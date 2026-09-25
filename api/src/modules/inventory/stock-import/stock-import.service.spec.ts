import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { BadRequestException } from "@nestjs/common";
import ExcelJS from "exceljs";
import type { PoolClient } from "pg";
import type { DatabaseService } from "../../../common/db/database.service";
import type { AuditService } from "../../../common/services/audit.service";
import type { AccessControlService } from "../../../common/services/access-control.service";
import { parseXlsxSheet } from "../imports/xlsx-import.parser";
import { StockImportRepository } from "./stock-import.repository";
import type { StockImportCatalogs } from "./stock-import.resolver";
import { StockImportService } from "./stock-import.service";

const TENANT = "tenant-1";
const ACTOR = { id: "user-1", tenantId: TENANT, roles: ["ADMIN"] };
const BRANCH = { id: "b-1", code: "PRINCIPAL", name: "Principal", isActive: true };
const PRODUCT = {
  id: "11111111-1111-4111-8111-111111111111",
  sku: "GASEOSA-1",
  name: "Gaseosa",
  isActive: true,
  requiresLot: false,
  requiresExpiration: false,
  cost: 1000,
};
const LOT_PRODUCT = {
  id: "22222222-2222-4222-8222-222222222222",
  sku: "LECHE-1",
  name: "Leche",
  isActive: true,
  requiresLot: true,
  requiresExpiration: true,
  cost: 2500,
};

async function workbook(rows: unknown[][]) {
  const book = new ExcelJS.Workbook();
  const sheet = book.addWorksheet("Carga_Inicial");
  rows.forEach((row) => sheet.addRow(row));
  return Buffer.from((await book.xlsx.writeBuffer()) as ArrayBuffer);
}

type Call = { method: string; args: unknown[] };

function setup(options: {
  stockOutside?: StockImportCatalogs["currentStock"];
  stockInside?: StockImportCatalogs["currentStock"];
  failOn?: string;
} = {}) {
  const calls: Call[] = [];
  const clientQueries: string[] = [];
  let released = false;
  const audits: unknown[] = [];

  const client = {
    query: async (text: string) => {
      clientQueries.push(text);
      return { rows: [] };
    },
    release: () => {
      released = true;
    },
  } as unknown as PoolClient;

  const record = (method: string) => async (...args: unknown[]) => {
    calls.push({ method, args });
    if (options.failOn === method) {
      throw new Error(`${method} failed`);
    }
    return undefined;
  };

  const repository = {
    listBranches: async () => [BRANCH],
    findProducts: async () => ({ products: [PRODUCT, LOT_PRODUCT], barcodes: [] }),
    currentStock: async (_tenant: string, _ids: string[], tx?: PoolClient) =>
      tx
        ? options.stockInside ?? options.stockOutside ?? []
        : options.stockOutside ?? [],
    listLots: async () => [],
    listTemplateProducts: async () => [
      { id: PRODUCT.id, sku: PRODUCT.sku, name: PRODUCT.name, requiresLot: false, stock: 7 },
      { id: LOT_PRODUCT.id, sku: LOT_PRODUCT.sku, name: LOT_PRODUCT.name, requiresLot: true, stock: 3 },
    ],
    listTemplateLots: async () => [
      { productId: LOT_PRODUCT.id, lotCode: "L-1", expirationDate: "2027-01-31", onHand: 3 },
    ],
    lockTenant: record("lockTenant"),
    insertLots: async (...args: unknown[]) => {
      calls.push({ method: "insertLots", args });
      const input = args[1] as { lots: Array<{ id: string; productId: string; branchId: string; lotCode: string }> };
      return new Map(input.lots.map((lot) => [`${lot.productId}|${lot.branchId}|${lot.lotCode}`, lot.id]));
    },
    insertMovements: record("insertMovements"),
    upsertLotBalances: record("upsertLotBalances"),
    insertMovementLots: record("insertMovementLots"),
  } as unknown as StockImportRepository;

  const db = { getClient: async () => client } as unknown as DatabaseService;
  const audit = { logEvent: (event: unknown) => audits.push(event) } as unknown as AuditService;
  const access = { canAccessBranch: async () => true } as unknown as AccessControlService;

  return {
    service: new StockImportService(repository, db, audit, access),
    repository: repository as unknown as Record<string, unknown>,
    calls,
    clientQueries,
    audits,
    isReleased: () => released,
  };
}

