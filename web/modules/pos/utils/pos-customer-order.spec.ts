import test from "node:test";
import assert from "node:assert/strict";
import { sortPosCustomers } from "./pos-customer-order";

const customer = (id: string, name: string) => ({
  id,
  tenantId: "tenant",
  name,
  documentNumber: id,
  isActive: true,
} as never);

test("sortPosCustomers orders Spanish names case-insensitively and stably", () => {
  const result = sortPosCustomers([
    customer("1", "Zulu"),
    customer("2", "álvaro"),
    customer("3", "Alvaro"),
    customer("4", "Érica"),
  ]);

  assert.deepEqual(result.map((item) => item.id), ["2", "3", "4", "1"]);
});
