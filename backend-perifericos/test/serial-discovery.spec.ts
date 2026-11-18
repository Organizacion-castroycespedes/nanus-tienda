import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";
import { DevicesController } from "../src/modules/devices/devices.controller";
import { DevicesService } from "../src/modules/devices/devices.service";
import { EventsService } from "../src/modules/events/events.service";
import { LogsService } from "../src/modules/logs/logs.service";
import { FileDeviceRegistryStateStore } from "../src/platform/device-registry-state.store";
import { buildRochiSerialDescriptor } from "../src/shared/usb/usb-printer-discovery";
import {
  extractUsbVidPid,
  parseWindowsSerialDiagnostics,
  WindowsPrinterDiscoveryProvider,
} from "../src/platform/windows/windows-printer-discovery.provider";
import type { DiscoveredSerialDevice } from "../src/shared/discovery/device-discovery-provider";
import type { UsbPrinterDiscovery } from "../src/shared/usb/usb-printer-discovery";
import { ConnectionType, DeviceStatus, DeviceType } from "../src/shared/types/peripheral.types";

const rawRochi = (port = "COM3"): DiscoveredSerialDevice => ({
  port,
  name: "USB-SERIAL CH340",
  nativeIdentifier: "USB\\VID_1A86&PID_7523\\ROCHI-QA",
  pnpDeviceId: "USB\\VID_1A86&PID_7523\\ROCHI-QA",
  vendorId: "1A86",
  productId: "7523",
  status: "OK",
  present: true,
  fingerprint: {
    source: "WINDOWS_SERIAL_PNP",
    values: {
      pnpDeviceId: "USB\\VID_1A86&PID_7523\\ROCHI-QA",
      vendorId: "1A86",
      productId: "7523",
      status: "OK",
    },
  },
  platform: "WINDOWS",
  architecture: "amd64",
});

const serialInventoryRow = (
  DeviceID: string,
  PNPDeviceID: string,
  options: { Name?: string; Status?: string; Present?: boolean } = {},
) => ({
  DeviceID,
  Name: options.Name ?? `Serial device (${DeviceID})`,
  PNPDeviceID,
  Status: options.Status ?? "OK",
  Present: options.Present ?? true,
});

const serialInventoryProvider = (
  cimOutput: string | Error,
  pnpOutput: string | Error,
  issues: Array<{ source: string; reason: string }> = [],
) => new WindowsPrinterDiscoveryProvider(
  (_command, args) => {
    const script = args.at(-1) ?? "";
    if (script.includes("Get-CimInstance Win32_SerialPort")) {
      if (cimOutput instanceof Error) throw cimOutput;
      return cimOutput;
    }
    if (script.includes("Get-PnpDevice -PresentOnly")) {
      assert.match(script, /\$_.Class -eq 'Ports'/);
      if (pnpOutput instanceof Error) throw pnpOutput;
      return pnpOutput;
    }
    throw new Error("unexpected Windows discovery command in serial test");
  },
  () => {},
  (source, reason) => { issues.push({ source, reason }); },
);

test("Windows serial parser reads COM port and structured PnP identity", () => {
  const parsed = parseWindowsSerialDiagnostics(JSON.stringify({
    DeviceID: "com3",
    Name: "USB-SERIAL CH340",
    PNPDeviceID: "USB\\VID_1a86&PID_7523\\ROCHI-QA",
    Status: "OK",
    Present: true,
  }));

  assert.deepEqual(parsed, [{
    DeviceID: "COM3",
    Name: "USB-SERIAL CH340",
    PNPDeviceID: "USB\\VID_1a86&PID_7523\\ROCHI-QA",
    Status: "OK",
    Present: true,
  }]);
  assert.deepEqual(extractUsbVidPid(parsed[0].PNPDeviceID), {
    vendorId: "1A86",
    productId: "7523",
  });
});

test("serial provider combines CIM COM3/COM4 with PnP-only healthy COM6", async () => {
  const provider = serialInventoryProvider(
    JSON.stringify([
      serialInventoryRow("COM3", "BTHENUM\\DEVICE-3"),
      serialInventoryRow("COM4", "BTHENUM\\DEVICE-4"),
    ]),
    JSON.stringify(serialInventoryRow("COM6", "USB\\VID_1A86&PID_7523\\ROCHI-QA", {
      Name: "USB-SERIAL CH340 (COM6)",
    })),
  );

  const devices = await provider.listSerialDevices();
  assert.deepEqual(devices.map((device) => device.port), ["COM3", "COM4", "COM6"]);
  const com6 = devices.find((device) => device.port === "COM6")!;
  assert.deepEqual({ vendorId: com6.vendorId, productId: com6.productId }, { vendorId: "1A86", productId: "7523" });
  assert.equal(buildRochiSerialDescriptor(com6)?.type, "ROCHI_A01E");
  assert.equal(com6.present, true);
});

