import assert from "node:assert/strict";
import test from "node:test";
import { buildAgentMetadataAfterBackendKgConfirmation, buildAgentUnitVerificationFromConfirmedBinding, deriveScaleAuthorizationUiState,
  describeScaleSaveOutcome, isAgentPairingChallengeUsable, isCurrentKgConfirmationEvidence, isRevocableAgentCredential,
  isRevocableScaleBinding, isStalePairingChallengeError, loadScaleAuthorizationRefresh, PAIRING_APPROVAL_EXPIRY_MARGIN_MS,
  shouldRevokeBindingForScaleChange, type KgConfirmationEvidence } from "./scale-authorization-ui-state";
import type { AgentPairingStatus, ScaleAuthorizationSnapshot } from "./scale-authorization.api";

const snapshot = (status = "AUTHORIZED"): ScaleAuthorizationSnapshot => ({
  posTerminalId: "pos-1", branchId: "branch-1", operationalTerminalId: "terminal-1",
  scaleDeviceId: "serial-rochi-a01e-1234abcd1234abcd", enableScale: true,
  agent: { deviceId: "device-1", installationId: "install-1", credentialId: "cred-1", status: "ACTIVE", authenticated: true },
  binding: { id: "binding-1", logicalScaleId: "serial-rochi-a01e-1234abcd1234abcd", status,
    unitState: status === "AUTHORIZED" ? "KG_VERIFIED" : "NOT_VERIFIED", verificationMethod: "OPERATOR_CONFIRMATION",
    unit: "kg", verifiedBy: "operator-1", verifiedAt: "2026-10-07T12:00:00.000Z" },
  realAvailable: false, realAvailabilityReason: "FRESH_REAL_OBSERVATION_REQUIRED",
});
const agent: AgentPairingStatus = { installationId: "install-1", enrolled: true, pairing: null };
const testRead = (overrides: Record<string, unknown> = {}) => ({ available: true, reason: "READY", reading: {
  source: "REAL", unit: "kg", unitVerified: true, observedAt: "2026-10-07T12:00:00.000Z", ...overrides,
} });

test("UI reconstructs authorization from server state but only shows REAL_READY after a fresh REAL kg test", () => {
  const input = { snapshot: snapshot(), localAgent: agent, testResult: testRead(),
    configuredScaleId: "serial-rochi-a01e-1234abcd1234abcd", now: new Date("2026-10-07T12:00:10.000Z") };
  assert.equal(deriveScaleAuthorizationUiState(input).realAvailable, true);
  assert.equal(deriveScaleAuthorizationUiState({ ...input, testResult: null }).realAvailable, false);
  assert.equal(deriveScaleAuthorizationUiState({ ...input, testResult: testRead({ source: "MOCK" }) }).realAvailable, false);
  assert.equal(deriveScaleAuthorizationUiState({ ...input, testResult: testRead({ unit: "lb" }) }).realAvailable, false);
  assert.equal(deriveScaleAuthorizationUiState({ ...input, now: new Date("2026-10-07T12:00:20.001Z") }).realAvailable, false);
});

test("UI requires current reading evidence and an authenticated Agent before KG confirmation", () => {
  const pending = snapshot("PENDING");
  assert.equal(deriveScaleAuthorizationUiState({ snapshot: pending, localAgent: agent, testResult: null,
    configuredScaleId: pending.scaleDeviceId }).canConfirmKg, false);
  assert.equal(deriveScaleAuthorizationUiState({ snapshot: pending, localAgent: agent, testResult: null,
    configuredScaleId: pending.scaleDeviceId, hasCurrentKgConfirmationEvidence: true }).canConfirmKg, true);
  assert.equal(deriveScaleAuthorizationUiState({ snapshot: pending, localAgent: { ...agent, enrolled: false }, testResult: null,
    configuredScaleId: pending.scaleDeviceId, hasCurrentKgConfirmationEvidence: true }).canConfirmKg, false);
  assert.equal(deriveScaleAuthorizationUiState({ snapshot: pending, localAgent: agent, testResult: null,
    configuredScaleId: "other-scale", hasCurrentKgConfirmationEvidence: true }).canConfirmKg, false);
});

const pendingSnapshot = (): ScaleAuthorizationSnapshot => ({ ...snapshot("PENDING"),
  binding: { ...snapshot("PENDING").binding!, status: "PENDING", unitState: "NOT_VERIFIED",
    verificationMethod: null, unit: null, verifiedBy: null, verifiedAt: null },
});
const configuredDevice = { id: snapshot("PENDING").scaleDeviceId!, type: "SCALE", connectionType: "SERIAL",
  terminalId: "local-terminal", profileId: "ROCHI_A01E", metadata: { configured: true } };
const kgEvidence = (overrides: Partial<KgConfirmationEvidence> = {}): KgConfirmationEvidence => ({
  weight: 0.245, unit: null, source: "REAL", unitVerified: false, stable: null, stabilityVerified: false,
  observedAt: "2026-10-07T12:00:00.000Z", bindingId: "binding-1", installationId: "install-1",
  branchId: "branch-1",
  terminalId: "local-terminal", profileId: "ROCHI_A01E", posTerminalId: "pos-1",
  operationalTerminalId: "terminal-1", logicalScaleId: configuredDevice.id, ...overrides,
});

