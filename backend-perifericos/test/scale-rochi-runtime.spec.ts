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
  return { scale, configured, capture, controller, logs, scaleController: new ScaleController(scale, {
    submitRealObservation: async () => ({ available: false }),
    submitSaleCaptureObservation: async () => ({ status: "READY" }),
  } as never, logs) };
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

test("REAL ROCHI exposes KG only after explicit local operator verification", async () => {
  const previousMode = process.env.PERIPHERALS_MODE;
  process.env.PERIPHERALS_MODE = "REAL";
  const runtime = buildRuntime();
  try {
    runtime.controller.update(runtime.configured.id, {
      metadata: {
        unitVerification: {
          unit: "KG",
          method: "OPERATOR_CONFIRMATION",
          verifiedAt: "2026-09-30T00:00:00.000Z",
        },
      },
    });
    const read = runtime.scale.getCurrentWeight({ deviceId: runtime.configured.id });
    runtime.capture.port!.emitFrame("000.245\r\n");
    const result = await read;
    assert.equal(result.unit, "kg");
    assert.equal(result.unitVerified, true);
    assert.equal(result.stable, null);
    assert.equal(result.stabilityVerified, false);
    const realReadLog = runtime.logs.list().find((entry) => entry.event === "scale.current_weight.real");
    assert.equal(realReadLog?.metadata.unitVerified, true);
    assert.equal(realReadLog?.metadata.unit, "kg");
    assert.equal(realReadLog?.metadata.stabilityVerified, false);
    assert.equal(realReadLog?.metadata.observedAt, result.timestamp);
  } finally {
    if (previousMode === undefined) delete process.env.PERIPHERALS_MODE;
    else process.env.PERIPHERALS_MODE = previousMode;
  }
});

test("commercial capture reads the configured REAL ROCHI and submits its observation to the authenticated API client", async () => {
  const previousMode = process.env.PERIPHERALS_MODE;
  process.env.PERIPHERALS_MODE = "REAL";
  const runtime = buildRuntime();
  const submitted: Record<string, unknown>[] = [];
  runtime.controller.update(runtime.configured.id, { metadata: { unitVerification: {
    unit: "KG", method: "OPERATOR_CONFIRMATION", verifiedAt: new Date().toISOString(),
  } } });
  const controller = new ScaleController(runtime.scale, {
    submitSaleCaptureObservation: async (input: Record<string, unknown>) => {
      submitted.push(input); return { captureId: input.captureId, status: "READY", expiresAt: new Date(Date.now() + 60_000).toISOString() };
    },
  } as never, runtime.logs);
  try {
    const resultPromise = controller.captureForSale({ captureId: "00000000-0000-4000-8000-000000000001" });
    runtime.capture.port!.emitFrame("000.245\r\n");
    const result = await resultPromise;
    assert.equal(result.status, "READY");
    assert.equal(result.reading.weight, 0.245);
    assert.equal(result.reading.source, "REAL");
    assert.equal(result.reading.unit, "kg");
    assert.equal(result.reading.unitVerified, true);
    assert.equal(submitted.length, 1);
    assert.equal(submitted[0].weight, 0.245);
    assert.equal(submitted[0].source, "REAL");
    const captureLogs = runtime.logs.list().filter((entry) => entry.event.startsWith("capture."));
    assert.deepEqual(captureLogs.map((entry) => entry.event).reverse(), [
      "capture.request_received", "capture.real_read_completed", "capture.local_validation_passed",
    ]);
    const readLog = captureLogs.find((entry) => entry.event === "capture.real_read_completed")!;
    assert.equal(readLog.metadata.unitVerified, true);
    assert.equal(readLog.metadata.source, "REAL");
    assert.equal(readLog.metadata.logicalScaleId, runtime.configured.id);
    assert.equal("weight" in readLog.metadata, false);
    const serializedLogs = JSON.stringify(captureLogs).toLowerCase();
    for (const sensitive of ["0.245", "authorization", "nonce", "verifier", "secret"]) {
      assert.equal(serializedLogs.includes(sensitive), false);
    }
  } finally {
    if (previousMode === undefined) delete process.env.PERIPHERALS_MODE;
    else process.env.PERIPHERALS_MODE = previousMode;
  }
});

test("commercial capture logs a safe local rejection stage for non-REAL, non-KG and unverified readings", async () => {
  const rejectedReadings = [
    { source: "MOCK", unit: "kg", unitVerified: true, expected: "SCALE_SOURCE_NOT_REAL" },
    { source: "REAL", unit: "lb", unitVerified: true, expected: "SCALE_UNIT_NOT_KG" },
    { source: "REAL", unit: "kg", unitVerified: false, expected: "SCALE_UNIT_UNVERIFIED" },
  ];
  for (const [index, scenario] of rejectedReadings.entries()) {
    const logs = new LogsService();
    const controller = new ScaleController({
      getCurrentWeight: async () => ({ deviceId: "scale-safe-id", weight: 0.245, unit: scenario.unit,
        stable: null, source: scenario.source, unitVerified: scenario.unitVerified,
        stabilityVerified: false, timestamp: "2026-10-08T00:00:00.000Z" }),
    } as never, { submitSaleCaptureObservation: async () => assert.fail("rejected reading must not be submitted") } as never, logs);

    await assert.rejects(() => controller.captureForSale({
      captureId: `00000000-0000-4000-8000-00000000000${index + 1}`,
    }), /REAL_KG_VERIFIED_READING_REQUIRED/);
    const rejection = logs.list().find((entry) => entry.event === "capture.local_validation_rejected");
    assert.equal(rejection?.metadata.stage, "local_validation");
    assert.equal(rejection?.metadata.httpStatus, 400);
    assert.equal(rejection?.metadata.errorCode, scenario.expected);
    assert.equal("weight" in (rejection?.metadata ?? {}), false);
  }
});

test("commercial capture rejects an exact REAL zero with a semantic code before observation submission", async () => {
  const logs = new LogsService();
  const controller = new ScaleController({
    getCurrentWeight: async () => ({ deviceId: "scale-safe-id", weight: 0, unit: "kg",
      stable: null, source: "REAL", unitVerified: true, stabilityVerified: false,
      timestamp: "2026-10-08T00:00:00.000Z" }),
  } as never, { submitSaleCaptureObservation: async () => assert.fail("zero weight must not be submitted") } as never, logs);

  await assert.rejects(() => controller.captureForSale({
    captureId: "00000000-0000-4000-8000-000000000010",
  }), /SCALE_WEIGHT_ZERO/);

  const events = logs.list().filter((entry) => entry.event.startsWith("capture."));
  const rejected = events.find((entry) => entry.event === "capture.local_validation_rejected");
  assert.equal(rejected?.metadata.errorCode, "SCALE_WEIGHT_ZERO");
  assert.equal(rejected?.metadata.httpStatus, 400);
  assert.equal(events.some((entry) => entry.event === "capture.local_validation_passed"), false);
  assert.equal(events.some((entry) => entry.event === "capture.observation_send_started"), false);
  assert.equal("weight" in (rejected?.metadata ?? {}), false);
});
