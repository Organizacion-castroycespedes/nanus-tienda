import assert from "node:assert/strict";
import test from "node:test";
import {
  decryptElectronicBillingCredentials,
  encryptElectronicBillingCredentials,
  inspectElectronicBillingCredentialRuntimeReadiness,
  inspectElectronicBillingEncryptionReadiness,
} from "../src/modules/electronic-billing/credentials";

const binding = {
  tenantId: "tenant-a",
  providerId: "provider-a",
  providerConfigId: "config-a",
};

const keyOne = "11".repeat(32);
const keyTwo = "22".repeat(32);

const setKeyRing = (activeKeyId: string, keys: Record<string, string>) => {
  process.env.ELECTRONIC_BILLING_ENCRYPTION_ACTIVE_KEY_ID = activeKeyId;
  process.env.ELECTRONIC_BILLING_ENCRYPTION_KEYS = JSON.stringify(keys);
  delete process.env.ELECTRONIC_BILLING_ENCRYPTION_KEY;
};

test.afterEach(() => {
  delete process.env.ELECTRONIC_BILLING_CREDENTIAL_WRITES_ENABLED;
  delete process.env.ELECTRONIC_BILLING_ENCRYPTION_ACTIVE_KEY_ID;
  delete process.env.ELECTRONIC_BILLING_ENCRYPTION_KEYS;
  delete process.env.ELECTRONIC_BILLING_ENCRYPTION_KEY;
});

test("encrypts with unique nonce and decrypts with the bound tenant context", () => {
  setKeyRing("key-1", { "key-1": keyOne });
  const values = { clientKey: "client-key", clientSecret: "client-secret" };

  const first = encryptElectronicBillingCredentials(values, binding);
  const second = encryptElectronicBillingCredentials(values, binding);

  assert.match(first, /^v2\.key-1\./);
  assert.notEqual(first, second);
  assert.deepEqual(decryptElectronicBillingCredentials(first, binding), values);
});

test("authenticated data binds ciphertext to tenant, provider, and config", () => {
  setKeyRing("key-1", { "key-1": keyOne });
  const ciphertext = encryptElectronicBillingCredentials(
    { clientKey: "client-key", clientSecret: "client-secret" },
    binding,
  );

  assert.throws(
    () => decryptElectronicBillingCredentials(ciphertext, { ...binding, tenantId: "tenant-b" }),
  );
  assert.throws(
    () => decryptElectronicBillingCredentials(ciphertext, { ...binding, providerConfigId: "config-b" }),
  );
});

test("supports active-key encryption and historical-key decryption", () => {
  setKeyRing("key-1", { "key-1": keyOne });
  const oldCiphertext = encryptElectronicBillingCredentials(
    { clientKey: "client-key", clientSecret: "client-secret" },
    binding,
  );

  setKeyRing("key-2", { "key-1": keyOne, "key-2": keyTwo });
  const newCiphertext = encryptElectronicBillingCredentials(
    { clientKey: "client-key", clientSecret: "client-secret" },
    binding,
  );

  assert.match(newCiphertext, /^v2\.key-2\./);
  assert.equal(decryptElectronicBillingCredentials(oldCiphertext, binding).clientKey, "client-key");
  assert.equal(decryptElectronicBillingCredentials(newCiphertext, binding).clientSecret, "client-secret");
});

test("fails closed for missing keys and unsupported ciphertext versions", () => {
  delete process.env.ELECTRONIC_BILLING_ENCRYPTION_KEYS;
  delete process.env.ELECTRONIC_BILLING_ENCRYPTION_KEY;
  assert.throws(() => encryptElectronicBillingCredentials(
    { clientKey: "client-key", clientSecret: "client-secret" },
    binding,
  ));

  setKeyRing("key-1", { "key-1": keyOne });
  assert.throws(() => decryptElectronicBillingCredentials("v1.old-format", binding));
});

test("reports missing operational keyring without exposing key material", () => {
  process.env.ELECTRONIC_BILLING_CREDENTIAL_WRITES_ENABLED = "true";
  delete process.env.ELECTRONIC_BILLING_ENCRYPTION_KEYS;
  delete process.env.ELECTRONIC_BILLING_ENCRYPTION_KEY;
  assert.deepEqual(inspectElectronicBillingEncryptionReadiness(), {
    configured: false,
    writesEnabled: true,
    keyringConfigured: false,
    activeKeyConfigured: false,
    reason: "KEYRING_MISSING",
  });
});

test("runtime self-test reports keyring readiness without enabling writes", () => {
  setKeyRing("key-1", { "key-1": keyOne });
  delete process.env.ELECTRONIC_BILLING_CREDENTIAL_WRITES_ENABLED;
  assert.deepEqual(inspectElectronicBillingCredentialRuntimeReadiness(), {
    configured: true,
    reason: "READY",
  });
});
