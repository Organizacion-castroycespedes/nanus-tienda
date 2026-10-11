import { randomBytes, randomUUID, createHash, timingSafeEqual } from "node:crypto";

export type WeightCaptureContext = {
  tenantId: string; branchId: string; posTerminalId: string; operationalTerminalId: string;
  posSessionId: string; productId: string; logicalScaleId: string; bindingId: string;
};
export type WeightCaptureStatus = "PENDING" | "READY" | "CONSUMED" | "EXPIRED" | "REJECTED";
export type WeightObservation = { source: "REAL" | "MOCK"; value: number; unit: "kg" | "lb" | null; unitVerified: boolean; observedAt: string };
export type WeightCapture = WeightCaptureContext & {
  captureId: string; nonceVerifier: string; expiresAt: string; status: WeightCaptureStatus; observation?: WeightObservation;
};

export const createWeightCapture = (context: WeightCaptureContext, ttlMs: number, now = new Date()): { capture: WeightCapture; nonce: string } => {
  if (ttlMs <= 0) throw new Error("CAPTURE_TTL_INVALID");
  const nonce = randomBytes(32).toString("base64url");
  return {
    nonce,
    capture: { ...context, captureId: randomUUID(), nonceVerifier: createHash("sha256").update(nonce).digest("hex"), expiresAt: new Date(now.getTime() + ttlMs).toISOString(), status: "PENDING" },
  };
};

export const markCaptureReady = (capture: WeightCapture, observation: WeightObservation, now = new Date()): WeightCapture => {
  if (capture.status !== "PENDING") throw new Error("CAPTURE_NOT_PENDING");
  if (Date.parse(capture.expiresAt) <= now.getTime()) return { ...capture, status: "EXPIRED" };
  if (observation.source !== "REAL") return { ...capture, status: "REJECTED" };
  if (observation.unit !== "kg" || !observation.unitVerified) return { ...capture, status: "REJECTED" };
  if (!Number.isFinite(observation.value) || observation.value < 0 || !Number.isFinite(Date.parse(observation.observedAt))) return { ...capture, status: "REJECTED" };
  return { ...capture, status: "READY", observation: { ...observation } };
};

export const consumeWeightCapture = (
  capture: WeightCapture, nonce: string, expectedContext: WeightCaptureContext, now = new Date()
): { capture: WeightCapture; weightKg: number } => {
  if (capture.status !== "READY" || !capture.observation) throw new Error("CAPTURE_NOT_READY");
  if (Date.parse(capture.expiresAt) <= now.getTime()) throw new Error("CAPTURE_EXPIRED");
  const expectedNonce = Buffer.from(createHash("sha256").update(nonce).digest("hex"), "hex");
  const storedNonce = Buffer.from(capture.nonceVerifier, "hex");
  if (expectedNonce.length !== storedNonce.length || !timingSafeEqual(expectedNonce, storedNonce)) throw new Error("CAPTURE_NONCE_INVALID");
  const fields = Object.keys(expectedContext) as Array<keyof WeightCaptureContext>;
  if (fields.some((key) => !expectedContext[key] || capture[key] !== expectedContext[key])) throw new Error("CAPTURE_CONTEXT_MISMATCH");
  return { capture: { ...capture, status: "CONSUMED" }, weightKg: capture.observation.value };
};
