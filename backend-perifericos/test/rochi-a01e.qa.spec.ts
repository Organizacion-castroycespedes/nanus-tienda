import assert from "node:assert/strict";
import test from "node:test";
import { RochiA01eQaCapture } from "../src/modules/scale/rochi-a01e.qa";
import { RochiA01eSerialScale } from "../src/modules/scale/rochi-a01e.serial";
import {
  createRochiA01eSimulatorFactory,
  RochiA01eSimulatorPort,
} from "../src/modules/scale/rochi-a01e.simulator";

const buildCapture = (options: { maxErrors?: number; maxInputBytes?: number } = {}) => {
  const port = new RochiA01eSimulatorPort();
  const scale = new RochiA01eSerialScale(
    { path: "simulated-rochi", sourceUnit: "KG", maxBufferLength: 8 },
    createRochiA01eSimulatorFactory({ port }),
    "SIMULATED"
  );
  const capture = new RochiA01eQaCapture(scale, { startedAtMs: Date.now(), ...options });
  return { capture, port, scale };
};

test("QA capture records bounded INVALID_FRAME and valid frames", async () => {
  const { capture, port, scale } = buildCapture({ maxInputBytes: 4 });
  await scale.open();
  port.emitData(Buffer.from("000.245\r\nbad\r\n000.245\r\n"));

  const report = capture.finish();

  assert.equal(report.validFrameCount, 2);
  assert.equal(report.errors[0]?.code, "INVALID_FRAME");
  assert.equal(report.errors[0]?.inputHex, "626164");
  assert.equal(report.suppressedErrorCount, 0);
  assert.equal(report.snapshot.pendingFragmentLength, 0);
  await scale.close();
});

test("QA capture distinguishes INVALID_ASCII and BUFFER_OVERFLOW", async () => {
  const { capture, port, scale } = buildCapture();
  await scale.open();
  port.emitData(Buffer.from("000.245\r\n"));
  port.emitData(Buffer.from([0x30, 0x30, 0x30, 0x2e, 0x32, 0xff]));
  port.emitData(Buffer.from("000.24599"));

  const report = capture.finish();

  assert.deepEqual(report.errors.map((error) => error.code), [
    "INVALID_ASCII",
    "BUFFER_OVERFLOW",
  ]);
  assert.equal(report.validFrameCount, 1);
  await scale.close();
});

test("QA capture limits error records and reports pending fragments separately", async () => {
  const { capture, port, scale } = buildCapture({ maxErrors: 2 });
  await scale.open();
  port.emitData(Buffer.from("000.245\r\nbad\r\nbad\r\nbad\r\n000."));

  const report = capture.finish();

  assert.equal(report.errors.length, 2);
  assert.equal(report.suppressedErrorCount, 1);
  assert.equal(report.snapshot.pendingFragmentLength, 4);
  assert.equal(report.validFrameCount, 1);
  await scale.close();
});
