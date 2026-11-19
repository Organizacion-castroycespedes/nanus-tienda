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

const buildRuntime = (capture: { port?: RochiA01eSimulatorPort } = {}, monotonicNow?: () => number) => {
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
    createRochiA01eSimulatorFactory(capture),
    monotonicNow
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
      acquireForCapture: async () => ({ reading: { deviceId: "scale-safe-id", weight: 0.245, unit: scenario.unit,
        stable: null, source: scenario.source, unitVerified: scenario.unitVerified,
        stabilityVerified: false, timestamp: "2026-10-08T00:00:00.000Z" }, acceptedMonoMs: 1, frameMonoMs: 2, requestToFrameMs: 1 }),
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
    acquireForCapture: async () => ({ reading: { deviceId: "scale-safe-id", weight: 0, unit: "kg",
      stable: null, source: "REAL", unitVerified: true, stabilityVerified: false,
      timestamp: "2026-10-08T00:00:00.000Z" }, acceptedMonoMs: 1, frameMonoMs: 2, requestToFrameMs: 1 }),
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

// --- Exclusive commercial acquisition (EXCLUSIVE_ACQUISITION_V1) ---

const withRealMode = async (run: () => Promise<void>) => {
  const previousMode = process.env.PERIPHERALS_MODE;
  process.env.PERIPHERALS_MODE = "REAL";
  try { await run(); } finally {
    if (previousMode === undefined) delete process.env.PERIPHERALS_MODE;
    else process.env.PERIPHERALS_MODE = previousMode;
  }
};

/** Deterministic monotonic clock: every reading advances by `step` ms. */
const steppingClock = (start = 1_000, step = 5) => {
  let value = start;
  return () => { value += step; return value; };
};

/** Simulator port whose close completes only when the test releases it. */
class DeferredClosePort extends RochiA01eSimulatorPort {
  private readonly pendingCloses: Array<() => void> = [];
  override close(callback: (error?: Error | null) => void): void {
    this.closeCount += 1;
    this.pendingCloses.push(() => { this.isOpen = false; this.emitClose(); callback(); });
  }
  releaseClose(): void { this.pendingCloses.shift()?.(); }
  get pendingCloseCount(): number { return this.pendingCloses.length; }
}

const verifyKg = (runtime: ReturnType<typeof buildRuntime>) => runtime.controller.update(runtime.configured.id, {
  metadata: { unitVerification: { unit: "KG", method: "OPERATOR_CONFIRMATION", verifiedAt: new Date().toISOString() } },
});

const flush = async () => { for (let i = 0; i < 10; i += 1) await Promise.resolve(); };

const captureController = (runtime: ReturnType<typeof buildRuntime>, submitted: Record<string, unknown>[]) =>
  new ScaleController(runtime.scale, {
    submitSaleCaptureObservation: async (input: Record<string, unknown>) => {
      submitted.push(input);
      return { captureId: input.captureId, status: "READY", expiresAt: new Date(Date.now() + 60_000).toISOString() };
    },
  } as never, runtime.logs);

test("commercial capture declares EXCLUSIVE_ACQUISITION_V1 with monotonic evidence independent of the wall clock", async () => {
  await withRealMode(async () => {
    const runtime = buildRuntime({}, steppingClock());
    verifyKg(runtime);
    const submitted: Record<string, unknown>[] = [];
    const controller = captureController(runtime, submitted);
    const resultPromise = controller.captureForSale({ captureId: "00000000-0000-4000-8000-000000000101" });
    runtime.capture.port!.emitFrame("000.245\r\n");
    const result = await resultPromise;
    assert.equal(result.status, "READY");
    assert.equal(submitted.length, 1);
    assert.equal(submitted[0].captureProtocol, "EXCLUSIVE_ACQUISITION_V1");
    const acquisition = submitted[0].acquisition as { requestToFrameMs: number; frameAgeMs: number };
    assert.deepEqual(Object.keys(acquisition).sort(), ["frameAgeMs", "requestToFrameMs"]);
    // accepted=1005, open=1015 (after resolveScale), frame=1020, submit measured at 1025.
    assert.equal(Number.isSafeInteger(acquisition.requestToFrameMs) && acquisition.requestToFrameMs > 0, true);
    assert.equal(Number.isSafeInteger(acquisition.frameAgeMs) && acquisition.frameAgeMs >= 0, true);
    // The wall-clock observedAt is still sent for audit, unchanged from the frame timestamp.
    assert.equal(submitted[0].observedAt, result.reading.observedAt);
    const readLog = runtime.logs.list().find((entry) => entry.event === "capture.real_read_completed")!;
    assert.equal(readLog.metadata.captureProtocol, "EXCLUSIVE_ACQUISITION_V1");
    assert.equal(readLog.metadata.requestToFrameMs, acquisition.requestToFrameMs);
    assert.equal(JSON.stringify(runtime.logs.list()).includes("0.245"), false);
  });
});

test("commercial capture never receives a frame read before the capture request, even while that port is closing", async () => {
  await withRealMode(async () => {
    const port = new DeferredClosePort();
    const runtime = buildRuntime({ port }, steppingClock());
    verifyKg(runtime);
    const submitted: Record<string, unknown>[] = [];
    const controller = captureController(runtime, submitted);

    // An administrative read receives its frame; its serial session is still closing.
    const adminRead = runtime.scale.getCurrentWeight({ deviceId: runtime.configured.id });
    port.emitFrame("000.111\r\n");
    await flush();
    assert.equal(port.pendingCloseCount, 1);

    // The capture arrives inside the close window of that earlier read.
    const capturePromise = controller.captureForSale({ captureId: "00000000-0000-4000-8000-000000000102" });
    await flush();
    assert.equal(port.openCount, 1, "capture must wait for the earlier session to close");

    port.releaseClose();
    assert.equal((await adminRead).weight, 0.111);
    await flush();
    assert.equal(port.openCount, 2, "capture opens a new serial session of its own");
    port.emitFrame("000.222\r\n");
    await flush();
    port.releaseClose();
    const result = await capturePromise;
    assert.equal(result.reading.weight, 0.222);
    assert.equal(submitted.length, 1);
    assert.equal(submitted[0].weight, 0.222);
  });
});

test("an administrative read issued during a capture never joins or consumes the capture frame", async () => {
  await withRealMode(async () => {
    const port = new DeferredClosePort();
    const runtime = buildRuntime({ port }, steppingClock());
    verifyKg(runtime);
    const submitted: Record<string, unknown>[] = [];
    const controller = captureController(runtime, submitted);

    const capturePromise = controller.captureForSale({ captureId: "00000000-0000-4000-8000-000000000103" });
    assert.equal(port.openCount, 1);
    const adminRead = runtime.scale.getCurrentWeight({ deviceId: runtime.configured.id });
    port.emitFrame("000.300\r\n");
    await flush();
    port.releaseClose();
    const result = await capturePromise;
    assert.equal(result.reading.weight, 0.3);

    await flush();
    assert.equal(port.openCount, 2, "the administrative read opens its own session after the capture");
    port.emitFrame("000.400\r\n");
    await flush();
    port.releaseClose();
    assert.equal((await adminRead).weight, 0.4);
    assert.equal(submitted.length, 1);
  });
});

test("a second simultaneous capture (double click) is rejected as SCALE_CAPTURE_BUSY without a read or submission", async () => {
  await withRealMode(async () => {
    const runtime = buildRuntime({}, steppingClock());
    verifyKg(runtime);
    const submitted: Record<string, unknown>[] = [];
    const controller = captureController(runtime, submitted);

    const first = controller.captureForSale({ captureId: "00000000-0000-4000-8000-000000000104" });
    await assert.rejects(() => controller.captureForSale({ captureId: "00000000-0000-4000-8000-000000000105" }),
      /SCALE_CAPTURE_BUSY/);
    runtime.capture.port!.emitFrame("000.245\r\n");
    await first;
    assert.equal(submitted.length, 1);
    assert.equal(submitted[0].captureId, "00000000-0000-4000-8000-000000000104");
    assert.equal(runtime.capture.port!.openCount, 1);
    const busy = runtime.logs.list().find((entry) => entry.event === "capture.failed"
      && entry.metadata.captureId === "00000000-0000-4000-8000-000000000105");
    assert.equal(busy?.metadata.errorCode, "SCALE_CAPTURE_BUSY");

    // Once the first capture finishes, the next capture reads a new frame.
    const next = controller.captureForSale({ captureId: "00000000-0000-4000-8000-000000000106" });
    runtime.capture.port!.emitFrame("000.500\r\n");
    assert.equal((await next).reading.weight, 0.5);
    assert.equal(runtime.capture.port!.openCount, 2);
  });
});

test("serial parser errors and disconnects fail the capture closed and release the scale for the next capture", async () => {
  await withRealMode(async () => {
    const runtime = buildRuntime({}, steppingClock());
    verifyKg(runtime);
    const submitted: Record<string, unknown>[] = [];
    const controller = captureController(runtime, submitted);

    const failing = controller.captureForSale({ captureId: "00000000-0000-4000-8000-000000000107" });
    // First line is synchronization noise; the second invalid frame is a real parser error.
    runtime.capture.port!.emitFrame("noise\r\nBAD-FRAME\r\n");
    await assert.rejects(() => failing, /ROCHI parser error/);
    const failure = runtime.logs.list().find((entry) => entry.event === "capture.failed"
      && entry.metadata.captureId === "00000000-0000-4000-8000-000000000107");
    assert.equal(failure?.metadata.errorCode, "REAL_SCALE_READ_FAILED");
    assert.equal(submitted.length, 0);

    const recovered = controller.captureForSale({ captureId: "00000000-0000-4000-8000-000000000108" });
    runtime.capture.port!.emitFrame("000.245\r\n");
    assert.equal((await recovered).status, "READY");
    assert.equal(submitted.length, 1);
  });
});

test("a port that cannot open (disconnected scale) rejects the capture without submission", async () => {
  await withRealMode(async () => {
    class DisconnectedPort extends RochiA01eSimulatorPort {
      override open(callback: (error?: Error | null) => void): void { this.openCount += 1; callback(new Error("COM port not found")); }
    }
    const runtime = buildRuntime({ port: new DisconnectedPort() }, steppingClock());
    verifyKg(runtime);
    const submitted: Record<string, unknown>[] = [];
    const controller = captureController(runtime, submitted);
    await assert.rejects(() => controller.captureForSale({ captureId: "00000000-0000-4000-8000-000000000109" }),
      /COM port not found/);
    assert.equal(submitted.length, 0);
    await assert.rejects(() => controller.captureForSale({ captureId: "00000000-0000-4000-8000-000000000110" }),
      /COM port not found/, "the lane is released after a failed open");
  });
});

test("a capture with no exclusive acquisition evidence is never submitted", async () => {
  const logs = new LogsService();
  const controller = new ScaleController({
    acquireForCapture: async () => ({ reading: { deviceId: "scale-safe-id", weight: 0.245, unit: "kg",
      stable: null, source: "REAL", unitVerified: true, stabilityVerified: false,
      timestamp: "2026-10-08T00:00:00.000Z" } }),
  } as never, { submitSaleCaptureObservation: async () => assert.fail("must not submit without evidence") } as never, logs);
  await assert.rejects(() => controller.captureForSale({ captureId: "00000000-0000-4000-8000-000000000111" }),
    /SCALE_ACQUISITION_EVIDENCE_MISSING/);
});
