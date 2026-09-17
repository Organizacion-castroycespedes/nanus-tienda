import assert from "node:assert/strict";
import test from "node:test";
import { BadRequestException } from "@nestjs/common";
import {
  buildSaleIdempotencyHash,
  normalizeSaleIdempotencyKey,
} from "./sale-idempotency";

test("sale idempotency keys accept the client attempt format", () => {
  assert.equal(normalizeSaleIdempotencyKey(" attempt-123 "), "attempt-123");
  assert.throws(
    () => normalizeSaleIdempotencyKey(["one", "two"]),
    BadRequestException,
  );
  assert.throws(
    () => normalizeSaleIdempotencyKey("not safe/for a header"),
    BadRequestException,
  );
});

test("sale idempotency hash is stable for object key order and scoped context", () => {
  const context = {
    tenantId: "tenant-a",
    branchId: "branch-a",
    terminalId: "terminal-a",
    userId: "user-a",
    posSessionId: "pos-a",
  };
  const first = buildSaleIdempotencyHash(
    { customerId: "customer-a", items: [{ productId: "product-a", quantity: 1 }] },
    context,
  );
  const sameRequestDifferentOrder = buildSaleIdempotencyHash(
    { items: [{ quantity: 1, productId: "product-a" }], customerId: "customer-a" },
    context,
  );
  const otherTenant = buildSaleIdempotencyHash(
    { customerId: "customer-a", items: [{ productId: "product-a", quantity: 1 }] },
    { ...context, tenantId: "tenant-b" },
  );

  assert.equal(first, sameRequestDifferentOrder);
  assert.notEqual(first, otherTenant);
});
