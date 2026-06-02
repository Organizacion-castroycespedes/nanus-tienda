import assert from "node:assert/strict";
import test from "node:test";
import { InventoryLotReconciliationService } from "./inventory-lot-reconciliation.service";
import type {
  InventoryLotDiscrepancyRecord,
  InventoryLotDiscrepancyType,
  InventoryLotReconciliationFilters,
} from "../repositories/inventory-lot-reconciliation.repository";

const ids = {
  tenant: "00000000-0000-0000-0000-000000000001",
  product: "10000000-0000-0000-0000-000000000001",
  lot: "20000000-0000-0000-0000-000000000001",
  branch: "30000000-0000-0000-0000-000000000001",
  movement: "40000000-0000-0000-0000-000000000001",
  link: "50000000-0000-0000-0000-000000000001",
  balance: "60000000-0000-0000-0000-000000000001",
  user: "70000000-0000-0000-0000-000000000001",
};

const actor = {
  roles: ["SUPER_ADMIN"],
  userId: ids.user,
  tenantId: ids.tenant,
};

const discrepancy = (
  type: InventoryLotDiscrepancyType
): InventoryLotDiscrepancyRecord => ({
  discrepancyType: type,
  tenantId: ids.tenant,
  branchId: ids.branch,
  productId: ids.product,
  lotId: ids.lot,
  stockMovementId: ids.movement,
  stockMovementLotId: ids.link,
  balanceId: ids.balance,
  expectedQuantity: 10,
  actualQuantity: 5,
  quantityDelta: 5,
  message: type,
  detectedAt: new Date("2026-05-28T00:00:00.000Z"),
});

class FakeRepository {
  readonly calls: Array<{
    method: string;
    tenantId: string;
    filters: InventoryLotReconciliationFilters;
  }> = [];

  constructor(
    private readonly discrepancies: InventoryLotDiscrepancyRecord[] = []
  ) {}

  async getSummary(
    tenantId: string,
    filters: InventoryLotReconciliationFilters
  ) {
    this.calls.push({ method: "getSummary", tenantId, filters });
    return {
      totalProductsChecked: 2,
      totalLotsChecked: 3,
      totalBalancesChecked: 4,
      totalMovementsChecked: 5,
      totalLinksChecked: 6,
    };
  }

  async findDiscrepancies(
    tenantId: string,
    filters: InventoryLotReconciliationFilters
  ) {
    this.calls.push({ method: "findDiscrepancies", tenantId, filters });
    return filters.discrepancyType
      ? this.discrepancies.filter(
          (item) => item.discrepancyType === filters.discrepancyType
        )
      : this.discrepancies;
  }

  async getProductReconciliation(
    tenantId: string,
    productId: string,
    filters: InventoryLotReconciliationFilters
  ) {
    this.calls.push({ method: "getProductReconciliation", tenantId, filters });
    return {
      productId,
      requiresLot: true,
      aggregateStockQuantity: 10,
      linkedQuantity: 5,
      balanceQuantity: 5,
      lotCount: 1,
      balanceCount: 1,
      movementCount: 1,
      linkCount: 1,
    };
  }

  async getLotReconciliation(
    tenantId: string,
    lotId: string,
    filters: InventoryLotReconciliationFilters
  ) {
    this.calls.push({ method: "getLotReconciliation", tenantId, filters });
    return {
      lotId,
      branchId: ids.branch,
      productId: ids.product,
      status: "ACTIVE",
      expirationDate: null,
      linkedQuantity: 5,
      balanceQuantity: 5,
      balanceAvailableQuantity: 5,
      balanceCount: 1,
      linkCount: 1,
    };
  }
}

class FakeFinanceAccessRepository {
  readonly branches: string[] = [ids.branch];

  async findBranchById(branchId: string, tenantId: string) {
    return this.branches.includes(branchId)
      ? { id: branchId, tenant_id: tenantId }
      : null;
  }

  async findAccessibleBranchIds() {
    return this.branches;
  }
}

