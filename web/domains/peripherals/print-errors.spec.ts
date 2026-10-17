import assert from "node:assert/strict";
import test from "node:test";
import { PRINT_ERROR_CODES, safePrintErrorCode, safePrintIpcErrorCode, toPeripheralOperationErrorCode } from "./print-errors";

test("print codes survive Electron serialization without exposing remote text", () => {
  for (const code of PRINT_ERROR_CODES) {
    assert.equal(safePrintErrorCode(code), code);
    assert.equal(safePrintIpcErrorCode(new Error(`Error invoking remote method 'printer:test': AgentHttpError: ${code}`)), code);
  }
});

test("unknown print errors and misleading payloads remain generic", () => {
  for (const value of ["UNKNOWN", "PRINT_TIMEOUT: C:\\private\\token", null, {}, ["PRINT_TIMEOUT"]]) {
    assert.equal(safePrintErrorCode(value), "PRINT_FAILED");
  }
  assert.equal(safePrintIpcErrorCode(new Error("C:\\private\\token")), "PRINT_FAILED");
  assert.equal(safePrintIpcErrorCode({ code: "UNKNOWN", message: "PRINT_TIMEOUT" }), "PRINT_FAILED");
});

test("operation errors keep legacy category and exact safe transport diagnostics", () => {
  for (const code of PRINT_ERROR_CODES) {
    assert.equal(toPeripheralOperationErrorCode(code), "PRINT_ERROR");
    assert.equal(safePrintErrorCode(code), code);
    assert.equal(safePrintIpcErrorCode(new Error(code)), code);
  }
});

test("non-print operation and configuration error categories remain unchanged", () => {
  for (const code of ["OPERATION_DISABLED", "MISSING_CONFIG", "INVALID_CONFIG",
    "AGENT_OFFLINE", "NETWORK_ERROR", "DEVICE_NOT_FOUND", "TIMEOUT",
    "CONNECTION_REFUSED", "PRINT_ERROR", "PRINTER_NOT_CONFIGURED",
    "SCALE_WEIGHT_ZERO", "HTTP_ERROR"] as const) {
    assert.equal(toPeripheralOperationErrorCode(code), code);
  }
});