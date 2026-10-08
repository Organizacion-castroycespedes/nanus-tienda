import assert from "node:assert/strict";
import test from "node:test";
import { issueOpaqueAgentCredential } from "./agent-credential.domain";
import { deriveRealAvailability } from "./real-availability.domain";
import type { ScaleBinding } from "./scale-binding.domain";

const context = { tenantId: "t", branchId: "b", posTerminalId: "p", operationalTerminalId: "o", terminalDeviceId: "d", logicalScaleId: "s" };
const credential = issueOpaqueAgentCredential();
const now = new Date("2026-01-01T00:00:00Z");
const binding: ScaleBinding = {
  id: "x", ...context, status: "AUTHORIZED", unitState: "KG_VERIFIED",
  unitVerification: { method: "OPERATOR_CONFIRMATION", unit: "kg", operatorId: "operator", verifiedAt: now.toISOString() },
};
const observation = { available: true, observedAt: now.toISOString(), logicalScaleId: "s" };
const base = { credential: { verifierSha256: credential.verifierSha256, expiresAt: "2027-01-01T00:00:00Z" }, credentialSecret: credential.secret, binding, expectedContext: context, observation, maxObservationAgeMs: 1000, now };

test("readiness requires credential, authorized KG binding, matching scale and fresh Agent", () => {
  assert.deepEqual(deriveRealAvailability(base), { available: true, reason: "READY" });
  assert.equal(deriveRealAvailability({ ...base, credential: null }).reason, "NO_AGENT_CREDENTIAL");
  assert.equal(deriveRealAvailability({ ...base, credential: { ...base.credential!, expiresAt: "2025-01-01T00:00:00Z" } }).reason, "AGENT_CREDENTIAL_EXPIRED");
  assert.equal(deriveRealAvailability({ ...base, binding: null }).reason, "NO_BINDING");
  assert.equal(deriveRealAvailability({ ...base, binding: { ...binding, status: "PENDING", unitState: "NOT_VERIFIED" } }).reason, "BINDING_PENDING");
  assert.equal(deriveRealAvailability({ ...base, binding: { ...binding, status: "REVOKED" } }).reason, "BINDING_REVOKED");
  assert.equal(deriveRealAvailability({ ...base, binding: { ...binding, status: "DISABLED" } }).reason, "BINDING_DISABLED");
  assert.equal(deriveRealAvailability({ ...base, expectedContext: { ...context, tenantId: "other" } }).reason, "SCALE_MISMATCH");
  assert.equal(deriveRealAvailability({ ...base, observation: { ...observation, logicalScaleId: "other" } }).reason, "SCALE_MISMATCH");
  assert.equal(deriveRealAvailability({ ...base, observation: { ...observation, available: false } }).reason, "AGENT_UNAVAILABLE_OR_STALE");
  assert.equal(deriveRealAvailability({ ...base, observation: { ...observation, observedAt: "2025-01-01T00:00:00Z" } }).reason, "AGENT_UNAVAILABLE_OR_STALE");
  assert.equal(deriveRealAvailability({ ...base, binding: { ...binding, unitState: "NOT_VERIFIED" } }).reason, "UNIT_NOT_VERIFIED");
  assert.equal(deriveRealAvailability({ ...base, credential: { ...base.credential!, revokedAt: now.toISOString() } }).reason, "AGENT_REVOKED");
});
