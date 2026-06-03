import { BadRequestException } from "@nestjs/common";
import type { ThirdPartyLookupMode } from "./third-party-lookup.types";

export type GetAcquirerConfig = {
  wsdlUrl: string | null;
  endpointUrl: string | null;
  certificatePath: string | null;
  certificatePassword: string | null;
  timeoutMs: number;
  httpEnabled: boolean;
};

export type ValidatedGetAcquirerConfig = {
  wsdlUrl: string;
  endpointUrl: string;
  certificatePath: string;
  certificatePassword: string;
  timeoutMs: number;
  httpEnabled: boolean;
};

export type ThirdPartyLookupConfig = {
  enabled: boolean;
  mode: ThirdPartyLookupMode;
  getAcquirer: GetAcquirerConfig;
};

const VALID_MODES: ThirdPartyLookupMode[] = ["disabled", "mock", "real"];

const readText = (
  env: NodeJS.ProcessEnv,
  key: string
): string | null => {
  const value = env[key]?.trim() ?? "";
  return value.length > 0 ? value : null;
};

const readTimeoutMs = (env: NodeJS.ProcessEnv): number => {
  const rawValue = readText(env, "DIAN_GET_ACQUIRER_TIMEOUT_MS");
  if (!rawValue) {
    return 15000;
  }

  const timeoutMs = Number(rawValue);
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0) {
    throw new BadRequestException(
      "DIAN_GET_ACQUIRER_TIMEOUT_MS must be a positive integer"
    );
  }

  return timeoutMs;
};

const readBooleanFlag = (
  env: NodeJS.ProcessEnv,
  key: string
): boolean => {
  const rawValue = readText(env, key);
  if (!rawValue) {
    return false;
  }

  const normalized = rawValue.toLowerCase();
  if (normalized === "true") {
    return true;
  }
  if (normalized === "false") {
    return false;
  }

  throw new BadRequestException(`${key} must be true or false`);
};

const readGetAcquirerConfig = (
  env: NodeJS.ProcessEnv,
  validateTimeout: boolean
): GetAcquirerConfig => ({
  wsdlUrl: readText(env, "DIAN_GET_ACQUIRER_WSDL_URL"),
  endpointUrl: readText(env, "DIAN_GET_ACQUIRER_ENDPOINT_URL"),
  certificatePath: readText(env, "DIAN_CERTIFICATE_PATH"),
  certificatePassword: readText(env, "DIAN_CERTIFICATE_PASSWORD"),
  timeoutMs: validateTimeout ? readTimeoutMs(env) : 15000,
  httpEnabled: readBooleanFlag(env, "DIAN_GET_ACQUIRER_HTTP_ENABLED"),
});

const readMode = (env: NodeJS.ProcessEnv): ThirdPartyLookupMode => {
  const rawMode = (readText(env, "DIAN_THIRD_PARTY_LOOKUP_MODE") ?? "disabled")
    .toLowerCase();

  if (!VALID_MODES.includes(rawMode as ThirdPartyLookupMode)) {
    throw new BadRequestException(
      "DIAN_THIRD_PARTY_LOOKUP_MODE must be one of disabled, mock, real"
    );
  }

  return rawMode as ThirdPartyLookupMode;
};

export const resolveThirdPartyLookupConfig = (
  env: NodeJS.ProcessEnv = process.env
): ThirdPartyLookupConfig => {
  const enabled =
    (readText(env, "DIAN_THIRD_PARTY_LOOKUP_ENABLED") ?? "false")
      .toLowerCase() === "true";

  if (!enabled) {
    return {
      enabled,
      mode: "disabled",
      getAcquirer: readGetAcquirerConfig(env, false),
    };
  }

  const mode = readMode(env);

  return {
    enabled,
    mode,
    getAcquirer: readGetAcquirerConfig(env, mode === "real"),
  };
};

const assertUrl = (value: string, key: string) => {
  try {
    new URL(value);
  } catch {
    throw new BadRequestException(`${key} must be a valid URL`);
  }
};

export const assertGetAcquirerConfig = (
  config: GetAcquirerConfig
): ValidatedGetAcquirerConfig => {
  const missing: string[] = [];
  const wsdlUrl = config.wsdlUrl;
  const endpointUrl = config.endpointUrl;
  const certificatePath = config.certificatePath;
  const certificatePassword = config.certificatePassword;

  if (!wsdlUrl) {
    missing.push("DIAN_GET_ACQUIRER_WSDL_URL");
  }
  if (!endpointUrl) {
    missing.push("DIAN_GET_ACQUIRER_ENDPOINT_URL");
  }
  if (!certificatePath) {
    missing.push("DIAN_CERTIFICATE_PATH");
  }
  if (!certificatePassword) {
    missing.push("DIAN_CERTIFICATE_PASSWORD");
  }

  if (missing.length > 0) {
    throw new BadRequestException(
      `DIAN GetAcquirer real mode requires ${missing.join(", ")}`
    );
  }

  assertUrl(wsdlUrl!, "DIAN_GET_ACQUIRER_WSDL_URL");
  assertUrl(endpointUrl!, "DIAN_GET_ACQUIRER_ENDPOINT_URL");

  return {
    wsdlUrl: wsdlUrl!,
    endpointUrl: endpointUrl!,
    certificatePath: certificatePath!,
    certificatePassword: certificatePassword!,
    timeoutMs: config.timeoutMs,
    httpEnabled: config.httpEnabled,
  };
};
