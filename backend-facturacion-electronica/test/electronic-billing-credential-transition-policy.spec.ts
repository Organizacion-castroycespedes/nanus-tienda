import assert from "node:assert/strict";
import test from "node:test";
import {
  ElectronicBillingCredentialTransitionPolicy,
  TenantElectronicBillingCredentialResolver,
  classifyElectronicBillingCredentialEnvelope,
} from "../src/modules/electronic-billing/credentials";

const context = {
  tenantId: "tenant-a",
  providerId: "provider-a",
  providerCode: "FACTUCORE",
  providerConfigId: "config-a",
  environment: "HABILITATION",
  credentialReference: "env:SYNTHETIC_LEGACY_CREDENTIAL",
};

const validV1Envelope = () => [
  "v1",
  Buffer.alloc(12).toString("base64url"),
  Buffer.alloc(16).toString("base64url"),
  Buffer.from("synthetic-ciphertext").toString("base64url"),
].join(".");

const setAllowlist = (entry = context) => {
  process.env.ELECTRONIC_BILLING_LEGACY_REFERENCE_ALLOWLIST = JSON.stringify([{
    tenantId: entry.tenantId,
    providerId: entry.providerId,
    providerConfigId: entry.providerConfigId,
    providerCode: entry.providerCode,
    environment: entry.environment,
  }]);
};

test.beforeEach(() => {
  delete process.env.ELECTRONIC_BILLING_LEGACY_REFERENCE_ENABLED;
  delete process.env.ELECTRONIC_BILLING_LEGACY_REFERENCE_ALLOWLIST;
  process.env.SYNTHETIC_LEGACY_CREDENTIAL = JSON.stringify({
    clientKey: "synthetic-key",
    clientSecret: "synthetic-secret",
  });
});

test.afterEach(() => {
  delete process.env.ELECTRONIC_BILLING_LEGACY_REFERENCE_ENABLED;
  delete process.env.ELECTRONIC_BILLING_LEGACY_REFERENCE_ALLOWLIST;
  delete process.env.SYNTHETIC_LEGACY_CREDENTIAL;
});

test("legacy transition is disabled and empty allowlist denies historical ciphertext", async () => {
  const resolver = new TenantElectronicBillingCredentialResolver();

  await assert.rejects(
    () => resolver.resolve({ ...context, encryptedCredentials: validV1Envelope() }),
  );
  assert.equal(new ElectronicBillingCredentialTransitionPolicy().evaluateLegacyOverride(context).allowed, false);
});

test("allowlisted historical v1 uses legacy resolution only when explicitly enabled", async () => {
  process.env.ELECTRONIC_BILLING_LEGACY_REFERENCE_ENABLED = "true";
  setAllowlist();

  const resolved = await new TenantElectronicBillingCredentialResolver().resolve({
    ...context,
    encryptedCredentials: validV1Envelope(),
  });

  assert.equal(resolved?.reference, "SYNTHETIC_LEGACY_CREDENTIAL");
  assert.equal(resolved?.values.clientKey, "synthetic-key");
});

test("tenant, provider, config, and environment mismatches deny legacy transition", async () => {
  process.env.ELECTRONIC_BILLING_LEGACY_REFERENCE_ENABLED = "true";
  setAllowlist();
  const resolver = new TenantElectronicBillingCredentialResolver();

  for (const override of [
    { tenantId: "tenant-b" },
    { providerId: "provider-b" },
    { providerConfigId: "config-b" },
    { environment: "TEST" },
  ]) {
    await assert.rejects(() => resolver.resolve({
      ...context,
      ...override,
      encryptedCredentials: validV1Envelope(),
    }));
  }
});

test("v2 and unknown envelopes never downgrade to legacy", async () => {
  process.env.ELECTRONIC_BILLING_LEGACY_REFERENCE_ENABLED = "true";
  setAllowlist();
  const resolver = new TenantElectronicBillingCredentialResolver();

  assert.equal(classifyElectronicBillingCredentialEnvelope("v2.invalid"), "UNKNOWN");
  assert.equal(classifyElectronicBillingCredentialEnvelope("not-a-version"), "UNKNOWN");
  await assert.rejects(() => resolver.resolve({ ...context, encryptedCredentials: "v2.invalid" }));
  await assert.rejects(() => resolver.resolve({ ...context, encryptedCredentials: "not-a-version" }));
});

test("malformed allowlist denies without exposing configuration or credential values", async () => {
  process.env.ELECTRONIC_BILLING_LEGACY_REFERENCE_ENABLED = "true";
  process.env.ELECTRONIC_BILLING_LEGACY_REFERENCE_ALLOWLIST = "not-json";
  const policy = new ElectronicBillingCredentialTransitionPolicy();
  const decision = policy.evaluateLegacyOverride(context);

  assert.deepEqual(decision, { allowed: false, category: "LEGACY_POLICY_INVALID" });
  assert.doesNotMatch(JSON.stringify(decision), /synthetic|client|secret|credential/i);
});

test("legacy resolution remains available for configurations without ciphertext", async () => {
  const resolved = await new TenantElectronicBillingCredentialResolver().resolve({
    ...context,
    encryptedCredentials: null,
  });

  assert.equal(resolved?.reference, "SYNTHETIC_LEGACY_CREDENTIAL");
});
