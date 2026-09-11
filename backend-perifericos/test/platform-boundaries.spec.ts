import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { AgentInstallationIdentityProvider } from "../src/shared/identity/agent-installation-id";
import { resolvePlatformPaths } from "../src/platform/platform-paths";
import { FileAgentInstallationStateStore } from "../src/platform/agent-installation-state.store";
import { loadAgentLocalConfig } from "../src/platform/agent-local-config";
import { WindowsPrinterDiscoveryProvider, parseWindowsPrinterDiagnostics } from "../src/platform/windows/windows-printer-discovery.provider";

test("portable core files contain no Windows API names", () => {
  const coreFiles = [
    "src/shared/escpos/thermal-escpos.renderer.ts",
    "src/shared/transports/printer-transport.ts",
    "src/shared/usb/usb-printer-discovery.ts",
    "src/shared/discovery/device-discovery-provider.ts",
  ];

  for (const file of coreFiles) {
    const source = readFileSync(join(process.cwd(), file), "utf8");
    assert.equal(/powershell\.exe|winspool\.drv|OpenPrinter|WritePrinter/i.test(source), false, file);
  }

  const windowsRaw = readFileSync(
    join(process.cwd(), "src/platform/windows/windows-raw-spooler.transport.ts"),
    "utf8"
  );
  const windowsDiscovery = readFileSync(
    join(process.cwd(), "src/platform/windows/windows-printer-discovery.provider.ts"),
    "utf8"
  );
  assert.match(windowsRaw, /winspool\.drv/);
  assert.match(windowsRaw, /powershell\.exe/);
  assert.match(windowsDiscovery, /Get-Printer/);
  assert.match(windowsDiscovery, /powershell\.exe/);
  assert.match(windowsDiscovery, /Where-Object/);
  assert.match(windowsDiscovery, /Type = \$_.Type\.ToString\(\)/);
  assert.match(windowsDiscovery, /ConvertTo-Json -InputObject/);
});

test("Windows discovery normalizes XP-58 numeric Type and stable single object", () => {
  const parsed = parseWindowsPrinterDiagnostics(JSON.stringify({
    Name: "XP-58", Type: 0, PortName: "USB001", DriverName: "XP-58", Shared: false,
  }));
  assert.deepEqual(parsed, [{ Name: "XP-58", Type: "Local", PortName: "USB001", DriverName: "XP-58", Shared: false }]);
});

test("Windows discovery handles multiple, empty, and excluded ports", () => {
  const parsed = parseWindowsPrinterDiagnostics(JSON.stringify([
    { Name: "XP-58", Type: 0, PortName: "USB001", DriverName: "XP-58", Shared: false },
    { Name: "Network", Type: "Local", PortName: "WSD-1", DriverName: "x", Shared: false },
    { Name: "Dot4", Type: "Local", PortName: "DOT4USB001", DriverName: "x", Shared: false },
  ]));
  const provider = new WindowsPrinterDiscoveryProvider(() => JSON.stringify(parsed));
  assert.deepEqual(provider.listUsbPrinters().map((printer) => printer.name), ["XP-58", "Dot4"]);
  assert.deepEqual(parseWindowsPrinterDiagnostics("[]"), []);
  assert.deepEqual(parseWindowsPrinterDiagnostics("null"), []);
});

test("Windows discovery reports invalid JSON as parse failure", () => {
  assert.throws(() => parseWindowsPrinterDiagnostics("not-json"), /PARSE_FAILED/);
  const provider = new WindowsPrinterDiscoveryProvider(() => "not-json");
  assert.throws(() => provider.listUsbPrinters(), /PARSE_FAILED/);
});

