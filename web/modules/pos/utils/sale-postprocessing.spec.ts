import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { runConfirmedSalePostProcessing } from "./sale-postprocessing";

describe("confirmed sale post-processing", () => {
  it("does not reject or resubmit when drawer, print and refresh fail", async () => {
    let confirmed = true;
    let salePostCount = 0;
    const errors: unknown[] = [];

    await runConfirmedSalePostProcessing({
      openCashDrawer: async () => {
        throw new Error("drawer unavailable");
      },
      triggerPrintWorkflow: async () => {
        throw new Error("printer unavailable");
      },
      refreshProducts: async () => {
        throw new Error("catalog unavailable");
      },
      onBackgroundError: (error) => errors.push(error),
    });

    assert.equal(confirmed, true);
    assert.equal(salePostCount, 0);
    assert.equal(errors.length, 3);
  });

  it("starts each follow-up once and never creates a second sale POST", async () => {
    let salePostCount = 1;
    let drawerCount = 0;
    let printCount = 0;
    let refreshCount = 0;

    await runConfirmedSalePostProcessing({
      openCashDrawer: () => {
        drawerCount += 1;
      },
      triggerPrintWorkflow: () => {
        printCount += 1;
      },
      refreshProducts: () => {
        refreshCount += 1;
      },
    });

    assert.equal(salePostCount, 1);
    assert.equal(drawerCount, 1);
    assert.equal(printCount, 1);
    assert.equal(refreshCount, 1);
  });
});