describe("StockImportService", () => {
  it("validate returns the resolved report", async () => {
    const { service } = setup({
      stockOutside: [{ productId: PRODUCT.id, branchId: BRANCH.id, quantity: 10 }],
    });
    const buffer = await workbook([["sku", "cantidad"], ["gaseosa-1", 25]]);

    const result = await service.validate(TENANT, ACTOR, buffer);

    assert.equal(result.report.canCommit, true);
    assert.equal(result.report.rows[0].delta, 15);
  });

  it("commit rejects files with errors without opening a transaction", async () => {
    const { service, clientQueries, calls } = setup();
    const buffer = await workbook([["sku", "cantidad"], ["NO-EXISTE", 1]]);

    await assert.rejects(service.commit(TENANT, ACTOR, buffer), BadRequestException);
    assert.equal(clientQueries.length, 0);
    assert.equal(calls.length, 0);
  });

  it("recalculates the stock inside the transaction before writing", async () => {
    const { service, calls, clientQueries, audits, isReleased } = setup({
      stockOutside: [{ productId: PRODUCT.id, branchId: BRANCH.id, quantity: 10 }],
      stockInside: [{ productId: PRODUCT.id, branchId: BRANCH.id, quantity: 20 }],
    });
    const buffer = await workbook([["sku", "cantidad"], ["GASEOSA-1", 25]]);

    const result = await service.commit(TENANT, ACTOR, buffer);

    assert.deepEqual(clientQueries, ["BEGIN", "COMMIT"]);
    assert.deepEqual(
      calls.map((call) => call.method),
      ["lockTenant", "insertMovements"]
    );
    const input = calls[1].args[1] as {
      referenceId: string;
      movements: Array<{ type: string; quantity: number; stockBefore: number; stockAfter: number }>;
    };
    assert.equal(input.movements.length, 1);
    assert.deepEqual(
      { ...input.movements[0], id: undefined, productId: undefined, branchId: undefined },
      { id: undefined, productId: undefined, branchId: undefined, type: "IN", quantity: 5, stockBefore: 20, stockAfter: 25 }
    );
    assert.equal(result.referenceId, input.referenceId);
    assert.equal(result.rows[0].delta, 5);
    assert.equal(audits.length, 1);
    assert.equal((audits[0] as { action: string }).action, "STOCK_INITIAL_LOAD");
    assert.equal(isReleased(), true);
  });

  it("rolls back when the recalculation finds new errors", async () => {
    const { service, clientQueries, calls } = setup({
      stockOutside: [{ productId: LOT_PRODUCT.id, branchId: BRANCH.id, quantity: 0 }],
    });
    const buffer = await workbook([
      ["sku", "cantidad", "lote_codigo", "fecha_vencimiento"],
      ["LECHE-1", 5, "L-1", "2027-01-31"],
    ]);
    let firstLots = true;
    (service as unknown as { repository: { listLots: () => Promise<unknown[]> } }).repository.listLots =
      async () => {
        if (firstLots) {
          firstLots = false;
          return [];
        }
        return [
          {
            id: "lot-1",
            productId: LOT_PRODUCT.id,
            branchId: BRANCH.id,
            lotCode: "L-1",
            expirationDate: "2027-01-31",
            status: "BLOCKED",
            onHand: 1,
            reserved: 0,
            balanceCount: 1,
            locationId: null,
          },
        ];
      };

    await assert.rejects(service.commit(TENANT, ACTOR, buffer), (error: unknown) => {
      const response = (error as BadRequestException).getResponse() as { report?: unknown };
      return error instanceof BadRequestException && Boolean(response.report);
    });
    assert.ok(clientQueries.includes("ROLLBACK"));
    assert.ok(!clientQueries.includes("COMMIT"));
    assert.deepEqual(calls.map((call) => call.method), ["lockTenant"]);
  });

  it("writes lots, movements, balances and links for lot products", async () => {
    const { service, calls } = setup();
    const buffer = await workbook([
      ["sku", "cantidad", "lote_codigo", "fecha_vencimiento", "costo_unitario"],
      ["LECHE-1", 6, "l-1", "2027-01-31", 2400],
    ]);

    await service.commit(TENANT, ACTOR, buffer);

    assert.deepEqual(
      calls.map((call) => call.method),
      ["lockTenant", "insertLots", "insertMovements", "upsertLotBalances", "insertMovementLots"]
    );
    const lots = (calls[1].args[1] as { lots: Array<{ lotCode: string; unitCost: number }> }).lots;
    assert.deepEqual(
      lots.map((lot) => [lot.lotCode, lot.unitCost]),
      [["L-1", 2400]]
    );
    const balances = (calls[3].args[1] as { balances: Array<{ quantityOnHand: number; locationId: string | null }> }).balances;
    assert.equal(balances[0].quantityOnHand, 6);
    assert.equal(balances[0].locationId, null);
  });

  it("adjusts an existing lot in the location that holds its balance", async () => {
    const { service, calls, repository } = setup();
    repository.listLots = async () => [
      {
        id: "lot-9",
        productId: LOT_PRODUCT.id,
        branchId: BRANCH.id,
        lotCode: "L-9",
        expirationDate: "2027-01-31",
        status: "ACTIVE",
        onHand: 10,
        reserved: 0,
        balanceCount: 1,
        locationId: "loc-1",
      },
    ];
    repository.currentStock = async () => [
      { productId: LOT_PRODUCT.id, branchId: BRANCH.id, quantity: 10 },
    ];
    const buffer = await workbook([
      ["sku", "cantidad", "lote_codigo"],
      [LOT_PRODUCT.sku, 7, "L-9"],
    ]);

    await service.commit(TENANT, ACTOR, buffer);

    assert.deepEqual(
      calls.map((call) => call.method),
      ["lockTenant", "insertMovements", "upsertLotBalances", "insertMovementLots"]
    );
    const balances = (calls[2].args[1] as { balances: Array<{ quantityOnHand: number; locationId: string | null }> }).balances;
    assert.deepEqual(balances.map((item) => [item.quantityOnHand, item.locationId]), [[7, "loc-1"]]);
    const links = (calls[3].args[1] as { links: Array<{ quantity: number; locationId: string | null }> }).links;
    assert.deepEqual(links.map((item) => [item.quantity, item.locationId]), [[3, "loc-1"]]);
  });

  it("does not write or audit when nothing changes", async () => {
    const { service, calls, audits } = setup({
      stockOutside: [{ productId: PRODUCT.id, branchId: BRANCH.id, quantity: 4 }],
    });
    const buffer = await workbook([["sku", "cantidad"], ["GASEOSA-1", 4]]);

    const result = await service.commit(TENANT, ACTOR, buffer);

    assert.equal(result.referenceId, null);
    assert.deepEqual(calls.map((call) => call.method), ["lockTenant"]);
    assert.equal(audits.length, 0);
  });

  it("rolls back and releases the client when a write fails", async () => {
    const { service, clientQueries, audits, isReleased } = setup({ failOn: "insertMovements" });
    const buffer = await workbook([["sku", "cantidad"], ["GASEOSA-1", 3]]);

    await assert.rejects(service.commit(TENANT, ACTOR, buffer), /insertMovements failed/);
    assert.deepEqual(clientQueries, ["BEGIN", "ROLLBACK"]);
    assert.equal(audits.length, 0);
    assert.equal(isReleased(), true);
  });

  it("builds a prefilled template that parses back unchanged", async () => {
    const { service } = setup({
      stockOutside: [
        { productId: PRODUCT.id, branchId: BRANCH.id, quantity: 7 },
        { productId: LOT_PRODUCT.id, branchId: BRANCH.id, quantity: 3 },
      ],
    });

    const buffer = await service.buildTemplate(TENANT, ACTOR, { prefill: true });
    const parsed = await parseXlsxSheet(buffer, {
      sheetNames: ["Carga_Inicial"],
      columns: ["sku", "cantidad", "lote_codigo"],
      required: ["sku", "cantidad"],
      maxRows: 10,
    });

    assert.deepEqual(
      parsed.rows.map((item) => [item.values.sku, item.values.cantidad, item.values.lote_codigo]),
      [
        ["GASEOSA-1", "7", undefined],
        ["LECHE-1", "3", "L-1"],
      ]
    );
  });
});

describe("StockImportRepository writes", () => {
  it("inserts movements in chunks of 500 rows", async () => {
    const queries: unknown[][] = [];
    const client = {
      query: async (_text: string, params: unknown[]) => {
        queries.push(params);
        return { rows: [] };
      },
    } as unknown as PoolClient;
    const repository = new StockImportRepository({} as DatabaseService);
    const movements = Array.from({ length: 1200 }, (_, index) => ({
      id: `m-${index}`,
      productId: "p",
      branchId: "b",
      type: "IN" as const,
      quantity: 1,
      stockBefore: 0,
      stockAfter: 1,
    }));

    await repository.insertMovements(client, {
      tenantId: TENANT,
      referenceId: "ref",
      userId: null,
      createdAt: new Date(),
      movements,
    });

    assert.equal(queries.length, 3);
    assert.deepEqual(
      queries.map((params) => (params[5] as string[]).length),
      [500, 500, 200]
    );
    assert.equal(queries[0][3], "stock_initial_load");
  });
});