const createService = (
  discrepancies: InventoryLotDiscrepancyRecord[] = []
) => {
  const repository = new FakeRepository(discrepancies);
  const financeAccessRepository = new FakeFinanceAccessRepository();
  const service = new InventoryLotReconciliationService(
    repository as any,
    financeAccessRepository as any
  );

  return { service, repository, financeAccessRepository };
};

test("summary without discrepancies returns zero severity counts", async () => {
  const { service } = createService();

  const summary = await service.getSummary(ids.tenant, {}, actor);

  assert.equal(summary.totalProductsChecked, 2);
  assert.equal(summary.discrepancyCount, 0);
  assert.equal(summary.criticalCount, 0);
  assert.equal(summary.highCount, 0);
  assert.equal(summary.warningCount, 0);
  assert.equal(summary.infoCount, 0);
});

test("detects lot-required movement without lot link", async () => {
  const { service } = createService([
    discrepancy("LOT_REQUIRED_MOVEMENT_WITHOUT_LOT_LINK"),
  ]);

  const rows = await service.findDiscrepancies(ids.tenant, {}, actor);

  assert.equal(rows[0].discrepancyType, "LOT_REQUIRED_MOVEMENT_WITHOUT_LOT_LINK");
  assert.equal(rows[0].severity, "HIGH");
});

test("detects link without movement", async () => {
  const { service } = createService([discrepancy("LOT_LINK_WITHOUT_MOVEMENT")]);

  const rows = await service.findDiscrepancies(ids.tenant, {}, actor);

  assert.equal(rows[0].discrepancyType, "LOT_LINK_WITHOUT_MOVEMENT");
  assert.equal(rows[0].severity, "HIGH");
});

test("detects product mismatch", async () => {
  const { service } = createService([discrepancy("LOT_LINK_PRODUCT_MISMATCH")]);

  const rows = await service.findDiscrepancies(ids.tenant, {}, actor);

  assert.equal(rows[0].discrepancyType, "LOT_LINK_PRODUCT_MISMATCH");
  assert.equal(rows[0].severity, "HIGH");
});

test("detects tenant mismatch", async () => {
  const { service } = createService([discrepancy("LOT_LINK_TENANT_MISMATCH")]);

  const rows = await service.findDiscrepancies(ids.tenant, {}, actor);

  assert.equal(rows[0].discrepancyType, "LOT_LINK_TENANT_MISMATCH");
  assert.equal(rows[0].severity, "CRITICAL");
});

test("detects balance without lot", async () => {
  const { service } = createService([discrepancy("LOT_BALANCE_WITHOUT_LOT")]);

  const rows = await service.findDiscrepancies(ids.tenant, {}, actor);

  assert.equal(rows[0].discrepancyType, "LOT_BALANCE_WITHOUT_LOT");
  assert.equal(rows[0].severity, "HIGH");
});

test("detects balance branch or product mismatch", async () => {
  const { service } = createService([
    discrepancy("LOT_BALANCE_PRODUCT_BRANCH_MISMATCH"),
  ]);

  const rows = await service.findDiscrepancies(ids.tenant, {}, actor);

  assert.equal(rows[0].discrepancyType, "LOT_BALANCE_PRODUCT_BRANCH_MISMATCH");
  assert.equal(rows[0].severity, "HIGH");
});

test("detects reserved above onHand or negative balance", async () => {
  const { service } = createService([
    discrepancy("LOT_BALANCE_NEGATIVE_OR_RESERVED_INVALID"),
  ]);

  const rows = await service.findDiscrepancies(ids.tenant, {}, actor);

  assert.equal(rows[0].discrepancyType, "LOT_BALANCE_NEGATIVE_OR_RESERVED_INVALID");
  assert.equal(rows[0].severity, "CRITICAL");
});

test("detects balance different from movement links", async () => {
  const { service } = createService([
    discrepancy("LOT_BALANCE_DIFFERS_FROM_MOVEMENT_LINKS"),
  ]);

  const rows = await service.findDiscrepancies(ids.tenant, {}, actor);

  assert.equal(rows[0].discrepancyType, "LOT_BALANCE_DIFFERS_FROM_MOVEMENT_LINKS");
  assert.equal(rows[0].severity, "CRITICAL");
});

