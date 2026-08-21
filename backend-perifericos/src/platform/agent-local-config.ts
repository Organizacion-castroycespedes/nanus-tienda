import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { resolvePlatformPaths } from "./platform-paths";

type AgentLocalConfig = {
  port?: number;
  bind?: string;
  allowedOrigins?: string[];
  logLevel?: "INFO" | "WARN" | "ERROR";
  enableRealAdapters?: boolean;
  usbPrintTransport?: "RAW" | "GDI";
  usbRawPhysicalCutCertified?: boolean;
  logLimit?: number;
  printerWidthChars?: number;
};

const configEnvironmentMapping: Record<keyof AgentLocalConfig, string> = {
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

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const assertLocalConfig = (value: unknown): AgentLocalConfig => {
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

  return value as AgentLocalConfig;
};

const serializeConfigValue = (key: keyof AgentLocalConfig, value: AgentLocalConfig[keyof AgentLocalConfig]): string =>
  key === "allowedOrigins" ? (value as string[]).join(",") : String(value);

/**
 * Loads an optional local-only JSON file before runtime config is read.
 * Environment variables always win, so service wrappers can override a local
 * file without mutating it. The file intentionally accepts no credentials.
 */
export const loadAgentLocalConfig = (
  environment = process.env,
  configPath = environment.PERIPHERALS_CONFIG_PATH || join(resolvePlatformPaths().configDir, "agent.config.local.json")
): string | null => {
  if (!existsSync(configPath)) {
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(configPath, "utf8"));
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown parse error";
    throw new Error(`Unable to read Peripheral Agent local configuration: ${message}`);
  }

  const config = assertLocalConfig(parsed);
  for (const key of Object.keys(configEnvironmentMapping) as Array<keyof AgentLocalConfig>) {
    const environmentKey = configEnvironmentMapping[key];
    const value = config[key];
    if (value !== undefined && !environment[environmentKey]) {
      environment[environmentKey] = serializeConfigValue(key, value);
    }
  }

  return configPath;
};
