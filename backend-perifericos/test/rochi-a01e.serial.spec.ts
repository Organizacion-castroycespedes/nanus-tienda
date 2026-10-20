import assert from "node:assert/strict";
import test from "node:test";
import {
  RochiA01eSerialScale,
  type RochiSerialPort,
  type RochiSerialPortOptions,
} from "../src/modules/scale/rochi-a01e.serial";
import {
  createRochiA01eSimulatorFactory,
  RochiA01eSimulatorPort,
} from "../src/modules/scale/rochi-a01e.simulator";

test("ROCHI serial adapter opens once with safe 9600 8N1 defaults", async () => {
  const port = new RochiA01eSimulatorPort();
  let options: RochiSerialPortOptions | undefined;
  const scale = new RochiA01eSerialScale(
    { path: "COM3", sourceUnit: "KG" },
    (receivedOptions) => {
      options = receivedOptions;
      return port;
    },
    "REAL"
  );

  await scale.open();
  await scale.open();

  assert.deepEqual(options, {
    path: "COM3",
    baudRate: 9600,
    dataBits: 8,
    stopBits: 1,
    parity: "none",
    rtscts: false,
    autoOpen: false,
  });
  assert.equal(port.openCount, 1);
  assert.equal(scale.snapshot().status, "OPEN");
});

test("ROCHI serial adapter feeds fragmented and concatenated bytes to the parser", async () => {
  const port = new RochiA01eSimulatorPort();
  const readings: number[] = [];
  const scale = new RochiA01eSerialScale(
    { path: "simulated-rochi", sourceUnit: "KG" },
    createRochiA01eSimulatorFactory({ port }),
    "SIMULATED"
  );
  scale.onReading((reading) => readings.push(reading.kilograms));

  await scale.open();
  port.emitData(Buffer.from("000."));
  port.emitData(Buffer.from("245\r\n000.270\r\n"));

  assert.deepEqual(readings, [0.245, 0.27]);
  assert.equal(scale.snapshot().source, "SIMULATED");
  assert.equal(scale.snapshot().stale, false);
});

test("ROCHI startup synchronizes after a partial frame and keeps later valid frames", async () => {
  const port = new RochiA01eSimulatorPort();
  const errors: string[] = [];
  const readings: string[] = [];
  const scale = new RochiA01eSerialScale(
    { path: "simulated-rochi", sourceUnit: "KG" },
    createRochiA01eSimulatorFactory({ port }),
    "SIMULATED"
  );
  scale.onParseError((error) => errors.push(error.code));
  scale.onReading((reading) => readings.push(reading.rawValue));

  await scale.open();
  port.emitData(Buffer.from("45\r\n000.245\r\n"));

  assert.deepEqual(errors, []);
  assert.deepEqual(readings, ["000.245"]);
  assert.equal(scale.snapshot().synchronized, true);
});

test("ROCHI startup preserves a frame that begins exactly at open", async () => {
  const port = new RochiA01eSimulatorPort();
  const readings: string[] = [];
  const scale = new RochiA01eSerialScale(
    { path: "simulated-rochi", sourceUnit: "KG" },
    createRochiA01eSimulatorFactory({ port }),
    "SIMULATED"
  );
  scale.onReading((reading) => readings.push(reading.rawValue));

  await scale.open();
  port.emitData(Buffer.from("000.245\r\n"));

  assert.deepEqual(readings, ["000.245"]);
  assert.equal(scale.snapshot().synchronized, true);
});

test("ROCHI startup keeps a valid frame divided across chunks", async () => {
  const port = new RochiA01eSimulatorPort();
  const readings: string[] = [];
  const scale = new RochiA01eSerialScale(
    { path: "simulated-rochi", sourceUnit: "KG" },
    createRochiA01eSimulatorFactory({ port }),
    "SIMULATED"
  );
  scale.onReading((reading) => readings.push(reading.rawValue));

  await scale.open();
  port.emitData(Buffer.from("000."));
  assert.equal(scale.snapshot().synchronized, false);
  port.emitData(Buffer.from("245\r\n"));

  assert.deepEqual(readings, ["000.245"]);
  assert.equal(scale.snapshot().synchronized, true);
});

