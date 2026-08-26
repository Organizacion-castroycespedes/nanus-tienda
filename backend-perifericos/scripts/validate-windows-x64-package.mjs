import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn, spawnSync } from "node:child_process";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDirectory, "..");
const packageJson = JSON.parse(readFileSync(join(projectRoot, "package.json"), "utf8"));
const artifactRoot = join(
  projectRoot,
  "dist-package",
  "windows-x64",
  `ManusPeripheralAgent-win-x64-${packageJson.version}`,
);
const runtime = join(artifactRoot, "runtime", "node.exe");
const main = join(artifactRoot, "app", "main.js");

const wait = (milliseconds) => new Promise((resolveWait) => setTimeout(resolveWait, milliseconds));

const request = async (url, method = "GET", timeoutMs = 1000) => {
  const response = await fetch(url, { method, signal: AbortSignal.timeout(timeoutMs) });
  return { statusCode: response.status, body: await response.text() };
};

const preflight = async (url, origin, timeoutMs = 1000) => {
  return await fetch(url, {
    method: "OPTIONS",
    headers: {
      Origin: origin,
      "Access-Control-Request-Method": "POST",
      "Access-Control-Request-Headers": "content-type",
    },
    signal: AbortSignal.timeout(timeoutMs),
  });
};

const taskkillProcess = (pid) => {
  if (!pid) {
    return;
  }
  spawnSync("taskkill", ["/PID", String(pid), "/T", "/F"], {
    encoding: "utf8",
    windowsHide: true,
  });
};

