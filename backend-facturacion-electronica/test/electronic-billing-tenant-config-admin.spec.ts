import assert from "node:assert/strict";
import test from "node:test";
import {
  ElectronicBillingAdminService,
  ElectronicBillingTenantConfigWriteUnavailableError,
} from "../src/modules/electronic-billing/admin/electronic-billing-admin.service";
import type { ElectronicBillingOperationalApproval } from "../src/modules/electronic-billing/admin/electronic-billing-write-readiness";

const approvedOperationalProvider = {
  getApproval: (): ElectronicBillingOperationalApproval => ({
    operationalOwnership: "APPROVED",
    recoveryReadiness: "APPROVED",
  }),
};

const schemaReadyQueryResult = {
  rows: [{
    databaseName: "manus_tienda_qa",
    schemaName: "public",
    auditTableExists: true,
    historyRows: 1,
    exactHistoryRows: 1,
    expectedColumns: 7,
    expectedIndexes: 2,
  }],
};

test("tenant credential write fails closed when operational keyring is absent", async () => {
  delete process.env.ELECTRONIC_BILLING_ENCRYPTION_KEYS;
  delete process.env.ELECTRONIC_BILLING_ENCRYPTION_KEY;

  const service = new ElectronicBillingAdminService(
    { transaction: async () => undefined, query: async () => ({ rows: [] }), getConnectionConfig: () => ({ database: "manus_tienda_qa" }) } as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );

  await assert.rejects(
    service.createTenantConfiguration(
      "00000000-0000-4000-8000-000000000001",
      {
        providerId: "00000000-0000-4000-8000-000000000002",
        environment: "TEST",
        clientKey: "qa-client-key",
        clientSecret: "qa-client-secret",
      },
    ),
    (error: unknown) => error instanceof ElectronicBillingTenantConfigWriteUnavailableError,
  );
});

test("tenant credential write fails closed when the keyring is ready but the write gate is disabled", async () => {
  process.env.ELECTRONIC_BILLING_ENCRYPTION_ACTIVE_KEY_ID = "qa-key";
  process.env.ELECTRONIC_BILLING_ENCRYPTION_KEYS = JSON.stringify({ "qa-key": "11".repeat(32) });
  delete process.env.ELECTRONIC_BILLING_CREDENTIAL_WRITES_ENABLED;

  const service = new ElectronicBillingAdminService(
    { transaction: async () => undefined, query: async () => ({ rows: [] }), getConnectionConfig: () => ({ database: "manus_tienda_qa" }) } as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );

  await assert.rejects(
    service.createTenantConfiguration(
      "00000000-0000-4000-8000-000000000001",
      {
        providerId: "00000000-0000-4000-8000-000000000002",
        environment: "TEST",
        clientKey: "synthetic-key",
        clientSecret: "synthetic-secret",
      },
    ),
    (error: unknown) => error instanceof ElectronicBillingTenantConfigWriteUnavailableError,
  );
});

const enableTestKeyring = () => {
  process.env.ELECTRONIC_BILLING_CREDENTIAL_WRITES_ENABLED = "true";
  process.env.ELECTRONIC_BILLING_ENCRYPTION_ACTIVE_KEY_ID = "qa-key";
  process.env.ELECTRONIC_BILLING_ENCRYPTION_KEYS = JSON.stringify({ "qa-key": "11".repeat(32) });
};

test.afterEach(() => {
  delete process.env.ELECTRONIC_BILLING_CREDENTIAL_WRITES_ENABLED;
  delete process.env.ELECTRONIC_BILLING_ENCRYPTION_ACTIVE_KEY_ID;
  delete process.env.ELECTRONIC_BILLING_ENCRYPTION_KEYS;
  delete process.env.NODE_ENV;
});

