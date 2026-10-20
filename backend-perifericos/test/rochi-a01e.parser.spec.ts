import assert from "node:assert/strict";
import test from "node:test";
import { RochiA01eParser } from "../src/modules/scale/rochi-a01e.parser";

test("ROCHI parses zero and captured KG frames", () => {
  const parser = new RochiA01eParser({ sourceUnit: "KG" });

  const result = parser.feed("000.000\r\n000.245\r\n000.270\r\n000.490\r\n");

  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.readings.map((reading) => reading.kilograms), [0, 0.245, 0.27, 0.49]);
  assert.equal(result.readings[1]?.sourceUnit, "KG");
});

test("ROCHI converts captured LB value only when LB is explicitly configured", () => {
  const parser = new RochiA01eParser({ sourceUnit: "LB" });

  const result = parser.feed("000.490\r\n");

  assert.deepEqual(result.errors, []);
  assert.equal(result.readings[0]?.value, 0.49);
  assert.equal(result.readings[0]?.kilograms, 0.245);
  assert.equal(result.readings[0]?.sourceUnit, "LB");
});

test("ROCHI keeps incomplete frames until CR LF arrives", () => {
  const parser = new RochiA01eParser({ sourceUnit: "KG" });

  assert.deepEqual(parser.feed("000."), { readings: [], errors: [] });
  assert.deepEqual(parser.feed("245\r"), { readings: [], errors: [] });
  assert.deepEqual(parser.feed("\n"), {
    readings: [{ rawValue: "000.245", value: 0.245, sourceUnit: "KG", kilograms: 0.245 }],
    errors: [],
  });
});

test("ROCHI parses concatenated frames and recovers after corruption", () => {
  const parser = new RochiA01eParser({ sourceUnit: "KG" });

  const result = parser.feed("bad\r\n000.270\r\n000.490\r\n");

  assert.equal(result.errors.length, 1);
  assert.equal(result.errors[0]?.code, "INVALID_FRAME");
  assert.deepEqual(result.readings.map((reading) => reading.rawValue), ["000.270", "000.490"]);
});

test("ROCHI rejects malformed frames without trimming or unit inference", () => {
  const parser = new RochiA01eParser({ sourceUnit: "KG" });

  const result = parser.feed(" 000.245\r\n000,245\r\n000.245kg\r\n");

  assert.equal(result.readings.length, 0);
  assert.equal(result.errors.length, 3);
});

test("ROCHI rejects non-ASCII input and does not retain stale state", () => {
  const parser = new RochiA01eParser({ sourceUnit: "KG" });

  assert.equal(parser.feed("000.2\u00e9").errors[0]?.code, "INVALID_ASCII");
  assert.deepEqual(parser.feed("000.245\r\n"), {
    readings: [{ rawValue: "000.245", value: 0.245, sourceUnit: "KG", kilograms: 0.245 }],
    errors: [],
  });
});

test("ROCHI protects the buffer and recovers on the next valid frame", () => {
  const parser = new RochiA01eParser({ sourceUnit: "KG", maxBufferLength: 8 });

  assert.equal(parser.feed("000.24599").errors[0]?.code, "BUFFER_OVERFLOW");
  assert.deepEqual(parser.feed("000.270\r\n"), {
    readings: [{ rawValue: "000.270", value: 0.27, sourceUnit: "KG", kilograms: 0.27 }],
    errors: [],
  });
});

test("ROCHI requires an explicit supported source unit", () => {
  assert.throws(
    () => new RochiA01eParser({ sourceUnit: "G" as never }),
    /sourceUnit must be explicitly configured/
  );
});
