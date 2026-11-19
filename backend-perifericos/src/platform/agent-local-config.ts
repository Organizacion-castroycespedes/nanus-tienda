import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { resolvePlatformPaths } from "./platform-paths";

type AgentLocalConfig = {
  packageProfile?: "qa" | "dev" | "production";
  port?: number;
  bind?: string;
  mode?: "MOCK" | "REAL";
  allowedOrigins?: string[];
  logLevel?: "INFO" | "WARN" | "ERROR";
  enableRealAdapters?: boolean;
  discoverOnStartup?: boolean;
  usbPrintTransport?: "RAW" | "GDI";
  usbRawPhysicalCutCertified?: boolean;
  logLimit?: number;
  printerWidthChars?: number;
  enrollmentApiBaseUrl?: string;
  enrollmentSigningPublicKeyPem?: string;
  enrollmentAudience?: string;
  enrollmentSigningKeyId?: string;
};

const configEnvironmentMapping: Record<keyof AgentLocalConfig, string> = {
  packageProfile: "PERIPHERALS_PACKAGE_PROFILE",
  port: "PERIPHERALS_PORT",
  bind: "PERIPHERALS_BIND",
  mode: "PERIPHERALS_MODE",
  allowedOrigins: "PERIPHERALS_ALLOWED_ORIGINS",
  logLevel: "PERIPHERALS_LOG_LEVEL",
  enableRealAdapters: "PERIPHERALS_ENABLE_REAL_ADAPTERS",
  discoverOnStartup: "PERIPHERALS_DISCOVER_ON_STARTUP",
  usbPrintTransport: "PERIPHERALS_USB_PRINT_TRANSPORT",
  usbRawPhysicalCutCertified: "PERIPHERALS_USB_RAW_PHYSICAL_CUT_CERTIFIED",
  logLimit: "PERIPHERALS_LOG_LIMIT",
  printerWidthChars: "PERIPHERALS_PRINTER_WIDTH_CHARS",
  enrollmentApiBaseUrl: "PERIPHERALS_ENROLLMENT_API_BASE_URL",
  enrollmentSigningPublicKeyPem: "PERIPHERALS_ENROLLMENT_SIGNING_PUBLIC_KEY_PEM",
  enrollmentAudience: "PERIPHERALS_ENROLLMENT_AUDIENCE",
  enrollmentSigningKeyId: "PERIPHERALS_ENROLLMENT_SIGNING_KEY_ID",
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const assertLocalConfig = (value: unknown): AgentLocalConfig => {
  if (!isRecord(value)) {
    throw new Error("Peripheral Agent local configuration must be a JSON object.");
  }

  const allowedKeys = new Set(Object.keys(configEnvironmentMapping));
  const sanitized: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (!allowedKeys.has(key)) {
      throw new Error(`Unsupported Peripheral Agent local configuration key: ${key}.`);
    }
    if (key === "discoverOnStartup" && typeof entry !== "boolean") {
      continue;
    }
    if (key === "packageProfile" && entry !== "qa" && entry !== "dev" && entry !== "production") {
      continue;
    }
    const valid = key === "allowedOrigins"
      ? Array.isArray(entry) && entry.every((origin) => typeof origin === "string")
      : ["string", "number", "boolean"].includes(typeof entry);
    if (!valid) {
      throw new Error(`Invalid Peripheral Agent local configuration value: ${key}.`);
    }
    sanitized[key] = entry;
  }

  return sanitized as AgentLocalConfig;
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
    environment.PERIPHERALS_PACKAGE_PROFILE = "unverified";
    environment.PERIPHERALS_DISCOVER_ON_STARTUP = "false";
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(configPath, "utf8"));
  } catch {
    environment.PERIPHERALS_PACKAGE_PROFILE = "unverified";
    environment.PERIPHERALS_DISCOVER_ON_STARTUP = "false";
    console.warn("Unable to read Peripheral Agent local configuration; startup discovery disabled.");
    return null;
  }

  const config = assertLocalConfig(parsed);
  for (const key of Object.keys(configEnvironmentMapping) as Array<keyof AgentLocalConfig>) {
    const environmentKey = configEnvironmentMapping[key];
    const value = config[key];
    if (value !== undefined && environment[environmentKey] === undefined) {
      environment[environmentKey] = serializeConfigValue(key, value);
    }
  }

  // Only a verified package profile may opt into startup discovery. QA is
  // always manual-only, even when an inherited process variable says true.
  const packageProfile = config.packageProfile;
  environment.PERIPHERALS_PACKAGE_PROFILE = packageProfile ?? "unverified";
  if (packageProfile !== "dev" && packageProfile !== "production") {
    environment.PERIPHERALS_DISCOVER_ON_STARTUP = "false";
  }

  // Older installed configs may not contain `mode`. Preserve their explicit
  // real-adapter setting without making REAL the default for incomplete or
  // development configs.
  if (config.mode === undefined && config.enableRealAdapters === true && !environment.PERIPHERALS_MODE) {
    environment.PERIPHERALS_MODE = "REAL";
  }

  return configPath;
};
