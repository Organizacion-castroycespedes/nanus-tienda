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
    () => resolveAgentVersion({ packageVersion: "0.1.1-prd.2", environment: "qa", requestedVersion: "0.1.1-qa.16" }),
    /QA Agent version must be 0\.1\.1-qa\.19/,
  );
});

test("production rejects an override", () => {
  assert.throws(
    () => resolveAgentVersion({ packageVersion: "0.1.1-prd.2", environment: "production", requestedVersion: "0.1.1-qa.12" }),
    /Production Agent version must remain 0\.1\.1-prd\.2/,
  );
});

test("QA rejects the reserved Build 08 qa.17 identity", () => {
  assert.throws(
    () => resolveAgentVersion({ packageVersion: "0.1.1-prd.2", environment: "qa", requestedVersion: "0.1.1-qa.17" }),
    /QA Agent version must be 0\.1\.1-qa\.19/,
  );
});

test("QA rejects the frozen Build 09 qa.18 identity", () => {
  assert.throws(
    () => resolveAgentVersion({ packageVersion: "0.1.1-prd.2", environment: "qa", requestedVersion: "0.1.1-qa.18" }),
    /QA Agent version must be 0\.1\.1-qa\.19/,
  );
});
