import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDirectory, "..");
const packageJson = JSON.parse(readFileSync(join(projectRoot, "package.json"), "utf8"));
const artifactName = `ManusPeripheralAgent-win-x64-${packageJson.version}`;
const artifactRoot = join(projectRoot, "dist-package", "windows-x64", artifactName);
const stagingRoot = mkdtempSync(join(tmpdir(), "manus-peripheral-agent-runtime-"));
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";

if (process.platform !== "win32" || process.arch !== "x64") {
  throw new Error("Windows x64 packaging must run on a Windows x64 build host.");
}

if (!existsSync(join(projectRoot, "dist", "main.js"))) {
  throw new Error("Missing dist/main.js. Run npm run build before packaging.");
}

const writeText = (relativePath, text) => {
  const destination = join(artifactRoot, relativePath);
  mkdirSync(dirname(destination), { recursive: true });
  writeFileSync(destination, text, "utf8");
};

try {
  rmSync(artifactRoot, { recursive: true, force: true });
  mkdirSync(artifactRoot, { recursive: true });

  // Build a clean production dependency closure. No development dependencies,
  // repository files, npm, or Git are copied to the workstation artifact.
  cpSync(join(projectRoot, "package.json"), join(stagingRoot, "package.json"));
  cpSync(join(projectRoot, "package-lock.json"), join(stagingRoot, "package-lock.json"));
  execFileSync(npmCommand, ["ci", "--omit=dev", "--ignore-scripts", "--no-audit", "--no-fund"], {
    cwd: stagingRoot,
    stdio: "inherit",
    windowsHide: true,
    // npm.cmd is a Windows command shim; the build host shell is required
    // only while composing the artifact, never by the target workstation.
    shell: process.platform === "win32",
  });

  cpSync(join(projectRoot, "dist"), join(artifactRoot, "app"), {
    recursive: true,
    filter: (source) => !source.endsWith(".d.ts") && !source.endsWith(".js.map") && !source.endsWith(".tsbuildinfo"),
  });
  cpSync(join(stagingRoot, "node_modules"), join(artifactRoot, "node_modules"), { recursive: true });
  mkdirSync(join(artifactRoot, "runtime"), { recursive: true });
  cpSync(process.execPath, join(artifactRoot, "runtime", "node.exe"));

  writeText("config/agent.config.example.json", `${JSON.stringify({
    port: 4050,
    bind: "127.0.0.1",
    allowedOrigins: ["http://localhost:3000"],
    logLevel: "INFO",
    enableRealAdapters: false,
    usbPrintTransport: "RAW",
    usbRawPhysicalCutCertified: false,
    logLimit: 500,
    printerWidthChars: 48,
  }, null, 2)}\n`);

  // This QA local config contains no secrets. It permits only the explicitly
  // approved remote Manus web origin while the Agent remains loopback-only.
  writeText("config/agent.config.local.json", `${JSON.stringify({
    port: 4050,
    bind: "127.0.0.1",
    allowedOrigins: ["http://192.168.1.14:3000"],
    logLevel: "INFO",
    enableRealAdapters: true,
    usbPrintTransport: "RAW",
    usbRawPhysicalCutCertified: true,
    logLimit: 500,
    printerWidthChars: 48,
  }, null, 2)}\n`);

  writeText("start-agent.cmd", `@echo off\r\nsetlocal\r\nset "AGENT_ROOT=%~dp0"\r\nset "PERIPHERALS_CONFIG_PATH=%AGENT_ROOT%config\\agent.config.local.json"\r\nif not exist "%LOCALAPPDATA%\\Manus\\PeripheralAgent\\logs" mkdir "%LOCALAPPDATA%\\Manus\\PeripheralAgent\\logs"\r\nif not exist "%LOCALAPPDATA%\\Manus\\PeripheralAgent\\state" mkdir "%LOCALAPPDATA%\\Manus\\PeripheralAgent\\state"\r\n"%AGENT_ROOT%runtime\\node.exe" "%AGENT_ROOT%app\\main.js"\r\n`);
  writeText("VERSION.json", `${JSON.stringify({
    agent: "manus-pos-peripheral-agent",
    version: packageJson.version,
    platform: "win32",
    architecture: "x64",
    runtime: process.version,
    packaging: "portable-node-runtime",
  }, null, 2)}\n`);
  writeText("README-WINDOWS-X64.txt", `MANUS PERIPHERAL AGENT - Windows x64 portable\r\n\r\n1. Copy this directory to C:\\Program Files\\Manus\\PeripheralAgent (administrator) or another local path.\r\n2. Edit config\\agent.config.local.json only for local workstation values. It accepts no secrets.\r\n3. Double-click start-agent.cmd.\r\n4. Check http://127.0.0.1:4050/health.\r\n5. Call POST http://127.0.0.1:4050/devices/discover.\r\n\r\nThe agent is loopback-only by default. Its Node runtime is embedded; npm and Git are not required on the POS workstation.\r\nLogs/state are under %LOCALAPPDATA%\\Manus\\PeripheralAgent.\r\n`);
  writeText("logs/.gitkeep", "");
  writeText("state/.gitkeep", "");

  console.log(`Package created: ${artifactRoot}`);
  console.log(`Portable runtime: ${join(artifactRoot, "runtime", "node.exe")}`);
  console.log("Global Node/npm/Git are not required by the target workstation.");
} finally {
  rmSync(stagingRoot, { recursive: true, force: true });
}
