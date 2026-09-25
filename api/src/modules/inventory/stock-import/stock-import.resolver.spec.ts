import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  resolveStockImport,
  type StockImportCatalogs,
  type StockImportRawRow,
} from "./stock-import.resolver";

const TODAY = "2026-09-25";
const BRANCH = { id: "b-1", code: "PRINCIPAL", name: "Sede principal", isActive: true };
const PRODUCT_ID = "11111111-1111-4111-8111-111111111111";

function catalogs(overrides: Partial<StockImportCatalogs> = {}): StockImportCatalogs {
  return {
    branches: [BRANCH],
    accessibleBranchIds: new Set([BRANCH.id]),
    products: [
      {
        id: PRODUCT_ID,
        sku: "GASEOSA-1",
        name: "Gaseosa",
        isActive: true,
        requiresLot: false,
        requiresExpiration: false,
        cost: 1000,
      },
      {
        id: "p-lot",
        sku: "LECHE-1",
        name: "Leche",
        isActive: true,
        requiresLot: true,
        requiresExpiration: true,
        cost: 2500,
      },
    ],
    barcodes: [{ barcode: "7700000000001", productId: PRODUCT_ID }],
    currentStock: [{ productId: PRODUCT_ID, branchId: BRANCH.id, quantity: 10 }],
    lots: [],
    ...overrides,
  };
}

function row(rowNumber: number, values: StockImportRawRow["values"]): StockImportRawRow {
  return { rowNumber, values };
}

function resolve(rows: StockImportRawRow[], overrides: Partial<StockImportCatalogs> = {}) {
  return resolveStockImport(rows, catalogs(overrides), { today: TODAY });
}

