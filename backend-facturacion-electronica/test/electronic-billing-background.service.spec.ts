import assert from "node:assert/strict";
import test from "node:test";
import { ElectronicBillingBackgroundService } from "../src/modules/electronic-billing/workers";

const tenantId = "00000000-0000-0000-0000-000000010001";
const processingDocumentId = "00000000-0000-0000-0000-000000010002";
const retryDocumentId = "00000000-0000-0000-0000-000000010003";
const maxRetryDocumentId = "00000000-0000-0000-0000-000000010004";

test("background worker stays disabled by default", async () => {
  const originalEnabled = process.env.ELECTRONIC_BILLING_BACKGROUND_ENABLED;
  delete process.env.ELECTRONIC_BILLING_BACKGROUND_ENABLED;

  const documentRepository = {
    claimDueForBackgroundSync: async () => {
      throw new Error("should not be called");
    },
    updateStatus: async () => {
      throw new Error("should not be called");
    },
  };
  const processingService = {
    refreshDocumentStatus: async () => {
      throw new Error("should not be called");
    },
    retryDocument: async () => {
      throw new Error("should not be called");
    },
  };

  const service = new ElectronicBillingBackgroundService(documentRepository as never, processingService as never);
  const summary = await service.runOnce();

  assert.deepEqual(summary, {
    processing: 0,
    retry: 0,
    skipped: 0,
    errors: 0,
  });

  if (originalEnabled === undefined) {
    delete process.env.ELECTRONIC_BILLING_BACKGROUND_ENABLED;
  } else {
    process.env.ELECTRONIC_BILLING_BACKGROUND_ENABLED = originalEnabled;
  }
});

test("background worker refreshes processing documents and retries technical errors", async () => {
  const originalEnabled = process.env.ELECTRONIC_BILLING_BACKGROUND_ENABLED;
  process.env.ELECTRONIC_BILLING_BACKGROUND_ENABLED = "true";

  const claimed: Array<{ statuses: string[]; dueBefore: Date; limit: number }> = [];
  const updates: Array<{ id: string; updates: Record<string, unknown> }> = [];
  const refreshes: Array<{ tenantId: string; id: string }> = [];
  const retries: Array<{ tenantId: string; id: string }> = [];

  const documentRepository = {
    claimDueForBackgroundSync: async (options: { statuses: string[]; dueBefore: Date; limit: number }) => {
      claimed.push(options);
      if (options.statuses.includes("PROCESSING")) {
        return [
          {
            id: processingDocumentId,
            tenant_id: tenantId,
            status: "PROCESSING",
            provider_status: "SENT",
            latest_attempt: 1,
          },
        ];
      }

      if (options.statuses.includes("TECHNICAL_ERROR")) {
        return [
          {
            id: retryDocumentId,
            tenant_id: tenantId,
            status: "TECHNICAL_ERROR",
            provider_status: "TECHNICAL_ERROR",
            latest_attempt: 2,
          },
          {
            id: maxRetryDocumentId,
            tenant_id: tenantId,
            status: "TECHNICAL_ERROR",
            provider_status: "TECHNICAL_ERROR",
            latest_attempt: 5,
          },
        ];
      }

      return [];
    },
    updateStatus: async (tenantIdValue: string, id: string, updatesValue: Record<string, unknown>) => {
      updates.push({ id, updates: updatesValue });
      return { tenantId: tenantIdValue, id };
    },
  };

  const processingService = {
    refreshDocumentStatus: async (tenantIdValue: string, id: string) => {
      refreshes.push({ tenantId: tenantIdValue, id });
      return null;
    },
    retryDocument: async (tenantIdValue: string, id: string) => {
      retries.push({ tenantId: tenantIdValue, id });
      return null;
    },
  };

  const service = new ElectronicBillingBackgroundService(documentRepository as never, processingService as never);
  const summary = await service.runOnce();

  assert.equal(summary.processing, 1);
  assert.equal(summary.retry, 1);
  assert.equal(summary.skipped, 1);
  assert.equal(refreshes.length, 1);
  assert.equal(retries.length, 1);
  assert.equal(updates.length, 1);
  assert.equal(updates[0].id, maxRetryDocumentId);
  assert.equal(claimed.length, 2);
  assert.deepEqual(claimed[0].statuses, ["PROCESSING"]);
  assert.deepEqual(claimed[1].statuses, ["TECHNICAL_ERROR"]);

  if (originalEnabled === undefined) {
    delete process.env.ELECTRONIC_BILLING_BACKGROUND_ENABLED;
  } else {
    process.env.ELECTRONIC_BILLING_BACKGROUND_ENABLED = originalEnabled;
  }
});
