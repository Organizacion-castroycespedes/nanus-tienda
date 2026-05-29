import assert from "node:assert/strict";
import test from "node:test";
import { BadRequestException } from "@nestjs/common";
import { StockAdjustmentService } from "./stock-adjustment.service";

const ids = {
  tenant: "00000000-0000-0000-0000-000000000001",
  product: "10000000-0000-0000-0000-000000000001",
  branch: "20000000-0000-0000-0000-000000000001",
  user: "30000000-0000-0000-0000-000000000001",
  lot: "40000000-0000-0000-0000-000000000001",
  location: "50000000-0000-0000-0000-000000000001",
};

type Scenario = {
  productRequiresLot?: boolean;
  productRequiresExpiration?: boolean;
  productCost?: number;
  inLotStatus?: "ACTIVE" | "BLOCKED" | "CANCELLED";
  outLotMissing?: boolean;
  outLotStatus?: "ACTIVE" | "EXPIRED" | "BLOCKED" | "CANCELLED" | "CONSUMED";
  existingExpirationDate?: string | null;
  insufficientBalance?: boolean;
  locationBelongsToBranch?: boolean;
};

const tomorrow = () => {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
};

const yesterday = () => {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
};

class FakeClient {
  readonly queries: string[] = [];
  released = false;

  constructor(private readonly scenario: Scenario = {}) {}

  async query(text: string, params: unknown[] = []) {
    const trimmed = text.trim();
    this.queries.push(trimmed);

    if (["BEGIN", "COMMIT", "ROLLBACK"].includes(trimmed)) {
      return { rows: [] };
    }

    if (trimmed.includes("FROM products") && trimmed.includes("requires_lot")) {
      return {
        rows: [
          {
            id: params[0],
            cost: this.scenario.productCost ?? 900,
            requires_lot: this.scenario.productRequiresLot ?? false,
            requires_expiration:
              this.scenario.productRequiresExpiration ?? false,
          },
        ],
      };
    }

    throw new Error(`Unexpected query: ${trimmed}`);
  }

  release() {
    this.released = true;
  }
}

class FakeDatabaseService {
  readonly client: FakeClient;

  constructor(scenario: Scenario = {}) {
    this.client = new FakeClient(scenario);
  }

  async getClient() {
    return this.client;
  }
}

class FakeStockMovementService {
  readonly movements: any[] = [];
  readonly audits: any[] = [];

  async createMovement(data: any) {
    const movement = {
      ...data,
      stockBefore: data.type === "OUT" ? 10 : 0,
      stockAfter:
        data.type === "OUT"
          ? 10 - Number(data.quantity)
          : Number(data.quantity),
    };
    this.movements.push(movement);
    return movement;
  }

  logMovementAuditEvent(movement: any) {
    this.audits.push(movement);
  }
}

class FakeInventoryLotService {
  readonly inCalls: any[] = [];
  readonly outCalls: any[] = [];

  constructor(private readonly scenario: Scenario = {}) {}

  async findOrCreateForAdjustmentIn(input: any) {
    this.inCalls.push(input);

    if (
      this.scenario.inLotStatus === "BLOCKED" ||
      this.scenario.inLotStatus === "CANCELLED"
    ) {
      throw new BadRequestException("inventory lot cannot receive stock");
    }
    if (input.expirationDate && input.expirationDate < new Date().toISOString().slice(0, 10)) {
      throw new BadRequestException("ACTIVE lot cannot be expired");
    }
    if (
      this.scenario.existingExpirationDate &&
      input.expirationDate &&
      this.scenario.existingExpirationDate !== input.expirationDate
    ) {
      throw new BadRequestException(
        "expirationDate does not match existing lot"
      );
    }

    return {
      id: ids.lot,
      tenantId: input.tenantId,
      branchId: input.branchId,
      productId: input.productId,
      lotCode: input.lotCode,
      status: this.scenario.inLotStatus ?? "ACTIVE",
      expirationDate: input.expirationDate ?? null,
    };
  }

  async findForAdjustmentOut(input: any) {
    this.outCalls.push(input);

    if (this.scenario.outLotMissing) {
      throw new BadRequestException("inventory lot not found for adjustment");
    }
    if (
      this.scenario.outLotStatus === "BLOCKED" ||
      this.scenario.outLotStatus === "CANCELLED" ||
      this.scenario.outLotStatus === "CONSUMED"
    ) {
      throw new BadRequestException("inventory lot cannot be adjusted out");
    }
    if (
      this.scenario.existingExpirationDate &&
      input.expirationDate &&
      this.scenario.existingExpirationDate !== input.expirationDate
    ) {
      throw new BadRequestException(
        "expirationDate does not match existing lot"
      );
    }

    return {
      id: ids.lot,
      tenantId: input.tenantId,
      branchId: input.branchId,
      productId: input.productId,
      lotCode: input.lotCode,
      status: this.scenario.outLotStatus ?? "ACTIVE",
      expirationDate: this.scenario.existingExpirationDate ?? null,
    };
  }
}