test("Windows discovery provider includes XP-58 Local USB001", () => {
  let inventory: unknown;
  const provider = new WindowsPrinterDiscoveryProvider(
    () => JSON.stringify({
      Name: "XP-58",
      Type: "Local",
      PortName: "USB001",
      DriverName: "XP-58",
      Shared: false,
    }),
    (printers) => {
      inventory = printers;
    }
  );
  const [printer] = provider.listUsbPrinters();

  assert.deepEqual(printer, {
    name: "XP-58",
    nativeIdentifier: "XP-58",
    fingerprint: { source: "WINDOWS_PRINT_QUEUE", values: { queueName: "XP-58" } },
    platform: "WINDOWS",
    architecture: process.arch,
  });
  assert.deepEqual(inventory, [{
    Name: "XP-58",
    Type: "Local",
    PortName: "USB001",
    DriverName: "XP-58",
    Shared: false,
  }]);
});

test("agent installation identity is persisted through platform paths", () => {
  const root = mkdtempSync(join(tmpdir(), "manus-agent-"));
  const paths = {
    configDir: join(root, "config"),
    stateDir: join(root, "state"),
    logDir: join(root, "logs"),
  };
  let stored: string | null = null;
  const store = {
    read: () => stored,
    write: (_paths: typeof paths, installationId: string) => {
      stored = installationId;
    },
  };

  try {
    const provider = new AgentInstallationIdentityProvider(paths, store);
    const first = provider.getInstallationId();
    assert.match(first, /^[0-9a-f-]{36}$/i);
    assert.equal(provider.getInstallationId(), first);
    assert.equal(stored, first);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("platform paths isolate Windows paths outside portable core", () => {
  const paths = resolvePlatformPaths("win32", { PROGRAMDATA: "C:\\ProgramData" });
  assert.equal(paths.stateDir, "C:\\ProgramData\\Manus\\PeripheralAgent\\state");
});

test("agent installation id persists in the local state directory", () => {
  const root = mkdtempSync(join(tmpdir(), "manus-agent-state-"));
  const paths = {
    configDir: join(root, "config"),
    stateDir: join(root, "state"),
    logDir: join(root, "logs"),
  };

  try {
    const first = new AgentInstallationIdentityProvider(
      paths,
      new FileAgentInstallationStateStore()
    ).getInstallationId();
    const second = new AgentInstallationIdentityProvider(
      paths,
      new FileAgentInstallationStateStore()
    ).getInstallationId();

    assert.equal(second, first);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("local configuration is whitelisted and environment overrides it", () => {
  const root = mkdtempSync(join(tmpdir(), "manus-agent-config-"));
  const configPath = join(root, "agent.config.local.json");
  const environment: NodeJS.ProcessEnv = {
    PERIPHERALS_PORT: "4500",
  };
  writeFileSync(configPath, JSON.stringify({
    port: 4050,
    bind: "127.0.0.1",
    mode: "REAL",
    allowedOrigins: ["http://localhost:3000"],
    logLevel: "WARN",
    enableRealAdapters: true,
    usbPrintTransport: "RAW",
    usbRawPhysicalCutCertified: true,
  }));

  try {
    assert.equal(loadAgentLocalConfig(environment, configPath), configPath);
    assert.equal(environment.PERIPHERALS_PORT, "4500");
    assert.equal(environment.PERIPHERALS_BIND, "127.0.0.1");
    assert.equal(environment.PERIPHERALS_MODE, "REAL");
    assert.equal(environment.PERIPHERALS_ALLOWED_ORIGINS, "http://localhost:3000");
    assert.equal(environment.PERIPHERALS_ENABLE_REAL_ADAPTERS, "true");
    assert.equal(environment.PERIPHERALS_USB_RAW_PHYSICAL_CUT_CERTIFIED, "true");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("local configuration rejects credentials and unknown keys", () => {
  const root = mkdtempSync(join(tmpdir(), "manus-agent-config-invalid-"));
  const configPath = join(root, "agent.config.local.json");
  writeFileSync(configPath, JSON.stringify({ token: "not-allowed" }));

  try {
    assert.throws(() => loadAgentLocalConfig({}, configPath), /Unsupported Peripheral Agent local configuration key/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