test("identical CIM and PnP identity/port records produce one candidate", async () => {
  const identity = "USB\\VID_1A86&PID_7523\\ROCHI-DUPLICATE";
  const provider = serialInventoryProvider(
    JSON.stringify(serialInventoryRow("COM6", identity, { Name: "CH340" })),
    JSON.stringify(serialInventoryRow("com6", identity.toLowerCase(), { Name: "USB-SERIAL CH340 (COM6)" })),
  );

  const devices = await provider.listSerialDevices();
  assert.equal(devices.length, 1);
  assert.equal(devices[0].port, "COM6");
  assert.equal(devices[0].name, "USB-SERIAL CH340 (COM6)");
});

test("serial provider excludes absent and non-OK records from both inventories", async () => {
  const provider = serialInventoryProvider(
    JSON.stringify([
      serialInventoryRow("COM3", "BTHENUM\\HEALTHY"),
      serialInventoryRow("COM4", "BTHENUM\\UNKNOWN", { Status: "Unknown" }),
      serialInventoryRow("COM5", "BTHENUM\\ABSENT", { Present: false }),
    ]),
    JSON.stringify([
      serialInventoryRow("COM6", "USB\\VID_1A86&PID_7523\\UNKNOWN", { Status: "Unknown" }),
      serialInventoryRow("COM7", "USB\\VID_1A86&PID_7523\\ABSENT", { Present: false }),
    ]),
  );

  const devices = await provider.listSerialDevices();
  assert.deepEqual(devices.map((device) => device.port), ["COM3"]);
});

test("ambiguous identity-to-port and port-to-identity mappings are excluded", async () => {
  const provider = serialInventoryProvider(
    JSON.stringify([
      serialInventoryRow("COM3", "USB\\VID_1A86&PID_7523\\SCALE-A"),
      serialInventoryRow("COM7", "USB\\VID_1A86&PID_7523\\SCALE-C"),
    ]),
    JSON.stringify([
      serialInventoryRow("COM6", "USB\\VID_1A86&PID_7523\\SCALE-A"),
      serialInventoryRow("COM7", "USB\\VID_1A86&PID_7523\\SCALE-D"),
    ]),
  );

  assert.deepEqual(await provider.listSerialDevices(), []);
});

test("a failed or malformed inventory preserves valid candidates from the other source", async () => {
  const validCim = JSON.stringify(serialInventoryRow("COM3", "BTHENUM\\CIM"));
  const validPnp = JSON.stringify(serialInventoryRow("COM6", "USB\\VID_1A86&PID_7523\\PNP"));
  for (const [cim, pnp, expectedPort, failedSource] of [
    [new Error("CIM unavailable"), validPnp, "COM6", "Win32_SerialPort"],
    [validCim, new Error("PnP unavailable"), "COM3", "Get-PnpDevice"],
    [validCim, "{invalid-json", "COM3", "Get-PnpDevice"],
    ["{invalid-json", validPnp, "COM6", "Win32_SerialPort"],
  ] as const) {
    const issues: Array<{ source: string; reason: string }> = [];
    const provider = serialInventoryProvider(cim, pnp, issues);
    const devices = await provider.listSerialDevices();
    assert.deepEqual(devices.map((device) => device.port), [expectedPort]);
    assert.ok(issues.some((issue) => issue.source === failedSource));
  }
});

test("serial discovery rejects when both independent inventories fail", async () => {
  const provider = serialInventoryProvider(new Error("CIM unavailable"), "not-json");
  await assert.rejects(provider.listSerialDevices(), /both Win32_SerialPort and Get-PnpDevice serial inventories failed/);
});

test("only demonstrated CH340 VID/PID becomes ROCHI_A01E", () => {
  const descriptor = buildRochiSerialDescriptor(rawRochi());
  assert.ok(descriptor);
  assert.equal(descriptor?.type, "ROCHI_A01E");
  assert.match(descriptor?.id ?? "", /^serial-rochi-a01e-[0-9a-f]{16}$/);
  assert.equal(descriptor?.serial.port, "COM3");
  assert.equal(descriptor?.serial.baudRate, 9600);
  assert.equal(descriptor?.serial.pnp?.deviceId, rawRochi().pnpDeviceId);
  assert.equal(buildRochiSerialDescriptor({ ...rawRochi(), vendorId: "0403", productId: "6001" }), undefined);
  assert.equal(buildRochiSerialDescriptor({ ...rawRochi(), name: "CH340", vendorId: undefined }), undefined);
});

