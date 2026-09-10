import assert from "node:assert/strict";
import test from "node:test";
import { DevicesController } from "../src/modules/devices/devices.controller";
import { DevicesService } from "../src/modules/devices/devices.service";
import { EventsService } from "../src/modules/events/events.service";
import { LogsService } from "../src/modules/logs/logs.service";
import type { PlatformPaths } from "../src/shared/platform/platform-paths";
import type { DeviceRegistryStateStore } from "../src/platform/device-registry-state.store";
import type { UsbPrinterDiscovery } from "../src/shared/usb/usb-printer-discovery";
import { DeviceStatus } from "../src/shared/types/peripheral.types";

const paths: PlatformPaths = { configDir: ".test-config", stateDir: ".test-state", logDir: ".test-log" };
const store: DeviceRegistryStateStore = { read: () => ({ schemaVersion: 1, devices: [] }), write: () => undefined };
const descriptor = (name: string, source: string, nativeIdentifier: string, values: Record<string, string> = {}) => ({
  id: `${source}-${name}`,
  name,
  deviceId: `${source}-${name}`,
  printerName: name,
  descriptor: { agentInstallationId: "fixture", deviceId: `${source}-${name}`, nativeIdentifier, fingerprint: { source, values }, platform: "WINDOWS" as const, architecture: "amd64" },
});

test("productive controller preserves reconciled PnP, queue and ambiguous printers", () => {
  const previousMode = process.env.PERIPHERALS_MODE;
  process.env.PERIPHERALS_MODE = "REAL";
  const discovery: UsbPrinterDiscovery = {
    list: () => [
      descriptor("USB Printer", "WINDOWS_PNP", "USB\\A", { vid: "0483", pid: "070B", physicalDetected: "true" }),
      descriptor("Queue Printer", "WINDOWS_PRINT_QUEUE", "QUEUE\\B", { queueInstalled: "true" }),
      descriptor("Exact Printer", "WINDOWS_PNP", "USB\\C"),
      descriptor("Exact Printer", "WINDOWS_PRINT_QUEUE", "USB\\C"),
      descriptor("Ambiguous", "WINDOWS_PNP", "USB\\D"),
      descriptor("Ambiguous", "WINDOWS_PRINT_QUEUE", "QUEUE\\D"),
    ],
  };
  const service = new DevicesService(new LogsService(), new EventsService(), discovery, store, paths);
  const controller = new DevicesController(service);
  const discovered = controller.discover().devices;
  const listed = controller.getDevices();
  assert.equal(listed.filter((device) => device.id.startsWith("mock-")).length, 0);
  assert.equal(discovered.filter((device) => device.id.startsWith("mock-")).length, 0);
  assert.ok(listed.some((device) => device.metadata?.physicalDetected === true));
  assert.ok(listed.some((device) => device.metadata?.queueInstalled === true));
  const queueOnly = listed.find((device) => device.name === "Queue Printer");
  assert.equal(queueOnly?.metadata?.physicalDetected, false);
  assert.equal(queueOnly?.metadata?.queueInstalled, true);
  assert.notEqual(queueOnly?.status, DeviceStatus.CONNECTED);
  assert.equal(discovered.filter((device) => device.name === "Exact Printer").length, 1);
  assert.equal(discovered.filter((device) => device.name === "Ambiguous").length, 2);
  assert.equal(discovered.length, listed.length);
  if (previousMode === undefined) delete process.env.PERIPHERALS_MODE;
  else process.env.PERIPHERALS_MODE = previousMode;
});

test("productive queue association persists through refresh and discovery", () => {
  const previousMode = process.env.PERIPHERALS_MODE;
  process.env.PERIPHERALS_MODE = "REAL";
  const discovery: UsbPrinterDiscovery = {
    list: () => [
      descriptor("XP-58", "WINDOWS_PNP", "USB\\XP58", { physicalDetected: "true" }),
      descriptor("XP-58 Queue", "WINDOWS_PRINT_QUEUE", "QUEUE\\XP58", { queueInstalled: "true" }),
    ],
  };
  const service = new DevicesService(new LogsService(), new EventsService(), discovery, store, paths);
  const controller = new DevicesController(service);
  const first = controller.discover().devices.find((device) => device.name === "XP-58");
  assert.ok(first);
  const configured = controller.create({
    id: "xp58-configured",
    type: "PRINTER",
    name: "XP-58",
    connectionType: "USB",
    profileId: "THERMAL_58MM",
    usb: { deviceId: first.usb?.deviceId },
  });
  const updated = controller.update(configured.id, {
    usb: { deviceId: first.usb?.deviceId, windowsQueueName: "XP-58 Queue" },
  });
  assert.equal(updated.usb?.windowsQueueName, "XP-58 Queue");
  assert.equal(controller.getDevices().find((device) => device.id === configured.id)?.usb?.windowsQueueName, "XP-58 Queue");
  controller.discover();
  assert.equal(controller.getDevices().find((device) => device.id === configured.id)?.usb?.windowsQueueName, "XP-58 Queue");
  if (previousMode === undefined) delete process.env.PERIPHERALS_MODE;
  else process.env.PERIPHERALS_MODE = previousMode;
});
