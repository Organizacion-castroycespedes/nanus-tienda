import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { loadAgentLocalConfig } from "../src/platform/agent-local-config";

const withConfig = (value: object, environment: NodeJS.ProcessEnv = {}) => {
  const directory = mkdtempSync(join(tmpdir(), "manus-agent-config-"));
  const configPath = join(directory, "agent.config.local.json");
  writeFileSync(configPath, JSON.stringify(value), "utf8");
  try {
    loadAgentLocalConfig(environment, configPath);
    return environment;
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
};

test("derives REAL mode from legacy persisted real-adapter config", () => {
  const environment = withConfig({ enableRealAdapters: true });

  assert.equal(environment.PERIPHERALS_MODE, "REAL");
  assert.equal(environment.PERIPHERALS_ENABLE_REAL_ADAPTERS, "true");
});

test("preserves explicit mode precedence", () => {
  const environment = withConfig({ mode: "MOCK", enableRealAdapters: true });

  assert.equal(environment.PERIPHERALS_MODE, "MOCK");
});

test("keeps incomplete or mock configs fail-safe", () => {
  assert.equal(withConfig({ enableRealAdapters: false }).PERIPHERALS_MODE, undefined);
  assert.equal(withConfig({}).PERIPHERALS_MODE, undefined);
});

test("loads only trusted non-secret enrollment configuration from the managed Agent config", () => {
  const environment = withConfig({ enrollmentApiBaseUrl: "https://api.example.invalid/api",
    enrollmentSigningPublicKeyPem: "PUBLIC-KEY-FIXTURE", enrollmentAudience: "manus-agent:qa",
    enrollmentSigningKeyId: "qa-key-1" });
  assert.equal(environment.PERIPHERALS_ENROLLMENT_API_BASE_URL, "https://api.example.invalid/api");
  assert.equal(environment.PERIPHERALS_ENROLLMENT_SIGNING_PUBLIC_KEY_PEM, "PUBLIC-KEY-FIXTURE");
  assert.equal(environment.PERIPHERALS_ENROLLMENT_AUDIENCE, "manus-agent:qa");
  assert.equal(environment.PERIPHERALS_ENROLLMENT_SIGNING_KEY_ID, "qa-key-1");
  assert.equal(environment.AGENT_ENROLLMENT_SIGNING_PRIVATE_KEY_PEM, undefined);
});

test("rejects attempts to put private or credential material in the Agent JSON config", () => {
  const directory = mkdtempSync(join(tmpdir(), "manus-agent-config-reject-"));
  const configPath = join(directory, "agent.config.local.json");
  writeFileSync(configPath, JSON.stringify({ enrollmentCredential: "not-allowed" }), "utf8");
  try {
    assert.throws(() => loadAgentLocalConfig({}, configPath), /Unsupported Peripheral Agent local configuration key/);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
