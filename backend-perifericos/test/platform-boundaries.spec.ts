import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { AgentInstallationIdentityProvider } from "../src/shared/identity/agent-installation-id";
import { resolvePlatformPaths } from "../src/platform/platform-paths";
import { FileAgentInstallationStateStore } from "../src/platform/agent-installation-state.store";
import { loadAgentLocalConfig } from "../src/platform/agent-local-config";
import { WindowsPrinterDiscoveryProvider, parseWindowsPrinterDiagnostics, parseWindowsPnpDiagnosticsDetailed } from "../src/platform/windows/windows-printer-discovery.provider";

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

test("Windows discovery handles multiple, empty, and excluded ports", async () => {
  const parsed = parseWindowsPrinterDiagnostics(JSON.stringify([
    { Name: "XP-58", Type: 0, PortName: "USB001", DriverName: "XP-58", Shared: false },
    { Name: "Network", Type: "Local", PortName: "WSD-1", DriverName: "x", Shared: false },
    { Name: "Dot4", Type: "Local", PortName: "DOT4USB001", DriverName: "x", Shared: false },
  ]));
  const provider = new WindowsPrinterDiscoveryProvider(() => JSON.stringify(parsed));
  assert.deepEqual((await provider.listUsbPrinters()).map((printer) => printer.name), ["XP-58", "Dot4"]);
  assert.deepEqual(parseWindowsPrinterDiagnostics("[]"), []);
  assert.deepEqual(parseWindowsPrinterDiagnostics("null"), []);
});

test("Windows discovery reports invalid JSON as parse failure", async () => {
  assert.throws(() => parseWindowsPrinterDiagnostics("not-json"), /PARSE_FAILED/);
  const provider = new WindowsPrinterDiscoveryProvider(() => "not-json");
  await assert.rejects(() => provider.listUsbPrinters(), /PARSE_FAILED/);
});

test("Windows discovery provider includes XP-58 Local USB001", async () => {
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
  const [printer] = await provider.listUsbPrinters();

  assert.deepEqual(printer, {
    name: "XP-58",
    nativeIdentifier: "XP-58",
    fingerprint: { source: "WINDOWS_PRINT_QUEUE", values: { queueName: "XP-58", portName: "USB001", driverName: "XP-58", queueReady: "true" } },
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

const queueDiscoveryOutput = JSON.stringify({
  Name: "Printer POS-80",
  Type: "Local",
  PortName: "USB002",
  DriverName: "XP-80",
  Shared: false,
});

const providerWithPnpOutput = (pnpOutput: string | Error) => {
  let call = 0;
  return new WindowsPrinterDiscoveryProvider(() => {
    call += 1;
    if (call === 1) return queueDiscoveryOutput;
    if (pnpOutput instanceof Error) return Promise.reject(pnpOutput);
    return pnpOutput;
  });
};

test("Windows PnP diagnostics classify accepted, incomplete, and filtered records", async () => {
  const detailed = parseWindowsPnpDiagnosticsDetailed(JSON.stringify([
    { InstanceId: "USB\\VID_1FC9&PID_2016\\SAFE", Class: "USB", FriendlyName: "Printer POS-80", Status: "OK", Present: true, CompatibleIds: ["USB\\Class_07"] },
    { InstanceId: "USB\\INCOMPLETE", Class: "USB", FriendlyName: "Unknown", Status: "OK", Present: true },
    { InstanceId: "USB\\FILTERED", Class: "USB", FriendlyName: "Other", Status: "OK", Present: true, CompatibleIds: ["USB\\Class_01"] },
    { Class: "USB", FriendlyName: "Missing identity", Status: "OK", Present: true, CompatibleIds: ["USB\\Class_07"] },
  ]));
  assert.equal(detailed.rawRecordCount, 4);
  assert.equal(detailed.parsedRecordCount, 3);
  assert.equal(detailed.incompleteRecordCount, 1);
  assert.equal(detailed.missingCompatibleIdCount, 1);

  const provider = providerWithPnpOutput(JSON.stringify([
    { InstanceId: "USB\\VID_1FC9&PID_2016\\SAFE", Class: "USB", FriendlyName: "Printer POS-80", Status: "OK", Present: true, CompatibleIds: ["USB\\Class_07"] },
    { InstanceId: "USB\\FILTERED", Class: "USB", FriendlyName: "Other", Status: "OK", Present: true, CompatibleIds: ["USB\\Class_01"] },
  ]));
  const devices = await provider.listUsbPrinters();
  assert.deepEqual(devices.map((device) => device.name), ["Printer POS-80", "Printer POS-80"]);
  const diagnostics = provider.getLastUsbDiscoveryDiagnostics()!;
  assert.equal(diagnostics[0]?.phase, "STARTED");
  const [, diagnostic] = diagnostics;
  assert.equal(diagnostic.reasonCode, "OK");
  assert.equal(diagnostic.outcome, "COMPLETED");
  assert.equal(diagnostic.rawRecordCount, 2);
  assert.equal(diagnostic.class07RecordCount, 1);
  assert.equal(diagnostic.acceptedRecordCount, 1);
  assert.equal(diagnostic.filteredRecordCount, 1);
  assert.equal(JSON.stringify(diagnostic).includes("VID_1FC9"), false);

  const filteredProvider = providerWithPnpOutput(JSON.stringify([
    { InstanceId: "USB\\FILTERED_ONLY", Class: "USB", FriendlyName: "Other", Status: "OK", Present: true, CompatibleIds: ["USB\\Class_01"] },
  ]));
  await filteredProvider.listUsbPrinters();
  const [, filteredDiagnostic] = filteredProvider.getLastUsbDiscoveryDiagnostics()!;
  assert.equal(filteredDiagnostic.reasonCode, "FILTERED_OUT");
  assert.equal(filteredDiagnostic.acceptedRecordCount, 0);
});

test("Windows PnP diagnostics classify empty, malformed, denied, and timed out stages", async () => {
  const cases: Array<[string, string | Error, string]> = [
    ["empty", "", "EMPTY_OUTPUT"],
    ["malformed", "not-json", "PARSE_FAILED"],
    ["denied", Object.assign(new Error("permission denied"), { code: "EACCES" }), "ACCESS_DENIED"],
    ["timeout", Object.assign(new Error("command timed out"), { killed: true }), "TIMEOUT"],
    ["execution", Object.assign(new Error("command failed"), { code: 5 }), "EXECUTION_FAILED"],
  ];
  for (const [name, pnpOutput, reasonCode] of cases) {
    const provider = providerWithPnpOutput(pnpOutput);
    const devices = await provider.listUsbPrinters();
    assert.equal(devices.length, 1, name);
    const [, diagnostic] = provider.getLastUsbDiscoveryDiagnostics()!;
    assert.equal(diagnostic.reasonCode, reasonCode, name);
    assert.equal(diagnostic.outcome, "UNKNOWN", name);
    assert.equal(JSON.stringify(diagnostic).includes("permission"), false, name);
  }
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
