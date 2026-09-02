import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDirectory, "..");
const packageJson = JSON.parse(readFileSync(join(projectRoot, "package.json"), "utf8"));
const artifactRoot = join(
  projectRoot,
  "dist-terminal",
  "windows-x64",
  `ManusPeripheralAgent-win-x64-${packageJson.version}`,
);
const runtime = join(artifactRoot, "runtime", "node.exe");
const main = join(artifactRoot, "app", "main.js");
const isolatedRuntimeRoot = mkdtempSync(join(tmpdir(), "manus-package-validation-"));

const wait = (milliseconds) => new Promise((resolveWait) => setTimeout(resolveWait, milliseconds));

const request = async (url, method = "GET", timeoutMs = 1000) => {
  const response = await fetch(url, { method, signal: AbortSignal.timeout(timeoutMs) });
  return { statusCode: response.status, body: await response.text() };
};

const preflight = async (url, origin, timeoutMs = 1000, privateNetwork = false) => {
  return await fetch(url, {
    method: "OPTIONS",
    headers: {
      Origin: origin,
      "Access-Control-Request-Method": "POST",
      "Access-Control-Request-Headers": "content-type",
      ...(privateNetwork
        ? { "Access-Control-Request-Private-Network": "true" }
        : {}),
    },
    signal: AbortSignal.timeout(timeoutMs),
  });
};

assert.equal(process.platform, "win32", "Windows x64 validation must run on Windows.");
assert.equal(process.arch, "x64", "Windows x64 validation must run on x64.");
for (const path of [
  runtime,
  main,
  join(artifactRoot, "node_modules"),
  join(artifactRoot, "config", "agent.config.local.json"),
  join(artifactRoot, "VERSION.json"),
  join(artifactRoot, "VERSION"),
  join(artifactRoot, "start-agent.cmd"),
  join(artifactRoot, "install-agent-autostart.ps1"),
  join(artifactRoot, "remove-agent-autostart.ps1"),
  join(artifactRoot, "status-agent-autostart.ps1"),
]) {
  assert.equal(existsSync(path), true, `Missing package artifact: ${path}`);
}

const localConfig = JSON.parse(
  readFileSync(join(artifactRoot, "config", "agent.config.local.json"), "utf8")
);
const versionMetadata = JSON.parse(
  readFileSync(join(artifactRoot, "VERSION.json"), "utf8")
);
assert.equal(versionMetadata.version, packageJson.version);
assert.equal(readFileSync(join(artifactRoot, "VERSION"), "utf8").trim(), packageJson.version);
assert.equal(localConfig.port, 4050);
assert.equal(localConfig.bind, "127.0.0.1");
assert.equal(localConfig.mode, "REAL");
assert.equal(localConfig.logLevel, "INFO");
assert.equal(localConfig.enableRealAdapters, true);
assert.equal(localConfig.usbPrintTransport, "RAW");
assert.equal(localConfig.usbRawPhysicalCutCertified, false);
assert.equal(localConfig.logLimit, 500);
assert.equal(localConfig.printerWidthChars, 48);
assert.ok(Array.isArray(localConfig.allowedOrigins));
assert.deepEqual(localConfig.allowedOrigins, [
  "https://apptiendamanus.space",
  "http://localhost:3000",
]);

const allowedOrigin = "https://apptiendamanus.space";

const readArtifactText = (relativePath) => readFileSync(join(artifactRoot, relativePath), "utf8");
const assertContains = (relativePath, patterns) => {
  const text = readArtifactText(relativePath);
  for (const pattern of patterns) {
    assert.ok(
      text.includes(pattern),
      `Missing expected text in ${relativePath}: ${pattern}`
    );
  }
};

assertContains("install-agent-autostart.ps1", [
  "Register-ScheduledTask",
  "New-ScheduledTaskAction",
  "New-ScheduledTaskTrigger",
  "New-ScheduledTaskSettingsSet",
  "New-ScheduledTaskPrincipal",
]);
assertContains("remove-agent-autostart.ps1", [
  "Unregister-ScheduledTask",
]);
assertContains("status-agent-autostart.ps1", [
  "Get-ScheduledTask",
  "Get-ScheduledTaskInfo",
  "registered:",
  "running:",
  "lastResult:",
]);
assertContains("README-WINDOWS-X64.txt", [
  "PowerShell 5.1 compatibility: the autostart launcher sets PERIPHERALS_CONFIG_PATH",
  "passes the main entry point as a quoted argument",
]);
assertContains("start-agent-autostart.ps1", [
  "Start-Sleep",
  "Invoke-WebRequest",
  "runtime\\node.exe",
  "app\\main.js",
  "Resolve-WritableDirectory",
  "Write-AutostartLog",
  "$env:PERIPHERALS_CONFIG_PATH = $configPath",
  "$quotedEntryPoint = '\"' + $entryPoint + '\"'",
  "Start-Process -FilePath $nodeExe",
  "-ArgumentList $quotedEntryPoint",
  "-WorkingDirectory $scriptRoot",
  "-RedirectStandardOutput $stdoutLog",
  "-RedirectStandardError $stderrLog",
  "Autostart health check: PASS",
  "Autostart health check: FAIL",
  "Get-NetTCPConnection",
]);
assert.ok(
  !readArtifactText("start-agent-autostart.ps1").includes("cmd.exe"),
  "Autostart runner must not invoke cmd.exe."
);
assert.ok(
  !readArtifactText("start-agent-autostart.ps1").includes("-ArgumentList $entryPoint"),
  "Autostart runner must quote the entry point."
);

