"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPeripheralsConfig = exports.buildPeripheralsCorsOptions = exports.getCorsAllowedOrigin = exports.isOriginAllowed = void 0;
const runtime_version_1 = require("../runtime/runtime-version");
const DEFAULT_ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://localhost:3029",
    "http://localhost:5173",
];
const STARTED_AT = Date.now();
const parsePort = (value) => {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : 4050;
};
const parseBind = (value) => value?.trim() || "127.0.0.1";
const parseLogLevel = (value) => {
    const level = value?.trim().toUpperCase();
    return level === "WARN" || level === "ERROR" ? level : "INFO";
};
const parseLogLimit = (value) => {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : 500;
};
const parsePrinterWidthChars = (value) => {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed >= 24 && parsed <= 80
        ? parsed
        : 48;
};
const parseAllowedOrigins = (value) => {
    const parsed = (value ?? "")
        .split(",")
        .map((origin) => origin.trim())
        .filter(Boolean);
    return parsed.length > 0 ? parsed : DEFAULT_ALLOWED_ORIGINS;
};
const parseMode = (value) => {
    const mode = value?.trim().toUpperCase();
    return mode === "MOCK" ? "MOCK" : "MOCK";
};
const parseRealAdaptersEnabled = (value) => value?.trim().toLowerCase() === "true";
const parseUsbPrintTransport = (value) => value?.trim().toUpperCase() === "GDI" ? "GDI" : "RAW";
const isOriginAllowed = (origin, allowedOrigins) => {
    if (!origin) {
        return true;
    }
    return allowedOrigins.includes(origin);
};
exports.isOriginAllowed = isOriginAllowed;
const getCorsAllowedOrigin = (origin, allowedOrigins) => {
    if (!origin) {
        return true;
    }
    return (0, exports.isOriginAllowed)(origin, allowedOrigins) ? origin : false;
};
exports.getCorsAllowedOrigin = getCorsAllowedOrigin;
const buildPeripheralsCorsOptions = (allowedOrigins) => ({
    origin: (origin, callback) => {
        callback(null, (0, exports.getCorsAllowedOrigin)(origin, allowedOrigins));
    },
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization", "Accept", "Origin"],
    methods: ["GET", "POST", "PATCH", "OPTIONS"],
    optionsSuccessStatus: 204,
    preflightContinue: false,
});
exports.buildPeripheralsCorsOptions = buildPeripheralsCorsOptions;
const getPeripheralsConfig = () => ({
    port: parsePort(process.env.PERIPHERALS_PORT),
    bind: parseBind(process.env.PERIPHERALS_BIND),
    mode: parseMode(process.env.PERIPHERALS_MODE),
    agentName: process.env.PERIPHERALS_AGENT_NAME?.trim() ||
        "manus-pos-peripheral-agent",
    realAdaptersEnabled: parseRealAdaptersEnabled(process.env.PERIPHERALS_ENABLE_REAL_ADAPTERS),
    usbPrintTransport: parseUsbPrintTransport(process.env.PERIPHERALS_USB_PRINT_TRANSPORT),
    usbRawPhysicalCutCertified: process.env.PERIPHERALS_USB_RAW_PHYSICAL_CUT_CERTIFIED?.trim().toLowerCase() ===
        "true",
    allowedOrigins: parseAllowedOrigins(process.env.PERIPHERALS_ALLOWED_ORIGINS),
    logLevel: parseLogLevel(process.env.PERIPHERALS_LOG_LEVEL),
    logLimit: parseLogLimit(process.env.PERIPHERALS_LOG_LIMIT),
    printerWidthChars: parsePrinterWidthChars(process.env.PERIPHERALS_PRINTER_WIDTH_CHARS),
    version: (0, runtime_version_1.resolveAgentVersion)(),
    startedAt: STARTED_AT,
});
exports.getPeripheralsConfig = getPeripheralsConfig;
//# sourceMappingURL=peripherals.config.js.map