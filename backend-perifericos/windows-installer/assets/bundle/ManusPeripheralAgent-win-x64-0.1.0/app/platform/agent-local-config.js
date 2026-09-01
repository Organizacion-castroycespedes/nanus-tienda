"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadAgentLocalConfig = void 0;
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const platform_paths_1 = require("./platform-paths");
const configEnvironmentMapping = {
    port: "PERIPHERALS_PORT",
    bind: "PERIPHERALS_BIND",
    allowedOrigins: "PERIPHERALS_ALLOWED_ORIGINS",
    logLevel: "PERIPHERALS_LOG_LEVEL",
    enableRealAdapters: "PERIPHERALS_ENABLE_REAL_ADAPTERS",
    usbPrintTransport: "PERIPHERALS_USB_PRINT_TRANSPORT",
    usbRawPhysicalCutCertified: "PERIPHERALS_USB_RAW_PHYSICAL_CUT_CERTIFIED",
    logLimit: "PERIPHERALS_LOG_LIMIT",
    printerWidthChars: "PERIPHERALS_PRINTER_WIDTH_CHARS",
};
const isRecord = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const assertLocalConfig = (value) => {
    if (!isRecord(value)) {
        throw new Error("Peripheral Agent local configuration must be a JSON object.");
    }
    const allowedKeys = new Set(Object.keys(configEnvironmentMapping));
    for (const [key, entry] of Object.entries(value)) {
        if (!allowedKeys.has(key)) {
            throw new Error(`Unsupported Peripheral Agent local configuration key: ${key}.`);
        }
        const valid = key === "allowedOrigins"
            ? Array.isArray(entry) && entry.every((origin) => typeof origin === "string")
            : ["string", "number", "boolean"].includes(typeof entry);
        if (!valid) {
            throw new Error(`Invalid Peripheral Agent local configuration value: ${key}.`);
        }
    }
    return value;
};
const serializeConfigValue = (key, value) => key === "allowedOrigins" ? value.join(",") : String(value);
const loadAgentLocalConfig = (environment = process.env, configPath = environment.PERIPHERALS_CONFIG_PATH || (0, node_path_1.join)((0, platform_paths_1.resolvePlatformPaths)().configDir, "agent.config.local.json")) => {
    if (!(0, node_fs_1.existsSync)(configPath)) {
        return null;
    }
    let parsed;
    try {
        parsed = JSON.parse((0, node_fs_1.readFileSync)(configPath, "utf8"));
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "unknown parse error";
        throw new Error(`Unable to read Peripheral Agent local configuration: ${message}`);
    }
    const config = assertLocalConfig(parsed);
    for (const key of Object.keys(configEnvironmentMapping)) {
        const environmentKey = configEnvironmentMapping[key];
        const value = config[key];
        if (value !== undefined && !environment[environmentKey]) {
            environment[environmentKey] = serializeConfigValue(key, value);
        }
    }
    return configPath;
};
exports.loadAgentLocalConfig = loadAgentLocalConfig;
//# sourceMappingURL=agent-local-config.js.map