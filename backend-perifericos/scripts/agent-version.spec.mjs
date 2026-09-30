import test from "node:test";
import assert from "node:assert/strict";
import { QA_AGENT_VERSION, resolveAgentVersion } from "./agent-version.mjs";

test("QA uses the approved Agent version", () => {
  assert.equal(resolveAgentVersion({ packageVersion: "0.1.1-prd.2", environment: "qa" }), QA_AGENT_VERSION);
});

test("production keeps the package version", () => {
  assert.equal(resolveAgentVersion({ packageVersion: "0.1.1-prd.2", environment: "production" }), "0.1.1-prd.2");
});

test("QA rejects a different requested version", () => {
  assert.throws(
    () => resolveAgentVersion({ packageVersion: "0.1.1-prd.2", environment: "qa", requestedVersion: "0.1.1-qa.11" }),
    /QA Agent version must be 0\.1\.1-qa\.13/,
  );
});

test("production rejects an override", () => {
  assert.throws(
    () => resolveAgentVersion({ packageVersion: "0.1.1-prd.2", environment: "production", requestedVersion: "0.1.1-qa.12" }),
    /Production Agent version must remain 0\.1\.1-prd\.2/,
  );
});