test("REAL finite reading with unknown unit is valid pre-confirmation evidence; stability stays unknown", () => {
  const pending = pendingSnapshot();
  const evidence = kgEvidence();
  assert.equal(isCurrentKgConfirmationEvidence({ evidence, snapshot: pending, localAgent: agent,
    configuredScaleId: configuredDevice.id, configuredDevice, now: new Date("2026-10-07T12:00:10.000Z") }), true);
  assert.equal(evidence.unit, null);
  assert.equal(evidence.unitVerified, false);
  assert.equal(evidence.stable, null);
  assert.equal(evidence.stabilityVerified, false);
  assert.equal(deriveScaleAuthorizationUiState({ snapshot: pending, localAgent: agent, testResult: null,
    configuredScaleId: configuredDevice.id, hasCurrentKgConfirmationEvidence: true }).canConfirmKg, true);
  assert.equal(deriveScaleAuthorizationUiState({ snapshot: pending, localAgent: agent, testResult: null,
    configuredScaleId: configuredDevice.id }).canConfirmKg, false);
});

test("MOCK, non-finite, stale and mismatched terminal/device evidence remain blocked", () => {
  const pending = pendingSnapshot();
  const isValid = (evidence: KgConfirmationEvidence) => isCurrentKgConfirmationEvidence({ evidence,
    snapshot: pending, localAgent: agent, configuredScaleId: configuredDevice.id, configuredDevice,
    now: new Date("2026-10-07T12:00:10.000Z") });
  assert.equal(isValid(kgEvidence({ source: "MOCK" })), false);
  assert.equal(isValid(kgEvidence({ weight: Number.NaN })), false);
  assert.equal(isValid(kgEvidence({ observedAt: "2026-10-07T11:59:40.000Z" })), false);
  assert.equal(isValid(kgEvidence({ logicalScaleId: "other-scale" })), false);
  assert.equal(isValid(kgEvidence({ installationId: "other-installation" })), false);
  assert.equal(isValid(kgEvidence({ posTerminalId: "other-pos" })), false);
  assert.equal(isValid(kgEvidence({ branchId: "other-branch" })), false);
  assert.equal(isValid(kgEvidence({ operationalTerminalId: "other-terminal" })), false);
  assert.equal(isValid(kgEvidence({ unit: "kg", unitVerified: false })), false);
  assert.equal(isValid(kgEvidence({ unit: "kg", unitVerified: true })), false);
});

test("local Agent unit metadata can only be derived from a backend-confirmed binding", () => {
  assert.deepEqual(buildAgentUnitVerificationFromConfirmedBinding({ id: "binding-1", status: "AUTHORIZED",
    unit_state: "KG_VERIFIED", unitVerification: { method: "OPERATOR_CONFIRMATION", unit: "kg",
      operatorId: "operator-1", verifiedAt: "2026-10-07T12:00:00.000Z" } }), {
    unit: "KG", method: "OPERATOR_CONFIRMATION", verifiedAt: "2026-10-07T12:00:00.000Z",
  });
  assert.equal(buildAgentUnitVerificationFromConfirmedBinding({ id: "binding-1", status: "PENDING",
    unit_state: "NOT_VERIFIED" }), null);
  assert.deepEqual(buildAgentMetadataAfterBackendKgConfirmation({ configured: true, serialNumber: "opaque" }, {
    id: "binding-1", status: "AUTHORIZED", unit_state: "KG_VERIFIED", unitVerification: {
      method: "OPERATOR_CONFIRMATION", unit: "kg", operatorId: "operator-1", verifiedAt: "2026-10-07T12:00:00.000Z",
    },
  }), { configured: true, serialNumber: "opaque", unitVerification: {
    unit: "KG", method: "OPERATOR_CONFIRMATION", verifiedAt: "2026-10-07T12:00:00.000Z",
  } });
});

test("status refresh loads Agent, backend authorization and configured device state together", async () => {
  const calls: string[] = [];
  const result = await loadScaleAuthorizationRefresh({
    agent: async () => { calls.push("agent"); return "enrolled"; },
    snapshot: async () => { calls.push("snapshot"); return "pending"; },
    devices: async () => { calls.push("devices"); return [configuredDevice]; },
  });
  assert.deepEqual(calls.sort(), ["agent", "devices", "snapshot"]);
  assert.equal(result.agent.status, "fulfilled");
  assert.equal(result.snapshot.status, "fulfilled");
  assert.equal(result.devices.status, "fulfilled");

  const partial = await loadScaleAuthorizationRefresh({
    agent: async () => { throw new Error("agent unavailable"); },
    snapshot: async () => "pending",
    devices: async () => [],
  });
  assert.equal(partial.agent.status, "rejected");
  assert.equal(partial.snapshot.status, "fulfilled");
  assert.equal(partial.devices.status, "fulfilled");
});

