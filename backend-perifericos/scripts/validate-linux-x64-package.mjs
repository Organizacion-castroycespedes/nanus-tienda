import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDirectory, "..");
const packageJson = JSON.parse(readFileSync(join(projectRoot, "package.json"), "utf8"));
const artifactRoot = join(
  projectRoot,
  "dist-terminal",
  "linux-x64",
  `ManusPeripheralAgent-linux-x64-${packageJson.version}`,
);
const archivePath = `${artifactRoot}.tar.gz`;
const archiveFileName = `${basename(artifactRoot)}.tar.gz`;

for (const path of [
  join(artifactRoot, "app", "manus-peripheral-agent"),
  join(artifactRoot, "config", "agent.config.local.json"),
  join(artifactRoot, "config", "agent.config.example.json"),
  join(artifactRoot, "VERSION"),
  join(artifactRoot, "VERSION.json"),
  join(artifactRoot, "start-agent.sh"),
  join(artifactRoot, "README-LINUX-X64.txt"),
  archivePath,
]) {
  assert.equal(existsSync(path), true, `Missing package artifact: ${path}`);
}

const versionJson = JSON.parse(
  readFileSync(join(artifactRoot, "VERSION.json"), "utf8")
);
assert.equal(versionJson.version, packageJson.version);
assert.equal(versionJson.platform, "linux");
assert.equal(versionJson.architecture, "x64");

const startScript = readFileSync(join(artifactRoot, "start-agent.sh"), "utf8");
assert.ok(startScript.includes("PERIPHERALS_CONFIG_PATH"));
assert.ok(startScript.includes("PERIPHERALS_VERSION"));
assert.ok(startScript.includes("exec \"$AGENT_ROOT/app/manus-peripheral-agent\""));

const localConfig = JSON.parse(
  readFileSync(join(artifactRoot, "config", "agent.config.local.json"), "utf8")
);
assert.equal(localConfig.port, 4050);
assert.equal(localConfig.bind, "127.0.0.1");
assert.equal(localConfig.enableRealAdapters, true);
assert.ok(Array.isArray(localConfig.allowedOrigins));

const tarListing = execFileSync(
  process.platform === "win32" ? "tar.exe" : "tar",
  ["-tvf", archiveFileName],
  {
    cwd: dirname(archivePath),
    encoding: "utf8",
    windowsHide: true,
  }
);
assert.match(tarListing, /app\/manus-peripheral-agent/);
assert.match(tarListing, /start-agent\.sh/);
assert.match(tarListing, /-rwx/);

console.log("Linux x64 package validation passed.");
