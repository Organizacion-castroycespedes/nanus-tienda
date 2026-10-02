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

test("serial discovery is side-effect free, deduplicated, and keeps printers", () => {
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
    const response = new DevicesController(service).discover();
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

test("discovered ROCHI configures, reloads, and follows PnP identity across COM changes", () => {
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
  const candidate = firstController.discover().devices.find(
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
  const reconciled = new DevicesController(secondService).discover().devices.filter(
    (device) => device.profileId === "ROCHI_A01E"
  );
  assert.equal(reconciled.length, 1);
  assert.equal(reconciled[0].id, candidate!.id);
  assert.equal(reconciled[0].serial?.port, "COM4");
  assert.equal(reconciled[0].serial?.pnp?.deviceId, "USB\\VID_1A86&PID_7523\\ROCHI-CONFIG-QA");
  assert.equal(secondService.getHealthSnapshot().configuredDevices, 1);
});
