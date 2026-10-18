import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { ApiError } from "../../../lib/request";
import {
  acquireSaleSubmission,
  isSaleIdempotencyConflict,
  releaseSaleSubmission,
} from "./sale-recovery";

describe("POS sale recovery error classification", () => {
  it("allows one submit and blocks a second callback until release", () => {
    const gate = { inFlight: false };

    assert.equal(acquireSaleSubmission(gate), true);
    assert.equal(acquireSaleSubmission(gate), false);
    releaseSaleSubmission(gate);
    assert.equal(acquireSaleSubmission(gate), true);
  });

  it("keeps idempotency 409 ambiguous", () => {
    const error = new ApiError(
      "Sale creation requires reconciliation before another attempt",
      409
    );

    assert.equal(isSaleIdempotencyConflict(error), true);
  });

  it("does not treat a generic 409 as a proven definitive rejection", () => {
    assert.equal(isSaleIdempotencyConflict(new ApiError("Conflict", 409)), false);
  });

  it("keeps every createSale 4xx ambiguous until reconciliation", () => {
    assert.equal(isSaleIdempotencyConflict(new ApiError("Bad request", 400)), false);
    assert.equal(isSaleIdempotencyConflict(new ApiError("Forbidden", 403)), false);
    assert.equal(isSaleIdempotencyConflict(new ApiError("Not found", 404)), false);
  });
});
