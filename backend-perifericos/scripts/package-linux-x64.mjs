import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDirectory, "..");
const packageJson = JSON.parse(readFileSync(join(projectRoot, "package.json"), "utf8"));
const artifactName = `ManusPeripheralAgent-linux-x64-${packageJson.version}`;
const artifactRoot = join(projectRoot, "dist-terminal", "linux-x64", artifactName);
const archivePath = join(projectRoot, "dist-terminal", "linux-x64", `${artifactName}.tar.gz`);
const archiveFileName = `${artifactName}.tar.gz`;
const pkgBinary = join(
  projectRoot,
  "node_modules",
  ".bin",
  process.platform === "win32" ? "pkg.cmd" : "pkg",
);
const tarCommand = process.platform === "win32" ? "tar.exe" : "tar";

const writeText = (relativePath, text) => {
  const destination = join(artifactRoot, relativePath);
  mkdirSync(dirname(destination), { recursive: true });
  writeFileSync(destination, text, { encoding: "utf8" });
};

const writeExecutable = (relativePath, text) => {
  const destination = join(artifactRoot, relativePath);
  mkdirSync(dirname(destination), { recursive: true });
  writeFileSync(destination, text, { encoding: "utf8" });
  try {
    execFileSync(
      process.platform === "win32" ? "chmod.exe" : "chmod",
      ["755", destination],
      {
        stdio: "ignore",
        windowsHide: true,
      },
    );
  } catch {
    // Best effort on Windows build hosts.
  }
};

const parseAllowedOrigins = (value) =>
  (value ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

if (process.platform !== "win32" && process.platform !== "linux") {
  throw new Error("Linux packaging must run on Windows or Linux build hosts.");
}

if (!existsSync(join(projectRoot, "dist", "main.js"))) {
  throw new Error("Missing dist/main.js. Run npm run build before packaging.");
}

if (!existsSync(pkgBinary)) {
  throw new Error("Missing local pkg binary. Run npm install in backend-perifericos first.");
}

rmSync(artifactRoot, { recursive: true, force: true });
mkdirSync(artifactRoot, { recursive: true });

execFileSync(
  pkgBinary,
  [".", "--targets", "node18-linux-x64", "--output", join(artifactRoot, "app", "manus-peripheral-agent")],
  {
    cwd: projectRoot,
    stdio: "inherit",
    windowsHide: true,
    shell: process.platform === "win32",
  }
);

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

writeText("config/agent.config.local.json", `${JSON.stringify({
  port: 4050,
  bind: "127.0.0.1",
  allowedOrigins: Array.from(new Set([
    "http://localhost:3000",
    ...parseAllowedOrigins(process.env.PERIPHERALS_ALLOWED_ORIGINS),
  ])),
  logLevel: "INFO",
  enableRealAdapters: true,
  usbPrintTransport: "RAW",
  usbRawPhysicalCutCertified: true,
  logLimit: 500,
  printerWidthChars: 48,
}, null, 2)}\n`);

writeExecutable("start-agent.sh", `#!/usr/bin/env sh
set -eu

AGENT_ROOT=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
if [ -z "\${PERIPHERALS_CONFIG_PATH:-}" ]; then
  export PERIPHERALS_CONFIG_PATH="$AGENT_ROOT/config/agent.config.local.json"
fi
if [ -z "\${PERIPHERALS_VERSION:-}" ]; then
  export PERIPHERALS_VERSION="${packageJson.version}"
fi
if [ -z "\${PERIPHERALS_BIND:-}" ]; then
  export PERIPHERALS_BIND="127.0.0.1"
fi
if [ -z "\${PERIPHERALS_PORT:-}" ]; then
  export PERIPHERALS_PORT="4050"
fi
exec "$AGENT_ROOT/app/manus-peripheral-agent"
`);

writeText("VERSION.json", `${JSON.stringify({
  agent: "manus-pos-peripheral-agent",
  version: packageJson.version,
  platform: "linux",
  architecture: "x64",
  packaging: "pkg-standalone-binary",
}, null, 2)}\n`);
writeText("VERSION", `${packageJson.version}\n`);
writeText("README-LINUX-X64.txt", `MANUS PERIPHERAL AGENT - Linux x64 portable

1. Copy this directory to /opt/manus/peripheral-agent or another local path.
2. Edit config/agent.config.local.json only for local workstation values. It accepts no secrets.
3. Run ./start-agent.sh.
4. Check http://127.0.0.1:4050/health.
5. Call POST http://127.0.0.1:4050/devices/discover.

The agent is loopback-only by default. Its runtime is self-contained; npm, Git and Node are not required on the target workstation.
Logs/state are under the configured external paths or local override paths.
The start script keeps PERIPHERALS_CONFIG_PATH externalizable for future systemd integration.
`);
writeText("logs/.gitkeep", "");
writeText("state/.gitkeep", "");

execFileSync(
  tarCommand,
  ["-czf", archiveFileName, artifactName],
  {
    cwd: join(projectRoot, "dist-terminal", "linux-x64"),
    stdio: "inherit",
    windowsHide: true,
  }
);

console.log(`Package created: ${artifactRoot}`);
console.log(`Archive created: ${archivePath}`);
console.log(`Portable runtime: ${join(artifactRoot, "app", "manus-peripheral-agent")}`);
console.log("Global Node/npm/Git are not required by the target workstation.");
