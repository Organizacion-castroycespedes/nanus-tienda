import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { calculateTerminalBounds, shouldRecoverRenderer } from "./window-policy.js";

describe("terminal window policy", () => {
  it("fits the display work area without a hardcoded resolution", () => {
    assert.deepEqual(calculateTerminalBounds({ x: 100, y: 20, width: 1600, height: 900 }), {
      x: 100,
      y: 20,
      width: 1600,
      height: 900,
    });
  });

  it("bounds renderer recovery to three attempts per minute", () => {
    assert.equal(shouldRecoverRenderer([1000, 2000], 3000), true);
    assert.equal(shouldRecoverRenderer([1000, 2000, 2500], 3000), false);
    assert.equal(shouldRecoverRenderer([1000, 2000, 2500], 70_001), true);
  });
});
