export type DatabaseConfig = {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl: boolean;
  logging: boolean;
  poolMax: number;
};

const parsePort = (value: string | undefined): number => {
  const parsed = Number(value);

  return Number.isInteger(parsed) && parsed > 0 ? parsed : 5432;
};

const parseBoolean = (value: string | undefined, fallback = false): boolean => {
  if (typeof value !== "string") {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();

  if (normalized.length === 0) {
    return fallback;
  }

  return ["1", "true", "yes", "on"].includes(normalized);
};

const parsePoolMax = (value: string | undefined): number => {
  const parsed = Number(value);

  return Number.isInteger(parsed) && parsed > 0 ? parsed : 10;
};

const normalizeString = (value: string | undefined): string =>
  typeof value === "string" ? value.trim() : "";

export const getDatabaseConfig = (
  env: NodeJS.ProcessEnv = process.env
): DatabaseConfig => ({
  host: normalizeString(env.DB_HOST) || "localhost",
  port: parsePort(env.DB_PORT),
  database:
    normalizeString(env.DB_DATABASE) ||
    normalizeString(env.DB_NAME) ||
    "manus_tienda_electronic_billing",
  username: normalizeString(env.DB_USERNAME) || normalizeString(env.DB_USER) || "postgres",
  password: normalizeString(env.DB_PASSWORD),
  ssl: parseBoolean(env.DB_SSL),
  logging: parseBoolean(env.DB_LOGGING),
  poolMax: parsePoolMax(env.DB_POOL_MAX),
});
