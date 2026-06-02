import assert from "node:assert/strict";
import test from "node:test";
import { InventoryFefoService } from "./inventory-fefo.service";
import type {
  InventoryFefoEligibleBalance,
  InventoryFefoProductPolicy,
} from "../repositories/inventory-fefo.repository";

const ids = {
  tenant: "00000000-0000-0000-0000-000000000001",
  product: "10000000-0000-0000-0000-000000000001",
  branch: "20000000-0000-0000-0000-000000000001",
  location: "30000000-0000-0000-0000-000000000001",
  otherLocation: "30000000-0000-0000-0000-000000000002",
  user: "40000000-0000-0000-0000-000000000001",
};

type Scenario = {
  product?: InventoryFefoProductPolicy | null;
  branchValid?: boolean;
  locationValid?: boolean;
  balances?: InventoryFefoEligibleBalance[];
};

const actor = {
  roles: ["SUPER_ADMIN"],
  userId: ids.user,
  tenantId: ids.tenant,
};

const daysFromNow = (days: number) => {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return new Date(`${date.toISOString().slice(0, 10)}T00:00:00.000Z`);
};

const balance = (
  overrides: Partial<InventoryFefoEligibleBalance> = {}
): InventoryFefoEligibleBalance => ({
  lotId: overrides.lotId ?? "50000000-0000-0000-0000-000000000001",
  lotCode: overrides.lotCode ?? "L-001",
  expirationDate:
    overrides.expirationDate === undefined
      ? daysFromNow(30)
      : overrides.expirationDate,
  receivedAt: overrides.receivedAt ?? new Date("2026-01-01T00:00:00.000Z"),
  locationId:
    overrides.locationId === undefined ? null : overrides.locationId,
  quantityAvailable: overrides.quantityAvailable ?? 10,
  status: overrides.status ?? "ACTIVE",
});

class FakeInventoryFefoRepository {
  readonly calls: string[] = [];

  constructor(private readonly scenario: Scenario = {}) {}

  async validateProductForTenant() {
    this.calls.push("validateProductForTenant");
    if (this.scenario.product === null) {
      return null;
    }
    return (
      this.scenario.product ?? {
        id: ids.product,
        tenantId: ids.tenant,
        requiresLot: true,
        requiresExpiration: false,
      }
    );
  }

  async validateBranchForTenant() {
    this.calls.push("validateBranchForTenant");
    return this.scenario.branchValid ?? true;
  }

  async validateLocationForTenantBranch() {
    this.calls.push("validateLocationForTenantBranch");
    return this.scenario.locationValid ?? true;
  }

  async findEligibleBalances() {
    this.calls.push("findEligibleBalances");
    return this.scenario.balances ?? [];
  }
}

class FakeFinanceAccessRepository {
  async findAccessibleBranchIds() {
    return [ids.branch];
  }
}

const createService = (scenario: Scenario = {}) => {
  const repository = new FakeInventoryFefoRepository(scenario);
  const financeAccessRepository = new FakeFinanceAccessRepository();
  const service = new InventoryFefoService(
    repository as any,
    financeAccessRepository as any
  );

  return { service, repository };
};

const baseInput = () => ({
  tenantId: ids.tenant,
  branchId: ids.branch,
  productId: ids.product,
  quantity: 5,
});

test("rejects quantity below or equal to zero", async () => {
  const { service } = createService();

  await assert.rejects(
    () => service.selectLotsForConsumption({ ...baseInput(), quantity: 0 }),
    /quantity must be greater than zero/
  );
});

test("rejects product from another tenant", async () => {
  const { service } = createService({ product: null });

  await assert.rejects(
    () => service.selectLotsForConsumption(baseInput()),
    /productId is invalid/
  );
});

test("rejects branch from another tenant", async () => {
  const { service } = createService({ branchValid: false });

  await assert.rejects(
    () => service.selectLotsForConsumption(baseInput(), actor),
    /branchId is invalid/
  );
});

test("rejects non-lotted product", async () => {
  const { service } = createService({
    product: {
      id: ids.product,
      tenantId: ids.tenant,
      requiresLot: false,
      requiresExpiration: false,
    },
  });

  await assert.rejects(
    () => service.selectLotsForConsumption(baseInput()),
    /FEFO applies only to products with lot control/
  );
});

test("selects one sufficient lot", async () => {
  const { service } = createService({
    balances: [balance({ quantityAvailable: 10 })],
  });

  const result = await service.selectLotsForConsumption(baseInput(), actor);

  assert.equal(result.canFulfill, true);
  assert.equal(result.selectedQuantity, 5);
  assert.equal(result.missingQuantity, 0);
  assert.equal(result.selections.length, 1);
  assert.equal(result.selections[0].quantityToConsume, 5);
});

