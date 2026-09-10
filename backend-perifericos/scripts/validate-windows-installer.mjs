import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDirectory, "..");
const packageJson = JSON.parse(readFileSync(join(projectRoot, "package.json"), "utf8"));
const installerPath = join(
  projectRoot,
  "dist-installer",
  "windows-x64",
  `ManusTerminalSetup-${packageJson.version}-win-x64.exe`,
);

assert.equal(existsSync(installerPath), true, `Missing installer artifact: ${installerPath}`);

const inspectOutput = execFileSync(installerPath, ["inspect"], {
  encoding: "utf8",
  windowsHide: true,
});
const inspectData = JSON.parse(inspectOutput);
assert.equal(inspectData.version, packageJson.version);
assert.equal(inspectData.serviceName, "ManusPeripheralAgent");
assert.equal(inspectData.displayName, "Manus Peripheral Agent");
assert.equal(inspectData.serviceAccount, "NT AUTHORITY\\LocalService");
assert.match(inspectData.installRoot, /Program Files\\Manus\\PeripheralAgent/);
assert.match(inspectData.currentRoot, /Program Files\\Manus\\PeripheralAgent\\current/);
assert.match(inspectData.serviceBinary, /ManusTerminalSetup\.exe$/);
assert.equal(inspectData.serviceArgs?.[0], "service");

const statusOutput = execFileSync(installerPath, ["status"], {
  encoding: "utf8",
  windowsHide: true,
});
const statusData = JSON.parse(statusOutput);
assert.equal(typeof statusData.installed, "boolean");
assert.equal(statusData.servicePresent, false);
assert.equal(statusData.serviceRunning, false);
assert.match(statusData.installRoot, /Program Files\\Manus\\PeripheralAgent/);
assert.match(statusData.logsPath, /ProgramData\\Manus\\PeripheralAgent\\logs/);

console.log("Windows installer validation passed.");
