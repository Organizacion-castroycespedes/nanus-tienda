import assert from "node:assert/strict";
import { PassThrough } from "node:stream";
import test from "node:test";
import {
  createQaControl,
  MAX_GLOBAL_DURATION_MS,
  MAX_PHASE_TIMEOUT_MS,
  QaControlError,
} from "../scripts/qa-rochi-disconnect.control.mjs";

const createHarness = (options = {}) => {
  const input = new PassThrough();
  const output = new PassThrough();
  const control = createQaControl({ input, output, ...options });
  return { control, input, output };
};

test("control caps global duration at 60 seconds and phase timeout at 10 seconds", () => {
  const { control } = createHarness({ maxDurationMs: 120_000, phaseTimeoutMs: 20_000 });
  assert.equal(control.remainingMs() <= MAX_GLOBAL_DURATION_MS, true);
  assert.equal(MAX_GLOBAL_DURATION_MS, 60_000);
  assert.equal(MAX_PHASE_TIMEOUT_MS, 10_000);
  control.dispose();
});

test("interactive confirmation accepts YES within the phase timeout", async () => {
  const { control, input } = createHarness({ phaseTimeoutMs: 100, maxDurationMs: 500 });
  const confirmation = control.confirm("open", "open");
  setTimeout(() => input.write("YES\n"), 5);

  await assert.doesNotReject(confirmation);
  control.dispose();
});

test("interactive confirmation returns TIMEOUT and rejects late YES", async () => {
  const { control, input } = createHarness({ phaseTimeoutMs: 20, maxDurationMs: 200 });
  const confirmation = control.confirm("disconnect", "disconnect");

  await assert.rejects(confirmation, (error) => {
    assert.equal(error.code, "TIMEOUT");
    assert.equal(error.stage, "disconnect");
    return true;
  });
  input.write("YES\n");
  assert.equal(control.remainingMs() > 0, true);
  control.dispose();
});

test("Ctrl+C cancellation closes the active confirmation", async () => {
  const { control } = createHarness({ phaseTimeoutMs: 100, maxDurationMs: 500 });
  const confirmation = control.confirm("open", "open");
  control.cancel();

  await assert.rejects(confirmation, (error) => {
    assert.equal(error.code, "CANCELLED");
    return true;
  });
  control.dispose();
});

test("EOF rejects confirmation and does not advance", async () => {
  const { control, input } = createHarness({ phaseTimeoutMs: 100, maxDurationMs: 500 });
  const confirmation = control.confirm("open", "open");
  input.end();

  await assert.rejects(confirmation, (error) => {
    assert.equal(error.code, "EOF");
    return true;
  });
  control.dispose();
});

test("invalid confirmation rejects without opening the next stage", async () => {
  const { control, input } = createHarness({ phaseTimeoutMs: 100, maxDurationMs: 500 });
  const confirmation = control.confirm("open", "open");
  input.write("NO\n");

  await assert.rejects(confirmation, (error) => {
    assert.ok(error instanceof QaControlError);
    assert.equal(error.code, "INVALID_CONFIRMATION");
    return true;
  });
  control.dispose();
});

test("global duration cancels a delay instead of resolving late", async () => {
  const { control } = createHarness({ phaseTimeoutMs: 100, maxDurationMs: 20 });

  await assert.rejects(control.delay(100, "capture"), (error) => {
    assert.equal(error.code, "TIMEOUT");
    assert.equal(error.stage, "capture");
    return true;
  });
  control.dispose();
});

test("dispose is idempotent and leaves no active prompt", async () => {
  const { control } = createHarness({ phaseTimeoutMs: 100, maxDurationMs: 500 });
  const confirmation = control.confirm("open", "open");
  control.dispose();
  control.dispose();

  await assert.rejects(confirmation, (error) => {
    assert.equal(error.code, "EOF");
    return true;
  });
});
