import assert from "node:assert/strict";
import test from "node:test";
import { BadRequestException } from "@nestjs/common";
import type { PoolClient } from "pg";
import { SaleService } from "./sale.service";

const ids = {
  tenant: "10000000-0000-0000-0000-000000000001",
  branch: "10000000-0000-0000-0000-000000000002",
  terminal: "10000000-0000-0000-0000-000000000003",
  user: "10000000-0000-0000-0000-000000000004",
  customer: "10000000-0000-0000-0000-000000000005",
  sale: "10000000-0000-0000-0000-000000000006",
  product: "10000000-0000-0000-0000-000000000007",
  movementOut: "10000000-0000-0000-0000-000000000008",
  movementIn: "10000000-0000-0000-0000-000000000009",
  lot: "10000000-0000-0000-0000-000000000010",
  balance: "10000000-0000-0000-0000-000000000011",
  location: "10000000-0000-0000-0000-000000000012",
  link: "10000000-0000-0000-0000-000000000013",
};

type Scenario = {
  saleStatus?: "DRAFT" | "CONFIRMED" | "CANCELLED" | "REFUNDED";
  requiresLot?: boolean;
  links?: Array<{
    lotStatus?: "ACTIVE" | "EXPIRED" | "BLOCKED" | "CONSUMED" | "CANCELLED";
    quantity?: number;
    locationId?: string | null;
  }>;
};

type RecordedQuery = {
  text: string;
  params: unknown[];
};

const saleRow = (status: Scenario["saleStatus"] = "CONFIRMED") => ({
  id: ids.sale,
  tenant_id: ids.tenant,
  branch_id: ids.branch,
  terminal_id: ids.terminal,
  user_id: ids.user,
  pos_session_id: null,
  customer_id: ids.customer,
  order_id: null,
  type: "CASH",
  status,
  total: 3000,
  balance: 0,
  payment_status: "PAID",
  total_paid: 3000,
  balance_due: 0,
  created_at: new Date("2026-05-28T00:00:00.000Z"),
  customer_name: "Cliente prueba",
});

const saleItemRow = {
  id: "10000000-0000-0000-0000-000000000014",
  tenant_id: ids.tenant,
  sale_id: ids.sale,
  product_id: ids.product,
  order_item_id: null,
  quantity: 3,
  price: 1000,
  price_without_tax: 1000,
  tax_total: 0,
  subtotal: 3000,
  created_at: new Date("2026-05-28T00:00:00.000Z"),
};

const movementOutRow = {
  id: ids.movementOut,
  product_id: ids.product,
  quantity: 3,
  branch_id: ids.branch,
  terminal_id: ids.terminal,
  pos_session_code: "POS-1",
  user_id: ids.user,
};

class FakeCancelClient {
  readonly queries: RecordedQuery[] = [];
  readonly balanceUpdates: RecordedQuery[] = [];
  readonly reverseLotLinks: RecordedQuery[] = [];
  released = false;

  constructor(private readonly scenario: Scenario = {}) {}