class FakeInventoryLotBalanceService {
  readonly incrementCalls: any[] = [];
  readonly decrementCalls: any[] = [];

  constructor(private readonly scenario: Scenario = {}) {}

  async incrementOnHand(_tenantId: string, input: any) {
    if (
      input.locationId &&
      this.scenario.locationBelongsToBranch === false
    ) {
      throw new BadRequestException("locationId is invalid");
    }
    this.incrementCalls.push(input);
    return { id: "balance-in", quantityOnHand: input.quantity };
  }

  async decrementOnHand(_tenantId: string, input: any) {
    if (
      input.locationId &&
      this.scenario.locationBelongsToBranch === false
    ) {
      throw new BadRequestException("locationId is invalid");
    }
    if (this.scenario.insufficientBalance) {
      throw new BadRequestException("quantity exceeds available stock");
    }
    this.decrementCalls.push(input);
    return { id: "balance-out", quantityOnHand: 10 - input.quantity };
  }
}

class FakeStockMovementLotService {
  readonly calls: any[] = [];

  async createLink(input: any) {
    this.calls.push(input);
    return { id: "movement-lot", ...input };
  }
}

const createService = (scenario: Scenario = {}) => {
  const db = new FakeDatabaseService(scenario);
  const stockMovementService = new FakeStockMovementService();
  const inventoryLotService = new FakeInventoryLotService(scenario);
  const inventoryLotBalanceService = new FakeInventoryLotBalanceService(
    scenario
  );
  const stockMovementLotService = new FakeStockMovementLotService();
  const service = new StockAdjustmentService(
    db as any,
    stockMovementService as any,
    inventoryLotService as any,
    inventoryLotBalanceService as any,
    stockMovementLotService as any
  );

  return {
    db,
    stockMovementService,
    inventoryLotService,
    inventoryLotBalanceService,
    stockMovementLotService,
    service,
  };
};

const baseInput = () => ({
  tenantId: ids.tenant,
  productId: ids.product,
  branchId: ids.branch,
  type: "IN" as const,
  quantity: 5,
  reason: "Ajuste por conteo fisico",
  context: {
    tenantId: ids.tenant,
    branchId: ids.branch,
    userId: ids.user,
  },
});

test("creates non-lotted stock adjustment as current flow", async () => {
  const { service, stockMovementService, stockMovementLotService, db } =
    createService();

  const movement = await service.create(baseInput());

  assert.equal(movement.productId, ids.product);
  assert.equal(stockMovementService.movements.length, 1);
  assert.equal(stockMovementLotService.calls.length, 0);
  assert.deepEqual(db.client.queries.filter((query) => query === "COMMIT"), [
    "COMMIT",
  ]);
});

test("rejects lot data for non-lotted product", async () => {
  const { service, stockMovementService, db } = createService();

  await assert.rejects(
    () =>
      service.create({
        ...baseInput(),
        lotCode: "L-001",
      }),
    /lot data is not allowed/
  );
  assert.equal(stockMovementService.movements.length, 0);
  assert.ok(db.client.queries.includes("ROLLBACK"));
});

test("requires lotCode for lotted product", async () => {
  const { service } = createService({ productRequiresLot: true });

  await assert.rejects(() => service.create(baseInput()), /lotCode is required/);
});

test("requires expirationDate for lotted IN when product requires expiration", async () => {
  const { service } = createService({
    productRequiresLot: true,
    productRequiresExpiration: true,
  });

  await assert.rejects(
    () => service.create({ ...baseInput(), lotCode: "L-001" }),
    /expirationDate is required/
  );
});

test("lotted IN creates lot balance and stock_movement_lots", async () => {
  const {
    service,
    inventoryLotService,
    inventoryLotBalanceService,
    stockMovementLotService,
  } = createService({
    productRequiresLot: true,
    productRequiresExpiration: true,
  });

  await service.create({
    ...baseInput(),
    lotCode: " l-001 ",
    expirationDate: tomorrow(),
    locationId: ids.location,
  });

  assert.equal(inventoryLotService.inCalls[0].lotCode, "L-001");
  assert.equal(inventoryLotBalanceService.incrementCalls[0].lotId, ids.lot);
  assert.equal(stockMovementLotService.calls[0].lotId, ids.lot);
});

