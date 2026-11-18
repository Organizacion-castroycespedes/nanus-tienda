import assert from "node:assert/strict";
import test from "node:test";
import {
  scheduleStartupDiscovery,
  shouldRunStartupDiscovery,
} from "../src/platform/peripheral-discovery-policy";

test("startup discovery requires both explicit boolean controls", () => {
  assert.equal(shouldRunStartupDiscovery({ realAdaptersEnabled: false, discoverOnStartup: true }), false);
  assert.equal(shouldRunStartupDiscovery({ realAdaptersEnabled: true, discoverOnStartup: false }), false);
  assert.equal(shouldRunStartupDiscovery({ realAdaptersEnabled: true, discoverOnStartup: true }), true);
  assert.equal(shouldRunStartupDiscovery({ realAdaptersEnabled: true, discoverOnStartup: undefined as never }), false);
  assert.equal(shouldRunStartupDiscovery({ realAdaptersEnabled: "true" as never, discoverOnStartup: true }), false);
});

test("QA configuration schedules no startup provider call and leaves health path untouched", () => {
  let scheduled = 0;
  let discoveryCalls = 0;
  const accepted = scheduleStartupDiscovery(
    { realAdaptersEnabled: true, discoverOnStartup: false },
    () => { scheduled += 1; },
    () => { discoveryCalls += 1; }
  );

  assert.equal(accepted, false);
  assert.equal(scheduled, 0);
  assert.equal(discoveryCalls, 0);
});

test("explicit production policy schedules one discovery operation", () => {
  let operation: (() => void) | undefined;
  let discoveryCalls = 0;
  const accepted = scheduleStartupDiscovery(
    { realAdaptersEnabled: true, discoverOnStartup: true },
    (scheduled) => { operation = scheduled; },
    () => { discoveryCalls += 1; }
  );

  assert.equal(accepted, true);
  assert.equal(discoveryCalls, 0);
  operation?.();
  assert.equal(discoveryCalls, 1);
});
