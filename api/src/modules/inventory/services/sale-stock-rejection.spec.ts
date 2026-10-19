import assert from "node:assert/strict";
import test from "node:test";
import { ConflictException } from "@nestjs/common";
import type { PoolClient } from "pg";
import { SaleRepository } from "../repositories/sale.repository";
import { SaleService, readDefinitiveStockFailureKind } from "./sale.service";

const ids = {
  tenant: "10000000-0000-0000-0000-000000000001",
  branch: "10000000-0000-0000-0000-000000000002",
  product: "10000000-0000-0000-0000-000000000003",
};

test("recognizes only the two definitive P0001 stock failures", () => {
  assert.equal(
    readDefinitiveStockFailureKind({
      code: "P0001",
      message: `insufficient stock for product ${ids.product}`,
    }),
    "INSUFFICIENT_STOCK",
  );
  assert.equal(
    readDefinitiveStockFailureKind({
      code: "P0001",
      message: `insufficient FEFO lot stock for product ${ids.product}`,
    }),
    "INSUFFICIENT_FEFO_STOCK",
  );
  assert.equal(
    readDefinitiveStockFailureKind({
      code: "P0001",
      message: "insufficient stock for product other-product",
    }),
    "INSUFFICIENT_STOCK",
  );
  assert.equal(
    readDefinitiveStockFailureKind({
      code: "P0001",
      message: "sale validation failed",
    }),
    null,
  );
  assert.equal(
    readDefinitiveStockFailureKind({
      code: "23514",
      message: `insufficient stock for product ${ids.product}`,
    }),
    null,
  );
});

test("stock availability query is tenant and branch scoped and maps numeric values", async () => {
  const calls: Array<{ text: string; params: unknown[] }> = [];
  const repository = new SaleRepository({
    query: async (text: string, params: unknown[]) => {
      calls.push({ text, params });
      return {
        rows: [{
          requires_lot: true,
          aggregate_available_quantity: "133.000",
          eligible_lot_quantity: "32.500",
        }],
      };
    },
  } as never);

  const availability = await repository.getStockAvailability(
    ids.tenant,
    ids.branch,
    ids.product,
    undefined as unknown as PoolClient,
  );

  assert.deepEqual(availability, {
    requiresLot: true,
    aggregateAvailableQuantity: 133,
    eligibleLotQuantity: 32.5,
  });
  assert.deepEqual(calls[0].params, [ids.tenant, ids.branch, ids.product]);
  assert.match(calls[0].text, /stock_movements/);
  assert.match(calls[0].text, /inventory_lot_balances/);
  assert.match(calls[0].text, /tenant_id = \$1/);
  assert.match(calls[0].text, /branch_id = \$2/);
  assert.match(calls[0].text, /product_id = \$3/);
  assert.match(calls[0].text, /lot\.status = 'ACTIVE'/);
});

test("builds a safe FEFO conflict after the transaction has been rolled back", async () => {
  const service = Object.create(SaleService.prototype) as any;
  service.repository = {
    getStockAvailability: async () => ({
      requiresLot: true,
      aggregateAvailableQuantity: 8,
      eligibleLotQuantity: 2,
    }),
  };

  const response = await service.translateDefinitiveStockFailure(
    {
      code: "P0001",
      message: `insufficient FEFO lot stock for product ${ids.product}`,
    },
    {
      type: "CASH",
      customerId: "10000000-0000-0000-0000-000000000004",
      items: [{
        productId: ids.product,
        saleMode: "UNIT",
        quantity: 6,
        price: 100,
      }],
    },
    { tenantId: ids.tenant, branchId: ids.branch },
    {} as PoolClient,
  );

  assert.ok(response instanceof ConflictException);
  assert.deepEqual(response.getResponse(), {
    code: "INSUFFICIENT_FEFO_STOCK",
    message: "La disponibilidad de lotes FEFO no alcanza para esta venta.",
    productId: ids.product,
    requestedQuantity: 6,
    availableQuantity: 2,
    aggregateAvailableQuantity: 8,
    eligibleLotQuantity: 2,
  });
});
