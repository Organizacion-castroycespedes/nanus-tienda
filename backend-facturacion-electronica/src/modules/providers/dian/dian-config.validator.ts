import { DIAN_GET_ACQUIRER_ACTION } from "./dian.constants";

export type DianEnvironment = "HABILITACION" | "PRODUCCION";

export type DianDirectConfig = {
  wsdlUrl: string;
  endpointUrl: string | null;
  certPath: string;
  certPasswordConfigured: boolean;
  environment: DianEnvironment;
  timeoutMs: number;
  getAcquirerAction: string;
  allowExternalCalls: boolean;
};

const allowedEnvironments: DianEnvironment[] = ["HABILITACION", "PRODUCCION"];

const requireEnv = (
  env: NodeJS.ProcessEnv,
  name: string
): string => {
  const value = env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required for DIAN_DIRECT`);
  }
  return value;
};

const parseTimeout = (rawValue: string | undefined): number => {
  const value = rawValue?.trim() || "15000";
  const timeoutMs = Number(value);
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new Error("DIAN_TIMEOUT_MS must be a positive number");
  }
  return timeoutMs;
};

const parseEnvironment = (rawValue: string | undefined): DianEnvironment => {
  const value = rawValue?.trim() || "HABILITACION";
  if (allowedEnvironments.includes(value as DianEnvironment)) {
    return value as DianEnvironment;
  }
  throw new Error("DIAN_ENVIRONMENT must be HABILITACION or PRODUCCION");
};

export const validateDianDirectConfig = (
  env: NodeJS.ProcessEnv = process.env
): DianDirectConfig => ({
  wsdlUrl: requireEnv(env, "DIAN_WSDL_URL"),
  endpointUrl: env.DIAN_ENDPOINT_URL?.trim() || null,
  certPath: requireEnv(env, "DIAN_CERT_PATH"),
  certPasswordConfigured: Boolean(requireEnv(env, "DIAN_CERT_PASSWORD")),
  environment: parseEnvironment(env.DIAN_ENVIRONMENT),
  timeoutMs: parseTimeout(env.DIAN_TIMEOUT_MS),
  getAcquirerAction:
    env.DIAN_GET_ACQUIRER_ACTION?.trim() || DIAN_GET_ACQUIRER_ACTION,
  allowExternalCalls: env.DIAN_ALLOW_EXTERNAL_CALLS === "true",
});

export const validateDianConfigForProvider = (
  provider: string | undefined,
  env: NodeJS.ProcessEnv = process.env
): DianDirectConfig | null => {
  if (provider !== "DIAN_DIRECT") {
    return null;
  }
  return validateDianDirectConfig(env);
};