test("selects several lots in FEFO order", async () => {
  const { service } = createService({
    balances: [
      balance({
        lotId: "50000000-0000-0000-0000-000000000003",
        lotCode: "L-003",
        expirationDate: daysFromNow(20),
        receivedAt: new Date("2026-01-03T00:00:00.000Z"),
        quantityAvailable: 5,
      }),
      balance({
        lotId: "50000000-0000-0000-0000-000000000001",
        lotCode: "L-001",
        expirationDate: daysFromNow(10),
        receivedAt: new Date("2026-01-02T00:00:00.000Z"),
        quantityAvailable: 3,
      }),
      balance({
        lotId: "50000000-0000-0000-0000-000000000002",
        lotCode: "L-002",
        expirationDate: daysFromNow(10),
        receivedAt: new Date("2026-01-01T00:00:00.000Z"),
        quantityAvailable: 4,
      }),
    ],
  });

  const result = await service.selectLotsForConsumption(
    { ...baseInput(), quantity: 8 },
    actor
  );

  assert.deepEqual(
    result.selections.map((selection) => selection.lotCode),
    ["L-002", "L-001", "L-003"]
  );
  assert.deepEqual(
    result.selections.map((selection) => selection.quantityToConsume),
    [4, 3, 1]
  );
});

test("excludes expired lot", async () => {
  const { service } = createService({
    balances: [
      balance({ lotCode: "OLD", expirationDate: daysFromNow(-1) }),
      balance({ lotCode: "NEW", expirationDate: daysFromNow(5) }),
    ],
  });

  const result = await service.selectLotsForConsumption(baseInput(), actor);

  assert.deepEqual(
    result.selections.map((selection) => selection.lotCode),
    ["NEW"]
  );
});

test("excludes blocked cancelled and consumed lots", async () => {
  const { service } = createService({
    balances: [
      balance({ lotCode: "BLOCK", status: "BLOCKED" }),
      balance({ lotCode: "CANCEL", status: "CANCELLED" }),
      balance({ lotCode: "CONSUMED", status: "CONSUMED" }),
      balance({ lotCode: "ACTIVE", status: "ACTIVE" }),
    ],
  });

  const result = await service.selectLotsForConsumption(baseInput(), actor);

  assert.deepEqual(
    result.selections.map((selection) => selection.lotCode),
    ["ACTIVE"]
  );
});

test("excludes balances without available quantity", async () => {
  const { service } = createService({
    balances: [
      balance({ lotCode: "ZERO", quantityAvailable: 0 }),
      balance({ lotCode: "NEG", quantityAvailable: -1 }),
      balance({ lotCode: "OK", quantityAvailable: 6 }),
    ],
  });

  const result = await service.selectLotsForConsumption(baseInput(), actor);

  assert.deepEqual(
    result.selections.map((selection) => selection.lotCode),
    ["OK"]
  );
});

test("respects locationId", async () => {
  const { service, repository } = createService({
    balances: [
      balance({ lotCode: "A", locationId: ids.location }),
      balance({ lotCode: "B", locationId: ids.otherLocation }),
    ],
  });

  const result = await service.selectLotsForConsumption(
    { ...baseInput(), locationId: ids.location },
    actor
  );

  assert.deepEqual(
    result.selections.map((selection) => selection.lotCode),
    ["A"]
  );
  assert.ok(repository.calls.includes("validateLocationForTenantBranch"));
});

test("returns cannot fulfill when stock is insufficient", async () => {
  const { service } = createService({
    balances: [balance({ quantityAvailable: 2 })],
  });

  const result = await service.selectLotsForConsumption(
    { ...baseInput(), quantity: 5 },
    actor
  );

  assert.equal(result.canFulfill, false);
  assert.equal(result.selectedQuantity, 2);
  assert.equal(result.missingQuantity, 3);
});

test("requires expirationDate for products requiring expiration", async () => {
  const { service } = createService({
    product: {
      id: ids.product,
      tenantId: ids.tenant,
      requiresLot: true,
      requiresExpiration: true,
    },
    balances: [balance({ expirationDate: null })],
  });

  await assert.rejects(
    () => service.selectLotsForConsumption(baseInput(), actor),
    /FEFO inconsistency: expirationDate is required/
  );
});

test("does not call balance mutation methods", async () => {
  const { service, repository } = createService({
    balances: [balance({ quantityAvailable: 10 })],
  });

  await service.selectLotsForConsumption(baseInput(), actor);

  assert.equal(
    repository.calls.some((call) =>
      ["create", "update", "delete", "reserve", "decrementOnHand"].includes(call)
    ),
    false
  );
});

test("does not create stock movements or movement lot links", async () => {
  const { service, repository } = createService({
    balances: [balance({ quantityAvailable: 10 })],
  });

  await service.selectLotsForConsumption(baseInput(), actor);

  assert.equal(
    repository.calls.some((call) =>
      ["createMovement", "createLink", "stock_movement_lots"].includes(call)
    ),
    false
  );
});
