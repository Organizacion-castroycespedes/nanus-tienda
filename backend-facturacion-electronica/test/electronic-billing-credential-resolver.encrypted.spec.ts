import assert from "node:assert/strict";
import test from "node:test";
import {
  ElectronicBillingEncryptedCredentialInvalidError,
  TenantElectronicBillingCredentialResolver,
} from "../src/modules/electronic-billing/credentials";
import { encryptElectronicBillingCredentials } from "../src/modules/electronic-billing/credentials";

const context = {
  tenantId: "tenant-a",
  providerId: "provider-a",
  providerCode: "FACTUCORE",
  providerConfigId: "config-a",
  credentialReference: "env:LEGACY_CREDENTIAL",
  encryptedCredentials: null as string | null,
};

test.beforeEach(() => {
  process.env.ELECTRONIC_BILLING_ENCRYPTION_ACTIVE_KEY_ID = "key-1";
  process.env.ELECTRONIC_BILLING_ENCRYPTION_KEYS = JSON.stringify({ "key-1": "33".repeat(32) });
  process.env.LEGACY_CREDENTIAL = JSON.stringify({ clientKey: "legacy-key", clientSecret: "legacy-secret" });
});

test.afterEach(() => {
  delete process.env.ELECTRONIC_BILLING_ENCRYPTION_ACTIVE_KEY_ID;
  delete process.env.ELECTRONIC_BILLING_ENCRYPTION_KEYS;
  delete process.env.LEGACY_CREDENTIAL;
});

test("resolves encrypted credentials before the legacy environment reference", async () => {
  const encryptedCredentials = encryptElectronicBillingCredentials(
    { clientKey: "encrypted-key", clientSecret: "encrypted-secret" },
    context,
  );
  const resolved = await new TenantElectronicBillingCredentialResolver().resolve({
    ...context,
    encryptedCredentials,
  });

  assert.equal(resolved?.reference, "encrypted_credentials");
  assert.equal(resolved?.values.clientKey, "encrypted-key");
});

test("does not fall back to env when encrypted credentials are corrupted", async () => {
  await assert.rejects(
    () => new TenantElectronicBillingCredentialResolver().resolve({
      ...context,
      encryptedCredentials: "v2.key-1.corrupted",
    }),
    ElectronicBillingEncryptedCredentialInvalidError,
  );
});

test("keeps environment resolution for legacy configurations without ciphertext", async () => {
  const resolved = await new TenantElectronicBillingCredentialResolver().resolve(context);
  assert.equal(resolved?.reference, "LEGACY_CREDENTIAL");
  assert.equal(resolved?.values.clientSecret, "legacy-secret");
});
