import {
  createQaControl,
  DEFAULT_GLOBAL_DURATION_MS,
  MAX_GLOBAL_DURATION_MS,
  MAX_PHASE_TIMEOUT_MS,
  QaControlError,
} from "./qa-rochi-disconnect.control.mjs";
import { authorizeAndRecover } from "./qa-rochi-disconnect.flow.mjs";
import { RochiA01eQaCapture } from "../dist/modules/scale/rochi-a01e.qa.js";
import { RochiA01eSerialScale } from "../dist/modules/scale/rochi-a01e.serial.js";
import {
  createRochiSerialPort,
  listRochiSerialPorts,
} from "../dist/modules/scale/rochi-a01e.serial-port.factory.js";

const args = new Map();
for (let index = 2; index < process.argv.length; index += 2) {
  args.set(process.argv[index], process.argv[index + 1]);
}

const requestedPath = args.get("--port");
const expectedPnpId = args.get("--pnp-id");
const sourceUnit = args.get("--unit") ?? "KG";
const captureDurationMs = Math.min(Number(args.get("--duration-ms") ?? 3000), 3000);
const phaseTimeoutMs = Math.min(Number(args.get("--phase-timeout-ms") ?? MAX_PHASE_TIMEOUT_MS), MAX_PHASE_TIMEOUT_MS);
const maxDurationMs = Math.min(Number(args.get("--max-duration-ms") ?? DEFAULT_GLOBAL_DURATION_MS), MAX_GLOBAL_DURATION_MS);

if (
  !requestedPath ||
  !expectedPnpId ||
  !["KG", "LB"].includes(sourceUnit) ||
  !Number.isFinite(captureDurationMs) ||
  captureDurationMs <= 0 ||
  !Number.isFinite(phaseTimeoutMs) ||
  phaseTimeoutMs <= 0 ||
  !Number.isFinite(maxDurationMs) ||
  maxDurationMs <= 0
) {
  console.error(
    "Usage: node scripts/qa-rochi-disconnect.mjs --port COM3 --pnp-id <exact-pnp-id> --unit KG [--duration-ms 3000] [--phase-timeout-ms 10000] [--max-duration-ms 60000]"
  );
  process.exit(2);
}

let interrupted = false;
let scale;
let capture;
const control = createQaControl({
  input: process.stdin,
  output: process.stdout,
  phaseTimeoutMs,
  maxDurationMs,
});
const onSigint = () => {
  interrupted = true;
  control.cancel();
};
process.once("SIGINT", onSigint);

const boundedCapture = (currentScale) =>
  new RochiA01eQaCapture(currentScale, {
    maxErrors: 8,
    maxInputBytes: 32,
    maxMessageLength: 160,
  });

const waitForOperator = (message, stage) => control.confirm(message, stage);

const waitForState = async (currentScale, states, stage) => {
  while (control.remainingMs() > 0) {
    const snapshot = currentScale.snapshot();
    if (states.includes(snapshot.status)) {
      return snapshot;
    }
    await control.delay(50, stage);
  }
  throw new QaControlError("TIMEOUT", "QA global duration expired", stage);
};

const findExpectedDevice = async (path) => {
  const ports = await listRochiSerialPorts();
  const device = ports.find((candidate) =>
    path ? candidate.path === path : candidate.pnpId === expectedPnpId
  );
  if (!device) {
    throw new Error(`Expected serial path is not present: ${path ?? "matching PnP ID"}`);
  }
  if (device.pnpId !== expectedPnpId) {
    throw new Error(`PnP identity mismatch for ${path ?? device.path}`);
  }
  if (!/VID_1A86&PID_7523/i.test(device.pnpId ?? "")) {
    throw new Error(`Device is not identified as USB-SERIAL CH340: ${path ?? device.path}`);
  }
  return device;
};

const createScale = (path) =>
  new RochiA01eSerialScale(
    { path, sourceUnit, maxReadingAgeMs: 1500 },
    createRochiSerialPort,
    "REAL"
  );

try {
  const initialDevice = await findExpectedDevice(requestedPath);
  console.log(JSON.stringify({ event: "PREFLIGHT", path: initialDevice.path, pnpId: initialDevice.pnpId }));

  await waitForOperator(
    "Confirm platform empty, visual zero is stable, and opening the serial port is authorized with YES.",
    "open"
  );
  scale = createScale(initialDevice.path);
  capture = boundedCapture(scale);
  await scale.open();
  console.log(JSON.stringify({ event: "OPEN", path: initialDevice.path, source: "REAL", sourceUnit }));
  await control.delay(captureDurationMs, "zero-capture");
  console.log(JSON.stringify({ event: "ZERO_CAPTURE", ...capture.finish() }));

  await waitForOperator(
    "Disconnect the USB cable now. Confirm only after the cable is disconnected with YES.",
    "disconnect"
  );
  const disconnected = await waitForState(scale, ["DISCONNECTED", "ERROR"], "disconnect-state");
  console.log(JSON.stringify({ event: "DISCONNECTED", snapshot: disconnected }));
  if (disconnected.status !== "DISCONNECTED" || !disconnected.stale || disconnected.reading) {
    throw new Error("Disconnect did not invalidate the reading safely");
  }

  await waitForOperator(
    "Reconnect the same ROCHI USB cable. Confirm only after Windows detects it with YES.",
    "reconnect"
  );
  const reconnectedDevice = await findExpectedDevice();
  const recovered = await authorizeAndRecover({
    device: reconnectedDevice,
    expectedPnpId,
    initialPath: initialDevice.path,
    onDetected: (device) => console.log(JSON.stringify({ event: "REENUMERATED", ...device })),
    confirmRecovery: (device) =>
      waitForOperator(
        `CH340 reenumerated on ${device.path} (${device.pnpId}). Authorize RECOVERY/reopen with YES.`,
        "recovery"
      ),
    reconnect: () => scale.reconnect(),
    reopen: async (path) => {
      await scale.close();
      scale = createScale(path);
      capture = boundedCapture(scale);
      await scale.open();
    },
  });
  console.log(JSON.stringify({ event: "RECONNECTED", ...recovered }));

  while (control.remainingMs() > 0 && !scale.snapshot().reading) {
    await control.delay(50, "reconnect-capture");
  }
  const afterReconnect = scale.snapshot();
  console.log(JSON.stringify({ event: "RECONNECT_CAPTURE", ...capture.finish(), snapshot: afterReconnect }));
  if (afterReconnect.status !== "OPEN" || afterReconnect.stale || !afterReconnect.reading) {
    throw new Error("No fresh reading after explicit reconnect");
  }
} catch (error) {
  if (error instanceof QaControlError) {
    console.error(JSON.stringify({ event: error.code, stage: error.stage, message: error.message }));
    process.exitCode = error.code === "TIMEOUT" ? 2 : 1;
  } else {
    console.error(JSON.stringify({ event: "BLOCKED_OR_FAIL", message: error.message }));
    process.exitCode = 1;
  }
} finally {
  try {
    await scale?.close();
    if (scale) {
      console.log(JSON.stringify({ event: "CLOSED", snapshot: scale.snapshot() }));
    }
  } catch (error) {
    console.error(JSON.stringify({ event: "CLOSE_ERROR", message: error.message }));
    process.exitCode = 1;
  }
  control.dispose();
  process.removeListener("SIGINT", onSigint);
  if (interrupted && process.exitCode === undefined) {
    process.exitCode = 1;
  }
}