  async query<T>(text: string, params: unknown[] = []) {
    this.queries.push({ text, params });
    const sql = text.replace(/\s+/g, " ").trim();

    if (sql === "BEGIN" || sql === "COMMIT" || sql === "ROLLBACK") {
      return { rows: [] as T[] };
    }

    if (sql.includes("FROM sales s") && sql.includes("FOR UPDATE")) {
      return { rows: [saleRow(this.scenario.saleStatus)] as T[] };
    }

    if (
      sql.includes("FROM sale_items") &&
      !sql.includes("sale_item_id IN")
    ) {
      return { rows: [saleItemRow] as T[] };
    }

    if (
      sql.includes("FROM stock_movements") &&
      sql.includes("reference_type = 'SALE'")
    ) {
      return { rows: [movementOutRow] as T[] };
    }

    if (sql.includes("FROM stock_movement_lots AS sml")) {
      const links = (this.scenario.links ?? []).map((link, index) => ({
        id: `${ids.link.slice(0, -1)}${index}`,
        product_id: ids.product,
        lot_id: ids.lot,
        location_id: link.locationId === undefined ? ids.location : link.locationId,
        quantity: link.quantity ?? 3,
        lot_status: link.lotStatus ?? "ACTIVE",
        lot_branch_id: ids.branch,
        lot_product_id: ids.product,
      }));
      return { rows: links as T[] };
    }

    if (sql.includes("SELECT id, requires_lot FROM products")) {
      return {
        rows: [
          {
            id: ids.product,
            requires_lot: this.scenario.requiresLot ?? false,
          },
        ] as T[],
      };
    }

    if (sql.includes("FROM inventory_lots") && sql.includes("FOR UPDATE")) {
      return {
        rows: [
          {
            id: ids.lot,
            status: this.scenario.links?.[0]?.lotStatus ?? "ACTIVE",
            branch_id: ids.branch,
            product_id: ids.product,
          },
        ] as T[],
      };
    }

    if (sql.startsWith("UPDATE inventory_lot_balances AS balance")) {
      this.balanceUpdates.push({ text, params });
      return { rows: [{ id: ids.balance }] as T[] };
    }

    if (sql.startsWith("INSERT INTO stock_movement_lots")) {
      this.reverseLotLinks.push({ text, params });
      return { rows: [] as T[] };
    }

    if (sql.startsWith("UPDATE sales")) {
      return { rows: [] as T[] };
    }

    throw new Error(`Unexpected SQL in test: ${sql}`);
  }

  release() {
    this.released = true;
  }
}

const buildService = (scenario: Scenario = {}) => {
  const client = new FakeCancelClient(scenario);
  const createdMovements: unknown[] = [];

  const service = new SaleService(
    {
      getClient: async () => client as unknown as PoolClient,
    } as never,
    {} as never,
    {} as never,
    {
      createMovement: async (data: unknown) => {
        createdMovements.push(data);
        return { ...(data as object), id: ids.movementIn };
      },
    } as never,
    {
      findAccessibleBranchIds: async () => [],
    } as never,
    {
      listAllocatedPayments: async () => [],
    } as never,
    {} as never
  );

  (service as unknown as { getSaleById: () => Promise<unknown> }).getSaleById =
    async () => ({ id: ids.sale, status: "CANCELLED" });

  return { service, client, createdMovements };
};

const actor = {
  tenantId: ids.tenant,
  userId: ids.user,
  roles: ["SUPER_ADMIN"],
};

test("SaleService.cancelSale keeps non-lotted cancellation without lot mutations", async () => {
  const { service, client, createdMovements } = buildService({
    requiresLot: false,
    links: [],
  });

  await service.cancelSale(ids.sale, actor);

  assert.equal(createdMovements.length, 1);
  assert.equal(client.balanceUpdates.length, 0);
  assert.equal(client.reverseLotLinks.length, 0);
  assert(
    client.queries.some((query) => query.text.replace(/\s+/g, " ").trim() === "COMMIT")
  );
});

test("SaleService.cancelSale restores original lot balance and creates reverse stock_movement_lots", async () => {
  const { service, client, createdMovements } = buildService({
    links: [{ lotStatus: "ACTIVE", quantity: 3 }],
  });

  await service.cancelSale(ids.sale, actor);

  assert.equal(createdMovements.length, 1);
  assert.equal(client.balanceUpdates.length, 1);
  assert.equal(client.balanceUpdates[0].params[3], ids.lot);
  assert.equal(client.balanceUpdates[0].params[4], 3);
  assert.equal(client.reverseLotLinks.length, 1);
  assert.equal(client.reverseLotLinks[0].params[2], ids.movementIn);
  assert.equal(client.reverseLotLinks[0].params[4], ids.lot);
  assert.equal(client.reverseLotLinks[0].params[6], 3);
});

test("SaleService.cancelSale allows reversal into BLOCKED lot", async () => {
  const { service, client } = buildService({
    links: [{ lotStatus: "BLOCKED", quantity: 3 }],
  });

  await service.cancelSale(ids.sale, actor);

  assert.equal(client.balanceUpdates.length, 1);
  assert.equal(client.reverseLotLinks.length, 1);
});

