import test from "node:test";
import assert from "node:assert/strict";
import { SaleVoidRequestWorker } from "./sale-void-request.worker";

const withEnv = async (value: string | undefined, run: () => Promise<void> | void) => {
  const original = process.env.SALE_VOID_REQUEST_WORKER_ENABLED;
  if (value === undefined) {
    delete process.env.SALE_VOID_REQUEST_WORKER_ENABLED;
  } else {
    process.env.SALE_VOID_REQUEST_WORKER_ENABLED = value;
  }
  try {
    await run();
  } finally {
    if (original === undefined) {
      delete process.env.SALE_VOID_REQUEST_WORKER_ENABLED;
    } else {
      process.env.SALE_VOID_REQUEST_WORKER_ENABLED = original;
    }
  }
};

test("sale void request worker runs by default without env configuration", async () => {
  await withEnv(undefined, () => {
    const worker = new SaleVoidRequestWorker({
      processDueVoidRequests: async () => ({ processed: 0 }),
    } as never);
    assert.equal((worker as unknown as { enabled: boolean }).enabled, true);
  });
});

test("sale void request worker can be switched off explicitly", async () => {
  await withEnv("false", () => {
    const worker = new SaleVoidRequestWorker({
      processDueVoidRequests: async () => ({ processed: 0 }),
    } as never);
    assert.equal((worker as unknown as { enabled: boolean }).enabled, false);
  });
});
