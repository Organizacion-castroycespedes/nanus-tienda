import assert from "node:assert/strict";
import test from "node:test";
import { ElectronicBillingAdminController } from "./electronic-billing-admin.controller";

test("administrative electronic billing controller is SUPER_ADMIN-only", () => {
  const controller = new ElectronicBillingAdminController({} as never);
  assert.deepEqual(Reflect.getMetadata("roles", controller.constructor), ["SUPER_ADMIN"]);
});

test("provider routes carry the future menu permission contract", () => {
  const controller = ElectronicBillingAdminController.prototype;
  assert.equal(Reflect.getMetadata("permission", controller.listProviders).menuKey, "ELECTRONIC_BILLING_PROVIDERS");
  assert.equal(Reflect.getMetadata("permission", controller.listProviders).level, "READ");
  assert.equal(Reflect.getMetadata("permission", controller.createProvider).level, "WRITE");
  assert.equal(Reflect.getMetadata("permission", controller.updateProvider).level, "WRITE");
  assert.equal(Reflect.getMetadata("permission", controller.updateProviderStatus).level, "WRITE");
  assert.equal(Reflect.getMetadata("permission", controller.getRuntimeCryptoReadiness).menuKey, "ELECTRONIC_BILLING_PROVIDERS");
  assert.equal(Reflect.getMetadata("permission", controller.getRuntimeCryptoReadiness).level, "WRITE");
});