test("SaleService.cancelSale rejects CANCELLED lot and rolls back", async () => {
  const { service, client } = buildService({
    links: [{ lotStatus: "CANCELLED", quantity: 3 }],
  });

  await assert.rejects(
    () => service.cancelSale(ids.sale, actor),
    (error) =>
      error instanceof BadRequestException &&
      error.message === "CANCELLED lot cannot be reversed automatically"
  );

  assert.equal(client.balanceUpdates.length, 0);
  assert.equal(client.reverseLotLinks.length, 0);
  assert(
    client.queries.some((query) => query.text.replace(/\s+/g, " ").trim() === "ROLLBACK")
  );
});

test("SaleService.cancelSale rejects lotted sale movement without lot links", async () => {
  const { service, client } = buildService({
    requiresLot: true,
    links: [],
  });

  await assert.rejects(
    () => service.cancelSale(ids.sale, actor),
    (error) =>
      error instanceof BadRequestException &&
      error.message ===
        "lotted sale movement is missing stock_movement_lots for reversal"
  );

  assert.equal(client.balanceUpdates.length, 0);
  assert.equal(client.reverseLotLinks.length, 0);
  assert(
    client.queries.some((query) => query.text.replace(/\s+/g, " ").trim() === "ROLLBACK")
  );
});

test("SaleService.cancelSale does not duplicate reversal when sale is already cancelled", async () => {
  const { service, client, createdMovements } = buildService({
    saleStatus: "CANCELLED",
    links: [{ lotStatus: "ACTIVE", quantity: 3 }],
  });

  await service.cancelSale(ids.sale, actor);

  assert.equal(createdMovements.length, 0);
  assert.equal(client.balanceUpdates.length, 0);
  assert.equal(client.reverseLotLinks.length, 0);
  assert(
    client.queries.some((query) => query.text.replace(/\s+/g, " ").trim() === "COMMIT")
  );
});

test("SaleService.normalizeSaleContext preserves roles for explicit POS context", async () => {
  const { service } = buildService();

  const normalized = await (
    service as unknown as {
      normalizeSaleContext: (context: unknown) => Promise<{
        tenantId: string;
        userId: string;
        branchId: string;
        terminalId: string;
        posSessionId: string;
        sessionId?: string;
        roles: string[];
      }>;
    }
  ).normalizeSaleContext({
    tenantId: ids.tenant,
    userId: ids.user,
    branchId: ids.branch,
    terminalId: ids.terminal,
    posSessionId: "10000000-0000-0000-0000-000000000015",
    sessionId: "10000000-0000-0000-0000-000000000016",
    roles: ["SUPER_ADMIN"],
  });

  assert.deepEqual(normalized.roles, ["SUPER_ADMIN"]);
  assert.equal(normalized.sessionId, "10000000-0000-0000-0000-000000000016");
});

test("SaleService.normalizeSaleContext preserves roles when POS context is resolved", async () => {
  const { service } = buildService();
  const repository = (
    service as unknown as {
      repository: {
        findCurrentPosContext: () => Promise<{
          branch_id: string;
          terminal_id: string;
          pos_session_id: string;
        }>;
      };
    }
  ).repository;
  repository.findCurrentPosContext = async () => ({
    branch_id: ids.branch,
    terminal_id: ids.terminal,
    pos_session_id: "10000000-0000-0000-0000-000000000015",
  });

  const normalized = await (
    service as unknown as {
      normalizeSaleContext: (context: unknown) => Promise<{
        branchId: string;
        terminalId: string;
        posSessionId: string;
        sessionId?: string;
        roles: string[];
      }>;
    }
  ).normalizeSaleContext({
    tenantId: ids.tenant,
    userId: ids.user,
    sessionId: "10000000-0000-0000-0000-000000000016",
    roles: ["ADMIN", "USER"],
  });

  assert.equal(normalized.branchId, ids.branch);
  assert.deepEqual(normalized.roles, ["ADMIN", "USER"]);
  assert.equal(normalized.sessionId, "10000000-0000-0000-0000-000000000016");
});
