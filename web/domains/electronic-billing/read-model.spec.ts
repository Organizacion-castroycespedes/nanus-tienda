import assert from "node:assert/strict";
import test from "node:test";
import {
  hasUnsafeCredentialField,
  toSafeElectronicBillingConfiguration,
} from "./read-model";

test("read model keeps only safe administrative fields", () => {
  const safe = toSafeElectronicBillingConfiguration({
    id: "config-1",
    tenantId: "tenant-1",
    providerId: "provider-1",
    providerCode: "FACTUCORE",
    providerName: "FactuCore",
    providerActive: true,
    environment: "QA",
    enabled: false,
    isDefault: true,
    configurationStatus: "INCOMPLETE",
    baseUrlConfigured: true,
    credentialStatus: {
      encryptedConfigured: true,
      legacyReferenceConfigured: false,
    },
    settings: { factuCoreTenantId: "fc-tenant-1" },
  });

  assert.deepEqual(safe.credentialStatus, {
    encryptedConfigured: true,
    legacyReferenceConfigured: false,
  });
  assert.equal("clientSecret" in safe, false);
  assert.equal("encryptedCredentials" in safe, false);
  assert.equal("credentialReference" in safe, false);
});

test("unsafe credential fields are detectable without printing their values", () => {
  assert.equal(hasUnsafeCredentialField({ clientSecret: "secret" }), true);
  assert.equal(hasUnsafeCredentialField({ configurationStatus: "COMPLETE" }), false);
});