const readStartedPid = (logPath) => {
  if (!existsSync(logPath)) {
    return null;
  }
  const logText = readFileSync(logPath, "utf8");
  const match = logText.match(/started pid=(\d+)/);
  return match ? match[1] : null;
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
assert.equal(localConfig.port, 4050);
assert.equal(localConfig.bind, "127.0.0.1");
assert.equal(localConfig.logLevel, "INFO");
assert.equal(localConfig.enableRealAdapters, true);
assert.equal(localConfig.usbPrintTransport, "RAW");
assert.equal(localConfig.usbRawPhysicalCutCertified, true);
assert.equal(localConfig.logLimit, 500);
assert.equal(localConfig.printerWidthChars, 48);
assert.ok(Array.isArray(localConfig.allowedOrigins));
assert.ok(localConfig.allowedOrigins.length > 0);
assert.ok(
  localConfig.allowedOrigins.every(
    (origin) => typeof origin === "string" && origin.length > 0
  )
);

const allowedOrigin =
  localConfig.allowedOrigins.find((origin) => origin !== "http://localhost:3000") ??
  localConfig.allowedOrigins[0];

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

const localAppDataRoot = mkdtempSync(join(tmpdir(), "manus-peripheral-agent-localappdata-"));
const launcherSmoke = spawn(
  "C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe",
  [
    "-NoProfile",
    "-ExecutionPolicy",
    "Bypass",
    "-File",
    join(artifactRoot, "start-agent-autostart.ps1"),
    "-DelaySeconds",
    "0",
    "-HealthTimeoutSeconds",
    "20",
    "-PollIntervalSeconds",
    "1",
  ],
  {
    cwd: artifactRoot,
    env: {
      ...process.env,
      LOCALAPPDATA: localAppDataRoot,
    },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  }
);

let launcherStdout = "";
let launcherStderr = "";
let launcherExit = null;
launcherSmoke.stdout.on("data", (chunk) => {
  launcherStdout += chunk.toString();
});
launcherSmoke.stderr.on("data", (chunk) => {
  launcherStderr += chunk.toString();
});

launcherSmoke.once("exit", (code, signal) => {
  launcherExit = { code, signal };
});

const autostartLogPath = join(localAppDataRoot, "Manus", "PeripheralAgent", "logs", "autostart.log");
const stdoutLogPath = join(localAppDataRoot, "Manus", "PeripheralAgent", "logs", "agent-autostart.stdout.log");
const stderrLogPath = join(localAppDataRoot, "Manus", "PeripheralAgent", "logs", "agent-autostart.stderr.log");

let launcherHealth;
let startedPid = null;
const launcherDeadline = Date.now() + 30000;
try {
  while (Date.now() < launcherDeadline) {
    startedPid ??= readStartedPid(autostartLogPath);

    if (launcherExit && launcherExit.code !== 0) {
      break;
    }

    try {
      launcherHealth = await request("http://127.0.0.1:4050/health");
      if (launcherHealth.statusCode === 200) {
        break;
      }
    } catch {
      // Keep waiting.
    }

    await wait(250);
  }

  assert.ok(launcherHealth, "Autostart launcher smoke timed out.");
  assert.equal(
    launcherHealth.statusCode,
    200,
    `Autostart launcher smoke failed.\nSTATUS: ${launcherHealth.statusCode}\nSTDOUT:\n${launcherStdout}\nSTDERR:\n${launcherStderr}`
  );
  const launcherHealthBody = JSON.parse(launcherHealth.body);
  assert.equal(launcherHealthBody.status, "ok");
  assert.equal(typeof launcherHealthBody.agentInstallationId, "string");
  assert.equal(typeof launcherHealthBody.platform, "string");
  assert.equal(typeof launcherHealthBody.architecture, "string");
  assert.equal(typeof launcherHealthBody.version, "string");
  assert.equal(typeof launcherHealthBody.uptimeSeconds, "number");
  assert.equal(typeof launcherHealthBody.configuredDevices, "number");
  assert.equal(typeof launcherHealthBody.discoveredDevices, "number");
  assert.equal(launcherHealthBody.persistenceState?.schemaVersion, 1);
  assert.ok(["empty", "loaded", "corrupt"].includes(launcherHealthBody.persistenceState?.status));

  assert.ok(existsSync(stdoutLogPath), "Launcher smoke did not create stdout log.");
  assert.ok(existsSync(stderrLogPath), "Launcher smoke did not create stderr log.");

  const autostartLog = readFileSync(autostartLogPath, "utf8");
  startedPid ??= readStartedPid(autostartLogPath);
  assert.ok(startedPid, `Missing started pid in autostart log.\n${autostartLog}`);
} finally {
  if (!startedPid) {
    for (let attempt = 0; attempt < 20 && !startedPid; attempt += 1) {
      await wait(250);
      startedPid = readStartedPid(autostartLogPath);
    }
  }
  taskkillProcess(startedPid);
  if (launcherSmoke.pid && !launcherSmoke.killed) {
    taskkillProcess(launcherSmoke.pid);
  }
}

const port = 44051;
let childOutput = "";
const child = spawn(runtime, [main], {
  cwd: artifactRoot,
  env: {
    ...process.env,
    PERIPHERALS_CONFIG_PATH: join(artifactRoot, "config", "agent.config.local.json"),
    PERIPHERALS_PORT: String(port),
    // The artifact config above is asserted as REAL. Disable only startup
    // discovery for this smoke so a slow Windows spooler cannot hide health;
    // the POST below still exercises real Windows discovery explicitly.
    PERIPHERALS_ENABLE_REAL_ADAPTERS: "false",
    PERIPHERALS_BIND: "127.0.0.1",
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
  assert.equal(typeof healthBody.agentInstallationId, "string");
  assert.equal(typeof healthBody.platform, "string");
  assert.equal(typeof healthBody.architecture, "string");
  assert.equal(typeof healthBody.version, "string");
  assert.equal(typeof healthBody.uptimeSeconds, "number");
  assert.equal(typeof healthBody.configuredDevices, "number");
  assert.equal(typeof healthBody.discoveredDevices, "number");
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
  rmSync(localAppDataRoot, { recursive: true, force: true });
}

console.log("Windows x64 portable package validation passed.");
