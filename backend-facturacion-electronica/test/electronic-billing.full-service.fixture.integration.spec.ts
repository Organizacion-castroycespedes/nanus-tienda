import assert from "node:assert/strict";
import test from "node:test";
import { Pool } from "pg";

import { RealBillingAggregateFixture } from "./helpers/real-billing-aggregate-fixture";

const enabled = process.env.PGHOST === "localhost"
  && Number(process.env.PGPORT) === 55432
  && process.env.PGDATABASE === "manus_billing_concurrency_test"
  && (process.env.PGUSER ?? "postgres") === "postgres";
const integrationTest = enabled ? test : test.skip;

const withPool = async <T>(runner: (pool: Pool) => Promise<T>) => {
  if (!enabled) {
    throw new Error("Full-service fixture requires the isolated local PostgreSQL database");
  }
  const pool = new Pool({ host: "localhost", port: 55432, database: "manus_billing_concurrency_test", user: "postgres", max: 4 });
  try {
    return await runner(pool);
  } finally {
    await pool.end();
  }
};

integrationTest("real Billing aggregate processes PRE_PROVIDER_CREATE and reloads durable state", async () => {
  await withPool(async (pool) => {
    const fixture = await RealBillingAggregateFixture.create(pool, "PRE_PROVIDER_CREATE");
    try {
      const result = await fixture.processingService.processDocument(fixture.ids.tenant, fixture.ids.document);
      const reloaded = await fixture.reload();
      assert.equal(result.document.id, fixture.ids.document);
      assert.equal(reloaded?.status, "ACCEPTED");
      assert.equal(reloaded?.processing_stage, "COMPLETED");
      assert.equal(reloaded?.provider_document_id, `PHASE511-PHASE511-${fixture.ids.document}`);
      assert.equal(fixture.provider.createCalls, 1);
      const second = await fixture.processingService.processDocument(fixture.ids.tenant, fixture.ids.document);
      assert.equal(second.idempotent, true);
      assert.equal(fixture.provider.createCalls, 1);
    } finally {
      await fixture.cleanup();
    }
  });
});

integrationTest("real Billing aggregate reconciles PROVIDER_LINKED without provider creation", async () => {
  await withPool(async (pool) => {
    const fixture = await RealBillingAggregateFixture.create(pool, "PROVIDER_LINKED", true);
    try {
      const result = await fixture.processingService.reconcileExistingProviderStatus(fixture.ids.tenant, fixture.ids.document);
      const reloaded = await fixture.reload();
      assert.equal(result.document.id, fixture.ids.document);
      assert.equal(reloaded?.status, "ACCEPTED");
      assert.equal(reloaded?.processing_stage, "COMPLETED");
      assert.equal(fixture.provider.createCalls, 0);
      assert.equal(fixture.provider.statusCalls, 1);
    } finally {
      await fixture.cleanup();
    }
  });
});

integrationTest("real Billing aggregate recovers stale PRE_PROVIDER_CREATE safely", async () => {
  await withPool(async (pool) => {
    for (let iteration = 0; iteration < 5; iteration += 1) {
      const fixture = await RealBillingAggregateFixture.create(pool, "PRE_PROVIDER_CREATE");
      try {
        await fixture.markStaleProcessing();
        const result = await fixture.processingService.recoverStaleDocument(fixture.ids.tenant, fixture.ids.document);
        const reloaded = await fixture.reload();
        assert.equal(result.disposition, "RECOVERED_PRE_PROVIDER");
        assert.equal(reloaded?.status, "ACCEPTED");
        assert.equal(reloaded?.processing_stage, "COMPLETED");
        assert.equal(fixture.provider.createCalls, 1);
      } finally {
        await fixture.cleanup();
      }
    }
  });
});

