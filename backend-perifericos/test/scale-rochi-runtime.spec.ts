import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";
import { DevicesService } from "../src/modules/devices/devices.service";
import { EventsService } from "../src/modules/events/events.service";
import { LogsService } from "../src/modules/logs/logs.service";
import { DevicesController } from "../src/modules/devices/devices.controller";
import { ScaleController } from "../src/modules/scale/scale.controller";
import { ScaleService } from "../src/modules/scale/scale.service";
import { RochiA01eSimulatorPort, createRochiA01eSimulatorFactory } from "../src/modules/scale/rochi-a01e.simulator";
import { FileDeviceRegistryStateStore } from "../src/platform/device-registry-state.store";
import { DeviceProfileId } from "../src/shared/profiles/device-profiles";
import { ConnectionType, DeviceType } from "../src/shared/types/peripheral.types";
import type { PlatformPaths } from "../src/shared/platform/platform-paths";
import type { UsbPrinterDiscovery } from "../src/shared/usb/usb-printer-discovery";

const createPaths = (): PlatformPaths => {
  const root = mkdtempSync(join(tmpdir(), "manus-scale-runtime-"));
  return {
    configDir: join(root, "config"),
    stateDir: join(root, "state"),
    logDir: join(root, "logs"),
  };
};

const rochiSerial = {
  port: "COM_TEST_ROCHI",
  baudRate: 9600,
  dataBits: 8 as const,
  stopBits: 1 as const,
  parity: "none" as const,
  flowControl: "none" as const,
  pnp: {
    deviceId: "USB\\VID_1A86&PID_7523\\RUNTIME-QA",
    vendorId: "1A86",
    productId: "7523",
  },
};

const buildRuntime = (capture: { port?: RochiA01eSimulatorPort } = {}) => {
  const logs = new LogsService();
  const events = new EventsService();
  const devices = new DevicesService(
    logs,
    events,
    { list: () => [] } satisfies UsbPrinterDiscovery,
    new FileDeviceRegistryStateStore(),
    createPaths()
  );
  const controller = new DevicesController(devices);
  const configured = controller.create({
    id: "scale-rochi-runtime-001",
    type: DeviceType.SCALE,
    name: "ROCHI runtime QA",
    connectionType: ConnectionType.SERIAL,
    terminalId: "local-terminal",
    profileId: DeviceProfileId.RochiA01e,
    serial: rochiSerial,
  });
  const scale = new ScaleService(
    devices,
    logs,
    events,
    createRochiA01eSimulatorFactory(capture)
  );
  return { scale, configured, capture, controller, scaleController: new ScaleController(scale) };
};

test("REAL ROCHI reads configured serial device without claiming unit or stability", async () => {
  const previousMode = process.env.PERIPHERALS_MODE;
  process.env.PERIPHERALS_MODE = "REAL";
  const runtime = buildRuntime();
  try {
    const resultPromise = runtime.scaleController.getCurrentWeight(
      undefined,
      runtime.configured.id
    );
    assert.ok(runtime.capture.port);
    runtime.capture.port.emitFrame("000.245\r\n");
    const result = await resultPromise;
    assert.deepEqual(result, {
      deviceId: runtime.configured.id,
      weight: 0.245,
      unit: null,
      stable: null,
      source: "REAL",
      unitVerified: false,
      stabilityVerified: false,
      timestamp: result.timestamp,
    });
    assert.equal(runtime.capture.port.openCount, 1);
    assert.equal(runtime.capture.port.closeCount, 1);
  } finally {
    if (previousMode === undefined) delete process.env.PERIPHERALS_MODE;
    else process.env.PERIPHERALS_MODE = previousMode;
  }
});

test("concurrent REAL requests share one ROCHI reader and later read reopens cleanly", async () => {
  const previousMode = process.env.PERIPHERALS_MODE;
  process.env.PERIPHERALS_MODE = "REAL";
  const runtime = buildRuntime();
  try {
    const first = runtime.scale.getCurrentWeight({ deviceId: runtime.configured.id });
    const second = runtime.scale.getCurrentWeight({ deviceId: runtime.configured.id });
    assert.equal(first, second);
    runtime.capture.port!.emitFrame("000.100\r\n");
    await Promise.all([first, second]);
    const later = runtime.scale.getCurrentWeight({ deviceId: runtime.configured.id });
    runtime.capture.port!.emitFrame("000.200\r\n");
    assert.equal((await later).weight, 0.2);
    assert.equal(runtime.capture.port!.openCount, 2);
    assert.equal(runtime.capture.port!.closeCount, 2);
  } finally {
    if (previousMode === undefined) delete process.env.PERIPHERALS_MODE;
    else process.env.PERIPHERALS_MODE = previousMode;
  }
});

test("REAL mode has no configured scale and never falls back to MOCK", () => {
  const previousMode = process.env.PERIPHERALS_MODE;
  process.env.PERIPHERALS_MODE = "REAL";
  const logs = new LogsService();
  const events = new EventsService();
  const devices = new DevicesService(
    logs,
    events,
    { list: () => [] },
    new FileDeviceRegistryStateStore(),
    createPaths()
  );
  const scale = new ScaleService(devices, logs, events);
  try {
    assert.throws(
      () => scale.getCurrentWeight({}),
      /configured SCALE device not found/
    );
  } finally {
    if (previousMode === undefined) delete process.env.PERIPHERALS_MODE;
    else process.env.PERIPHERALS_MODE = previousMode;
  }
});

test("REAL mode rejects multiple configured scales without an explicit selector", () => {
  const previousMode = process.env.PERIPHERALS_MODE;
  process.env.PERIPHERALS_MODE = "REAL";
  const runtime = buildRuntime();
  try {
    runtime.controller.create({
      id: "scale-rochi-runtime-002",
      type: DeviceType.SCALE,
      name: "ROCHI runtime QA 2",
      connectionType: ConnectionType.SERIAL,
      terminalId: "local-terminal",
      profileId: DeviceProfileId.RochiA01e,
      serial: { ...rochiSerial, port: "COM_TEST_ROCHI_2" },
    });
    assert.throws(
      () => runtime.scale.getCurrentWeight({}),
      /multiple configured scales require deviceId/
    );
  } finally {
    if (previousMode === undefined) delete process.env.PERIPHERALS_MODE;
    else process.env.PERIPHERALS_MODE = previousMode;
  }
});
