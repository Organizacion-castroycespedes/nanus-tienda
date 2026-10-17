import assert from "node:assert/strict";
import test from "node:test";
import { ElectronicBillingProviderDisabledError } from "../src/modules/electronic-billing/contracts/electronic-billing-errors";
import { ElectronicBillingProviderResolver } from "../src/modules/electronic-billing/providers/electronic-billing-provider-resolver";

const tenantId = "00000000-0000-4000-8000-000000000001";
const providerId = "00000000-0000-4000-8000-000000000002";
const configId = "00000000-0000-4000-8000-000000000003";

const disabledConfig = {
  id: configId,
  tenant_id: tenantId,
  provider_id: providerId,
  environment: "HABILITATION" as const,
  enabled: false,
  base_url: "http://127.0.0.1:8000/",
  credential_reference: null,
  encrypted_credentials: "v2.redacted",
  settings: { factuCoreTenantId: "00000000-0000-4000-8000-000000000004" },
  is_default: false,
  created_at: new Date(),
  updated_at: new Date(),
};

const createResolver = () => new ElectronicBillingProviderResolver(
  { resolve: (code: string) => ({ code, getClientContext: async () => ({}) }) } as never,
  { findById: async () => ({ id: providerId, code: "FACTUCORE" }) } as never,
  {
    findDefaultForTenant: async () => disabledConfig,
    findById: async () => disabledConfig,
    findFactuCoreForAdministrativeContext: async () => disabledConfig,
  } as never,
);

test("admin identity resolution can select a disabled FactuCore configuration", async () => {
  const resolved = await createResolver().resolveForAdministrativeContext(tenantId);

  assert.equal(resolved.context.tenantId, tenantId);
  assert.equal(resolved.context.providerId, providerId);
  assert.equal(resolved.context.providerConfigId, configId);
  assert.equal(resolved.config.enabled, false);
  assert.equal(resolved.config.isDefault, false);
});

test("standard billing resolution still rejects a disabled configuration", async () => {
  await assert.rejects(
    () => createResolver().resolve({ tenantId }),
    (error: unknown) => error instanceof ElectronicBillingProviderDisabledError,
  );
});

test("admin identity resolution remains tenant-scoped", async () => {
  let requestedTenant: string | undefined;
  const resolver = new ElectronicBillingProviderResolver(
    { resolve: () => ({ code: "FACTUCORE" }) } as never,
    { findById: async () => ({ id: providerId, code: "FACTUCORE" }) } as never,
    {
      findFactuCoreForAdministrativeContext: async (value: string) => {
        requestedTenant = value;
        return null;
      },
    } as never,
  );

  await assert.rejects(() => resolver.resolveForAdministrativeContext(tenantId));
  assert.equal(requestedTenant, tenantId);
});