test("detects ACTIVE expired lot", async () => {
  const { service } = createService([discrepancy("EXPIRED_ACTIVE_LOT")]);

  const rows = await service.findDiscrepancies(ids.tenant, {}, actor);

  assert.equal(rows[0].discrepancyType, "EXPIRED_ACTIVE_LOT");
  assert.equal(rows[0].severity, "WARNING");
});

test("detects blocked or cancelled lot with available balance", async () => {
  const { service } = createService([
    discrepancy("BLOCKED_OR_CANCELLED_LOT_WITH_AVAILABLE_BALANCE"),
  ]);

  const rows = await service.findDiscrepancies(ids.tenant, {}, actor);

  assert.equal(
    rows[0].discrepancyType,
    "BLOCKED_OR_CANCELLED_LOT_WITH_AVAILABLE_BALANCE"
  );
  assert.equal(rows[0].severity, "WARNING");
});

test("detects lot-required product with non-lotted stock", async () => {
  const { service } = createService([
    discrepancy("LOT_REQUIRED_PRODUCT_WITH_NON_LOTTED_STOCK"),
  ]);

  const rows = await service.findDiscrepancies(ids.tenant, {}, actor);

  assert.equal(rows[0].discrepancyType, "LOT_REQUIRED_PRODUCT_WITH_NON_LOTTED_STOCK");
  assert.equal(rows[0].severity, "HIGH");
});

test("filters by branch product lot date and discrepancy type", async () => {
  const { service, repository } = createService([
    discrepancy("EXPIRED_ACTIVE_LOT"),
    discrepancy("LOT_LINK_TENANT_MISMATCH"),
  ]);

  const rows = await service.findDiscrepancies(
    ids.tenant,
    {
      branchId: ids.branch,
      productId: ids.product,
      lotId: ids.lot,
      from: "2026-05-01",
      to: "2026-05-28",
      onlyDiscrepancies: true,
      discrepancyType: "EXPIRED_ACTIVE_LOT",
    },
    actor
  );

  assert.equal(rows.length, 1);
  assert.equal(rows[0].discrepancyType, "EXPIRED_ACTIVE_LOT");
  const lastCall = repository.calls.at(-1);
  assert.equal(lastCall?.filters.branchId, ids.branch);
  assert.equal(lastCall?.filters.productId, ids.product);
  assert.equal(lastCall?.filters.lotId, ids.lot);
  assert.equal(lastCall?.filters.onlyDiscrepancies, true);
});

test("branch-scoped actor is limited to actor branch", async () => {
  const { service, repository } = createService();

  await service.getSummary(
    ids.tenant,
    {},
    {
      roles: ["USER"],
      userId: ids.user,
      tenantId: ids.tenant,
      branchId: ids.branch,
    }
  );

  assert.equal(repository.calls[0].filters.branchId, ids.branch);
});

test("product reconciliation returns detail and discrepancies", async () => {
  const { service } = createService([discrepancy("LOT_LINK_PRODUCT_MISMATCH")]);

  const result = await service.getProductReconciliation(
    ids.tenant,
    ids.product,
    {},
    actor
  );

  assert.equal(result.productId, ids.product);
  assert.equal(result.discrepancies.length, 1);
  assert.equal(result.summary.highCount, 1);
});

test("lot reconciliation returns detail and discrepancies", async () => {
  const { service } = createService([discrepancy("EXPIRED_ACTIVE_LOT")]);

  const result = await service.getLotReconciliation(
    ids.tenant,
    ids.lot,
    {},
    actor
  );

  assert.equal(result.lotId, ids.lot);
  assert.equal(result.discrepancies.length, 1);
  assert.equal(result.summary.warningCount, 1);
});

test("service does not call write methods", async () => {
  const { service, repository } = createService();

  await service.findDiscrepancies(ids.tenant, {}, actor);

  assert.equal(
    repository.calls.some((call) =>
      ["create", "update", "delete", "fix"].includes(call.method)
    ),
    false
  );
});
