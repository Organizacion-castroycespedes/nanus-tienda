import assert from "node:assert/strict";
import test from "node:test";
import { BadRequestException, ConflictException } from "@nestjs/common";
import {
  captureStateRejection, parseObservationTiming, readLegacyObservationPolicy,
  WEIGHT_CAPTURE_MAX_FRAME_AGE_MS, WEIGHT_CAPTURE_MAX_REQUEST_TO_FRAME_MS, WEIGHT_CAPTURE_WALL_CLOCK_AUDIT_BOUND_MS,
  type ObservationTiming, type ReasonedError,
} from "./weight-capture-observation-protocol";

// Fixed server clock: capture created at T0, observation received 1 s later.
const T0 = Date.parse("2026-11-18T05:42:51.410Z");
const NOW = T0 + 1_000;
const iso = (ms: number) => new Date(ms).toISOString();
const v1 = (observedAtMs: number, acquisition: Record<string, unknown> = { requestToFrameMs: 300, frameAgeMs: 120 }) => ({
  observedAt: iso(observedAtMs), captureProtocol: "EXCLUSIVE_ACQUISITION_V1", acquisition,
});
const pending = { status: "PENDING", created_at: new Date(T0), expires_at: new Date(T0 + 60_000) };

const rejectsWith = (run: () => unknown, type: typeof BadRequestException | typeof ConflictException, code: string, reason: string) => {
  assert.throws(run, (error: unknown) => {
    assert.ok(error instanceof type);
    assert.equal((error as Error).message, code);
    assert.equal((error as ReasonedError).rejectionReason, reason);
    return true;
  });
};

test("V1 accepts an Agent wall clock 1 s behind or ahead of the capture creation (QA skew 0.72 s)", () => {
  for (const observedAtMs of [T0 - 1_000, T0 - 720, T0 + 1_000]) {
    const timing = parseObservationTiming(v1(observedAtMs), NOW, "ENABLED");
    assert.equal(timing.protocol, "EXCLUSIVE_ACQUISITION_V1");
    assert.equal(captureStateRejection(pending, timing, NOW), null);
  }
});

test("V1 order does not depend on wall clocks: >2 s skew either way is accepted within the audit bound", () => {
  for (const observedAtMs of [T0 - 2_500, NOW + 2_500, NOW - WEIGHT_CAPTURE_WALL_CLOCK_AUDIT_BOUND_MS,
    NOW + WEIGHT_CAPTURE_WALL_CLOCK_AUDIT_BOUND_MS]) {
    const timing = parseObservationTiming(v1(observedAtMs), NOW, "ENABLED");
    assert.equal(captureStateRejection(pending, timing, NOW), null);
  }
  for (const observedAtMs of [NOW - WEIGHT_CAPTURE_WALL_CLOCK_AUDIT_BOUND_MS - 1, NOW + WEIGHT_CAPTURE_WALL_CLOCK_AUDIT_BOUND_MS + 1]) {
    rejectsWith(() => parseObservationTiming(v1(observedAtMs), NOW, "ENABLED"),
      ConflictException, "CAPTURE_OBSERVATION_STALE", "WALL_CLOCK_OUT_OF_AUDIT_BOUND");
  }
});

test("V1 frame freshness and request-to-frame limits are inclusive at 15 000 ms", () => {
  assert.equal(parseObservationTiming(v1(NOW, { requestToFrameMs: WEIGHT_CAPTURE_MAX_REQUEST_TO_FRAME_MS,
    frameAgeMs: WEIGHT_CAPTURE_MAX_FRAME_AGE_MS }), NOW, "DISABLED").protocol, "EXCLUSIVE_ACQUISITION_V1");
  rejectsWith(() => parseObservationTiming(v1(NOW, { requestToFrameMs: 10, frameAgeMs: WEIGHT_CAPTURE_MAX_FRAME_AGE_MS + 1 }), NOW, "ENABLED"),
    ConflictException, "CAPTURE_OBSERVATION_STALE", "FRAME_AGE_EXCEEDED");
  rejectsWith(() => parseObservationTiming(v1(NOW, { requestToFrameMs: WEIGHT_CAPTURE_MAX_REQUEST_TO_FRAME_MS + 1, frameAgeMs: 10 }), NOW, "ENABLED"),
    ConflictException, "CAPTURE_OBSERVATION_STALE", "REQUEST_TO_FRAME_EXCEEDED");
});

