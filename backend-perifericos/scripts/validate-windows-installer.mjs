import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { resolveAgentVersion } from "./agent-version.mjs";
import { validateInstallerInspectData, validateInstallerStatusData } from "./installer-artifact-validation.mjs";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDirectory, "..");
const packageJson = JSON.parse(readFileSync(join(projectRoot, "package.json"), "utf8"));
const agentVersion = resolveAgentVersion({ packageVersion: packageJson.version });
const outputName = process.env.MANUS_INSTALLER_OUTPUT_NAME || `ManusTerminalSetup-${agentVersion}-win-x64.exe`;
const installerPath = join(
  projectRoot,
  "dist-installer",
  "windows-x64",
  outputName,
);

assert.equal(existsSync(installerPath), true, `Missing installer artifact: ${installerPath}`);

const inspectOutput = execFileSync(installerPath, ["inspect"], {
  encoding: "utf8",
  windowsHide: true,
});
const inspectData = JSON.parse(inspectOutput);
validateInstallerInspectData(inspectData, { agentVersion });

const statusOutput = execFileSync(installerPath, ["status"], {
  encoding: "utf8",
  windowsHide: true,
});
const statusData = JSON.parse(statusOutput);
const statusObservation = validateInstallerStatusData(statusData);
if (statusObservation.hostServiceNotice) {
  console.log(`Informational: ${statusObservation.hostServiceNotice}`);
}

console.log("Windows installer validation passed.");
