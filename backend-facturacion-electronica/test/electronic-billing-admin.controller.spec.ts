import assert from "node:assert/strict";
import test from "node:test";
import { ForbiddenException, ServiceUnavailableException, UnauthorizedException } from "@nestjs/common";
import { ElectronicBillingAdminController } from "../src/modules/electronic-billing/admin/electronic-billing-admin.controller";

const tenantId = "00000000-0000-4000-8000-000000000001";

test.beforeEach(() => {
  process.env.API_INTERNAL_TOKEN = "internal-test-token";
});

test.afterEach(() => {
  delete process.env.API_INTERNAL_TOKEN;
});

test("internal admin read rejects missing and invalid service tokens", async () => {
  const controller = new ElectronicBillingAdminController({
    listProviders: async () => ({ providers: [] }),
    getTenantConfiguration: async () => ({ tenantId, configurations: [] }),
    getRuntimeCryptoReadiness: () => ({
      schemaMigration: "UNKNOWN",
      keyringStatus: "MISSING",
      syntheticSelfTest: "NOT_RUN",
      historicalDecryptReady: "UNKNOWN",
      operationalOwnership: "UNKNOWN",
      recoveryReadiness: "UNKNOWN",
      credentialWrites: "DISABLED",
      writeReady: false,
    }),
  } as never);

  await assert.rejects(() => controller.listProviders(undefined), ForbiddenException);
  await assert.rejects(() => controller.listProviders("Bearer wrong"), ForbiddenException);
});

test("runtime crypto readiness is internal, uncached, and redacted", async () => {
  const controller = new ElectronicBillingAdminController({
    listProviders: async () => ({ providers: [] }),
    getTenantConfiguration: async () => ({ tenantId, configurations: [] }),
    getRuntimeCryptoReadiness: () => ({
      schemaMigration: "UNKNOWN",
      keyringStatus: "MISSING",
      syntheticSelfTest: "NOT_RUN",
      historicalDecryptReady: "UNKNOWN",
      operationalOwnership: "UNKNOWN",
      recoveryReadiness: "UNKNOWN",
      credentialWrites: "DISABLED",
      writeReady: false,
    }),
  } as never);

  const response = await controller.getRuntimeCryptoReadiness("Bearer internal-test-token");
  assert.deepEqual(response, {
    schemaMigration: "UNKNOWN",
    keyringStatus: "MISSING",
    syntheticSelfTest: "NOT_RUN",
    historicalDecryptReady: "UNKNOWN",
    operationalOwnership: "UNKNOWN",
    recoveryReadiness: "UNKNOWN",
    credentialWrites: "DISABLED",
    writeReady: false,
  });
  assert.doesNotMatch(JSON.stringify(response), /keyId|secret|ciphertext|credential_reference|encrypted_credentials/i);
});

test("runtime crypto readiness rejects missing internal token", async () => {
  const controller = new ElectronicBillingAdminController({
    listProviders: async () => ({ providers: [] }),
    getTenantConfiguration: async () => ({ tenantId, configurations: [] }),
    getRuntimeCryptoReadiness: () => ({
      schemaMigration: "UNKNOWN",
      keyringStatus: "READY",
      syntheticSelfTest: "PASS",
      historicalDecryptReady: "UNKNOWN",
      operationalOwnership: "UNKNOWN",
      recoveryReadiness: "UNKNOWN",
      credentialWrites: "DISABLED",
      writeReady: false,
    }),
  } as never);

  await assert.rejects(() => controller.getRuntimeCryptoReadiness(undefined), ForbiddenException);
});

test("provider catalog returns no credential material", async () => {
  const controller = new ElectronicBillingAdminController({
    listProviders: async () => ({
      providers: [{
        id: "provider-id",
        code: "FACTUCORE",
        name: "FactuCore",
        active: true,
        capabilities: { invoice: true },
      }],
    }),
    getTenantConfiguration: async () => ({ tenantId, configurations: [] }),
  } as never);

  const response = await controller.listProviders("Bearer internal-test-token");
  const serialized = JSON.stringify(response);
  assert.match(serialized, /FACTUCORE/);
  assert.doesNotMatch(serialized, /clientSecret|encrypted_credentials|credential_reference|key-1/i);
});