describe("resolveStockImport", () => {
  it("plans IN, OUT and NONE against the current stock", () => {
    const report = resolve([
      row(2, { sku: "gaseosa-1", cantidad: "25" }),
    ]);
    assert.equal(report.rows[0].action, "IN");
    assert.equal(report.rows[0].before, 10);
    assert.equal(report.rows[0].delta, 15);
    assert.equal(report.rows[0].movementStockAfter, 25);

    const out = resolve([row(2, { sku: "GASEOSA-1", cantidad: "4" })]);
    assert.equal(out.rows[0].action, "OUT");
    assert.equal(out.rows[0].delta, -6);
    assert.ok(out.rows[0].warnings.some((message) => message.includes("baja de 10 a 4")));

    const none = resolve([row(2, { sku: "GASEOSA-1", cantidad: "10" })]);
    assert.equal(none.rows[0].action, "NONE");
    assert.equal(none.summary.unchanged, 1);
    assert.equal(none.canCommit, true);
  });

  it("finds products by barcode or producto_id", () => {
    const report = resolve([
      row(2, { codigo_barras: "7700000000001", cantidad: "12" }),
    ]);
    assert.equal(report.rows[0].productId, PRODUCT_ID);

    const byId = resolve([row(2, { producto_id: PRODUCT_ID, cantidad: "12" })]);
    assert.equal(byId.rows[0].productId, PRODUCT_ID);
  });

  it("rejects unknown products and conflicting identifiers", () => {
    const report = resolve([
      row(2, { sku: "NO-EXISTE", cantidad: "1" }),
      row(3, { producto_id: "10", cantidad: "1" }),
      row(4, { sku: "LECHE-1", codigo_barras: "7700000000001", cantidad: "1" }),
      row(5, { cantidad: "1" }),
    ]);
    assert.ok(report.rows[0].errors[0].includes("SKU"));
    assert.ok(report.rows[1].errors[0].includes("UUID"));
    assert.ok(report.rows[2].errors[0].includes("distintos"));
    assert.ok(report.rows[3].errors[0].includes("Falta el producto"));
    assert.equal(report.canCommit, false);
  });

  it("uses the only active branch when sucursal is empty", () => {
    const report = resolve([row(2, { sku: "GASEOSA-1", cantidad: "1" })]);
    assert.equal(report.rows[0].branchId, BRANCH.id);

    const second = { id: "b-2", code: "NORTE", name: "Norte", isActive: true };
    const ambiguous = resolve([row(2, { sku: "GASEOSA-1", cantidad: "1" })], {
      branches: [BRANCH, second],
      accessibleBranchIds: new Set([BRANCH.id, second.id]),
    });
    assert.ok(ambiguous.rows[0].errors[0].includes("más de una sucursal"));
  });

  it("rejects branches without access or inactive", () => {
    const noAccess = resolve([row(2, { sku: "GASEOSA-1", sucursal: "principal", cantidad: "1" })], {
      accessibleBranchIds: new Set(),
    });
    assert.ok(noAccess.rows[0].errors[0].includes("No tienes acceso"));

    const inactive = resolve([row(2, { sku: "GASEOSA-1", sucursal: "PRINCIPAL", cantidad: "1" })], {
      branches: [{ ...BRANCH, isActive: false }],
    });
    assert.ok(inactive.rows[0].errors[0].includes("inactiva"));
  });

  it("rejects duplicated product and branch rows", () => {
    const report = resolve([
      row(2, { sku: "GASEOSA-1", cantidad: "1" }),
      row(3, { sku: "GASEOSA-1", cantidad: "2" }),
    ]);
    assert.equal(report.rows[0].errors.length, 0);
    assert.ok(report.rows[1].errors[0].includes("fila 2"));
  });

  it("skips rows without quantity with a warning", () => {
    const report = resolve([row(2, { sku: "LECHE-1", sucursal: "PRINCIPAL" })]);
    assert.equal(report.rows[0].skipped, true);
    assert.equal(report.rows[0].action, "NONE");
    assert.deepEqual(report.rows[0].errors, []);
    assert.ok(report.rows[0].warnings[0].includes("se omite"));
    assert.equal(report.canCommit, true);
  });

  it("rejects negative or invalid quantities", () => {
    const report = resolve([
      row(2, { sku: "GASEOSA-1", cantidad: "-1" }),
      row(3, { sku: "GASEOSA-1", cantidad: "abc", sucursal: "PRINCIPAL" }),
    ]);
    assert.ok(report.rows[0].errors[0].includes("negativa"));
    assert.ok(report.rows[1].errors.some((message) => message.includes("número")));
  });

  it("rejects lot data and warns about cost for products without lot", () => {
    const report = resolve([
      row(2, { sku: "GASEOSA-1", cantidad: "1", lote_codigo: "L1" }),
    ]);
    assert.ok(report.rows[0].errors[0].includes("no maneja lote"));

    const cost = resolve([row(2, { sku: "GASEOSA-1", cantidad: "1", costo_unitario: "900" })]);
    assert.equal(cost.rows[0].errors.length, 0);
    assert.ok(cost.rows[0].warnings[0].includes("costo_unitario se ignora"));
  });

  it("requires lot code and expiration for lot products", () => {
    const report = resolve([
      row(2, { sku: "LECHE-1", cantidad: "5" }),
      row(3, { sku: "LECHE-1", cantidad: "5", lote_codigo: "l-1" }),
    ]);
    assert.ok(report.rows[0].errors[0].includes("lote_codigo es obligatorio"));
    assert.ok(report.rows[1].errors.some((message) => message.includes("requiere fecha_vencimiento")));
  });

  it("creates a new lot with the file cost or the product cost", () => {
    const report = resolve([
      row(2, { sku: "LECHE-1", cantidad: "5", lote_codigo: "l-1", fecha_vencimiento: "2027-01-31", costo_unitario: "2300" }),
      row(3, { sku: "LECHE-1", cantidad: "3", lote_codigo: "l-2", fecha_vencimiento: "2027-02-28" }),
    ]);
    assert.equal(report.canCommit, true);
    assert.deepEqual(report.rows[0].lot, {
      lotId: null,
      lotCode: "L-1",
      isNew: true,
      locationId: null,
      expirationDate: "2027-01-31",
      unitCost: 2300,
    });
    assert.equal(report.rows[1].lot?.unitCost, 2500);
    assert.equal(report.rows[1].movementStockBefore, 5);
    assert.equal(report.rows[1].movementStockAfter, 8);
  });

  it("rejects expired, mismatched or reserved lots", () => {
    const lot = {
      id: "lot-1",
      productId: "p-lot",
      branchId: BRANCH.id,
      lotCode: "L-1",
      expirationDate: "2027-01-31",
      status: "ACTIVE" as const,
      onHand: 8,
      reserved: 3,
      balanceCount: 1,
      locationId: null,
    };
    const overrides = {
      lots: [lot],
      currentStock: [{ productId: "p-lot", branchId: BRANCH.id, quantity: 8 }],
    };

    const expired = resolve([
      row(2, { sku: "LECHE-1", cantidad: "5", lote_codigo: "L-9", fecha_vencimiento: "2026-01-01" }),
    ]);
    assert.ok(expired.rows[0].errors.some((message) => message.includes("vencido")));

    const mismatch = resolve(
      [row(2, { sku: "LECHE-1", cantidad: "9", lote_codigo: "L-1", fecha_vencimiento: "2027-05-01" })],
      overrides
    );
    assert.ok(mismatch.rows[0].errors.some((message) => message.includes("no coincide")));

    const reserved = resolve(
      [row(2, { sku: "LECHE-1", cantidad: "2", lote_codigo: "L-1" })],
      overrides
    );
    assert.ok(reserved.rows[0].errors.some((message) => message.includes("reservado")));

    const ok = resolve([row(2, { sku: "LECHE-1", cantidad: "4", lote_codigo: "L-1" })], overrides);
    assert.equal(ok.rows[0].action, "OUT");
    assert.equal(ok.rows[0].delta, -4);
    assert.equal(ok.rows[0].lot?.lotId, "lot-1");
    assert.equal(ok.canCommit, true);
  });

  it("rejects blocked lots", () => {
    const blocked = resolve([row(2, { sku: "LECHE-1", cantidad: "10", lote_codigo: "L-1" })], {
      lots: [
        {
          id: "lot-1",
          productId: "p-lot",
          branchId: BRANCH.id,
          lotCode: "L-1",
          expirationDate: "2027-01-31",
          onHand: 8,
          reserved: 0,
          balanceCount: 1,
          locationId: null,
          status: "BLOCKED",
        },
      ],
      currentStock: [{ productId: "p-lot", branchId: BRANCH.id, quantity: 8 }],
    });
    assert.ok(blocked.rows[0].errors.some((message) => message.includes("BLOCKED")));
  });

  it("adjusts a lot kept in a single location and rejects changes split across locations", () => {
    const base = {
      id: "lot-1",
      productId: "p-lot",
      branchId: BRANCH.id,
      lotCode: "L-1",
      expirationDate: "2027-01-31",
      status: "ACTIVE" as const,
      onHand: 8,
      reserved: 0,
    };
    const currentStock = [{ productId: "p-lot", branchId: BRANCH.id, quantity: 8 }];

    const single = resolve([row(2, { sku: "LECHE-1", cantidad: "10", lote_codigo: "L-1" })], {
      lots: [{ ...base, balanceCount: 1, locationId: "loc-1" }],
      currentStock,
    });
    assert.equal(single.canCommit, true);
    assert.equal(single.rows[0].before, 8);
    assert.equal(single.rows[0].delta, 2);
    assert.equal(single.rows[0].lot?.locationId, "loc-1");

    const splitUnchanged = resolve([row(2, { sku: "LECHE-1", cantidad: "8", lote_codigo: "L-1" })], {
      lots: [{ ...base, balanceCount: 2, locationId: "loc-1" }],
      currentStock,
    });
    assert.equal(splitUnchanged.canCommit, true);
    assert.equal(splitUnchanged.rows[0].action, "NONE");

    const splitChanged = resolve([row(2, { sku: "LECHE-1", cantidad: "10", lote_codigo: "L-1" })], {
      lots: [{ ...base, balanceCount: 2, locationId: "loc-1" }],
      currentStock,
    });
    assert.ok(splitChanged.rows[0].errors.some((message) => message.includes("varias ubicaciones")));
  });

  it("rejects movements that leave the branch stock negative", () => {
    const report = resolve([row(2, { sku: "LECHE-1", cantidad: "0", lote_codigo: "L-1" })], {
      lots: [
        {
          id: "lot-1",
          productId: "p-lot",
          branchId: BRANCH.id,
          lotCode: "L-1",
          expirationDate: "2027-01-31",
          status: "ACTIVE",
          onHand: 5,
          reserved: 0,
          balanceCount: 1,
          locationId: null,
        },
      ],
      currentStock: [{ productId: "p-lot", branchId: BRANCH.id, quantity: 2 }],
    });
    assert.ok(report.rows[0].errors.some((message) => message.includes("negativo")));
  });

  it("summarizes quantities", () => {
    const report = resolve([
      row(2, { sku: "GASEOSA-1", cantidad: "15" }),
      row(3, { sku: "LECHE-1", cantidad: "4", lote_codigo: "L-5", fecha_vencimiento: "2027-03-01" }),
    ]);
    assert.equal(report.summary.in, 2);
    assert.equal(report.summary.quantityIn, 9);
    assert.equal(report.summary.quantityOut, 0);
  });
});
