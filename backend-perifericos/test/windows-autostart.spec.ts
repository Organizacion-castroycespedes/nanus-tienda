import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import test from "node:test";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDirectory, "..");
const packageJson = JSON.parse(readFileSync(join(projectRoot, "package.json"), "utf8"));
const artifactRoot = join(
  projectRoot,
  "dist-package",
  "windows-x64",
  `ManusPeripheralAgent-win-x64-${packageJson.version}`,
);
const packageScript = readFileSync(join(projectRoot, "scripts", "package-windows-x64.mjs"), "utf8");

test("windows autostart runner targets portable node and health gate", () => {
  assert.ok(packageScript.includes('set "PERIPHERALS_CONFIG_PATH=%AGENT_ROOT%config\\\\agent.config.local.json"'));
  assert.ok(packageScript.includes('if not exist "%LOCALAPPDATA%\\\\Manus\\\\PeripheralAgent\\\\logs" mkdir'));
  assert.ok(packageScript.includes('if not exist "%LOCALAPPDATA%\\\\Manus\\\\PeripheralAgent\\\\state" mkdir'));
  assert.ok(packageScript.includes('"%AGENT_ROOT%runtime\\\\node.exe" "%AGENT_ROOT%app\\\\main.js"'));

  assert.ok(packageScript.includes('Join-Path $scriptRoot "config\\\\agent.config.local.json"'));
  assert.ok(packageScript.includes('runtime\\\\node.exe'));
  assert.ok(packageScript.includes('app\\\\main.js'));
  assert.ok(packageScript.includes('Resolve-WritableDirectory'));
  assert.ok(packageScript.includes('Write-AutostartLog'));
  assert.ok(packageScript.includes('PERIPHERALS_CONFIG_PATH = $configPath'));
  assert.ok(packageScript.includes('$env:PERIPHERALS_CONFIG_PATH = $configPath'));
  assert.ok(packageScript.includes('$quotedEntryPoint'));
  assert.ok(packageScript.includes('Start-Process -FilePath $nodeExe'));
  assert.ok(packageScript.includes('-ArgumentList $quotedEntryPoint'));
  assert.ok(!packageScript.includes('-ArgumentList $entryPoint'));
  assert.ok(packageScript.includes('-WorkingDirectory $scriptRoot'));
  assert.ok(packageScript.includes('-RedirectStandardOutput $stdoutLog'));
  assert.ok(packageScript.includes('-RedirectStandardError $stderrLog'));
  assert.ok(packageScript.includes('Get-NetTCPConnection'));
  assert.ok(packageScript.includes('Autostart health check: PASS'));
  assert.ok(packageScript.includes('Autostart health check: FAIL'));
  assert.ok(!packageScript.includes('Start-Process -FilePath "cmd.exe"'));
});
