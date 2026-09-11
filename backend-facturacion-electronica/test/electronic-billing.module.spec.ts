import assert from "node:assert/strict";
import test from "node:test";
import { ElectronicBillingModule } from "../src/modules/electronic-billing/electronic-billing.module";

test("electronic billing module shell exists", () => {
  assert.equal(typeof ElectronicBillingModule, "function");
});
