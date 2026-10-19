import assert from "node:assert/strict";
import test from "node:test";
import { StockMovementService } from "./stock-movement.service";

const tenantId = "11111111-1111-4111-8111-111111111111";
const productId = "22222222-2222-4222-8222-222222222222";
const saleId = "33333333-3333-4333-8333-333333333333";
const movementId = "44444444-4444-4444-8444-444444444444";
const branchId = "55555555-5555-4555-8555-555555555555";

test("createMovement calculates IN stock snapshots in tenant and branch scope", async () => {
  const queries: Array<{ text: string; params: unknown[] }> = [];
  const db = {
    query: async (text: string, params: unknown[]) => {
      queries.push({ text, params });
      if (text.includes("FROM products")) return { rows: [{ id: productId }] };
      if (text.includes("FROM stock_movements")) return { rows: [{ stock: "7.125" }] };
      return {
        rows: [{
          id: movementId,
          tenant_id: tenantId,
          product_id: productId,
          type: "IN",
          quantity: "2.500",
          reference_type: "SALE",
          reference_id: saleId,
          branch_id: branchId,
          terminal_id: null,
          pos_session_code: null,
          user_id: null,
          reference_table: "sales",
          stock_before: "7.125",
          stock_after: "9.625",
          created_at: new Date().toISOString(),
        }],
      };
    },
  };
  const service = new StockMovementService(db as never, { logEvent: () => undefined } as never);

  const movement = await service.createMovement({
    id: movementId,
    tenantId,
    productId,
    type: "IN",
    quantity: 2.5,
    referenceType: "SALE",
    referenceId: saleId,
    branchId,
    createdAt: new Date(),
  });

  assert.equal(movement.stockBefore, 7.125);
  assert.equal(movement.stockAfter, 9.625);
  const balanceQuery = queries.find((query) => query.text.includes("FROM stock_movements"));
  assert.ok(balanceQuery);
  assert.deepEqual(balanceQuery.params, [productId, tenantId, branchId]);
  const insertQuery = queries.find((query) => query.text.includes("INSERT INTO stock_movements"));
  assert.ok(insertQuery);
  assert.equal(insertQuery.params[12], 7.125);
  assert.equal(insertQuery.params[13], 9.625);
});
