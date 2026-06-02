import type { SignOptions } from "jsonwebtoken";
import { loadApiEnv } from "./env";

const INSECURE_LOCAL_JWT_SECRET = "changeme";
const LOCAL_OR_TEST_ENVIRONMENTS = new Set(["local", "test"]);

const normalizeNodeEnv = () => (process.env.NODE_ENV ?? "").trim().toLowerCase();

const isLocalOrTestEnvironment = () =>
  LOCAL_OR_TEST_ENVIRONMENTS.has(normalizeNodeEnv());

export const resolveJwtSecret = () => {
  loadApiEnv();

  const jwtSecret = process.env.JWT_SECRET?.trim();
  if (jwtSecret) {
    return jwtSecret;
  }

  if (isLocalOrTestEnvironment()) {
    return INSECURE_LOCAL_JWT_SECRET;
  }

  throw new Error(
    "JWT_SECRET is required before API auth bootstrap. Set JWT_SECRET in the environment or .env.",
  );
};

export const assertAuthEnv = () => {
  resolveJwtSecret();
};

export const resolveJwtExpiresIn = (): SignOptions["expiresIn"] => {
  loadApiEnv();

  const rawValue = process.env.JWT_EXPIRES_IN?.trim() || "15m";
  return /^\d+$/.test(rawValue)
    ? Number(rawValue)
    : (rawValue as SignOptions["expiresIn"]);
};

export const resolveRefreshTokenExpiresDays = () => {
  loadApiEnv();

  const days = Number(process.env.REFRESH_TOKEN_EXPIRES_DAYS ?? "30");
  return Number.isFinite(days) && days > 0 ? days : 30;
};
