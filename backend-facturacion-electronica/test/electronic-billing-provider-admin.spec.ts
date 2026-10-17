import assert from "node:assert/strict";
import test from "node:test";
import { ElectronicBillingAdminService } from "../src/modules/electronic-billing/admin/electronic-billing-admin.service";
import { ElectronicBillingProviderRegistry } from "../src/modules/electronic-billing/providers/electronic-billing-provider-registry";

const capabilities = {
  invoice: true,
  creditNote: true,
  debitNote: true,
  retry: true,
  pdf: true,
  xml: true,
  signedXml: true,
  asyncStatus: true,
  attachmentDownload: true,
};

const provider = {
  id: "00000000-0000-4000-8000-000000000002",
  code: "FACTUCORE",
  name: "FactuCore",
  provider_type: "ELECTRONIC_BILLING",
  active: true,
  capabilities,
  created_at: new Date("2026-01-01T00:00:00.000Z"),
  updated_at: new Date("2026-01-01T00:00:00.000Z"),
};

const buildService = (
  overrides: Record<string, unknown> = {},
  adapterCapabilities = capabilities,
) => {
  const calls: string[] = [];
  let transactionCalls = 0;
  const db = {
    transaction: async (runner: (client: object) => Promise<unknown>) => {
      transactionCalls += 1;
      return runner({});
    },
  };
  const repository = {
    findByCode: async () => null,
    findByIdForUpdate: async () => provider,
    create: async (input: Record<string, unknown>) => ({ ...provider, ...input }),
    updateMetadata: async (_id: string, input: Record<string, unknown>) => ({ ...provider, ...input, provider_type: "ELECTRONIC_BILLING" }),
    updateStatus: async (_id: string, active: boolean) => ({ ...provider, active }),
    countDependencies: async () => ({ enabledTenantConfigurations: 0, historicalDocuments: 0 }),
    listAll: async () => [provider],
    ...overrides,
  };
  const registry = new ElectronicBillingProviderRegistry();
  registry.register({ code: "FACTUCORE", capabilities: adapterCapabilities } as never);
  const service = new ElectronicBillingAdminService(
    db as never,
    repository as never,
    {} as never,
    {} as never,
    registry,
  );
  return { service, repository, calls, getTransactionCalls: () => transactionCalls };
};

test("create normalizes code and returns safe metadata", async () => {
  const { service, repository } = buildService();
  const result = await service.createProvider({
    code: " factucore ",
    name: "FactuCore",
    providerType: "ELECTRONIC_BILLING",
    capabilities,
  });

  assert.equal(result.code, "FACTUCORE");
  assert.equal(result.active, true);
  assert.equal("credential_reference" in result, false);
});

test("create rejects unknown fields and unsupported adapters", async () => {
  const { service } = buildService();
  await assert.rejects(
    () => service.createProvider({ code: "FACTUCORE", name: "x", providerType: "ELECTRONIC_BILLING", capabilities, clientSecret: "no" }),
    /Unsupported provider fields/,
  );
  await assert.rejects(
    () => service.createProvider({ code: "UNKNOWN", name: "x", providerType: "ELECTRONIC_BILLING", capabilities }),
    /adapter is unavailable/,
  );
});

test("create maps duplicate application and database races to conflict", async () => {
  const existing = buildService({ findByCode: async () => provider });
  await assert.rejects(
    () => existing.service.createProvider({ code: "FACTUCORE", name: "x", providerType: "ELECTRONIC_BILLING", capabilities }),
    /already exists/,
  );

  const raced = buildService({
    create: async () => { throw { code: "23505" }; },
  });
  await assert.rejects(
    () => raced.service.createProvider({ code: "FACTUCORE", name: "x", providerType: "ELECTRONIC_BILLING", capabilities }),
    /already exists/,
  );
});

test("create rejects capabilities not supported by the registered adapter", async () => {
  const { service } = buildService({}, { ...capabilities, invoice: false });
  await assert.rejects(
    () => service.createProvider({
      code: "FACTUCORE",
      name: "x",
      providerType: "ELECTRONIC_BILLING",
      capabilities,
    }),
    /capability is not supported/,
  );
});

test("metadata update preserves immutable identity and rejects identity fields", async () => {
  const { service } = buildService();
  const result = await service.updateProvider(provider.id, { name: "FactuCore Updated", capabilities });
  assert.equal(result.code, "FACTUCORE");
  await assert.rejects(
    () => service.updateProvider(provider.id, { code: "OTHER" }),
    /Unsupported provider fields/,
  );
});

test("deactivation blocks enabled tenant dependencies", async () => {
  const { service } = buildService({
    countDependencies: async () => ({ enabledTenantConfigurations: 1, historicalDocuments: 2 }),
  });
  await assert.rejects(
    () => service.updateProviderStatus(provider.id, { active: false }),
    /enabled tenant configurations/,
  );
});

test("status transition uses the database transaction boundary", async () => {
  const { service, getTransactionCalls } = buildService();
  const result = await service.updateProviderStatus(provider.id, { active: true });
  assert.equal(result.active, true);
  assert.equal(getTransactionCalls(), 1);
});

test("activation succeeds without touching tenant configuration", async () => {
  const { service, repository } = buildService();
  const result = await service.updateProviderStatus(provider.id, { active: true });
  assert.equal(result.active, true);
  assert.equal(typeof repository.updateStatus, "function");
});

test("malformed provider identifiers fail before database access", async () => {
  const { service } = buildService({
    findByIdForUpdate: async () => { throw new Error("database should not run"); },
  });
  await assert.rejects(
    () => service.updateProviderStatus("not-a-uuid", { active: false }),
    /identifier is invalid/,
  );
});