integrationTest("real stale recovery and refresh share lock and preserve ACCEPTED", async () => {
  await withPool(async (pool) => {
    for (let iteration = 0; iteration < 5; iteration += 1) {
      const fixture = await RealBillingAggregateFixture.create(pool, "PROVIDER_LINKED", true);
      try {
        await fixture.markStaleProcessing("PROVIDER_LINKED");
        const [recovery, refresh] = await Promise.all([
          fixture.processingService.recoverStaleDocument(fixture.ids.tenant, fixture.ids.document),
          fixture.processingService.reconcileExistingProviderStatus(fixture.ids.tenant, fixture.ids.document),
        ]);
        const reloaded = await fixture.reload();
        assert.equal(recovery.disposition, "RECONCILIATION_REQUIRED");
        assert.equal(refresh.document.id, fixture.ids.document);
        assert.equal(reloaded?.status, "ACCEPTED");
        assert.equal(reloaded?.processing_stage, "COMPLETED");
        assert.equal(fixture.provider.createCalls, 0);
      } finally {
        await fixture.cleanup();
      }
    }
  });
});

integrationTest("combined issue crash before intent resumes safely", async () => {
  await withPool(async (pool) => {
    for (let iteration = 0; iteration < 5; iteration += 1) {
      const fixture = await RealBillingAggregateFixture.create(pool, "PRE_PROVIDER_CREATE");
      const internals = fixture.processingService as unknown as {
        persistProcessingStage: (...args: unknown[]) => Promise<void>;
      };
      const originalPersistProcessingStage = internals.persistProcessingStage.bind(fixture.processingService);
      internals.persistProcessingStage = async () => {
        throw new Error("test crash before combined intent");
      };
      try {
        await assert.rejects(() => fixture.processingService.processDocument(fixture.ids.tenant, fixture.ids.document));
        assert.equal(fixture.provider.createCalls, 0);
        internals.persistProcessingStage = originalPersistProcessingStage;
        await fixture.markStaleProcessing("PRE_PROVIDER_CREATE");
        const recovered = await fixture.processingService.recoverStaleDocument(fixture.ids.tenant, fixture.ids.document);
        const reloaded = await fixture.reload();
        assert.equal(recovered.disposition, "RECOVERED_PRE_PROVIDER");
        assert.equal(reloaded?.status, "ACCEPTED");
        assert.equal(fixture.provider.createCalls, 1);
      } finally {
        await fixture.cleanup();
      }
    }
  });
});

integrationTest("combined intent crash before issue fails closed without blind issue", async () => {
  await withPool(async (pool) => {
    for (let iteration = 0; iteration < 5; iteration += 1) {
      const fixture = await RealBillingAggregateFixture.create(pool, "PRE_PROVIDER_CREATE");
      const internals = fixture.processingService as unknown as {
        issueWithProvider: (...args: unknown[]) => Promise<never>;
        persistProviderError: (...args: unknown[]) => Promise<never>;
      };
      internals.issueWithProvider = async () => {
        throw new Error("test crash after combined intent");
      };
      internals.persistProviderError = async () => {
        throw new Error("test process loss before error persistence");
      };
      fixture.provider.statusFailure = "NOT_FOUND";
      try {
        await assert.rejects(() => fixture.processingService.processDocument(fixture.ids.tenant, fixture.ids.document));
        assert.equal(fixture.provider.createCalls, 0);
        await fixture.markStaleProcessing("PROVIDER_CREATE_INTENT");
        const recovered = await fixture.processingService.recoverStaleDocument(fixture.ids.tenant, fixture.ids.document);
        assert.equal(recovered.disposition, "RECONCILIATION_REQUIRED");
        assert.equal(fixture.provider.createCalls, 0);
      } finally {
        await fixture.cleanup();
      }
    }
  });
});

integrationTest("combined issue timeout recovers persisted provider by external reference", async () => {
  await withPool(async (pool) => {
    for (let iteration = 0; iteration < 5; iteration += 1) {
      const fixture = await RealBillingAggregateFixture.create(pool, "PRE_PROVIDER_CREATE");
      const internals = fixture.processingService as unknown as {
        persistProviderError: (...args: unknown[]) => Promise<never>;
      };
      fixture.provider.issueFailure = "TIMEOUT_AFTER_PERSIST";
      internals.persistProviderError = async () => {
        throw new Error("test process loss after provider response ambiguity");
      };
      try {
        await assert.rejects(() => fixture.processingService.processDocument(fixture.ids.tenant, fixture.ids.document));
        assert.equal(fixture.provider.createCalls, 1);
        await fixture.markStaleProcessing("PROVIDER_CREATE_INTENT");
        fixture.provider.issueFailure = "NONE";
        const recovered = await fixture.processingService.recoverStaleDocument(fixture.ids.tenant, fixture.ids.document);
        const reloaded = await fixture.reload();
        assert.equal(recovered.disposition, "RECONCILIATION_REQUIRED");
        assert.equal(reloaded?.status, "ACCEPTED");
        assert.equal(reloaded?.provider_document_id, `PHASE511-PHASE511-${fixture.ids.document}`);
        assert.equal(fixture.provider.createCalls, 1);
      } finally {
        await fixture.cleanup();
      }
    }
  });
});

