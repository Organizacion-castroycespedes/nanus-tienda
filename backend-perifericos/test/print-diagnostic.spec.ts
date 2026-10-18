import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { ArgumentsHost } from "@nestjs/common";
import { BadRequestException } from "@nestjs/common";
import { classifyPrintCommandError, PRINT_ERROR_CODES, PrintDiagnosticError, safePrintDiagnosticMetadata } from "../src/shared/printing/print-diagnostic";
import { WindowsGdiSpoolerTransport } from "../src/platform/windows/windows-gdi-spooler.transport";
import { encodePowerShellRawPrint } from "../src/platform/windows/windows-raw-spooler.transport";
import { UsbSystemPrinterAdapter } from "../src/shared/adapters/usb-system-printer.adapter";
import { DEVICE_PROFILES } from "../src/shared/profiles/device-profiles";
import { ConnectionType, DeviceStatus, DeviceType, type PeripheralDevice } from "../src/shared/types/peripheral.types";
import { SanitizedHttpExceptionFilter } from "../src/shared/filters/sanitized-http-exception.filter";
import { DEFAULT_CASH_DRAWER_PULSE_PROFILE } from "../src/shared/escpos/thermal-escpos.renderer";
import { forbidHardwareIO } from "./support/no-hardware";

forbidHardwareIO();

const secret = "C:\\private\\token payload stderr stack";
const device: PeripheralDevice = {
  id: "usb-printer-1f0028d1fa5243c2", name: "XP-80", type: DeviceType.PRINTER,
  status: DeviceStatus.CONNECTED, connectionType: ConnectionType.USB, terminalId: "fixture",
  usb: { deviceId: "fixture-usb", printerName: "wrong legacy name", windowsQueueName: "XP-80" },
  metadata: { usbRawCashDrawerPulseCertified: true },
};
const input = {
  device, profile: DEVICE_PROFILES.THERMAL_80MM, mode: "REAL" as const,
  agentName: "fixture", terminalId: "fixture", jobId: "fixture", timestamp: "2026-10-16T00:00:00Z",
};

for (const [failure, code] of [
  [{ code: "ENOENT" }, "PRINT_COMMAND_LAUNCH_FAILED"],
  [{ code: "EACCES" }, "PRINT_COMMAND_LAUNCH_FAILED"],
  [{ code: "ETIMEDOUT", signal: "SIGTERM" }, "PRINT_TIMEOUT"],
  [{ status: 41 }, "WINDOWS_INVALID_PRINTER_QUEUE"],
  [{ status: 42 }, "PRINT_SPOOLER_SUBMISSION_FAILED"],
  [{ status: 43 }, "PRINT_PROCESS_FAILED"],
  [{ status: 1 }, "PRINT_PROCESS_FAILED"],
  [{ code: "UNKNOWN", message: "OpenPrinter failed: 1801", stderr: secret }, "PRINT_FAILED"],
] as const) {
  test(`safe command classification ${code} ${JSON.stringify(failure)}`, () => {
    assert.equal(classifyPrintCommandError(failure, "WINDOWS_USB_GDI"), code);
    const adapter = new UsbSystemPrinterAdapter("win32", () => { throw Object.assign(new Error(secret), failure); }, "GDI");
    assert.throws(() => adapter.printTest(input), (error: unknown) => {
      assert.ok(error instanceof PrintDiagnosticError);
      assert.equal(error.code, code);
      assert.equal(error.getStatus(), 400);
      assert.equal(error.message, code);
      assert.ok(!JSON.stringify(error.getResponse()).includes(secret));
      return true;
    });
  });
}

test("mock GDI uses explicit queue, bounded script exits and unchanged success", () => {
  let calls = 0;
  const adapter = new UsbSystemPrinterAdapter("win32", (_command, args) => {
    calls += 1;
    const script = Buffer.from(args[3], "base64").toString("utf16le");
    assert.ok(script.includes(Buffer.from("XP-80").toString("base64")));
    assert.match(script, /exit 41/);
    assert.match(script, /exit 42/);
    assert.match(script, /exit 43/);
    assert.match(script, /ErrorActionPreference = 'Stop'/);
  }, "GDI");
  assert.equal(adapter.printTest(input).adapterName, "UsbSystemPrinterAdapter");
  assert.equal(calls, 1);
  assert.match(encodePowerShellRawPrint(), /GetLastWin32Error\(\) -eq 1801/);
});

for (const status of [41, 42]) {
  test(`reserved exit ${status} requires an Agent Windows USB context`, () => {
    const failure = { status, message: secret, stderr: secret };
    const expected = status === 41 ? "WINDOWS_INVALID_PRINTER_QUEUE" : "PRINT_SPOOLER_SUBMISSION_FAILED";
    assert.equal(classifyPrintCommandError(failure, "WINDOWS_USB_RAW"), expected);
    assert.equal(classifyPrintCommandError(failure, "WINDOWS_USB_GDI"), expected);
    assert.equal(classifyPrintCommandError(failure), "PRINT_PROCESS_FAILED");
    for (const platform of ["linux", "darwin"] as const) {
      let calls = 0;
      const adapter = new UsbSystemPrinterAdapter(platform, (command, args) => {
        calls += 1;
        assert.equal(command, "lp");
        assert.equal(args[1], "XP-80");
        throw failure;
      }, "GDI");
      assert.throws(() => adapter.printTest(input), (error: unknown) => {
        assert.ok(error instanceof PrintDiagnosticError);
        assert.equal(error.code, "PRINT_PROCESS_FAILED");
        assert.equal(error.getStatus(), 400);
        assert.ok(!JSON.stringify(error.getResponse()).includes(secret));
        return true;
      });
      assert.equal(calls, 1);
    }
  });
}

