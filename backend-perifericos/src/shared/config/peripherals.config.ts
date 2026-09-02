import { resolveAgentVersion } from "../runtime/runtime-version";

import type { NextFunction, Request, Response } from "express";

export type PeripheralsMode = "MOCK" | "REAL";
export type UsbPrintTransport = "RAW" | "GDI";
export type AgentLogLevel = "INFO" | "WARN" | "ERROR";

export type PeripheralsConfig = {
  port: number;
  bind: string;
  mode: PeripheralsMode;
  agentName: string;
  realAdaptersEnabled: boolean;
  usbPrintTransport: UsbPrintTransport;
  usbRawPhysicalCutCertified: boolean;
  allowedOrigins: string[];
  logLevel: AgentLogLevel;
  logLimit: number;
  printerWidthChars: number;
  version: string;
  startedAt: number;
};

const DEFAULT_ALLOWED_ORIGINS = [
  "http://localhost:3000",
  "https://apptiendamanus.space",
];

const STARTED_AT = Date.now();

const parsePort = (value: string | undefined): number => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 4050;
};

const parseBind = (value: string | undefined): string =>
  value?.trim() || "127.0.0.1";

const parseLogLevel = (value: string | undefined): AgentLogLevel => {
  const level = value?.trim().toUpperCase();
  return level === "WARN" || level === "ERROR" ? level : "INFO";
};

const parseLogLimit = (value: string | undefined): number => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 500;
};

const parsePrinterWidthChars = (value: string | undefined): number => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 24 && parsed <= 80
    ? parsed
    : 48;
};

const parseAllowedOrigins = (value: string | undefined): string[] => {
  const parsed = (value ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  return parsed.length > 0 ? parsed : DEFAULT_ALLOWED_ORIGINS;
};

export const parseMode = (value: string | undefined): PeripheralsMode => {
  const mode = value?.trim().toUpperCase();
  return mode === "REAL" ? "REAL" : "MOCK";
};

const parseRealAdaptersEnabled = (value: string | undefined): boolean =>
  value?.trim().toLowerCase() === "true";

const parseUsbPrintTransport = (value: string | undefined): UsbPrintTransport =>
  value?.trim().toUpperCase() === "GDI" ? "GDI" : "RAW";

export const isOriginAllowed = (
  origin: string | undefined,
  allowedOrigins: string[]
): boolean => {
  if (!origin) {
    return true;
  }

  return allowedOrigins.includes(origin);
};

export const getCorsAllowedOrigin = (
  origin: string | undefined,
  allowedOrigins: string[]
): boolean | string => {
  if (!origin) {
    return true;
  }

  return isOriginAllowed(origin, allowedOrigins) ? origin : false;
};

export const buildPeripheralsCorsOptions = (allowedOrigins: string[]) => ({
  origin: (
    origin: string | undefined,
    callback: (error: Error | null, allow?: boolean | string) => void
  ) => {
    callback(null, getCorsAllowedOrigin(origin, allowedOrigins));
  },
  credentials: true,
  allowedHeaders: ["Content-Type", "Authorization", "Accept", "Origin"],
  methods: ["GET", "POST", "PATCH", "OPTIONS"],
  optionsSuccessStatus: 204,
  preflightContinue: false,
});

export const buildPrivateNetworkAccessMiddleware = (
  allowedOrigins: string[]
) => (request: Request, response: Response, next: NextFunction): void => {
  const origin = Array.isArray(request.headers.origin)
    ? request.headers.origin[0]
    : request.headers.origin;
  const privateNetworkRequested =
    request.method === "OPTIONS" &&
    request.headers["access-control-request-private-network"] === "true";

  if (privateNetworkRequested && isOriginAllowed(origin, allowedOrigins)) {
    response.setHeader("Access-Control-Allow-Private-Network", "true");
    response.setHeader("Vary", "Origin, Access-Control-Request-Private-Network");
  }

  next();
};

export const getPeripheralsConfig = (): PeripheralsConfig => ({
  port: parsePort(process.env.PERIPHERALS_PORT),
  bind: parseBind(process.env.PERIPHERALS_BIND),
  mode: parseMode(process.env.PERIPHERALS_MODE),
  agentName:
    process.env.PERIPHERALS_AGENT_NAME?.trim() ||
    "manus-pos-peripheral-agent",
  realAdaptersEnabled: parseRealAdaptersEnabled(
    process.env.PERIPHERALS_ENABLE_REAL_ADAPTERS
  ),
  usbPrintTransport: parseUsbPrintTransport(
    process.env.PERIPHERALS_USB_PRINT_TRANSPORT
  ),
  usbRawPhysicalCutCertified:
    process.env.PERIPHERALS_USB_RAW_PHYSICAL_CUT_CERTIFIED?.trim().toLowerCase() ===
    "true",
  allowedOrigins: parseAllowedOrigins(process.env.PERIPHERALS_ALLOWED_ORIGINS),
  logLevel: parseLogLevel(process.env.PERIPHERALS_LOG_LEVEL),
  logLimit: parseLogLimit(process.env.PERIPHERALS_LOG_LIMIT),
  printerWidthChars: parsePrinterWidthChars(
    process.env.PERIPHERALS_PRINTER_WIDTH_CHARS
  ),
  version: resolveAgentVersion(),
  startedAt: STARTED_AT,
});