const bindingWith = (status: string, logicalScaleId = "serial-rochi-a01e-1234abcd1234abcd") => ({
  id: `binding-${status}`, logicalScaleId, status, unitState: "NOT_VERIFIED", verificationMethod: null,
  unit: null, verifiedBy: null, verifiedAt: null,
});

test("only PENDING and AUTHORIZED bindings are revocable", () => {
  assert.equal(isRevocableScaleBinding(bindingWith("PENDING")), true);
  assert.equal(isRevocableScaleBinding(bindingWith("AUTHORIZED")), true);
  for (const status of ["REVOKED", "SUPERSEDED", "EXPIRED", ""]) assert.equal(isRevocableScaleBinding(bindingWith(status)), false, status);
  assert.equal(isRevocableScaleBinding(null), false);
  assert.equal(isRevocableScaleBinding({ ...bindingWith("PENDING"), id: "" }), false);
});

test("changing the scale never revokes an already revoked binding", () => {
  assert.equal(shouldRevokeBindingForScaleChange(bindingWith("REVOKED", "old-scale"), "new-scale"), false);
  assert.equal(shouldRevokeBindingForScaleChange(bindingWith("PENDING", "old-scale"), "new-scale"), true);
  assert.equal(shouldRevokeBindingForScaleChange(bindingWith("AUTHORIZED", "old-scale"), null), true);
  assert.equal(shouldRevokeBindingForScaleChange(bindingWith("AUTHORIZED", "same-scale"), "same-scale"), false);
  assert.equal(shouldRevokeBindingForScaleChange(null, "new-scale"), false);
});

test("credential revocation requires an exposed and authenticated credential", () => {
  const base = snapshot("AUTHORIZED");
  assert.equal(isRevocableAgentCredential(base), true);
  assert.equal(isRevocableAgentCredential({ ...base, agent: { ...base.agent, credentialId: null } }), false);
  assert.equal(isRevocableAgentCredential({ ...base, agent: { ...base.agent, authenticated: false } }), false);
  assert.equal(isRevocableAgentCredential(null), false);
});

test("scale save outcome distinguishes saved association from failed follow-up steps", () => {
  assert.deepEqual(describeScaleSaveOutcome({ scaleAssociated: true, revocation: "NOT_REQUIRED" }), { kind: "success", message: "Balanza asociada." });
  assert.deepEqual(describeScaleSaveOutcome({ scaleAssociated: false, revocation: "REVOKED" }), { kind: "success", message: "Balanza desasociada." });
  const revokeFailed = describeScaleSaveOutcome({ scaleAssociated: true, revocation: "FAILED", revocationError: "SCALE_BINDING_NOT_ACTIVE" });
  assert.equal(revokeFailed.kind, "warning");
  assert.match(revokeFailed.message, /^Balanza asociada\. No se pudo revocar .*SCALE_BINDING_NOT_ACTIVE/);
  const refreshFailed = describeScaleSaveOutcome({ scaleAssociated: true, revocation: "REVOKED", refreshError: "timeout" });
  assert.equal(refreshFailed.kind, "warning");
  assert.match(refreshFailed.message, /^Balanza asociada\. No se pudo actualizar el estado mostrado: timeout/);
});

test("a held pairing challenge is usable only with more than the approval margin left", () => {
  const now = new Date("2026-11-17T16:00:00.000Z");
  const pairingAt = (expiresAt: string) => ({ pairingCode: "0000000000", signedChallenge: {}, enrollmentPublicKeyPem: "pem", expiresAt });
  assert.equal(PAIRING_APPROVAL_EXPIRY_MARGIN_MS, 5_000);
  assert.equal(isAgentPairingChallengeUsable(pairingAt("2026-11-17T16:00:05.001Z"), now), true);
  assert.equal(isAgentPairingChallengeUsable(pairingAt("2026-11-17T16:00:05.000Z"), now), false);
  assert.equal(isAgentPairingChallengeUsable(pairingAt("2026-11-17T15:59:59.000Z"), now), false);
  assert.equal(isAgentPairingChallengeUsable(pairingAt("not-a-date"), now), false);
  assert.equal(isAgentPairingChallengeUsable(null, now), false);
});

test("only stale-challenge API rejections clear the held challenge", () => {
  assert.equal(isStalePairingChallengeError(Object.assign(new Error("PAIRING_CHALLENGE_INVALID"), { status: 403 })), true);
  assert.equal(isStalePairingChallengeError(new Error("PAIRING_CHALLENGE_ALREADY_USED")), true);
  assert.equal(isStalePairingChallengeError({ message: "Request failed", code: "PAIRING_CHALLENGE_INVALID" }), true);
  for (const message of ["PAIRING_OPERATIONAL_DEVICE_NOT_BOUND", "PAIRING_TERMINAL_SCOPE_MISMATCH", "ACTIVE_AGENT_CREDENTIAL_EXISTS", "Request failed"]) {
    assert.equal(isStalePairingChallengeError(new Error(message)), false, message);
  }
  assert.equal(isStalePairingChallengeError(null), false);
});
