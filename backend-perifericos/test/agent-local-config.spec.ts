import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { getEnvironment } from "../../desktop/electron/scripts/environments.mjs";
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

test("QA profile keeps real adapters and health while locking startup discovery off", () => {
  const environment = withConfig(
    { packageProfile: "qa", mode: "REAL", enableRealAdapters: true, discoverOnStartup: false },
    { PERIPHERALS_DISCOVER_ON_STARTUP: "true" }
  );

  assert.equal(environment.PERIPHERALS_MODE, "REAL");
  assert.equal(environment.PERIPHERALS_ENABLE_REAL_ADAPTERS, "true");
  assert.equal(environment.PERIPHERALS_DISCOVER_ON_STARTUP, "false");
});

test("enables real adapters with startup discovery disabled only in QA", () => {
  assert.equal(getEnvironment("qa").agentRealAdaptersEnabled, true);
  assert.equal(getEnvironment("qa").agentPackageProfile, "qa");
  assert.equal(getEnvironment("qa").agentDiscoveryOnStartupEnabled, false);
  assert.equal(getEnvironment("production").agentPackageProfile, "production");
  assert.equal(getEnvironment("production").agentRealAdaptersEnabled, true);
  assert.equal(getEnvironment("production").agentDiscoveryOnStartupEnabled, true);
  assert.equal(getEnvironment("dev").agentRealAdaptersEnabled, true);
  assert.equal(getEnvironment("dev").agentDiscoveryOnStartupEnabled, true);
});

test("environment discovery setting takes precedence over local JSON", () => {
  const environment = withConfig(
    { packageProfile: "dev", mode: "REAL", enableRealAdapters: true, discoverOnStartup: true },
    { PERIPHERALS_DISCOVER_ON_STARTUP: "false" }
  );

  assert.equal(environment.PERIPHERALS_DISCOVER_ON_STARTUP, "false");
});

test("unverified, missing, and QA profiles ignore inherited startup discovery", () => {
  const qa = withConfig(
    { packageProfile: "qa", mode: "REAL", enableRealAdapters: true, discoverOnStartup: true },
    { PERIPHERALS_DISCOVER_ON_STARTUP: "true" }
  );
  const unverified = withConfig(
    { mode: "REAL", enableRealAdapters: true, discoverOnStartup: true },
    { PERIPHERALS_DISCOVER_ON_STARTUP: "true" }
  );
  const invalidProfile = withConfig(
    { packageProfile: "qa-prod", mode: "REAL", enableRealAdapters: true, discoverOnStartup: true },
    { PERIPHERALS_DISCOVER_ON_STARTUP: "true" }
  );
  assert.equal(qa.PERIPHERALS_DISCOVER_ON_STARTUP, "false");
  assert.equal(unverified.PERIPHERALS_PACKAGE_PROFILE, "unverified");
  assert.equal(unverified.PERIPHERALS_DISCOVER_ON_STARTUP, "false");
  assert.equal(invalidProfile.PERIPHERALS_PACKAGE_PROFILE, "unverified");
  assert.equal(invalidProfile.PERIPHERALS_DISCOVER_ON_STARTUP, "false");
});

test("invalid local discovery type is ignored and therefore stays fail-closed", () => {
  const environment = withConfig({
    packageProfile: "qa",
    mode: "REAL",
    enableRealAdapters: true,
    discoverOnStartup: "true",
  }, { PERIPHERALS_DISCOVER_ON_STARTUP: "true" });

  assert.equal(environment.PERIPHERALS_DISCOVER_ON_STARTUP, "false");
});

test("missing local package config disables inherited startup discovery", () => {
  const environment: NodeJS.ProcessEnv = {
    PERIPHERALS_DISCOVER_ON_STARTUP: "true",
  };
  const directory = mkdtempSync(join(tmpdir(), "manus-agent-config-missing-"));
  try {
    assert.equal(loadAgentLocalConfig(environment, join(directory, "missing.json")), null);
    assert.equal(environment.PERIPHERALS_PACKAGE_PROFILE, "unverified");
    assert.equal(environment.PERIPHERALS_DISCOVER_ON_STARTUP, "false");
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("malformed local JSON disables startup discovery without blocking Agent startup", () => {
  const directory = mkdtempSync(join(tmpdir(), "manus-agent-config-malformed-"));
  const configPath = join(directory, "agent.config.local.json");
  writeFileSync(configPath, "{ invalid", "utf8");
  const environment: NodeJS.ProcessEnv = { PERIPHERALS_DISCOVER_ON_STARTUP: "true" };
  try {
    assert.equal(loadAgentLocalConfig(environment, configPath), null);
    assert.equal(environment.PERIPHERALS_PACKAGE_PROFILE, "unverified");
    assert.equal(environment.PERIPHERALS_DISCOVER_ON_STARTUP, "false");
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
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
