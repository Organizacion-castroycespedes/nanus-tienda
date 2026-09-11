export type IntegrationOutboxConfig = {
  enabled: boolean;
  scanIntervalMs: number;
  batchSize: number;
  concurrencyLimit: number;
  maxRetryAttempts: number;
  leaseMs: number;
  initialBackoffMs: number;
  maxBackoffMs: number;
  timeoutMs: number;
  billingBackendBaseUrl: string;
  internalToken: string;
};

const readBooleanEnv = (name: string, fallback: boolean) => {
  const raw = process.env[name];
  if (raw === undefined || raw === null || raw.trim() === "") {
    return fallback;
  }

  return ["1", "true", "yes", "on"].includes(raw.trim().toLowerCase());
};

const readPositiveIntegerEnv = (name: string, fallback: number) => {
  const raw = Number(process.env[name]);
  if (Number.isInteger(raw) && raw > 0) {
    return raw;
  }

  return fallback;
};

const readTrimmedEnv = (name: string) => (process.env[name] ?? "").trim();

export const getIntegrationOutboxConfig = (): IntegrationOutboxConfig => {
  const billingBackendBaseUrl = readTrimmedEnv("BILLING_BACKEND_INTERNAL_BASE_URL");
  const internalToken = readTrimmedEnv("API_INTERNAL_TOKEN");

  return {
    enabled: readBooleanEnv("INTEGRATION_OUTBOX_DISPATCHER_ENABLED", false),
    scanIntervalMs: readPositiveIntegerEnv(
      "INTEGRATION_OUTBOX_DISPATCHER_SCAN_INTERVAL_MS",
      30_000,
    ),
    batchSize: readPositiveIntegerEnv("INTEGRATION_OUTBOX_DISPATCHER_BATCH_SIZE", 10),
    concurrencyLimit: readPositiveIntegerEnv(
      "INTEGRATION_OUTBOX_DISPATCHER_CONCURRENCY_LIMIT",
      4,
    ),
    maxRetryAttempts: readPositiveIntegerEnv(
      "INTEGRATION_OUTBOX_DISPATCHER_MAX_RETRY_ATTEMPTS",
      5,
    ),
    leaseMs: readPositiveIntegerEnv("INTEGRATION_OUTBOX_DISPATCHER_LEASE_MS", 300_000),
    initialBackoffMs: readPositiveIntegerEnv(
      "INTEGRATION_OUTBOX_DISPATCHER_INITIAL_BACKOFF_MS",
      30_000,
    ),
    maxBackoffMs: readPositiveIntegerEnv(
      "INTEGRATION_OUTBOX_DISPATCHER_MAX_BACKOFF_MS",
      1_800_000,
    ),
    timeoutMs: readPositiveIntegerEnv("INTEGRATION_OUTBOX_DISPATCHER_TIMEOUT_MS", 15_000),
    billingBackendBaseUrl,
    internalToken,
  };
};
