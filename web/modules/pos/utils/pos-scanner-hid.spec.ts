import assert from "node:assert/strict";
import test from "node:test";

import {
  createPosScannerHidLogger,
  describePosScannerWedgeIgnoredSequence,
  resolvePosScannerHidStatus,
} from "./pos-scanner-hid";
import {
  capturePosScannerWedgeChar,
  createPosScannerWedgeState,
} from "./pos-scanner-wedge";

test("hid status uses capture state and not mock disconnect wording", () => {
  const enabled = resolvePosScannerHidStatus(true, null);
  const withLastRead = resolvePosScannerHidStatus(true, "7701234567890");
  const disabled = resolvePosScannerHidStatus(false, null);

  assert.equal(enabled.label, "Scanner HID habilitado");
  assert.equal(enabled.detail, null);
  assert.match(enabled.tone, /emerald/);
  assert.equal(withLastRead.detail, "Última lectura OK");
  assert.equal(disabled.label, "Scanner HID deshabilitado");
  assert.equal(disabled.detail, null);
  assert.match(disabled.tone, /slate/);
  assert.notEqual(enabled.label, "Scanner Desconectado");
});

test("debug false keeps logger silent", () => {
  const calls: unknown[][] = [];
  const sink = {
    info: (...args: unknown[]) => {
      calls.push(args);
    },
  };
  const logger = createPosScannerHidLogger(false, sink);

  logger.captureEnabled();
  logger.scanDetected({ code: "7701234567890", length: 13, durationMs: 120 });
  logger.processingCode("7701234567890");
  logger.productMatched({ id: "prod-1", name: "Arroz" });
  logger.productNotFound("7701234567890");
  logger.sequenceIgnored({
    reason: "duration above maximum",
    length: 13,
    durationMs: 900,
  });

  assert.equal(calls.length, 0);
});

test("debug true emits concise HID logs", () => {
  const calls: unknown[][] = [];
  const sink = {
    info: (...args: unknown[]) => {
      calls.push(args);
    },
  };
  const logger = createPosScannerHidLogger(true, sink);

  logger.captureEnabled();
  logger.scanDetected({ code: "7701234567890", length: 13, durationMs: 118 });
  logger.processingCode("7701234567890");
  logger.productMatched({ id: "prod-1", name: "Arroz" });
  logger.productNotFound("123");
  logger.sequenceIgnored({
    reason: "length below minimum",
    length: 4,
    durationMs: 90,
  });

  assert.deepEqual(calls, [
    ["[POS Scanner HID] capture enabled"],
    [
      "[POS Scanner HID] scan detected",
      {
        code: "7701234567890",
        length: 13,
        durationMs: 118,
      },
    ],
    ["[POS Scanner HID] processing code", { code: "7701234567890" }],
    [
      "[POS Scanner HID] product matched",
      {
        id: "prod-1",
        name: "Arroz",
      },
    ],
    ["[POS Scanner HID] product not found", { code: "123" }],
    [
      "[POS Scanner HID] sequence ignored",
      {
        reason: "length below minimum",
        length: 4,
        durationMs: 90,
      },
    ],
  ]);
});

test("slow typing gets flagged as ignored", () => {
  let state = createPosScannerWedgeState();
  const code = "7701234567890";
  for (const [index, key] of Array.from(code).entries()) {
    state = capturePosScannerWedgeChar(state, key, index * 10);
  }

  const ignored = describePosScannerWedgeIgnoredSequence(state, 900);

  assert.ok(ignored);
  assert.equal(ignored?.reason, "duration above maximum");
  assert.equal(ignored?.length, 13);
});