test("lotted IN reuses valid lot through lot service", async () => {
  const { service, inventoryLotService, inventoryLotBalanceService } =
    createService({
      productRequiresLot: true,
      existingExpirationDate: tomorrow(),
    });

  await service.create({
    ...baseInput(),
    lotCode: "L-REUSE",
    expirationDate: tomorrow(),
  });

  assert.equal(inventoryLotService.inCalls.length, 1);
  assert.equal(inventoryLotBalanceService.incrementCalls.length, 1);
});

test("lotted IN rejects BLOCKED lot and rolls back", async () => {
  const { service, db, stockMovementLotService } = createService({
    productRequiresLot: true,
    inLotStatus: "BLOCKED",
  });

  await assert.rejects(
    () => service.create({ ...baseInput(), lotCode: "L-BLOCK" }),
    /inventory lot cannot receive stock/
  );
  assert.ok(db.client.queries.includes("ROLLBACK"));
  assert.equal(stockMovementLotService.calls.length, 0);
});

test("lotted IN rejects CANCELLED lot and rolls back", async () => {
  const { service, db } = createService({
    productRequiresLot: true,
    inLotStatus: "CANCELLED",
  });

  await assert.rejects(
    () => service.create({ ...baseInput(), lotCode: "L-CANCEL" }),
    /inventory lot cannot receive stock/
  );
  assert.ok(db.client.queries.includes("ROLLBACK"));
});

test("lotted OUT requires existing lot", async () => {
  const { service } = createService({
    productRequiresLot: true,
    outLotMissing: true,
  });

  await assert.rejects(
    () =>
      service.create({
        ...baseInput(),
        type: "OUT",
        lotCode: "L-MISSING",
      }),
    /inventory lot not found/
  );
});

test("lotted OUT rejects insufficient lot balance", async () => {
  const { service, db } = createService({
    productRequiresLot: true,
    insufficientBalance: true,
  });

  await assert.rejects(
    () =>
      service.create({
        ...baseInput(),
        type: "OUT",
        lotCode: "L-LOW",
      }),
    /quantity exceeds available stock/
  );
  assert.ok(db.client.queries.includes("ROLLBACK"));
});

test("lotted OUT decrements balance", async () => {
  const { service, inventoryLotBalanceService } = createService({
    productRequiresLot: true,
  });

  await service.create({
    ...baseInput(),
    type: "OUT",
    lotCode: "L-OUT",
  });

  assert.equal(inventoryLotBalanceService.decrementCalls.length, 1);
  assert.equal(inventoryLotBalanceService.decrementCalls[0].quantity, 5);
});

test("lotted OUT creates stock_movement_lots with movement id", async () => {
  const { service, stockMovementService, stockMovementLotService } =
    createService({ productRequiresLot: true });

  await service.create({
    ...baseInput(),
    type: "OUT",
    lotCode: "L-OUT",
  });

  assert.equal(
    stockMovementLotService.calls[0].stockMovementId,
    stockMovementService.movements[0].id
  );
});

test("rejects location from another branch", async () => {
  const { service } = createService({
    productRequiresLot: true,
    locationBelongsToBranch: false,
  });

  await assert.rejects(
    () =>
      service.create({
        ...baseInput(),
        lotCode: "L-LOC",
        locationId: ids.location,
      }),
    /locationId is invalid/
  );
});

test("lotted OUT allows expired lot for physical correction", async () => {
  const { service, inventoryLotService, inventoryLotBalanceService } =
    createService({
      productRequiresLot: true,
      outLotStatus: "EXPIRED",
      existingExpirationDate: yesterday(),
    });

  await service.create({
    ...baseInput(),
    type: "OUT",
    lotCode: "L-EXPIRED",
  });

  assert.equal(inventoryLotService.outCalls.length, 1);
  assert.equal(inventoryLotBalanceService.decrementCalls.length, 1);
});

test("does not create stock_movement_lots for non-lotted product", async () => {
  const { service, stockMovementLotService } = createService();

  await service.create(baseInput());

  assert.equal(stockMovementLotService.calls.length, 0);
});

test("does not touch payment or cash queries", async () => {
  const { service, db } = createService();

  await service.create(baseInput());

  assert.equal(
    db.client.queries.some(
      (query) =>
        query.includes("payment_allocations") ||
        query.includes("cash") ||
        query.includes("caja")
    ),
    false
  );
});