test("tenant configuration route rejects malformed tenant identifiers", async () => {
  const controller = new ElectronicBillingAdminController({
    listProviders: async () => ({ providers: [] }),
    getTenantConfiguration: async () => ({ tenantId, configurations: [] }),
  } as never);

  await assert.rejects(
    () => controller.getTenantConfiguration("Bearer internal-test-token", "not-a-uuid"),
    /Tenant billing configuration not found/,
  );
});

test("tenant configuration route accepts the QA UUID fixture shape", async () => {
  const controller = new ElectronicBillingAdminController({
    listProviders: async () => ({ providers: [] }),
    getTenantConfiguration: async () => ({ tenantId, configurations: [] }),
  } as never);

  const response = await controller.getTenantConfiguration(
    "Bearer internal-test-token",
    tenantId,
  );

  assert.equal(response.tenantId, tenantId);
});

test("activation route requires internal auth and forwards explicit legacy cleanup", async () => {
  let received: unknown;
  const controller = new ElectronicBillingAdminController({
    activateTenantConfiguration: async (_tenant: string, _config: string, body: unknown) => {
      received = body;
      return { id: "config-1", tenantId, enabled: true, isDefault: true };
    },
  } as never);

  await assert.rejects(
    () => controller.activateTenantConfiguration(undefined, tenantId, "00000000-0000-4000-8000-000000000002", { clearLegacyReference: true }),
    ForbiddenException,
  );
  const result = await controller.activateTenantConfiguration(
    "Bearer internal-test-token",
    tenantId,
    "00000000-0000-4000-8000-000000000002",
    { clearLegacyReference: true },
  );
  assert.deepEqual(received, { clearLegacyReference: true });
  assert.equal(result.enabled, true);
  assert.equal(result.isDefault, true);
  assert.doesNotMatch(JSON.stringify(result), /secret|ciphertext|credential_reference/i);
});

test("FactuCore context failure exposes only allowlisted QA diagnostics and no-store", async () => {
  const previousNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = "qa";
  const service = {
    getTenantFactuCoreContext: async () => {
      const error = Object.assign(new Error("hidden upstream detail"), { status: 401 });
      throw error;
    },
  };
  const controller = new ElectronicBillingAdminController(service as never);

  try {
    await assert.rejects(
      () => controller.getTenantFactuCoreContext("Bearer internal-test-token", "corr-qa-1", tenantId),
      (error: unknown) => {
        assert.ok(error instanceof ServiceUnavailableException);
        const response = error.getResponse() as { message: string; diagnostic: Record<string, unknown> };
        assert.equal(response.message, "FactuCore context is unavailable");
        assert.deepEqual(response.diagnostic, {
          category: "FACTUCORE_AUTHENTICATION_401",
          layer: "factucore-http",
          upstreamStatus: 401,
          responseBodyPresent: true,
          correlationId: "corr-qa-1",
        });
        assert.doesNotMatch(JSON.stringify(response), /hidden upstream detail|authorization|secret|ciphertext/i);
        return true;
      },
    );
  } finally {
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousNodeEnv;
  }
});

test("FactuCore context diagnostics stay hidden outside QA", async () => {
  const previousNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";
  const controller = new ElectronicBillingAdminController({
    getTenantFactuCoreContext: async () => {
      const error = Object.assign(new Error("hidden"), { status: 403 });
      throw error;
    },
  } as never);

  try {
    await assert.rejects(
      () => controller.getTenantFactuCoreContext("Bearer internal-test-token", "corr-prod-1", tenantId),
      (error: unknown) => {
        assert.ok(error instanceof ServiceUnavailableException);
        const response = error.getResponse();
        assert.deepEqual(response, { message: "FactuCore context is unavailable" });
        return true;
      },
    );
  } finally {
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousNodeEnv;
  }
});
