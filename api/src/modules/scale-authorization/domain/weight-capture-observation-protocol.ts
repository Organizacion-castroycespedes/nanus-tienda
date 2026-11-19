import { BadRequestException, ConflictException } from "@nestjs/common";

/**
 * Commercial weight observation timing.
 *
 * EXCLUSIVE_ACQUISITION_V1: the Agent attests (with its authenticated credential) that the
 * frame came from a new serial session opened after it accepted the request carrying the
 * server-issued, unpredictable captureId, and was never shared with another request. Order
 * against the capture is therefore causal: the Agent could not know the captureId before
 * the API created it. Intervals are measured on the Agent's monotonic clock. Wall-clock
 * observedAt is kept for audit only and is never compared with the API clock to prove order.
 *
 * LEGACY_WALL_CLOCK: Agents without the protocol (up to 0.1.1-qa.16) keep the original
 * checks: observedAt must not precede created_at and must be within 15 s of the API clock.
 */
export const WEIGHT_CAPTURE_PROTOCOL_EXCLUSIVE_V1 = "EXCLUSIVE_ACQUISITION_V1";
/** Maximum age of the physical frame, Agent monotonic clock, frame to submission. */
export const WEIGHT_CAPTURE_MAX_FRAME_AGE_MS = 15_000;
/** Maximum interval from accepting the capture request to the frame, Agent monotonic clock. */
export const WEIGHT_CAPTURE_MAX_REQUEST_TO_FRAME_MS = 15_000;
/** Audit sanity bound for the wall-clock observedAt; not an ordering or freshness proof. */
export const WEIGHT_CAPTURE_WALL_CLOCK_AUDIT_BOUND_MS = 300_000;
/** Freshness of the legacy wall-clock observation against the API clock. */
export const WEIGHT_CAPTURE_LEGACY_MAX_AGE_MS = 15_000;
export const WEIGHT_CAPTURE_LEGACY_POLICY_ENV = "SCALE_WEIGHT_CAPTURE_LEGACY_OBSERVATION";

export type LegacyObservationPolicy = "ENABLED" | "DISABLED" | "INVALID";

export type ObservationTiming =
  | { protocol: typeof WEIGHT_CAPTURE_PROTOCOL_EXCLUSIVE_V1; observedAtMs: number; requestToFrameMs: number; frameAgeMs: number }
  | { protocol: "LEGACY_WALL_CLOCK"; observedAtMs: number };

export type CaptureStateRejection = "CAPTURE_STATUS_INVALID" | "CAPTURE_EXPIRED" | "OBSERVATION_BEFORE_CAPTURE";

/** Error carrying an internal, log-only reason; the public error code is unchanged. */
export type ReasonedError = Error & { rejectionReason?: string };

const withReason = <T extends Error>(error: T, reason: string): T => {
  (error as ReasonedError).rejectionReason = reason;
  return error;
};

export const readLegacyObservationPolicy = (env: NodeJS.ProcessEnv = process.env): LegacyObservationPolicy => {
  const raw = env[WEIGHT_CAPTURE_LEGACY_POLICY_ENV];
  if (raw === undefined || raw.trim() === "") return "ENABLED";
  const value = raw.trim().toUpperCase();
  return value === "ENABLED" || value === "DISABLED" ? value : "INVALID";
};

const isBoundedInteger = (value: unknown): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0;

export const parseObservationTiming = (
  input: { observedAt?: unknown; captureProtocol?: unknown; acquisition?: unknown },
  nowMs: number,
  legacyPolicy: LegacyObservationPolicy,
): ObservationTiming => {
  const observedAtMs = typeof input.observedAt === "string" ? Date.parse(input.observedAt) : Number.NaN;
  const declaresProtocol = input.captureProtocol !== undefined || input.acquisition !== undefined;

  if (!declaresProtocol) {
    if (legacyPolicy !== "ENABLED") {
      throw withReason(new ConflictException("CAPTURE_PROTOCOL_UNSUPPORTED"),
        legacyPolicy === "INVALID" ? "LEGACY_POLICY_INVALID" : "LEGACY_PROTOCOL_DISABLED");
    }
    if (!Number.isFinite(observedAtMs) || observedAtMs > nowMs || nowMs - observedAtMs > WEIGHT_CAPTURE_LEGACY_MAX_AGE_MS) {
      throw withReason(new ConflictException("CAPTURE_OBSERVATION_STALE"), "LEGACY_WALL_CLOCK_STALE");
    }
    return { protocol: "LEGACY_WALL_CLOCK", observedAtMs };
  }

  const acquisition = input.acquisition;
  if (input.captureProtocol !== WEIGHT_CAPTURE_PROTOCOL_EXCLUSIVE_V1
    || !acquisition || typeof acquisition !== "object" || Array.isArray(acquisition)) {
    throw withReason(new BadRequestException("CAPTURE_OBSERVATION_INVALID"), "PROTOCOL_PAYLOAD_INVALID");
  }
  const evidence = acquisition as Record<string, unknown>;
  const keys = Object.keys(evidence).sort();
  if (keys.length !== 2 || keys[0] !== "frameAgeMs" || keys[1] !== "requestToFrameMs"
    || !isBoundedInteger(evidence.frameAgeMs) || !isBoundedInteger(evidence.requestToFrameMs)
    || !Number.isFinite(observedAtMs)) {
    throw withReason(new BadRequestException("CAPTURE_OBSERVATION_INVALID"), "PROTOCOL_PAYLOAD_INVALID");
  }
  if (evidence.frameAgeMs > WEIGHT_CAPTURE_MAX_FRAME_AGE_MS) {
    throw withReason(new ConflictException("CAPTURE_OBSERVATION_STALE"), "FRAME_AGE_EXCEEDED");
  }
  if (evidence.requestToFrameMs > WEIGHT_CAPTURE_MAX_REQUEST_TO_FRAME_MS) {
    throw withReason(new ConflictException("CAPTURE_OBSERVATION_STALE"), "REQUEST_TO_FRAME_EXCEEDED");
  }
  if (Math.abs(nowMs - observedAtMs) > WEIGHT_CAPTURE_WALL_CLOCK_AUDIT_BOUND_MS) {
    throw withReason(new ConflictException("CAPTURE_OBSERVATION_STALE"), "WALL_CLOCK_OUT_OF_AUDIT_BOUND");
  }
  return {
    protocol: WEIGHT_CAPTURE_PROTOCOL_EXCLUSIVE_V1, observedAtMs,
    requestToFrameMs: evidence.requestToFrameMs, frameAgeMs: evidence.frameAgeMs,
  };
};

/** Server-clock state checks. Only the legacy protocol compares wall clocks for order. */
export const captureStateRejection = (
  row: { status: string; created_at: Date; expires_at: Date },
  timing: ObservationTiming,
  nowMs: number,
): CaptureStateRejection | null => {
  if (row.status !== "PENDING") return "CAPTURE_STATUS_INVALID";
  if (row.expires_at.getTime() <= nowMs) return "CAPTURE_EXPIRED";
  if (timing.protocol === "LEGACY_WALL_CLOCK" && timing.observedAtMs < row.created_at.getTime()) {
    return "OBSERVATION_BEFORE_CAPTURE";
  }
  return null;
};

export const captureStateRejectionError = (reason: CaptureStateRejection) =>
  withReason(new ConflictException("CAPTURE_NOT_PENDING_OR_EXPIRED"), reason);
