import { ApiError } from "../../../lib/request";

export type SaleSubmissionGate = { inFlight: boolean };

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