test("ROCHI reports invalid frames after startup synchronization", async () => {
  const port = new RochiA01eSimulatorPort();
  const errors: string[] = [];
  const scale = new RochiA01eSerialScale(
    { path: "simulated-rochi", sourceUnit: "KG" },
    createRochiA01eSimulatorFactory({ port }),
    "SIMULATED"
  );
  scale.onParseError((error) => errors.push(error.code));

  await scale.open();
  port.emitData(Buffer.from("000.245\r\nbad\r\n"));

  assert.deepEqual(errors, ["INVALID_FRAME"]);
});

test("ROCHI serial adapter preserves explicit LB conversion and reports parser errors", async () => {
  const port = new RochiA01eSimulatorPort();
  const errors: string[] = [];
  const scale = new RochiA01eSerialScale(
    { path: "simulated-rochi", sourceUnit: "LB" },
    createRochiA01eSimulatorFactory({ port }),
    "SIMULATED"
  );
  scale.onParseError((error) => errors.push(error.code));

  await scale.open();
  port.emitData(Buffer.from("000.490\r\nbad\r\n"));

  assert.deepEqual(errors, ["INVALID_FRAME"]);
  assert.equal(scale.snapshot().reading?.kilograms, 0.245);
  assert.equal(scale.snapshot().reading?.sourceUnit, "LB");
});

test("ROCHI serial adapter invalidates an old reading after the configured age", async () => {
  const port = new RochiA01eSimulatorPort();
  const scale = new RochiA01eSerialScale(
    { path: "simulated-rochi", sourceUnit: "KG", maxReadingAgeMs: 100 },
    createRochiA01eSimulatorFactory({ port }),
    "SIMULATED"
  );

  await scale.open();
  port.emitFrame("000.245\r\n");
  const receivedAt = scale.snapshot().reading?.receivedAtMs;
  assert.ok(receivedAt);
  assert.equal(scale.snapshot(receivedAt + 100).stale, false);
  assert.equal(scale.snapshot(receivedAt + 101).reading, undefined);
  assert.equal(scale.snapshot(receivedAt + 101).stale, true);
});

test("ROCHI serial adapter reports disconnect and releases resources", async () => {
  const port = new RochiA01eSimulatorPort();
  const scale = new RochiA01eSerialScale(
    { path: "simulated-rochi", sourceUnit: "KG" },
    createRochiA01eSimulatorFactory({ port }),
    "SIMULATED"
  );

  await scale.open();
  port.emitFrame("000.245\r\n");
  assert.equal(scale.snapshot().stale, false);
  port.emitClose();
  assert.equal(scale.snapshot().status, "DISCONNECTED");
  assert.equal(scale.snapshot().reading, undefined);
  assert.equal(scale.snapshot().stale, true);
  assert.equal(scale.snapshot().pendingFragmentLength, 0);
  assert.equal(scale.snapshot().synchronized, false);
  await scale.close();
  assert.equal(scale.snapshot().status, "CLOSED");
  assert.equal(port.closeCount, 0);
});

test("ROCHI serial adapter invalidates a fresh reading on transport error", async () => {
  const port = new RochiA01eSimulatorPort();
  const scale = new RochiA01eSerialScale(
    { path: "simulated-rochi", sourceUnit: "KG" },
    createRochiA01eSimulatorFactory({ port }),
    "SIMULATED"
  );

  await scale.open();
  port.emitFrame("000.");
  port.emitError(new Error("USB disconnected"));
  port.emitFrame("000.270\r\n");

  const snapshot = scale.snapshot();
  assert.equal(snapshot.status, "ERROR");
  assert.equal(snapshot.reading, undefined);
  assert.equal(snapshot.stale, true);
  assert.equal(snapshot.pendingFragmentLength, 0);
  assert.equal(snapshot.synchronized, false);
  assert.match(snapshot.error ?? "", /USB disconnected/);
});

