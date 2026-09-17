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