const port = 44051;
let childOutput = "";
const child = spawn(runtime, [main], {
  cwd: artifactRoot,
  env: {
    ...process.env,
    PERIPHERALS_CONFIG_PATH: join(artifactRoot, "config", "agent.config.local.json"),
    PERIPHERALS_VERSION: packageJson.version,
    PERIPHERALS_PORT: String(port),
    // The artifact config above is asserted as REAL. Disable only startup
    // discovery for this smoke so a slow Windows spooler cannot hide health;
    // the POST below still exercises real Windows discovery explicitly.
    PERIPHERALS_ENABLE_REAL_ADAPTERS: "false",
    PERIPHERALS_BIND: "127.0.0.1",
    PROGRAMDATA: join(isolatedRuntimeRoot, "ProgramData"),
    LOCALAPPDATA: join(isolatedRuntimeRoot, "LocalAppData"),
  },
  stdio: ["ignore", "pipe", "pipe"],
  windowsHide: true,
});
child.stdout.on("data", (chunk) => { childOutput += chunk.toString(); });
child.stderr.on("data", (chunk) => { childOutput += chunk.toString(); });

try {
  let health;
  for (let attempt = 0; attempt < 180; attempt += 1) {
    try {
      health = await request(`http://127.0.0.1:${port}/health`);
      if (health.statusCode === 200) break;
    } catch {
      await wait(200);
    }
  }
  assert.ok(health, `Packaged Agent did not start through its embedded Node runtime. ${childOutput}`);
  assert.equal(health.statusCode, 200);
  const healthBody = JSON.parse(health.body);
  assert.equal(healthBody.status, "ok");
  assert.equal(healthBody.mode, "REAL");
  assert.equal(typeof healthBody.agentInstallationId, "string");
  assert.equal(typeof healthBody.platform, "string");
  assert.equal(typeof healthBody.architecture, "string");
  assert.equal(typeof healthBody.version, "string");
  assert.equal(typeof healthBody.uptimeSeconds, "number");
  assert.equal(typeof healthBody.configuredDevices, "number");
  assert.equal(typeof healthBody.discoveredDevices, "number");
  assert.equal(healthBody.version, packageJson.version);
  assert.equal(healthBody.persistenceState?.schemaVersion, 1);
  assert.ok(["empty", "loaded", "corrupt"].includes(healthBody.persistenceState?.status));

  const printerPreflight = await preflight(
    `http://127.0.0.1:${port}/printer/print-ticket`,
    allowedOrigin,
    3000
  );
  assert.equal(printerPreflight.status, 204);
  assert.equal(
    printerPreflight.headers.get("access-control-allow-origin"),
    allowedOrigin
  );

  const privateNetworkPreflight = await preflight(
    `http://127.0.0.1:${port}/devices`,
    allowedOrigin,
    3000,
    true
  );
  assert.equal(privateNetworkPreflight.status, 204);
  assert.equal(
    privateNetworkPreflight.headers.get("access-control-allow-private-network"),
    "true"
  );
  assert.match(
    printerPreflight.headers.get("access-control-allow-methods") ?? "",
    /POST/
  );
  assert.match(
    printerPreflight.headers.get("access-control-allow-headers") ?? "",
    /Content-Type/i
  );

  const discovery = await request(`http://127.0.0.1:${port}/devices/discover`, "POST", 15000);
  assert.equal(discovery.statusCode, 201);
  assert.ok(Array.isArray(JSON.parse(discovery.body).devices));
} finally {
  let exited = false;
  child.once("exit", () => { exited = true; });
  child.kill("SIGINT");
  for (let attempt = 0; attempt < 25 && !exited; attempt += 1) await wait(200);
  assert.equal(exited, true, "Packaged Agent did not shut down cleanly after SIGINT.");
  rmSync(isolatedRuntimeRoot, { recursive: true, force: true });
}

console.log("Windows x64 portable package validation passed.");
