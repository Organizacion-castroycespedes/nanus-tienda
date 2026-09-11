import assert from "node:assert/strict";
import test from "node:test";
import {
  ElectronicBillingProviderDisabledError,
  ElectronicBillingProviderNotRegisteredError,
  ElectronicBillingProviderRegistry,
  ElectronicBillingProviderResolver,
  FakeElectronicBillingProvider,
} from "../src/modules/electronic-billing";

const ids = {
  tenant: "00000000-0000-0000-0000-000000000301",
  provider: "00000000-0000-0000-0000-000000000302",
  config: "00000000-0000-0000-0000-000000000303",
};

const providerRepository = (provider = { id: ids.provider, code: "FAKE_PROVIDER", name: "Fake" }) => ({
  findById: async () => provider,
});

const tenantConfigRepository = (config: Record<string, unknown> | null) => ({
  findById: async () => config,
  findDefaultForTenant: async () => config,
});

test("resolve registered provider by code and tenant config", async () => {
  const registry = new ElectronicBillingProviderRegistry();
  registry.register(new FakeElectronicBillingProvider("FAKE_PROVIDER"));

  const resolver = new ElectronicBillingProviderResolver(
    registry,
    providerRepository() as never,
    tenantConfigRepository({
      id: ids.config,
      tenant_id: ids.tenant,
      provider_id: ids.provider,
      environment: "TEST",
      enabled: true,
      base_url: "https://billing.example",
      credential_reference: "cred-1",
      settings: { foo: "bar" },
      is_default: true,
    }) as never,
  );

  const resolved = await resolver.resolve({ tenantId: ids.tenant, providerConfigId: ids.config });

  assert.equal(resolved.provider.code, "FAKE_PROVIDER");
  assert.equal(resolved.context.tenantId, ids.tenant);
  assert.equal(resolved.context.credentialReference, "cred-1");
});

test("resolve without config uses default tenant config", async () => {
  const registry = new ElectronicBillingProviderRegistry();
  registry.register(new FakeElectronicBillingProvider("FAKE_PROVIDER"));

  let defaultCalls = 0;
  const resolver = new ElectronicBillingProviderResolver(
    registry,
    providerRepository() as never,
    {
      findById: async () => null,
      findDefaultForTenant: async () => {
        defaultCalls += 1;
        return {
          id: ids.config,
          tenant_id: ids.tenant,
          provider_id: ids.provider,
          environment: "TEST",
          enabled: true,
          base_url: null,
          credential_reference: null,
          settings: {},
          is_default: true,
        };
      },
    } as never,
  );

  const resolved = await resolver.resolve({ tenantId: ids.tenant });

  assert.equal(resolved.config.configId, ids.config);
  assert.equal(defaultCalls, 1);
});

test("resolve throws when config disabled", async () => {
  const registry = new ElectronicBillingProviderRegistry();
  registry.register(new FakeElectronicBillingProvider("FAKE_PROVIDER"));

  const resolver = new ElectronicBillingProviderResolver(
    registry,
    providerRepository() as never,
    tenantConfigRepository({
      id: ids.config,
      tenant_id: ids.tenant,
      provider_id: ids.provider,
      environment: "TEST",
      enabled: false,
      base_url: null,
      credential_reference: null,
      settings: {},
      is_default: true,
    }) as never,
  );

  await assert.rejects(
    () => resolver.resolve({ tenantId: ids.tenant, providerConfigId: ids.config }),
    ElectronicBillingProviderDisabledError,
  );
});

test("resolve throws when provider code not registered", async () => {
  const resolver = new ElectronicBillingProviderResolver(
    new ElectronicBillingProviderRegistry(),
    providerRepository() as never,
    tenantConfigRepository({
      id: ids.config,
      tenant_id: ids.tenant,
      provider_id: ids.provider,
      environment: "TEST",
      enabled: true,
      base_url: null,
      credential_reference: null,
      settings: {},
      is_default: true,
    }) as never,
  );

  await assert.rejects(
    () => resolver.resolve({ tenantId: ids.tenant, providerConfigId: ids.config }),
    ElectronicBillingProviderNotRegisteredError,
  );
});
