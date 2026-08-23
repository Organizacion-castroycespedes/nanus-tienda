import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";
import { DevicesController } from "../src/modules/devices/devices.controller";
import { DevicesService } from "../src/modules/devices/devices.service";
import { EventsService } from "../src/modules/events/events.service";
import { LogsService } from "../src/modules/logs/logs.service";
import {
  ConnectionType,
  DeviceStatus,
  DeviceType,
  type PeripheralDevice,
} from "../src/shared/types/peripheral.types";
import { FileDeviceRegistryStateStore } from "../src/platform/device-registry-state.store";
import {
  buildUsbPrinterDescriptor,
  type UsbPrinterDiscovery,
} from "../src/shared/usb/usb-printer-discovery";

const discoveredUsbPrinter = buildUsbPrinterDescriptor("Xprinter XP-80T USB");

class FakeUsbDiscovery implements UsbPrinterDiscovery {
  constructor(private devices = [discoveredUsbPrinter]) {}

  list() {
    return [...this.devices];
  }
}

const createTestPaths = () => {
  const root = mkdtempSync(join(tmpdir(), "manus-peripheral-agent-registry-"));
  return {
    root,
    paths: {
      configDir: join(root, "config"),
      stateDir: join(root, "state"),
      logDir: join(root, "logs"),
    },
  };
};

const buildPersistentBundle = (
  usbDiscovery: UsbPrinterDiscovery = new FakeUsbDiscovery(),
  paths = createTestPaths().paths
) => {
  const logsService = new LogsService();
  const eventsService = new EventsService();
  const devicesService = new DevicesService(
    logsService,
    eventsService,
    usbDiscovery,
    new FileDeviceRegistryStateStore(),
    paths
  );

  return {
    logsService,
    eventsService,
    devicesService,
    devicesController: new DevicesController(devicesService),
    paths,
  };
};

const createNetworkDevice = (): PeripheralDevice => ({
  id: "network-xp80-qa-001",
  type: DeviceType.PRINTER,
  name: "XP-80 LAN QA",
  status: DeviceStatus.CONNECTED,
  connectionType: ConnectionType.NETWORK,
  terminalId: "local-terminal",
  profileId: "THERMAL_80MM",
  network: {
    host: "192.168.123.100",
    port: 9100,
    timeoutMs: 3000,
  },
});

test("NETWORK device survives restart and keeps configuration", () => {
  const context = createTestPaths();
  const first = buildPersistentBundle(new FakeUsbDiscovery(), context.paths);

  first.devicesController.create(createNetworkDevice());

  const second = buildPersistentBundle(new FakeUsbDiscovery(), context.paths);
  const restored = second.devicesController
    .getDevices()
    .find((device) => device.id === "network-xp80-qa-001");

  assert.ok(restored);
  assert.equal(restored?.connectionType, ConnectionType.NETWORK);
  assert.equal(restored?.network?.host, "192.168.123.100");
  assert.equal(restored?.network?.port, 9100);
});

test("PATCH persists across restart", () => {
  const context = createTestPaths();
  const first = buildPersistentBundle(new FakeUsbDiscovery(), context.paths);

  first.devicesController.create(createNetworkDevice());
  first.devicesController.update("network-xp80-qa-001", {
    name: "XP-80 LAN QA UPDATED",
    network: {
      host: "192.168.123.110",
      port: 9100,
      timeoutMs: 3000,
    },
  });

  const second = buildPersistentBundle(new FakeUsbDiscovery(), context.paths);
  const restored = second.devicesController
    .getDevices()
    .find((device) => device.id === "network-xp80-qa-001");

  assert.equal(restored?.name, "XP-80 LAN QA UPDATED");
  assert.equal(restored?.network?.host, "192.168.123.110");
});

test("offline configured device stays configured after restart", () => {
  const context = createTestPaths();
  const first = buildPersistentBundle(new FakeUsbDiscovery(), context.paths);

  first.devicesController.create(createNetworkDevice());

  const second = buildPersistentBundle(new FakeUsbDiscovery(), context.paths);
  const restored = second.devicesController
    .getDevices()
    .find((device) => device.id === "network-xp80-qa-001");

  assert.ok(restored);
  assert.equal(restored?.status, DeviceStatus.NOT_REACHABLE);
});

test("missing registry file boots with default mock devices", () => {
  const context = createTestPaths();
  const bundle = buildPersistentBundle(new FakeUsbDiscovery(), context.paths);

  const devices = bundle.devicesController.getDevices();

  assert.equal(
    devices.some((device) => device.id === "mock-printer-001"),
    true
  );
  assert.equal(
    devices.some((device) => device.id === "network-xp80-qa-001"),
    false
  );
});

test("corrupt registry file is handled without crash", () => {
  const context = createTestPaths();
  mkdirSync(context.paths.stateDir, { recursive: true });
  writeFileSync(
    join(context.paths.stateDir, "device-registry.state.json"),
    "{ not json",
    "utf8"
  );

  const bundle = buildPersistentBundle(new FakeUsbDiscovery(), context.paths);
  const devices = bundle.devicesController.getDevices();

  assert.equal(
    devices.some((device) => device.id === "mock-printer-001"),
    true
  );
});

test("configured and discovered USB device does not duplicate on restart", () => {
  const context = createTestPaths();
  const discovery = new FakeUsbDiscovery();
  const first = buildPersistentBundle(discovery, context.paths);

  first.devicesController.discover();
  first.devicesController.create({
    id: "printer-xp80t-usb-qa-001",
    type: DeviceType.PRINTER,
    name: "Xprinter XP-80T QA",
    connectionType: ConnectionType.USB,
    terminalId: "local-terminal",
    profileId: "THERMAL_80MM",
    usb: {
      deviceId: discoveredUsbPrinter.deviceId,
      printerName: discoveredUsbPrinter.printerName,
    },
  });

  first.devicesController.discover();

  const second = buildPersistentBundle(discovery, context.paths);
  second.devicesController.discover();
  const devices = second.devicesController.getDevices();

  assert.equal(
    devices.filter((device) => device.id === "printer-xp80t-usb-qa-001").length,
    1
  );
  assert.equal(
    devices.filter(
      (device) => device.usb?.deviceId === discoveredUsbPrinter.deviceId
    ).length,
    1
  );
});
