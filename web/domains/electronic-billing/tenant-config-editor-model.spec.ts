import assert from "node:assert/strict";
import test from "node:test";
import {
  draftFromConfiguration,
  emptyTenantElectronicBillingDraft,
  validateTenantElectronicBillingDraft,
} from "./tenant-config-editor-model";

test("draft never preloads stored credentials", () => {
  const draft = draftFromConfiguration({
    id: "config-1",
    tenantId: "tenant-1",
    providerId: "provider-1",
    providerCode: "FACTUCORE",
    providerName: "FactuCore",
    providerActive: true,
    environment: "HABILITATION",
    enabled: true,
    isDefault: true,
    configurationStatus: "COMPLETE",
    baseUrlConfigured: true,
    credentialStatus: { encryptedConfigured: true, legacyReferenceConfigured: false },
    settings: { factuCoreTenantId: "factucore-tenant-1" },
  });

  assert.equal(draft.clientKey, "");
  assert.equal(draft.clientSecret, "");
  assert.equal(draft.environment, "HABILITATION");
});

test("blank credentials preserve existing credentials and partial replacement is rejected", () => {
  const draft = emptyTenantElectronicBillingDraft();
  draft.providerId = "provider-1";
  draft.factuCoreTenantId = "factucore-tenant-1";
  assert.equal(validateTenantElectronicBillingDraft(draft).some((error) => error.includes("credencial")), false);
  draft.clientKey = "new-key";
  assert.equal(validateTenantElectronicBillingDraft(draft).some((error) => error.includes("key y secret")), true);
});

test("local validation rejects unsafe URL and incomplete mapping", () => {
  const draft = emptyTenantElectronicBillingDraft();
  draft.providerId = "provider-1";
  draft.baseUrl = "javascript:alert(1)";
  const errors = validateTenantElectronicBillingDraft(draft);
  assert.equal(errors.some((error) => error.includes("URL")), true);
  assert.equal(errors.some((error) => error.includes("tenant FactuCore")), true);
});

test("initial configuration requires both write-only credentials", () => {
  const draft = emptyTenantElectronicBillingDraft();
  draft.providerId = "provider-1";
  draft.factuCoreTenantId = "factucore-tenant-1";

  assert.equal(
    validateTenantElectronicBillingDraft(draft, { requireCredentials: true })
      .some((error) => error.includes("inicial requiere")),
    true,
  );
  draft.clientKey = "key";
  draft.clientSecret = "secret";
  assert.equal(validateTenantElectronicBillingDraft(draft, { requireCredentials: true }).length, 0);
});
