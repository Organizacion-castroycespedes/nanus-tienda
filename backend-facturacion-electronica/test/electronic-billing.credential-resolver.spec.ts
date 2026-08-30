import assert from "node:assert/strict";
import test from "node:test";
import {
  ElectronicBillingCredentialInvalidError,
  ElectronicBillingCredentialNotFoundError,
  EnvironmentElectronicBillingCredentialResolver,
} from "../src/modules/electronic-billing/credentials";

const originalEnv = new Map<string, string | undefined>();

const setEnv = (key: string, value: string | undefined) => {
  if (!originalEnv.has(key)) {
    originalEnv.set(key, process.env[key]);
  }

  if (value === undefined) {
    delete process.env[key];
    return;
  }

  process.env[key] = value;
};

const restoreEnv = () => {
  for (const [key, value] of originalEnv.entries()) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
  originalEnv.clear();
};

test.afterEach(() => {
  restoreEnv();
});

test("resolve env credential by reference", async () => {
  setEnv("FACTUCORE_TENANT_A", JSON.stringify({ clientKey: "key-a", clientSecret: "secret-a" }));
  const resolver = new EnvironmentElectronicBillingCredentialResolver();

  const resolved = await resolver.resolve({
    tenantId: "tenant-a",
    providerId: "provider-a",
    providerCode: "FACTUCORE",
    providerConfigId: "config-a",
    credentialReference: "env:FACTUCORE_TENANT_A",
  });

  assert.equal(resolved?.reference, "FACTUCORE_TENANT_A");
  assert.equal(resolved?.values.clientKey, "key-a");
  assert.equal(resolved?.values.clientSecret, "secret-a");
});

test("resolve returns null when credential reference missing", async () => {
  const resolver = new EnvironmentElectronicBillingCredentialResolver();

  const resolved = await resolver.resolve({
    tenantId: "tenant-a",
    providerId: "provider-a",
    providerCode: "FACTUCORE",
    providerConfigId: "config-a",
    credentialReference: null,
  });

  assert.equal(resolved, null);
});

test("resolve throws when referenced secret is missing", async () => {
  const resolver = new EnvironmentElectronicBillingCredentialResolver();

  await assert.rejects(
    () =>
      resolver.resolve({
        tenantId: "tenant-a",
        providerId: "provider-a",
        providerCode: "FACTUCORE",
        providerConfigId: "config-a",
        credentialReference: "env:FACTUCORE_TENANT_MISSING",
      }),
    ElectronicBillingCredentialNotFoundError,
  );
});

test("resolve throws when secret payload is invalid", async () => {
  setEnv("FACTUCORE_TENANT_B", JSON.stringify({ clientKey: "key-b", clientSecret: "" }));
  const resolver = new EnvironmentElectronicBillingCredentialResolver();

  await assert.rejects(
    () =>
      resolver.resolve({
        tenantId: "tenant-b",
        providerId: "provider-b",
        providerCode: "FACTUCORE",
        providerConfigId: "config-b",
        credentialReference: "env:FACTUCORE_TENANT_B",
      }),
    ElectronicBillingCredentialInvalidError,
  );
});

test("interleaved tenants keep isolated credential references", async () => {
  setEnv("FACTUCORE_TENANT_A", JSON.stringify({ clientKey: "key-a", clientSecret: "secret-a" }));
  setEnv("FACTUCORE_TENANT_B", JSON.stringify({ clientKey: "key-b", clientSecret: "secret-b" }));
  const resolver = new EnvironmentElectronicBillingCredentialResolver();

  const [tenantA, tenantB, tenantAAgain] = await Promise.all([
    resolver.resolve({
      tenantId: "tenant-a",
      providerId: "provider-a",
      providerCode: "FACTUCORE",
      providerConfigId: "config-a",
      credentialReference: "env:FACTUCORE_TENANT_A",
    }),
    resolver.resolve({
      tenantId: "tenant-b",
      providerId: "provider-b",
      providerCode: "FACTUCORE",
      providerConfigId: "config-b",
      credentialReference: "env:FACTUCORE_TENANT_B",
    }),
    resolver.resolve({
      tenantId: "tenant-a",
      providerId: "provider-a",
      providerCode: "FACTUCORE",
      providerConfigId: "config-a",
      credentialReference: "env:FACTUCORE_TENANT_A",
    }),
  ]);

  assert.equal(tenantA?.values.clientKey, "key-a");
  assert.equal(tenantB?.values.clientKey, "key-b");
  assert.equal(tenantAAgain?.values.clientSecret, "secret-a");
});
