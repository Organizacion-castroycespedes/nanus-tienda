import { ApiError } from "../../../lib/request";

export type SaleSubmissionGate = { inFlight: boolean };

export type DefinitiveStockRejection = {
  code: "INSUFFICIENT_STOCK" | "INSUFFICIENT_FEFO_STOCK";
  productId: string;
  requestedQuantity: number;
  availableQuantity: number;
  aggregateAvailableQuantity: number;
  eligibleLotQuantity: number | null;
};

export const acquireSaleSubmission = (gate: SaleSubmissionGate) => {
  if (gate.inFlight) {
    return false;
  }
  gate.inFlight = true;
  return true;
};

export const releaseSaleSubmission = (gate: SaleSubmissionGate) => {
  gate.inFlight = false;
};

export const isSaleIdempotencyConflict = (error: unknown) => {
  if (!(error instanceof ApiError) || error.status !== 409) {
    return false;
  }

  const message = error.message.toLowerCase();
  return message.includes("idempotency") || message.includes("reconciliation");
};

const finiteNonNegative = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : null;

export const readDefinitiveStockRejection = (
  error: unknown,
): DefinitiveStockRejection | null => {
  if (!(error instanceof ApiError) || error.status !== 409) {
    return null;
  }

  const payload = error.details;
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const candidate = payload as Record<string, unknown>;
  const code = candidate.code;
  if (code !== "INSUFFICIENT_STOCK" && code !== "INSUFFICIENT_FEFO_STOCK") {
    return null;
  }

  const productId = candidate.productId;
  const requestedQuantity = finiteNonNegative(candidate.requestedQuantity);
  const availableQuantity = finiteNonNegative(candidate.availableQuantity);
  const aggregateAvailableQuantity = finiteNonNegative(
    candidate.aggregateAvailableQuantity,
  );
  const eligibleLotQuantity =
    candidate.eligibleLotQuantity === null
      ? null
      : finiteNonNegative(candidate.eligibleLotQuantity);

  if (
    typeof productId !== "string" ||
    !productId ||
    requestedQuantity === null ||
    availableQuantity === null ||
    aggregateAvailableQuantity === null ||
    (candidate.eligibleLotQuantity !== null && eligibleLotQuantity === null)
  ) {
    return null;
  }

  return {
    code,
    productId,
    requestedQuantity,
    availableQuantity,
    aggregateAvailableQuantity,
    eligibleLotQuantity,
  };
};
