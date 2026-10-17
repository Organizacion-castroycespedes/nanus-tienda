import { HttpException } from "@nestjs/common";
import { ConnectionType, type PeripheralDevice } from "../types/peripheral.types";

export const PRINT_ERROR_CODES = [
  "PRINT_TRANSPORT_NOT_READY",
  "WINDOWS_PRINT_QUEUE_REQUIRED",
  "WINDOWS_INVALID_PRINTER_QUEUE",
  "PRINT_COMMAND_LAUNCH_FAILED",
  "PRINT_PROCESS_FAILED",
  "PRINT_TIMEOUT",
  "PRINT_SPOOLER_SUBMISSION_FAILED",
  "PRINT_FAILED",
  "DRAWER_NOT_CERTIFIED",
  "DRAWER_RAW_TRANSPORT_FAILED",
] as const;
export type PrintErrorCode = typeof PRINT_ERROR_CODES[number];

export class PrintDiagnosticError extends HttpException {
  constructor(readonly code: PrintErrorCode, status = 400) {
    super({ code, message: code, error: "Peripheral operation failed" }, status);
  }
}

// execFileSync exposes code/status on failure. Never inspect message, stderr,
// stdout, command arguments or payloads to guess a category.
export const classifyPrintCommandError = (
  error: unknown,
  source: "WINDOWS_USB_RAW" | "WINDOWS_USB_GDI" | "OTHER" = "OTHER",
): PrintErrorCode => {
  if (error instanceof PrintDiagnosticError) return error.code;
  if (!error || typeof error !== "object") return "PRINT_FAILED";
  const failure = error as { code?: unknown; status?: unknown };
  if (failure.code === "ETIMEDOUT") return "PRINT_TIMEOUT";
  if (["ENOENT", "EACCES", "EPERM", "ENOEXEC"].includes(String(failure.code))) {
    return "PRINT_COMMAND_LAUNCH_FAILED";
  }
  // Reserved by the Agent-owned PowerShell scripts only.
  if (source === "WINDOWS_USB_RAW" || source === "WINDOWS_USB_GDI") {
    if (failure.status === 41) return "WINDOWS_INVALID_PRINTER_QUEUE";
    if (failure.status === 42) return "PRINT_SPOOLER_SUBMISSION_FAILED";
  }
  if (typeof failure.status === "number" && failure.status !== 0) return "PRINT_PROCESS_FAILED";
  return "PRINT_FAILED";
};

export const safePrintDiagnosticMetadata = (
  device: PeripheralDevice,
  operation: "testPrint" | "printTicket" | "drawer.open",
  configuredTransport: "RAW" | "GDI",
  error: unknown,
) => {
  const isUsb = device.connectionType === ConnectionType.USB;
  const queue = isUsb ? device.usb?.windowsQueueName ?? device.usb?.printerName : undefined;
  return {
    operation,
    connectionType: device.connectionType,
    configuredTransport: isUsb ? configuredTransport : undefined,
    transport: isUsb
      ? operation === "drawer.open" ? "RAW" : configuredTransport
      : device.connectionType,
    expectedQueue: typeof queue === "string" && /^[\p{L}\p{N} _().-]{1,80}$/u.test(queue)
      ? queue : undefined,
    errorCode: error instanceof PrintDiagnosticError ? error.code : "PRINT_FAILED",
    errorMessage: error instanceof PrintDiagnosticError ? error.code : "PRINT_FAILED",
  };
};
