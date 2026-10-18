import type { PeripheralAgentRequestErrorCode } from "./api";
import type { PeripheralErrorCode } from "./types";

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
const isPrintErrorCode = (value: unknown): value is PrintErrorCode =>
  PRINT_ERROR_CODES.some((code) => code === value);

// Operation results retain their established category; transport errors and
// their sanitized messages retain the exact diagnostic code.
export const toPeripheralOperationErrorCode = (
  code: PeripheralAgentRequestErrorCode
): PeripheralErrorCode => isPrintErrorCode(code) ? "PRINT_ERROR" : code;

export const safePrintErrorCode = (value: unknown): PrintErrorCode =>
  typeof value === "string" && PRINT_ERROR_CODES.includes(value as PrintErrorCode)
    ? value as PrintErrorCode : "PRINT_FAILED";

// Rejected Electron IPC errors may retain only their serialized message.
export const safePrintIpcErrorCode = (error: unknown): PrintErrorCode => {
  if (!error || typeof error !== "object") return "PRINT_FAILED";
  const value = error as { code?: unknown; message?: unknown };
  if (typeof value.code === "string") return safePrintErrorCode(value.code);
  const token = typeof value.message === "string"
    ? value.message.match(/(?:^|:\s)([A-Z][A-Z0-9_]+)$/)?.[1] : undefined;
  return safePrintErrorCode(token);
};