test("USB metadata preserves RAW/GDI configuration and RAW drawer transport", () => {
  for (const configured of ["RAW", "GDI"] as const) {
    const print = safePrintDiagnosticMetadata(device, "testPrint", configured, new Error(secret));
    assert.equal(print.connectionType, ConnectionType.USB);
    assert.equal(print.transport, configured);
    assert.equal(print.configuredTransport, configured);
    assert.equal(print.expectedQueue, "XP-80");
    const drawer = safePrintDiagnosticMetadata(device, "drawer.open", configured, new Error(secret));
    assert.equal(drawer.transport, "RAW");
    assert.equal(drawer.configuredTransport, configured);
  }
});

test("NETWORK and other metadata never inherit USB configuration or queue", () => {
  for (const connectionType of [ConnectionType.NETWORK, ConnectionType.MOCK, ConnectionType.SERIAL]) {
    for (const operation of ["printTicket", "drawer.open"] as const) {
      const metadata = safePrintDiagnosticMetadata({ ...device, connectionType }, operation, "GDI", new Error(secret));
      assert.equal(metadata.connectionType, connectionType);
      assert.equal(metadata.transport, connectionType);
      assert.equal(metadata.configuredTransport, undefined);
      assert.equal(metadata.expectedQueue, undefined);
      assert.equal(metadata.errorCode, "PRINT_FAILED");
      assert.ok(!JSON.stringify(metadata).includes(secret));
    }
  }
});

test("mock GDI bridge propagates command failure without executing a process", () => {
  const failure = Object.assign(new Error(secret), { code: "ETIMEDOUT" });
  assert.throws(() => new WindowsGdiSpoolerTransport(() => { throw failure; }).print("XP-80", "fake"), (e) => e === failure);
});

test("drawer remains RAW in GDI configuration and masks unknown failure", () => {
  const adapter = new UsbSystemPrinterAdapter("win32", () => { throw new Error(secret); }, "GDI");
  assert.throws(() => adapter.openCashDrawer({ ...input, commandId: "fixture", reason: "MANUAL", pulse: DEFAULT_CASH_DRAWER_PULSE_PROFILE }),
    (e: unknown) => e instanceof PrintDiagnosticError && e.code === "DRAWER_RAW_TRANSPORT_FAILED" && e.getStatus() === 500);
  assert.throws(() => adapter.openCashDrawer({ ...input, device: { ...device, metadata: {} }, commandId: "fixture", reason: "MANUAL", pulse: DEFAULT_CASH_DRAWER_PULSE_PROFILE }),
    (e: unknown) => e instanceof PrintDiagnosticError && e.code === "DRAWER_NOT_CERTIFIED" && e.getStatus() === 400);
});

test("HTTP print boundary masks arbitrary HttpException messages and preserves status", () => {
  for (const error of [new PrintDiagnosticError("PRINT_TIMEOUT"), new BadRequestException(secret), new Error(secret)]) {
    let status = 0;
    let payload: unknown;
    const response = { status: (value: number) => { status = value; return response; }, json: (value: unknown) => { payload = value; } };
    const host = { switchToHttp: () => ({ getResponse: () => response, getRequest: () => ({ url: "/printer/test-print" }) }) } as unknown as ArgumentsHost;
    new SanitizedHttpExceptionFilter().catch(error, host);
    assert.equal(status, error instanceof Error && !(error instanceof BadRequestException) && !(error instanceof PrintDiagnosticError) ? 500 : 400);
    assert.ok(!JSON.stringify(payload).includes(secret));
    assert.equal((payload as { code: string }).code, error instanceof PrintDiagnosticError ? error.code : "PRINT_FAILED");
  }
});

test("diagnostic metadata masks unsafe queue identities and exception text", () => {
  const metadata = safePrintDiagnosticMetadata({ ...device, usb: { ...device.usb!, windowsQueueName: secret } }, "drawer.open", "GDI", new Error(secret));
  assert.equal(metadata.transport, "RAW");
  assert.equal(metadata.configuredTransport, "GDI");
  assert.equal(metadata.expectedQueue, undefined);
  assert.equal(metadata.errorCode, "PRINT_FAILED");
  assert.ok(!JSON.stringify(metadata).includes(secret));
});

test("Agent Electron and web explicit print-code allowlists stay synchronized", () => {
  for (const file of ["desktop/electron/agent-client.ts", "web/domains/peripherals/print-errors.ts"]) {
    const source = readFileSync(resolve(__dirname, "../..", file), "utf8");
    const list = source.match(/(?:SAFE_AGENT_ERROR_CODES = new Set\(|PRINT_ERROR_CODES = )\[([\s\S]*?)\]/)?.[1] ?? "";
    const codes = [...list.matchAll(/"([A-Z_]+)"/g)].map((match) => match[1]).filter((code) => code !== "SCALE_WEIGHT_ZERO");
    assert.deepEqual(codes.sort(), [...PRINT_ERROR_CODES].sort());
  }
});
