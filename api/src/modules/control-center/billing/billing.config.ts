export type BillingConfig = {
  workerEnabled: boolean;
  workerIntervalMs: number;
  leadDays: number;
  receiptMaxSizeBytes: number;
};

type Env = Record<string, string | undefined>;

const integer = (value: string | undefined, fallback: number, min: number, max: number) => {
  const parsed = Number(value?.trim());
  return Number.isInteger(parsed) && parsed >= min && parsed <= max ? parsed : fallback;
};

export const readBillingConfig = (env: Env = process.env): BillingConfig => ({
  workerEnabled: env.CONTROL_CENTER_BILLING_WORKER_ENABLED?.trim().toLowerCase() === "true",
  workerIntervalMs: integer(env.CONTROL_CENTER_BILLING_WORKER_INTERVAL_MS, 3_600_000, 60_000, 86_400_000),
  leadDays: integer(env.CONTROL_CENTER_BILLING_LEAD_DAYS, 5, 0, 60),
  receiptMaxSizeBytes: integer(env.CONTROL_CENTER_RECEIPT_MAX_SIZE_MB, 5, 1, 10) * 1024 * 1024,
});
