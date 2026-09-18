import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  getRetryDelayMs,
  isRecoverableNetworkError,
  nextRetryAttempt,
} from "./connectivity.js";

describe("connectivity recovery policy", () => {
  it("recognizes recoverable Electron network errors", () => {
    for (const errorCode of [-105, -106, -118, -101, -102, -21, -7]) {
      assert.equal(isRecoverableNetworkError(errorCode), true);
    }
    assert.equal(isRecoverableNetworkError(-3), false);
    assert.equal(isRecoverableNetworkError(401), false);
  });

  it("uses bounded backoff without creating a second policy", () => {
    assert.deepEqual([0, 1, 2, 3, 4, 5].map(getRetryDelayMs), [2_000, 4_000, 8_000, 15_000, 30_000, 30_000]);
    assert.equal(nextRetryAttempt(0), 1);
    assert.equal(nextRetryAttempt(4), 5);
  });
});