test("serial discovery is side-effect free, deduplicated, and keeps printers", async () => {
  const previousMode = process.env.PERIPHERALS_MODE;
  process.env.PERIPHERALS_MODE = "REAL";
  let writes = 0;
  const discovery: UsbPrinterDiscovery = {
    list: () => [],
    listSerialDevices: () => [
      buildRochiSerialDescriptor(rawRochi())!,
      buildRochiSerialDescriptor(rawRochi())!,
    ],
  };
  const store = {
    read: () => ({ schemaVersion: 1 as const, devices: [] }),
    write: () => { writes += 1; },
  };
  const service = new DevicesService(
    new LogsService(),
    new EventsService(),
    discovery,
    store,
    { configDir: ".serial-discovery-config", stateDir: ".serial-discovery-state", logDir: ".serial-discovery-log" }
  );

  try {
    const response = await new DevicesController(service).discover();
    const candidates = response.devices.filter((device) => device.type === DeviceType.SCALE);
    assert.equal(candidates.length, 1);
    assert.equal(candidates[0].connectionType, ConnectionType.SERIAL);
    assert.equal(candidates[0].profileId, "ROCHI_A01E");
    assert.equal(candidates[0].serial?.port, "COM3");
    assert.equal(candidates[0].status, DeviceStatus.DISCONNECTED);
    assert.equal(candidates[0].metadata?.physicalDetected, true);
    assert.equal(candidates[0].metadata?.configured, false);
    assert.equal(candidates[0].metadata?.connected, false);
    assert.equal(candidates[0].metadata?.authorized, false);
    assert.equal(candidates[0].metadata?.realAvailable, false);
    assert.equal(writes, 0);
  } finally {
    if (previousMode === undefined) delete process.env.PERIPHERALS_MODE;
    else process.env.PERIPHERALS_MODE = previousMode;
  }
});

test("discovered ROCHI configures, reloads, and follows PnP identity across COM changes", async () => {
  const root = mkdtempSync(join(tmpdir(), "manus-rochi-config-"));
  const paths = {
    configDir: join(root, "config"),
    stateDir: join(root, "state"),
    logDir: join(root, "logs"),
  };
  const store = new FileDeviceRegistryStateStore();
  const descriptor = (port: string) => buildRochiSerialDescriptor({
    ...rawRochi(port),
    name: `USB-SERIAL CH340 (${port})`,
    pnpDeviceId: "USB\\VID_1A86&PID_7523\\ROCHI-CONFIG-QA",
    nativeIdentifier: "USB\\VID_1A86&PID_7523\\ROCHI-CONFIG-QA",
    fingerprint: {
      source: "WINDOWS_SERIAL_PNP",
      values: { pnpDeviceId: "USB\\VID_1A86&PID_7523\\ROCHI-CONFIG-QA" },
    },
  })!;
  const firstService = new DevicesService(
    new LogsService(),
    new EventsService(),
    { list: () => [], listSerialDevices: () => [descriptor("COM5")] },
    store,
    paths
  );
  const firstController = new DevicesController(firstService);
  const candidate = (await firstController.discover()).devices.find(
    (device) => device.profileId === "ROCHI_A01E"
  );
  assert.ok(candidate);
  assert.equal(candidate?.metadata?.configured, false);
  assert.equal(candidate!.name, "USB-SERIAL CH340 (COM5)");
  const configured = firstController.update(candidate!.id, {
    terminalId: "local-terminal",
    profileId: "ROCHI_A01E",
    connectionType: ConnectionType.SERIAL,
    serial: candidate!.serial,
  });
  assert.equal(configured.name, "USB-SERIAL CH340 (COM5)");
  assert.equal(configured.serial?.port, "COM5");
  for (const name of ["bad\u0000name", "bad\nname", "<script>", "bad\\name", "x".repeat(161)]) {
    assert.throws(() => firstController.update(candidate!.id, { name }), /name contains unsupported/);
  }
  assert.equal(configured.status, DeviceStatus.DISCONNECTED);
  assert.equal(configured.metadata?.configured, true);
  assert.equal(configured.metadata?.authorized, false);
  assert.equal(configured.metadata?.realAvailable, false);

  const secondService = new DevicesService(
    new LogsService(),
    new EventsService(),
    { list: () => [], listSerialDevices: () => [descriptor("COM4")] },
    store,
    paths
  );
  const reloaded = secondService.list().find((device) => device.id === candidate!.id);
  assert.equal(reloaded?.name, "USB-SERIAL CH340 (COM5)");
  assert.equal(reloaded?.serial?.port, "COM5");
  assert.equal(reloaded?.serial?.pnp?.deviceId, configured.serial?.pnp?.deviceId);
  const reconciled = (await new DevicesController(secondService).discover()).devices.filter(
    (device) => device.profileId === "ROCHI_A01E"
  );
  assert.equal(reconciled.length, 1);
  assert.equal(reconciled[0].id, candidate!.id);
  assert.equal(reconciled[0].serial?.port, "COM4");
  assert.equal(reconciled[0].serial?.pnp?.deviceId, "USB\\VID_1A86&PID_7523\\ROCHI-CONFIG-QA");
  assert.equal(secondService.getHealthSnapshot().configuredDevices, 1);
  const persisted = store.read(paths)?.devices.find((device) => device.id === candidate!.id);
  assert.equal(persisted?.type, DeviceType.SCALE);
  assert.equal(persisted?.connectionType, ConnectionType.SERIAL);
  assert.equal(persisted?.serial?.port, "COM5");
  assert.equal(persisted?.serial?.pnp?.deviceId, configured.serial?.pnp?.deviceId);
});
