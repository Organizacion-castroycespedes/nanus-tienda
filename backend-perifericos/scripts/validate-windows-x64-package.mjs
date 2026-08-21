import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

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

assert.equal(process.platform, "win32", "Windows x64 validation must run on Windows.");
assert.equal(process.arch, "x64", "Windows x64 validation must run on x64.");
for (const path of [runtime, main, join(artifactRoot, "node_modules"), join(artifactRoot, "config", "agent.config.local.json"), join(artifactRoot, "VERSION.json")]) {
  assert.equal(existsSync(path), true, `Missing package artifact: ${path}`);
}

const localConfig = JSON.parse(readFileSync(join(artifactRoot, "config", "agent.config.local.json"), "utf8"));
assert.deepEqual(localConfig, {
  port: 4050,
  bind: "127.0.0.1",
  allowedOrigins: ["http://192.168.1.14:3000"],
  logLevel: "INFO",
  enableRealAdapters: true,
  usbPrintTransport: "RAW",
  usbRawPhysicalCutCertified: true,
  logLimit: 500,
  printerWidthChars: 48,
});

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
  assert.equal(JSON.parse(health.body).status, "ok");

  const discovery = await request(`http://127.0.0.1:${port}/devices/discover`, "POST", 15000);
  assert.equal(discovery.statusCode, 201);
  assert.ok(Array.isArray(JSON.parse(discovery.body).devices));
} finally {
  let exited = false;
  child.once("exit", () => { exited = true; });
  child.kill("SIGINT");
  for (let attempt = 0; attempt < 25 && !exited; attempt += 1) await wait(200);
  assert.equal(exited, true, "Packaged Agent did not shut down cleanly after SIGINT.");
}

console.log("Windows x64 portable package validation passed.");
