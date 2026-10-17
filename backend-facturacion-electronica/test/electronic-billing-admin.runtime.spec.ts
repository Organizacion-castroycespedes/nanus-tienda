import assert from "node:assert/strict";
import test from "node:test";
import "reflect-metadata";
import { Module } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { DatabaseService } from "../src/modules/database/database.service";
import { ElectronicBillingAdminController } from "../src/modules/electronic-billing/admin/electronic-billing-admin.controller";
import { ElectronicBillingAdminService } from "../src/modules/electronic-billing/admin/electronic-billing-admin.service";
import { ElectronicBillingProviderResolver } from "../src/modules/electronic-billing/providers/electronic-billing-provider-resolver";
import { ElectronicBillingProviderRegistry } from "../src/modules/electronic-billing/providers/electronic-billing-provider-registry";
import {
  ElectronicBillingProviderRepository,
  TenantElectronicBillingConfigRepository,
} from "../src/modules/electronic-billing/repositories";

const tenantId = "00000000-0000-0000-0000-000000000001";
const internalToken = "runtime-test-token";

@Module({
  controllers: [ElectronicBillingAdminController],
  providers: [
    ElectronicBillingAdminService,
    {
      provide: DatabaseService,
      useValue: {
        query: async () => ({ rows: [{ id: tenantId }] }),
        getConnectionConfig: () => ({ database: "manus_tienda_qa" }),
      },
    },
    {
      provide: ElectronicBillingProviderRepository,
      useValue: {
        listAll: async () => [
          {
            id: "provider-1",
            code: "FACTUCORE",
            name: "FactuCore",
            active: true,
            capabilities: {},
          },
        ],
      },
    },
    {
      provide: TenantElectronicBillingConfigRepository,
      useValue: {
        listSafeForTenant: async () => [],
      },
    },
    {
      provide: ElectronicBillingProviderResolver,
      useValue: { resolve: async () => { throw new Error("not used by this read test"); } },
    },
    {
      provide: ElectronicBillingProviderRegistry,
      useValue: { resolve: () => ({ capabilities: {} }) },
    },
  ],
})
class ElectronicBillingAdminRuntimeTestModule {}

const createAdminService = (db: {
  query: (text: string, params?: unknown[]) => Promise<unknown>;
  getConnectionConfig: () => { database: string };
}, operationalApproval = { getApproval: () => ({ operationalOwnership: "UNKNOWN" as const, recoveryReadiness: "UNKNOWN" as const }) }) => new ElectronicBillingAdminService(
  db as never,
  {} as never,
  {} as never,
  {} as never,
  {} as never,
  operationalApproval,
);

const withReadinessEnv = async (
  query: (text: string) => Promise<unknown>,
  assertion: (readiness: Awaited<ReturnType<ElectronicBillingAdminService["getRuntimeCryptoReadiness"]>>) => void,
) => {
  const previousKeys = process.env.ELECTRONIC_BILLING_ENCRYPTION_KEYS;
  const previousActiveKey = process.env.ELECTRONIC_BILLING_ENCRYPTION_ACTIVE_KEY_ID;
  const previousWrites = process.env.ELECTRONIC_BILLING_CREDENTIAL_WRITES_ENABLED;
  process.env.ELECTRONIC_BILLING_ENCRYPTION_KEYS = JSON.stringify({ "test-key": "11".repeat(32) });
  process.env.ELECTRONIC_BILLING_ENCRYPTION_ACTIVE_KEY_ID = "test-key";
  process.env.ELECTRONIC_BILLING_CREDENTIAL_WRITES_ENABLED = "false";
  try {
    const service = createAdminService({
      getConnectionConfig: () => ({ database: "manus_tienda_qa" }),
      query,
    });
    assertion(await service.getRuntimeCryptoReadiness());
  } finally {
    if (previousKeys === undefined) delete process.env.ELECTRONIC_BILLING_ENCRYPTION_KEYS;
    else process.env.ELECTRONIC_BILLING_ENCRYPTION_KEYS = previousKeys;
    if (previousActiveKey === undefined) delete process.env.ELECTRONIC_BILLING_ENCRYPTION_ACTIVE_KEY_ID;
    else process.env.ELECTRONIC_BILLING_ENCRYPTION_ACTIVE_KEY_ID = previousActiveKey;
    if (previousWrites === undefined) delete process.env.ELECTRONIC_BILLING_CREDENTIAL_WRITES_ENABLED;
    else process.env.ELECTRONIC_BILLING_CREDENTIAL_WRITES_ENABLED = previousWrites;
  }
};

