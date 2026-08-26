import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  clampFloatingControlPosition,
  FLOATING_CART_STORAGE_KEY,
  FLOATING_CONTROL_DRAG_THRESHOLD,
  FLOATING_CONTROL_MARGIN,
  FLOATING_POS_STORAGE_KEY,
  resolveFloatingControlDefaultPosition,
  shouldTreatFloatingControlMovementAsDrag,
  snapFloatingControlPosition,
} from "./floating-control-position";

describe("floating control position helpers", () => {
  it("clamps positions inside the viewport and below the top boundary", () => {
    const next = clampFloatingControlPosition(
      { x: -40, y: 12 },
      { width: 1280, height: 800 },
      { width: 180, height: 56 },
      96
    );

    assert.equal(next.x, FLOATING_CONTROL_MARGIN);
    assert.equal(next.y, 96);
  });

  it("snaps to the nearest horizontal edge", () => {
    const snappedLeft = snapFloatingControlPosition(
      { x: 200, y: 260 },
      { width: 1280, height: 800 },
      { width: 180, height: 56 },
      96
    );
    const snappedRight = snapFloatingControlPosition(
      { x: 920, y: 260 },
      { width: 1280, height: 800 },
      { width: 180, height: 56 },
      96
    );

    assert.equal(snappedLeft.x, FLOATING_CONTROL_MARGIN);
    assert.equal(snappedRight.x, 1280 - 180 - FLOATING_CONTROL_MARGIN);
  });

  it("resolves the default position for top-right and bottom-right placements", () => {
    const topRight = resolveFloatingControlDefaultPosition(
      "top-right",
      { width: 1280, height: 800 },
      { width: 180, height: 56 },
      96
    );
    const bottomRight = resolveFloatingControlDefaultPosition(
      "bottom-right",
      { width: 1280, height: 800 },
      { width: 220, height: 64 },
      96
    );

    assert.equal(topRight.x, 1280 - 180 - FLOATING_CONTROL_MARGIN);
    assert.equal(topRight.y, 96);
    assert.equal(bottomRight.x, 1280 - 220 - FLOATING_CONTROL_MARGIN);
    assert.equal(bottomRight.y, 800 - 64 - FLOATING_CONTROL_MARGIN);
  });

  it("treats small movement as click and larger movement as drag", () => {
    assert.equal(shouldTreatFloatingControlMovementAsDrag(3, 4), false);
    assert.equal(
      shouldTreatFloatingControlMovementAsDrag(
        FLOATING_CONTROL_DRAG_THRESHOLD,
        0
      ),
      true
    );
  });

  it("keeps POS and cart storage keys independent", () => {
    assert.notEqual(FLOATING_POS_STORAGE_KEY, FLOATING_CART_STORAGE_KEY);
  });
});
