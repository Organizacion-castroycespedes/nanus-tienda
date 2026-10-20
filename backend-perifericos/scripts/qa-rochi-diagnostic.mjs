import { RochiA01eQaCapture } from "../dist/modules/scale/rochi-a01e.qa.js";
import { RochiA01eSerialScale } from "../dist/modules/scale/rochi-a01e.serial.js";
import { createRochiSerialPort } from "../dist/modules/scale/rochi-a01e.serial-port.factory.js";

const args = new Map();
for (let index = 2; index < process.argv.length; index += 2) {
  args.set(process.argv[index], process.argv[index + 1]);
}

const path = args.get("--port");
const sourceUnit = args.get("--unit") ?? "KG";
const durationMs = Math.min(Number(args.get("--duration-ms") ?? 3000), 3000);

if (!path || !["KG", "LB"].includes(sourceUnit) || !Number.isFinite(durationMs) || durationMs <= 0) {
  console.error("Usage: node scripts/qa-rochi-diagnostic.mjs --port COM3 --unit KG [--duration-ms 3000]");
  process.exit(2);
}

const scale = new RochiA01eSerialScale(
  { path, sourceUnit, maxReadingAgeMs: 1500 },
  createRochiSerialPort,
  "REAL",
);
const capture = new RochiA01eQaCapture(scale, {
  maxErrors: 8,
  maxInputBytes: 32,
  maxMessageLength: 160,
});

try {
  await scale.open();
  console.log(JSON.stringify({ event: "OPEN", path, source: "REAL", sourceUnit }));
  await new Promise((resolve) => setTimeout(resolve, durationMs));
  console.log(JSON.stringify({ event: "CAPTURE", ...capture.finish() }));
} catch (error) {
  console.error(JSON.stringify({ event: "OPEN_ERROR", message: error.message, code: error.code }));
  process.exitCode = 1;
} finally {
  try {
    await scale.close();
    console.log(JSON.stringify({ event: "CLOSED", status: scale.snapshot().status }));
  } catch (error) {
    console.error(JSON.stringify({ event: "CLOSE_ERROR", message: error.message }));
    process.exitCode = 1;
  }
}
