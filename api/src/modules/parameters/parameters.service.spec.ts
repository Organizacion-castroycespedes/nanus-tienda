import assert from "node:assert/strict";
import test from "node:test";
import { ParametersService } from "./parameters.service";

test("ParametersService maps GENERATE_INVOICE modes to billing policy when SEND_INVOICE allows it", async () => {
  const repository = {
    resolveValue: async (code: string) => {
      if (code === "SEND_INVOICE") {
        return "AUTOMATIC";
      }
      assert.equal(code, "GENERATE_INVOICE");
      return "ON_DEMAND";
    },
  };
  const service = new ParametersService(repository as never);
  const policy = await service.resolveElectronicBillingPolicy("tenant-1");
  assert.deepEqual(policy, {
    enabled: true,
    mode: "ON_DEMAND",
    rawMode: "ON_DEMAND",
  });
});

test("ParametersService treats DISABLED SEND_INVOICE as disabled billing", async () => {
  const repository = {
    resolveValue: async (code: string) => {
      if (code === "SEND_INVOICE") {
        return "DISABLED";
      }
      return "AUTOMATIC";
    },
  };
  const service = new ParametersService(repository as never);
  const policy = await service.resolveElectronicBillingPolicy("tenant-1");
  assert.equal(policy.enabled, false);
  assert.equal(policy.rawMode, "DISABLED");
});

test("ParametersService treats DISABLED GENERATE_INVOICE as disabled billing", async () => {
  const repository = {
    resolveValue: async (code: string) => {
      if (code === "SEND_INVOICE") {
        return "AUTOMATIC";
      }
      return "DISABLED";
    },
  };
  const service = new ParametersService(repository as never);
  const policy = await service.resolveElectronicBillingPolicy("tenant-1");
  assert.equal(policy.enabled, false);
  assert.equal(policy.rawMode, "DISABLED");
});