test("runtime readiness reports schema READY only with exact V106 evidence", async () => {
  let queryText = "";
  await withReadinessEnv(
    async (text) => {
      queryText = text;
      return {
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
    },
    (readiness) => {
      assert.equal(readiness.schemaMigration, "READY");
      assert.equal(readiness.keyringStatus, "READY");
      assert.equal(readiness.syntheticSelfTest, "PASS");
      assert.equal(readiness.credentialWrites, "DISABLED");
      assert.equal(readiness.writeReady, false);
    },
  );
  assert.match(queryText, /actual\.udt_name = expected\.udt_name/);
  assert.match(queryText, /\('created_at', 'timestamptz', 'NO'\)/);
  assert.match(queryText, /WHERE version = \$1/);
  assert.match(queryText, /LOWER\(checksum\) = LOWER\(\$2\)/);
});

test("runtime write readiness requires trusted ownership and recovery evidence", async () => {
  const previousWrites = process.env.ELECTRONIC_BILLING_CREDENTIAL_WRITES_ENABLED;
  const previousKeys = process.env.ELECTRONIC_BILLING_ENCRYPTION_KEYS;
  const previousActiveKey = process.env.ELECTRONIC_BILLING_ENCRYPTION_ACTIVE_KEY_ID;
  process.env.ELECTRONIC_BILLING_CREDENTIAL_WRITES_ENABLED = "true";
  process.env.ELECTRONIC_BILLING_ENCRYPTION_KEYS = JSON.stringify({ "test-key": "11".repeat(32) });
  process.env.ELECTRONIC_BILLING_ENCRYPTION_ACTIVE_KEY_ID = "test-key";
  try {
    const service = createAdminService({
      getConnectionConfig: () => ({ database: "manus_tienda_qa" }),
      query: async () => ({ rows: [{
        databaseName: "manus_tienda_qa",
        schemaName: "public",
        auditTableExists: true,
        historyRows: 1,
        exactHistoryRows: 1,
        expectedColumns: 7,
        expectedIndexes: 2,
      }] }),
    }, { getApproval: () => ({ operationalOwnership: "APPROVED", recoveryReadiness: "APPROVED" }) });
    const readiness = await service.getRuntimeCryptoReadiness();
    assert.equal(readiness.operationalOwnership, "APPROVED");
    assert.equal(readiness.recoveryReadiness, "APPROVED");
    assert.equal(readiness.writeReady, true);
  } finally {
    if (previousWrites === undefined) delete process.env.ELECTRONIC_BILLING_CREDENTIAL_WRITES_ENABLED;
    else process.env.ELECTRONIC_BILLING_CREDENTIAL_WRITES_ENABLED = previousWrites;
    if (previousKeys === undefined) delete process.env.ELECTRONIC_BILLING_ENCRYPTION_KEYS;
    else process.env.ELECTRONIC_BILLING_ENCRYPTION_KEYS = previousKeys;
    if (previousActiveKey === undefined) delete process.env.ELECTRONIC_BILLING_ENCRYPTION_ACTIVE_KEY_ID;
    else process.env.ELECTRONIC_BILLING_ENCRYPTION_ACTIVE_KEY_ID = previousActiveKey;
  }
});

test("QA write readiness does not require the manual credential-write flag", async () => {
  const previousEnvironment = process.env.NODE_ENV;
  const previousWrites = process.env.ELECTRONIC_BILLING_CREDENTIAL_WRITES_ENABLED;
  const previousKeys = process.env.ELECTRONIC_BILLING_ENCRYPTION_KEYS;
  const previousActiveKey = process.env.ELECTRONIC_BILLING_ENCRYPTION_ACTIVE_KEY_ID;
  process.env.NODE_ENV = "qa";
  process.env.ELECTRONIC_BILLING_CREDENTIAL_WRITES_ENABLED = "false";
  process.env.ELECTRONIC_BILLING_ENCRYPTION_KEYS = JSON.stringify({ "test-key": "11".repeat(32) });
  process.env.ELECTRONIC_BILLING_ENCRYPTION_ACTIVE_KEY_ID = "test-key";
  try {
    const service = createAdminService({
      getConnectionConfig: () => ({ database: "manus_tienda_qa" }),
      query: async () => ({ rows: [{
        databaseName: "manus_tienda_qa",
        schemaName: "public",
        auditTableExists: true,
        historyRows: 1,
        exactHistoryRows: 1,
        expectedColumns: 7,
        expectedIndexes: 2,
      }] }),
    });
    const readiness = await service.getRuntimeCryptoReadiness();
    assert.equal(readiness.operationalOwnership, "UNKNOWN");
    assert.equal(readiness.recoveryReadiness, "UNKNOWN");
    assert.equal(readiness.credentialWrites, "DISABLED");
    assert.equal(readiness.writeReady, true);
  } finally {
    if (previousEnvironment === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousEnvironment;
    if (previousWrites === undefined) delete process.env.ELECTRONIC_BILLING_CREDENTIAL_WRITES_ENABLED;
    else process.env.ELECTRONIC_BILLING_CREDENTIAL_WRITES_ENABLED = previousWrites;
    if (previousKeys === undefined) delete process.env.ELECTRONIC_BILLING_ENCRYPTION_KEYS;
    else process.env.ELECTRONIC_BILLING_ENCRYPTION_KEYS = previousKeys;
    if (previousActiveKey === undefined) delete process.env.ELECTRONIC_BILLING_ENCRYPTION_ACTIVE_KEY_ID;
    else process.env.ELECTRONIC_BILLING_ENCRYPTION_ACTIVE_KEY_ID = previousActiveKey;
  }
});

test("production write readiness still requires V107 approval", async () => {
  const previousEnvironment = process.env.NODE_ENV;
  const previousWrites = process.env.ELECTRONIC_BILLING_CREDENTIAL_WRITES_ENABLED;
  const previousKeys = process.env.ELECTRONIC_BILLING_ENCRYPTION_KEYS;
  const previousActiveKey = process.env.ELECTRONIC_BILLING_ENCRYPTION_ACTIVE_KEY_ID;
  process.env.NODE_ENV = "production";
  process.env.ELECTRONIC_BILLING_CREDENTIAL_WRITES_ENABLED = "true";
  process.env.ELECTRONIC_BILLING_ENCRYPTION_KEYS = JSON.stringify({ "test-key": "11".repeat(32) });
  process.env.ELECTRONIC_BILLING_ENCRYPTION_ACTIVE_KEY_ID = "test-key";
  try {
    const service = createAdminService({
      getConnectionConfig: () => ({ database: "manus_tienda_qa" }),
      query: async () => ({ rows: [{
        databaseName: "manus_tienda_qa",
        schemaName: "public",
        auditTableExists: true,
        historyRows: 1,
        exactHistoryRows: 1,
        expectedColumns: 7,
        expectedIndexes: 2,
      }] }),
    });
    const readiness = await service.getRuntimeCryptoReadiness();
    assert.equal(readiness.writeReady, false);
    assert.equal(readiness.operationalOwnership, "UNKNOWN");
    assert.equal(readiness.recoveryReadiness, "UNKNOWN");
  } finally {
    if (previousEnvironment === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousEnvironment;
    if (previousWrites === undefined) delete process.env.ELECTRONIC_BILLING_CREDENTIAL_WRITES_ENABLED;
    else process.env.ELECTRONIC_BILLING_CREDENTIAL_WRITES_ENABLED = previousWrites;
    if (previousKeys === undefined) delete process.env.ELECTRONIC_BILLING_ENCRYPTION_KEYS;
    else process.env.ELECTRONIC_BILLING_ENCRYPTION_KEYS = previousKeys;
    if (previousActiveKey === undefined) delete process.env.ELECTRONIC_BILLING_ENCRYPTION_ACTIVE_KEY_ID;
    else process.env.ELECTRONIC_BILLING_ENCRYPTION_ACTIVE_KEY_ID = previousActiveKey;
  }
});

test("runtime readiness stays UNKNOWN when schema inspection is unavailable", async () => {
  await withReadinessEnv(
    async () => { throw new Error("database unavailable"); },
    (readiness) => {
      assert.equal(readiness.schemaMigration, "UNKNOWN");
      assert.equal(readiness.keyringStatus, "READY");
      assert.equal(readiness.credentialWrites, "DISABLED");
      assert.equal(readiness.writeReady, false);
    },
  );
});

test("runtime readiness stays UNKNOWN when V106 checksum evidence is inconsistent", async () => {
  await withReadinessEnv(
    async () => ({
      rows: [{
        databaseName: "manus_tienda_qa",
        schemaName: "public",
        auditTableExists: true,
        historyRows: 1,
        exactHistoryRows: 0,
        expectedColumns: 7,
        expectedIndexes: 2,
      }],
    }),
    (readiness) => {
      assert.equal(readiness.schemaMigration, "UNKNOWN");
      assert.equal(readiness.keyringStatus, "READY");
      assert.equal(readiness.credentialWrites, "DISABLED");
      assert.equal(readiness.writeReady, false);
    },
  );
});

test("real billing Nest module injects admin service and serves both protected reads", async () => {
  const previousToken = process.env.API_INTERNAL_TOKEN;
  process.env.API_INTERNAL_TOKEN = internalToken;
  const app = await NestFactory.createApplicationContext(
    ElectronicBillingAdminRuntimeTestModule,
    { logger: false },
  );

  try {
    const controller = app.get(ElectronicBillingAdminController);
    assert.ok(controller);
    assert.ok(Reflect.get(controller, "service"));

    const providers = await controller.listProviders(`Bearer ${internalToken}`);
    assert.equal(providers.providers[0]?.code, "FACTUCORE");

    const configuration = await controller.getTenantConfiguration(
      `Bearer ${internalToken}`,
      tenantId,
    );
    assert.equal(configuration.tenantId, tenantId);

    await assert.rejects(
      () => controller.listProviders("Bearer wrong-token"),
      /Invalid internal authorization token/,
    );
  } finally {
    await app.close();
    if (previousToken === undefined) {
      delete process.env.API_INTERNAL_TOKEN;
    } else {
      process.env.API_INTERNAL_TOKEN = previousToken;
    }
  }
});
