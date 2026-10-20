import assert from "node:assert/strict";
import test from "node:test";
import { ElectronicDocumentAlreadyProcessingError } from "../src/modules/electronic-billing/contracts/electronic-billing-errors";
import { ElectronicBillingGraphicBackfillWorker } from "../src/modules/electronic-billing/workers/electronic-billing-graphic-backfill.worker";

const withEnv = async (value: string | undefined, run: () => Promise<void>) => {
  const previous = process.env.ELECTRONIC_BILLING_GRAPHIC_BACKFILL_ENABLED;
  if (value === undefined) {
    delete process.env.ELECTRONIC_BILLING_GRAPHIC_BACKFILL_ENABLED;
  } else {
    process.env.ELECTRONIC_BILLING_GRAPHIC_BACKFILL_ENABLED = value;
  }
  try {
    await run();
  } finally {
    if (previous === undefined) {
      delete process.env.ELECTRONIC_BILLING_GRAPHIC_BACKFILL_ENABLED;
    } else {
      process.env.ELECTRONIC_BILLING_GRAPHIC_BACKFILL_ENABLED = previous;
    }
  }
};

test("graphic backfill runs by default and stores what the provider returns", async () => {
  await withEnv(undefined, async () => {
    const claims: Array<{ limit: number; maxAttempts: number; retryDelayMs: number }> = [];
    const documentRepository = {
      claimAcceptedMissingGraphicRepresentation: async (options: { limit: number; maxAttempts: number; retryDelayMs: number }) => {
        claims.push(options);
        return [
          { id: "doc-1", tenant_id: "tenant-1" },
          { id: "doc-2", tenant_id: "tenant-1" },
          { id: "doc-3", tenant_id: "tenant-1" },
          { id: "doc-4", tenant_id: "tenant-1" },
        ];
      },
    };
    const processingService = {
      backfillGraphicRepresentation: async (_tenantId: string, id: string) => {
        if (id === "doc-2") return false;
        if (id === "doc-3") throw new ElectronicDocumentAlreadyProcessingError();
        if (id === "doc-4") throw new Error("provider down");
        return true;
      },
    };
    const worker = new ElectronicBillingGraphicBackfillWorker(documentRepository as never, processingService as never);

    const summary = await worker.runOnce();

    assert.deepEqual(summary, { stored: 1, unavailable: 2, errors: 1 });
    assert.equal(claims.length, 1);
    assert.equal(claims[0].limit, 10);
    assert.equal(claims[0].maxAttempts, 20);
    assert.equal(claims[0].retryDelayMs, 6 * 60 * 60 * 1000);
  });
});

test("graphic backfill can be switched off explicitly", async () => {
  await withEnv("false", async () => {
    let claimed = false;
    const worker = new ElectronicBillingGraphicBackfillWorker(
      { claimAcceptedMissingGraphicRepresentation: async () => { claimed = true; return []; } } as never,
      {} as never,
    );

    assert.deepEqual(await worker.runOnce(), { stored: 0, unavailable: 0, errors: 0 });
    assert.equal(claimed, false);
  });
});