test("accepts the observed QA tenant and configuration UUIDs for V2 replacement", async () => {
  const tenantId = "00000000-0000-0000-0000-000000000001";
  const configId = "b17881f1-6a35-4cbd-b6b1-355baed05943";
  const providerId = "00000000-0000-4000-8000-000000000002";
  process.env.NODE_ENV = "qa";
  enableTestKeyring();
  let updateInput: Record<string, unknown> | undefined;
  const service = new ElectronicBillingAdminService(
    {
      transaction: async (runner: (client: unknown) => Promise<unknown>) => runner({}),
      query: async () => schemaReadyQueryResult,
      getConnectionConfig: () => ({ database: "manus_tienda_qa" }),
    } as never,
    {} as never,
    {
      findByIdForUpdate: async () => ({
        id: configId,
        tenant_id: tenantId,
        provider_id: providerId,
        environment: "HABILITATION",
        enabled: true,
        is_default: true,
        encrypted_credentials: "v2.existing",
      }),
      updateAdministrative: async (_id: string, _tenantId: string, input: Record<string, unknown>) => {
        updateInput = input;
        return {
          id: configId,
          tenant_id: tenantId,
          provider_id: providerId,
          environment: "HABILITATION",
          enabled: true,
          is_default: true,
          encrypted_credentials: input.encryptedCredentials,
        };
      },
      insertAdministrativeAudit: async () => undefined,
    } as never,
    {} as never,
    {} as never,
  );

  const result = await service.updateTenantConfiguration(tenantId, configId, {
    baseUrl: "https://qa.factucore.local",
    settings: { factuCoreTenantId: "d5bacedc-c3cd-48bf-b1a9-e4327ef0ffdc" },
    clientKey: "synthetic-client-key",
    clientSecret: "synthetic-client-secret",
  });

  assert.equal(result.credentialConfigured, true);
  assert.match(String(updateInput?.encryptedCredentials), /^v2\./);
  assert.doesNotMatch(String(updateInput?.encryptedCredentials), /synthetic-client-(key|secret)/);
});

test("creates disabled tenant configuration and audits inside one transaction without returning ciphertext", async () => {
  enableTestKeyring();
  const clientQueries: string[] = [];
  const audits: unknown[] = [];
  const created = {
    id: "00000000-0000-4000-8000-000000000003",
    tenant_id: "00000000-0000-4000-8000-000000000001",
    provider_id: "00000000-0000-4000-8000-000000000002",
    environment: "TEST" as const,
    enabled: false,
    is_default: false,
    encrypted_credentials: "v2.hidden",
  };
  const service = new ElectronicBillingAdminService(
    {
      transaction: async (runner: (client: { query: (sql: string, params: unknown[]) => Promise<{ rows: unknown[] }> }) => Promise<unknown>) =>
        runner({ query: async (sql) => { clientQueries.push(sql); return { rows: [{}] }; } }),
      query: async () => schemaReadyQueryResult,
      getConnectionConfig: () => ({ database: "manus_tienda_qa" }),
    } as never,
    { findByIdForUpdate: async () => ({ id: created.provider_id, code: "FACTUCORE", capabilities: { invoice: true } }) } as never,
    {
      findByTenantAndProvider: async () => null,
      create: async (input: Record<string, unknown>) => ({ ...created, encrypted_credentials: input.encryptedCredentials }),
      insertAdministrativeAudit: async (input: unknown) => audits.push(input),
    } as never,
    {} as never,
    { resolve: () => ({ capabilities: { invoice: true } }) } as never,
    approvedOperationalProvider,
  );

  const result = await service.createTenantConfiguration(created.tenant_id, {
    providerId: created.provider_id,
    environment: "TEST",
    clientKey: "qa-key",
    clientSecret: "qa-secret",
  });

  assert.deepEqual(result, {
    id: created.id,
    tenantId: created.tenant_id,
    providerId: created.provider_id,
    environment: "TEST",
    enabled: false,
    isDefault: false,
    credentialConfigured: true,
  });
  assert.equal(audits.length, 1);
  assert.ok(clientQueries.some((query) => query.includes("FOR UPDATE")));
  assert.doesNotMatch(JSON.stringify(result), /clientSecret|ciphertext|encrypted_credentials/);
});

