import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const packageScript = readFileSync(
  join(process.cwd(), "scripts", "package-linux-x64.mjs"),
  "utf8"
);

test("linux packaging script targets dist-terminal and self-contained runtime", () => {
  assert.ok(packageScript.includes('dist-terminal'));
  assert.ok(packageScript.includes('node18-linux-x64'));
  assert.ok(packageScript.includes('manus-peripheral-agent'));
  assert.ok(packageScript.includes('PERIPHERALS_VERSION'));
  assert.ok(packageScript.includes('PERIPHERALS_CONFIG_PATH'));
  assert.ok(packageScript.includes('config/agent.config.local.json'));
  assert.ok(packageScript.includes('README-LINUX-X64.txt'));
});
