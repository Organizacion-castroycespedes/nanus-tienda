import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  calculateTerminalBounds,
  boundsCoverDisplay,
  enforceTerminalWindowState,
  shouldRecoverRenderer,
  showAndEnforceTerminalWindow,
  type TerminalWindowStateTarget,
} from "./window-policy.js";

describe("terminal window policy", () => {
  const createWindow = (fullscreen = false) => {
    const calls: string[] = [];
    let bounds = { x: 0, y: 0, width: 1264, height: 792 };
    const window: TerminalWindowStateTarget = {
      isDestroyed: () => false,
      setMenuBarVisibility: (visible) => calls.push(`menu:${visible}`),
      isFullScreen: () => fullscreen,
      setFullScreen: (value) => {
        calls.push(`fullscreen:${value}`);
        fullscreen = value;
      },
      getBounds: () => bounds,
      setBounds: (nextBounds) => {
        bounds = nextBounds;
        calls.push(`bounds:${nextBounds.width}x${nextBounds.height}`);
      },
      show: () => calls.push("show"),
    };
    return { window, calls };
  };

  it("enforces fullscreen without kiosk or maximize behavior", () => {
    const { window, calls } = createWindow(false);

    enforceTerminalWindowState(window, { x: 0, y: 0, width: 1920, height: 1080 });

    assert.deepEqual(calls, ["menu:false", "fullscreen:true", "bounds:1920x1080"]);
  });

  it("enforces terminal state before and after showing", () => {
    const { window, calls } = createWindow(false);

    showAndEnforceTerminalWindow(window, { x: 0, y: 0, width: 1920, height: 1080 });

    assert.deepEqual(calls, [
      "menu:false",
      "fullscreen:true",
      "bounds:1920x1080",
      "show",
      "menu:false",
    ]);
  });

  it("does not touch a destroyed window", () => {
    const calls: string[] = [];
    const window: TerminalWindowStateTarget = {
      isDestroyed: () => true,
      setMenuBarVisibility: () => calls.push("menu"),
      isFullScreen: () => false,
      setFullScreen: () => calls.push("fullscreen"),
      getBounds: () => ({ x: 0, y: 0, width: 1, height: 1 }),
      setBounds: () => calls.push("bounds"),
      show: () => calls.push("show"),
    };

    showAndEnforceTerminalWindow(window, { x: 0, y: 0, width: 1920, height: 1080 });

    assert.deepEqual(calls, []);
  });

  it("requires correction when fullscreen is true but bounds are wrong", () => {
    const { window, calls } = createWindow(true);

    enforceTerminalWindowState(window, { x: 0, y: 0, width: 1920, height: 1080 });

    assert.deepEqual(calls, ["menu:false", "bounds:1920x1080"]);
  });

  it("accepts exact display bounds and never targets the work area", () => {
    assert.equal(boundsCoverDisplay(
      { x: 0, y: 0, width: 1920, height: 1080 },
      { x: 0, y: 0, width: 1920, height: 1080 },
    ), true);
    assert.equal(boundsCoverDisplay(
      { x: 0, y: 0, width: 1920, height: 1032 },
      { x: 0, y: 0, width: 1920, height: 1080 },
    ), false);
  });

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
