import assert from "node:assert/strict";
import test from "node:test";
import { BadRequestException } from "@nestjs/common";
import { InventoryLotReconciliationController } from "./inventory-lot-reconciliation.controller";

const ids = {
  tenant: "00000000-0000-0000-0000-000000000001",
  user: "00000000-0000-0000-0000-000000000002",
  branch: "30000000-0000-0000-0000-000000000001",
  product: "10000000-0000-0000-0000-000000000001",
  lot: "20000000-0000-0000-0000-000000000001",
};

type RecordedCall = {
  method: string;
  tenantId: string;
  filters?: Record<string, unknown>;
  actor?: Record<string, unknown>;
  id?: string;
};

class FakeReconciliationService {
  readonly calls: RecordedCall[] = [];

  async getSummary(
    tenantId: string,
    filters: Record<string, unknown>,
    actor: Record<string, unknown>
  ) {
    this.calls.push({ method: "getSummary", tenantId, filters, actor });
    return { discrepancyCount: 0 };
  }

  async findDiscrepancies(
    tenantId: string,
    filters: Record<string, unknown>,
    actor: Record<string, unknown>
  ) {
    this.calls.push({ method: "findDiscrepancies", tenantId, filters, actor });
    return [];
  }

  async getProductReconciliation(
    tenantId: string,
    productId: string,
    filters: Record<string, unknown>,
    actor: Record<string, unknown>
  ) {
    this.calls.push({
      method: "getProductReconciliation",
      tenantId,
      filters,
      actor,
      id: productId,
    });
    return { productId };
  }

  async getLotReconciliation(
    tenantId: string,
    lotId: string,
    filters: Record<string, unknown>,
    actor: Record<string, unknown>
  ) {
    this.calls.push({
      method: "getLotReconciliation",
      tenantId,
      filters,
      actor,
      id: lotId,
    });
    return { lotId };
  }
}

const request = {
  user: {
    tenantId: ids.tenant,
    id: ids.user,
    roles: ["SUPER_ADMIN"],
  },
};

const createController = () => {
  const service = new FakeReconciliationService();
  const controller = new InventoryLotReconciliationController(service as never);
  return { controller, service };
};

test("InventoryLotReconciliationController accepts valid branchId UUID query", async () => {
  const { controller, service } = createController();

  await controller.getSummary({ branchId: ids.branch }, request as never);

  assert.equal(service.calls[0].tenantId, ids.tenant);
  assert.equal(service.calls[0].filters?.branchId, ids.branch);
});

test("InventoryLotReconciliationController rejects invalid branchId query", () => {
  const { controller } = createController();

  assert.throws(
    () => controller.getSummary({ branchId: "not-a-uuid" }, request as never),
    BadRequestException
  );
});

test("InventoryLotReconciliationController accepts productId and lotId UUID filters", async () => {
  const { controller, service } = createController();

  await controller.findDiscrepancies(
    {
      branchId: ids.branch,
      productId: ids.product,
      lotId: ids.lot,
      onlyDiscrepancies: "true",
    },
    request as never
  );

  assert.deepEqual(service.calls[0].filters, {
    branchId: ids.branch,
    productId: ids.product,
    lotId: ids.lot,
    from: undefined,
    to: undefined,
    onlyDiscrepancies: true,
    discrepancyType: undefined,
  });
});

test("InventoryLotReconciliationController rejects invalid productId filter", () => {
  const { controller } = createController();

  assert.throws(
    () =>
      controller.findDiscrepancies(
        { productId: "bad-product-id" },
        request as never
      ),
    BadRequestException
  );
});

test("InventoryLotReconciliationController rejects invalid lotId filter", () => {
  const { controller } = createController();

  assert.throws(
    () =>
      controller.findDiscrepancies({ lotId: "bad-lot-id" }, request as never),
    BadRequestException
  );
});

test("InventoryLotReconciliationController accepts valid productId route param", async () => {
  const { controller, service } = createController();

  await controller.getProduct(ids.product, { branchId: ids.branch }, request as never);

  assert.equal(service.calls[0].id, ids.product);
  assert.equal(service.calls[0].filters?.branchId, ids.branch);
});

test("InventoryLotReconciliationController accepts valid lotId route param", async () => {
  const { controller, service } = createController();

  await controller.getLot(ids.lot, { branchId: ids.branch }, request as never);

  assert.equal(service.calls[0].id, ids.lot);
  assert.equal(service.calls[0].filters?.branchId, ids.branch);
});