integrationTest("persistent provider status matrix survives service recreation", async () => {
  await withPool(async (pool) => {
    const statuses = ["ACCEPTED", "REJECTED", "PROCESSING", "PENDING"] as const;
    for (const status of statuses) {
      for (let iteration = 0; iteration < 5; iteration += 1) {
        const fixture = await RealBillingAggregateFixture.create(pool, "PROVIDER_LINKED", true);
        try {
          fixture.provider.statusByDocument.set(fixture.ids.document, status);
          let service = fixture.processingService;
          for (let recovery = 0; recovery < 3; recovery += 1) {
            if (recovery === 0 || status === "PROCESSING" || status === "PENDING") {
              await fixture.markStaleProcessing("PROVIDER_LINKED");
            }
            const result = await service.recoverStaleDocument(fixture.ids.tenant, fixture.ids.document);
            assert.equal(result.document.id, fixture.ids.document);
            if (recovery === 0) {
              service = fixture.createProcessingService();
            }
          }
          const reloaded = await fixture.reload();
          assert.equal(reloaded?.status, status);
          assert.equal(fixture.provider.createCalls, 0);
          assert.equal(fixture.provider.providerDocuments.size, 0);
          assert.equal(reloaded?.processing_stage, status === "PROCESSING" || status === "PENDING" ? "RECONCILIATION_REQUIRED" : "COMPLETED");
        } finally {
          await fixture.cleanup();
        }
      }
    }
  });
});

integrationTest("persistent ambiguous combined intent fails closed", async () => {
  await withPool(async (pool) => {
    for (const failure of ["NOT_FOUND", "UNAVAILABLE"] as const) {
      for (let iteration = 0; iteration < 5; iteration += 1) {
        const fixture = await RealBillingAggregateFixture.create(pool, "PROVIDER_CREATE_INTENT");
        try {
          fixture.provider.statusFailure = failure;
          let service = fixture.processingService;
          for (let recovery = 0; recovery < 3; recovery += 1) {
            await fixture.markStaleProcessing("PROVIDER_CREATE_INTENT");
            if (failure === "NOT_FOUND") {
              const result = await service.recoverStaleDocument(fixture.ids.tenant, fixture.ids.document);
              assert.equal(result.disposition, "RECONCILIATION_REQUIRED");
            } else {
              await assert.rejects(() => service.recoverStaleDocument(fixture.ids.tenant, fixture.ids.document));
            }
            service = fixture.createProcessingService();
          }
          assert.equal(fixture.provider.createCalls, 0);
          assert.equal((await fixture.reload())?.processing_stage, "PROVIDER_CREATE_INTENT");
        } finally {
          await fixture.cleanup();
        }
      }
    }
  });
});

integrationTest("unknown stale stage requires manual review", async () => {
  await withPool(async (pool) => {
    for (let iteration = 0; iteration < 5; iteration += 1) {
      const fixture = await RealBillingAggregateFixture.create(pool, "UNKNOWN");
      try {
        await fixture.markStaleProcessing("UNKNOWN");
        const result = await fixture.processingService.recoverStaleDocument(fixture.ids.tenant, fixture.ids.document);
        assert.equal(result.disposition, "MANUAL_REVIEW");
        assert.equal(fixture.provider.createCalls, 0);
        assert.equal((await fixture.reload())?.status, "PROCESSING");
      } finally {
        await fixture.cleanup();
      }
    }
  });
});