test("V1 rejects malformed, partial or unknown protocol evidence", () => {
  const cases: Record<string, unknown>[] = [
    { observedAt: iso(NOW), captureProtocol: "EXCLUSIVE_ACQUISITION_V1" },
    { observedAt: iso(NOW), acquisition: { requestToFrameMs: 1, frameAgeMs: 1 } },
    { observedAt: iso(NOW), captureProtocol: "EXCLUSIVE_ACQUISITION_V2", acquisition: { requestToFrameMs: 1, frameAgeMs: 1 } },
    v1(NOW, { requestToFrameMs: 1 }),
    v1(NOW, { requestToFrameMs: 1, frameAgeMs: 1, sharedFrame: true }),
    v1(NOW, { requestToFrameMs: -1, frameAgeMs: 1 }),
    v1(NOW, { requestToFrameMs: 1.5, frameAgeMs: 1 }),
    v1(NOW, { requestToFrameMs: "1", frameAgeMs: 1 }),
    { ...v1(NOW), acquisition: [1, 2] },
    { ...v1(NOW), observedAt: "not-a-date" },
  ];
  for (const input of cases) {
    rejectsWith(() => parseObservationTiming(input, NOW, "ENABLED"),
      BadRequestException, "CAPTURE_OBSERVATION_INVALID", "PROTOCOL_PAYLOAD_INVALID");
  }
});

test("legacy observations keep the original wall-clock checks, including the QA OBSERVATION_BEFORE_CAPTURE case", () => {
  const legacy = (observedAtMs: number) => parseObservationTiming({ observedAt: iso(observedAtMs) }, NOW, "ENABLED");
  // Exactly at created_at is accepted (inclusive); 0.72 s before is the QA rejection.
  assert.equal(captureStateRejection(pending, legacy(T0), NOW), null);
  assert.equal(captureStateRejection(pending, legacy(T0 - 720), NOW), "OBSERVATION_BEFORE_CAPTURE");
  assert.equal(legacy(NOW - 15_000).protocol, "LEGACY_WALL_CLOCK");
  rejectsWith(() => legacy(NOW - 15_001), ConflictException, "CAPTURE_OBSERVATION_STALE", "LEGACY_WALL_CLOCK_STALE");
  rejectsWith(() => legacy(NOW + 1), ConflictException, "CAPTURE_OBSERVATION_STALE", "LEGACY_WALL_CLOCK_STALE");
});

test("legacy observations are refused when the legacy policy is disabled or misconfigured", () => {
  rejectsWith(() => parseObservationTiming({ observedAt: iso(NOW) }, NOW, "DISABLED"),
    ConflictException, "CAPTURE_PROTOCOL_UNSUPPORTED", "LEGACY_PROTOCOL_DISABLED");
  rejectsWith(() => parseObservationTiming({ observedAt: iso(NOW) }, NOW, "INVALID"),
    ConflictException, "CAPTURE_PROTOCOL_UNSUPPORTED", "LEGACY_POLICY_INVALID");
  assert.equal(readLegacyObservationPolicy({}), "ENABLED");
  assert.equal(readLegacyObservationPolicy({ SCALE_WEIGHT_CAPTURE_LEGACY_OBSERVATION: " disabled " }), "DISABLED");
  assert.equal(readLegacyObservationPolicy({ SCALE_WEIGHT_CAPTURE_LEGACY_OBSERVATION: "ENABLED" }), "ENABLED");
  assert.equal(readLegacyObservationPolicy({ SCALE_WEIGHT_CAPTURE_LEGACY_OBSERVATION: "yes" }), "INVALID");
});

test("server-clock state checks reject non-PENDING and expired captures for every protocol", () => {
  const timings: ObservationTiming[] = [
    parseObservationTiming(v1(NOW), NOW, "ENABLED"),
    parseObservationTiming({ observedAt: iso(NOW) }, NOW, "ENABLED"),
  ];
  for (const timing of timings) {
    for (const status of ["READY", "CONSUMED", "REJECTED", "EXPIRED"]) {
      assert.equal(captureStateRejection({ ...pending, status }, timing, NOW), "CAPTURE_STATUS_INVALID");
    }
    // expires_at is exclusive on the server clock.
    assert.equal(captureStateRejection({ ...pending, expires_at: new Date(NOW) }, timing, NOW), "CAPTURE_EXPIRED");
    assert.equal(captureStateRejection({ ...pending, expires_at: new Date(NOW + 1) }, timing, NOW), null);
  }
});