test("ROCHI serial adapter keeps ERROR when close follows the same transport failure", async () => {
  const port = new RochiA01eSimulatorPort();
  const scale = new RochiA01eSerialScale(
    { path: "simulated-rochi", sourceUnit: "KG" },
    createRochiA01eSimulatorFactory({ port }),
    "SIMULATED"
  );

  await scale.open();
  port.emitFrame("000.245\r\n");
  port.emitError(new Error("read failed"));
  port.emitClose();

  assert.equal(scale.snapshot().status, "ERROR");
  assert.equal(scale.snapshot().reading, undefined);
  assert.equal(scale.snapshot().stale, true);
});

test("ROCHI serial adapter ignores late events from a disconnected connection", async () => {
  const ports: RochiA01eSimulatorPort[] = [];
  const scale = new RochiA01eSerialScale(
    { path: "simulated-rochi", sourceUnit: "KG" },
    () => {
      const port = new RochiA01eSimulatorPort();
      ports.push(port);
      return port;
    },
    "SIMULATED"
  );

  await scale.open();
  const oldPort = ports[0];
  oldPort.emitFrame("000.245\r\n");
  oldPort.emitClose();
  await scale.reconnect();

  oldPort.emitFrame("000.270\r\n");
  assert.equal(scale.snapshot().reading, undefined);

  ports[1].emitFrame("000.270\r\n");
  assert.equal(scale.snapshot().reading?.kilograms, 0.27);
  assert.equal(scale.snapshot().reading?.source, "SIMULATED");
});

test("ROCHI serial adapter clears a pending fragment on voluntary close", async () => {
  const port = new RochiA01eSimulatorPort();
  const scale = new RochiA01eSerialScale(
    { path: "simulated-rochi", sourceUnit: "KG" },
    createRochiA01eSimulatorFactory({ port }),
    "SIMULATED"
  );

  await scale.open();
  port.emitFrame("000.000\r\n");
  port.emitData(Buffer.from("000.245"));
  assert.equal(scale.snapshot().pendingFragmentLength, 7);

  await scale.close();
  assert.equal(scale.snapshot().status, "CLOSED");
  assert.equal(scale.snapshot().reading, undefined);
  assert.equal(scale.snapshot().stale, true);
  assert.equal(scale.snapshot().pendingFragmentLength, 0);
  assert.equal(scale.snapshot().synchronized, false);
  assert.equal(port.closeCount, 1);
});

test("ROCHI serial adapter reconnects only when explicitly requested", async () => {
  const ports: RochiA01eSimulatorPort[] = [];
  const scale = new RochiA01eSerialScale(
    { path: "simulated-rochi", sourceUnit: "KG" },
    (_options) => {
      const port = new RochiA01eSimulatorPort();
      ports.push(port);
      return port;
    },
    "SIMULATED"
  );

  await scale.open();
  ports[0]?.emitClose();
  assert.equal(ports.length, 1);
  await scale.reconnect();
  assert.equal(ports.length, 2);
  assert.equal(scale.snapshot().status, "OPEN");
});

test("ROCHI serial adapter keeps port-open failures controlled", async () => {
  const occupiedPort: RochiSerialPort = {
    isOpen: false,
    on() {
      return this;
    },
    open(callback) {
      callback(new Error("Port is already open"));
    },
    close(callback) {
      callback();
    },
  };
  const scale = new RochiA01eSerialScale(
    { path: "COM3", sourceUnit: "KG" },
    () => occupiedPort,
    "REAL"
  );

  await assert.rejects(scale.open(), /Port is already open/);
  assert.equal(scale.snapshot().status, "ERROR");
  assert.match(scale.snapshot().error ?? "", /already open/);
});
