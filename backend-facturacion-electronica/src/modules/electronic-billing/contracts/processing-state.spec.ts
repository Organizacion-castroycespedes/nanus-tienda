import assert from "node:assert/strict";
import test from "node:test";
import { PROCESSING_STAGE_TRANSITIONS } from "./processing-state";

test("processing stage transition matrix keeps intent states reconcile-first", () => {
  const createIntent = PROCESSING_STAGE_TRANSITIONS.find((item) => item.from === "PROVIDER_CREATE_INTENT");
  const transmitIntent = PROCESSING_STAGE_TRANSITIONS.find((item) => item.from === "TRANSMISSION_INTENT");

  assert.equal(createIntent?.recoveryRule, "lookup external reference before repeating combined issueInvoice");
  assert.equal(transmitIntent?.recoveryRule, "poll status; never blindly repeat");
  assert.equal(PROCESSING_STAGE_TRANSITIONS.some((item) => item.externalMutation === "PROVIDER_CREATE" && item.from === "PRE_PROVIDER_CREATE"), false);
});

test("terminal completion has no outgoing processing transition", () => {
  assert.equal(PROCESSING_STAGE_TRANSITIONS.some((item) => item.from === "COMPLETED"), false);
});