test("metadata update omits credentials and preserves prior ciphertext contract", async () => {
  enableTestKeyring();
  let updateInput: Record<string, unknown> | undefined;
  const service = new ElectronicBillingAdminService(
    { transaction: async (runner: (client: unknown) => Promise<unknown>) => runner({}), query: async () => ({ rows: [] }) } as never,
    {} as never,
    {
      findByIdForUpdate: async () => ({
        id: "00000000-0000-4000-8000-000000000003",
        tenant_id: "00000000-0000-4000-8000-000000000001",
        provider_id: "00000000-0000-4000-8000-000000000002",
        environment: "TEST",
        enabled: false,
        is_default: false,
        encrypted_credentials: "v2.existing",
      }),
      updateAdministrative: async (_id: string, _tenantId: string, input: Record<string, unknown>) => {
        updateInput = input;
        return {
          id: "00000000-0000-4000-8000-000000000003",
          tenant_id: "00000000-0000-4000-8000-000000000001",
          provider_id: "00000000-0000-4000-8000-000000000002",
          environment: "TEST",
          enabled: false,
          is_default: false,
          encrypted_credentials: "v2.existing",
        };
      },
      insertAdministrativeAudit: async () => undefined,
    } as never,
    {} as never,
    {} as never,
  );

  await service.updateTenantConfiguration(
    "00000000-0000-4000-8000-000000000001",
    "00000000-0000-4000-8000-000000000003",
    { settings: { factuCoreTenantId: null } },
  );

  assert.equal(updateInput?.encryptedCredentials, null);
});

test("credential replacement stays blocked when ownership or recovery is unknown", async () => {
  enableTestKeyring();
  let transactionCalled = false;
  const service = new ElectronicBillingAdminService(
    {
      getConnectionConfig: () => ({ database: "manus_tienda_qa" }),
      query: async () => schemaReadyQueryResult,
      transaction: async () => {
        transactionCalled = true;
        return undefined;
      },
    } as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );

  await assert.rejects(
    service.updateTenantConfiguration(
      "00000000-0000-4000-8000-000000000001",
      "00000000-0000-4000-8000-000000000003",
      { clientKey: "new-key", clientSecret: "new-secret" },
    ),
    (error: unknown) => error instanceof ElectronicBillingTenantConfigWriteUnavailableError,
  );
  assert.equal(transactionCalled, false);
});

test("propagates audit failure so the transaction boundary can roll back configuration", async () => {
  enableTestKeyring();
  let transactionRejected = false;
  const service = new ElectronicBillingAdminService(
    {
      transaction: async (runner: (client: unknown) => Promise<unknown>) => {
        try {
          return await runner({});
        } catch (error) {
          transactionRejected = true;
          throw error;
        }
      },
      query: async () => ({ rows: [] }),
    } as never,
    {} as never,
    {
      findByIdForUpdate: async () => ({
      id: "00000000-0000-4000-8000-000000000003",
      tenant_id: "00000000-0000-4000-8000-000000000001",
      provider_id: "00000000-0000-4000-8000-000000000002",
      environment: "TEST",
      enabled: false,
      is_default: false,
      encrypted_credentials: "v2.existing",
      }),
      updateAdministrative: async () => ({
        id: "00000000-0000-4000-8000-000000000003",
        tenant_id: "00000000-0000-4000-8000-000000000001",
        provider_id: "00000000-0000-4000-8000-000000000002",
        environment: "TEST",
        enabled: false,
        is_default: false,
        encrypted_credentials: "v2.existing",
      }),
      insertAdministrativeAudit: async () => { throw new Error("audit unavailable"); },
    } as never,
    {} as never,
    {} as never,
  );

  await assert.rejects(() => service.updateTenantConfiguration(
    "00000000-0000-4000-8000-000000000001",
    "00000000-0000-4000-8000-000000000003",
    { settings: { factuCoreTenantId: null } },
  ), /audit unavailable/);
  assert.equal(transactionRejected, true);
});
