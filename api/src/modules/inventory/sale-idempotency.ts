import crypto from "node:crypto";
import { BadRequestException } from "@nestjs/common";

export const SALE_IDEMPOTENCY_KEY_MAX_LENGTH = 128;

const SALE_IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9._~-]{1,128}$/;

export const normalizeSaleIdempotencyKey = (
  value: string | string[] | null | undefined,
) => {
  if (Array.isArray(value)) {
    if (value.length !== 1) {
      throw new BadRequestException("Idempotency-Key must be a single value");
    }
    value = value[0];
  }

  const normalized = value?.trim();
  if (!normalized) {
    return undefined;
  }
  if (!SALE_IDEMPOTENCY_KEY_PATTERN.test(normalized)) {
    throw new BadRequestException(
      `Idempotency-Key must use 1-${SALE_IDEMPOTENCY_KEY_MAX_LENGTH} URL-safe characters`,
    );
  }
  return normalized;
};

const stableSerialize = (value: unknown): string => {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value) ?? "null";
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableSerialize).join(",")}]`;
  }

  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableSerialize(record[key])}`)
    .join(",")}}`;
};

export const buildSaleIdempotencyHash = (
  request: unknown,
  context: {
    tenantId: string;
    branchId?: string;
    terminalId?: string;
    userId?: string;
    posSessionId?: string;
  },
) =>
  crypto
    .createHash("sha256")
    .update(stableSerialize({ request, context }))
    .digest("hex");
