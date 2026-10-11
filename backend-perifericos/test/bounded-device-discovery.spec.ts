import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { DevicesService } from "../src/modules/devices/devices.service";
import { EventsService } from "../src/modules/events/events.service";
import { LogsService } from "../src/modules/logs/logs.service";
import { buildRochiSerialDescriptor, type UsbPrinterDiscovery } from "../src/shared/usb/usb-printer-discovery";
import type { DiscoveredSerialDevice } from "../src/shared/discovery/device-discovery-provider";

const serial: DiscoveredSerialDevice = {
  port: "COM5",
  name: "USB-SERIAL CH340",
  nativeIdentifier: "USB\\VID_1A86&PID_7523\\BOUNDED-QA",
  pnpDeviceId: "USB\\VID_1A86&PID_7523\\BOUNDED-QA",
  vendorId: "1A86",
  productId: "7523",
  status: "OK",
  present: true,
  fingerprint: { source: "WINDOWS_SERIAL_PNP", values: { status: "OK" } },
  platform: "WINDOWS",
  architecture: "amd64",
};

test("Windows discovery uses asynchronous child-process execution with a per-command timeout", () => {
  const source = readFileSync(join(process.cwd(), "src/platform/windows/windows-printer-discovery.provider.ts"), "utf8");
  assert.match(source, /import \{ execFile \}/);
  assert.doesNotMatch(source, /execFileSync/);
  assert.match(source, /timeout: WINDOWS_PRINTER_DISCOVERY_TIMEOUT_MS/);
  assert.match(source, /WINDOWS_PRINTER_DISCOVERY_TIMEOUT_MS = 7_000/);
});

test("overlapping discovery requests share one bounded hardware scan", async () => {
  const previousMode = process.env.PERIPHERALS_MODE;
  process.env.PERIPHERALS_MODE = "REAL";
  let serialCalls = 0;
  const discovery: UsbPrinterDiscovery = {
    list: async () => [],
    listSerialDevices: async () => {
      serialCalls += 1;
      await new Promise((resolve) => setTimeout(resolve, 20));
      return [buildRochiSerialDescriptor(serial)!];
    },
  };
  const service = new DevicesService(new LogsService(), new EventsService(), discovery, {
    read: () => ({ schemaVersion: 1, devices: [] }),
    write: () => undefined,
  }, { configDir: ".test-config", stateDir: ".test-state", logDir: ".test-log" });
  try {
    const [first, second] = await Promise.all([service.discover(), service.discover()]);
    assert.equal(serialCalls, 1);
    assert.equal(first.devices.some((device) => device.id === second.devices.find((item) => item.type === "SCALE")?.id), true);
  } finally {
    if (previousMode === undefined) delete process.env.PERIPHERALS_MODE;
    else process.env.PERIPHERALS_MODE = previousMode;
  }
});

test("serial discovery failure is controlled and does not erase last known ROCHI or printer stage", async () => {
  const previousMode = process.env.PERIPHERALS_MODE;
  process.env.PERIPHERALS_MODE = "REAL";
  let failSerial = false;
  let printerCalls = 0;
  const discovery: UsbPrinterDiscovery = {
    list: async () => { printerCalls += 1; return []; },
    listSerialDevices: async () => {
      if (failSerial) throw new Error("serial inventory timed out");
      return [buildRochiSerialDescriptor(serial)!];
    },
  };
  const logs = new LogsService();
  const service = new DevicesService(logs, new EventsService(), discovery, {
    read: () => ({ schemaVersion: 1, devices: [] }),
    write: () => undefined,
  }, { configDir: ".test-config", stateDir: ".test-state", logDir: ".test-log" });
  const rochiId = buildRochiSerialDescriptor(serial)!.id;
  try {
    await service.discover();
    assert.ok(service.list().some((device) => device.id === rochiId));
    failSerial = true;
    await assert.rejects(service.discover(), /serial discovery failed: serial inventory timed out/);
    assert.ok(service.list().some((device) => device.id === rochiId));
    assert.equal(printerCalls, 2);
    assert.equal(logs.list().some((entry) => entry.event === "devices.discover.serial_failed" && entry.metadata.durationMs !== undefined), true);
    assert.equal(logs.list().some((entry) => entry.event === "discovery.completed" && entry.metadata.outcome === "PARTIAL"), true);
  } finally {
    if (previousMode === undefined) delete process.env.PERIPHERALS_MODE;
    else process.env.PERIPHERALS_MODE = previousMode;
  }
});
