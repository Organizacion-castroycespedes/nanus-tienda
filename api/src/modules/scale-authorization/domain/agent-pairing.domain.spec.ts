import assert from "node:assert/strict";
import { createHash, createPublicKey, generateKeyPairSync, verify } from "node:crypto";
import test from "node:test";
import {
  AGENT_PAIRING_CHALLENGE_MAX_LIFETIME_MS,
  AGENT_PAIRING_ISSUED_AT_BACKDATE_MS,
  createAgentCredentialEnvelope,
  createSignedAgentPairingChallenge,
  publicKeyFingerprint,
  verifyAgentCredentialEnvelope,
  verifySignedAgentPairingChallenge,
  type SignedAgentPairingChallenge,
} from "./agent-pairing.domain";

const signing = generateKeyPairSync("ed25519");
const enrollment = generateKeyPairSync("rsa", { modulusLength: 3072 });
const otherEnrollment = generateKeyPairSync("rsa", { modulusLength: 3072 });
const signingPrivate = signing.privateKey.export({ type: "pkcs8", format: "pem" }).toString();
const signingPublic = signing.publicKey.export({ type: "spki", format: "pem" }).toString();
const enrollmentPublic = enrollment.publicKey.export({ type: "spki", format: "pem" }).toString();
const base = {
  keyId: "qa-key-1", privateKeyPem: signingPrivate, audience: "manus-agent:qa",
  installationId: "install-1", terminalDeviceId: "device-1", enrollmentPublicKeyPem: enrollmentPublic,
  nonce: "a".repeat(48), now: new Date("2026-10-07T12:00:00Z"), jti: "credential-1", pairingCode: "4711058293",
};

test("signed pairing challenge binds audience, installation, device, key and expiry", () => {
  const signed = createSignedAgentPairingChallenge(base);
  const verifyInput = { signed, publicKeyPem: signingPublic, expectedAudience: base.audience,
    expectedInstallationId: base.installationId, expectedTerminalDeviceId: base.terminalDeviceId,
    expectedEnrollmentKeyFingerprint: publicKeyFingerprint(enrollmentPublic), now: base.now };
  assert.equal(verifySignedAgentPairingChallenge(verifyInput), true);
  assert.equal(verifySignedAgentPairingChallenge({ ...verifyInput, expectedInstallationId: "other" }), false);
  assert.equal(verifySignedAgentPairingChallenge({ ...verifyInput, expectedAudience: "manus-agent:prod" }), false);
  assert.equal(verifySignedAgentPairingChallenge({ ...verifyInput, now: new Date("2026-10-07T12:06:00Z") }), false);
  assert.equal(verifySignedAgentPairingChallenge({ ...verifyInput, publicKeyPem: enrollmentPublic }), false);
  assert.equal(verifySignedAgentPairingChallenge({ ...verifyInput, signed: { ...signed, challenge: { ...signed.challenge, pairingCode: "0000000000" } } }), false);
});

test("credential envelope is encrypted to the signed Agent key and server-signed", () => {
  const signed = createSignedAgentPairingChallenge(base);
  const agentSecret = "a".repeat(43);
  const envelope = createAgentCredentialEnvelope({ keyId: base.keyId, privateKeyPem: signingPrivate,
    challenge: signed.challenge, enrollmentPublicKeyPem: enrollmentPublic, credentialSecret: agentSecret,
    credentialExpiresAt: "2027-01-05T12:00:00.000Z" });
  assert.equal(JSON.stringify(envelope).includes(agentSecret), false);
  assert.equal(verifyAgentCredentialEnvelope({ envelope, publicKeyPem: signingPublic,
    expectedKeyId: base.keyId, expectedJti: base.jti,
    expectedFingerprint: publicKeyFingerprint(enrollmentPublic) }), true);
  assert.equal(verifyAgentCredentialEnvelope({ envelope: { ...envelope, ciphertext: "substituted" },
    publicKeyPem: signingPublic, expectedKeyId: base.keyId, expectedJti: base.jti,
    expectedFingerprint: publicKeyFingerprint(enrollmentPublic) }), false);
  assert.throws(() => createAgentCredentialEnvelope({ keyId: base.keyId, privateKeyPem: signingPrivate,
    challenge: signed.challenge, enrollmentPublicKeyPem: otherEnrollment.publicKey.export({ type: "spki", format: "pem" }).toString(),
    credentialSecret: agentSecret, credentialExpiresAt: "2027-01-05T12:00:00.000Z" }), /AGENT_ENROLLMENT_KEY_MISMATCH/);
});

// Faithful replica of the Agent-side verifier (backend-perifericos
// agent-pairing.crypto.ts). qa.16 (HEAD 6a26df54) has no future-skew allowance;
// qa.17 allows 2,000 ms. Both cap the signed window at 300,000 ms.
const agentVerifies = (signed: SignedAgentPairingChallenge, agentNow: Date, futureSkewMs: number, overrides: Partial<{
  trustedSigningPublicKeyPem: string; expectedKeyId: string; expectedAudience: string; expectedInstallationId: string;
}> = {}): boolean => {
  const expected = { trustedSigningPublicKeyPem: signingPublic, expectedKeyId: base.keyId,
    expectedAudience: base.audience, expectedInstallationId: base.installationId, ...overrides };
  try {
    const key = createPublicKey(expected.trustedSigningPublicKeyPem);
    const { challenge } = signed;
    const expires = Date.parse(challenge.expiresAt);
    const issued = Date.parse(challenge.issuedAt);
    const fingerprint = createHash("sha256")
      .update(createPublicKey(enrollmentPublic).export({ type: "spki", format: "der" })).digest("hex");
    return key.asymmetricKeyType === "ed25519"
      && signed.keyId === expected.expectedKeyId
      && challenge.typ === "MANUS_AGENT_PAIRING_V1"
      && challenge.audience === expected.expectedAudience
      && challenge.installationId === expected.expectedInstallationId
      && challenge.enrollmentKeyFingerprint === fingerprint
      && /^[A-Za-z0-9_-]{32,128}$/.test(challenge.nonce)
      && Number.isFinite(issued) && issued <= agentNow.getTime() + futureSkewMs
      && Number.isFinite(expires) && expires > agentNow.getTime() && expires - issued <= 5 * 60_000
      && verify(null, Buffer.from(JSON.stringify(challenge), "utf8"), key, Buffer.from(signed.signature, "base64url"));
  } catch { return false; }
};
const qa16Verifies = (signed: SignedAgentPairingChallenge, agentNow: Date, overrides = {}) => agentVerifies(signed, agentNow, 0, overrides);
const qa17Verifies = (signed: SignedAgentPairingChallenge, agentNow: Date, overrides = {}) => agentVerifies(signed, agentNow, 2_000, overrides);
const lagged = (ms: number) => new Date(base.now.getTime() - ms);

test("challenge timestamp contract: issuedAt is backdated 2,000 ms and the signed window is exactly 300,000 ms from issuedAt", () => {
  const { challenge } = createSignedAgentPairingChallenge(base);
  assert.equal(AGENT_PAIRING_ISSUED_AT_BACKDATE_MS, 2_000);
  assert.equal(AGENT_PAIRING_CHALLENGE_MAX_LIFETIME_MS, 300_000);
  assert.equal(challenge.issuedAt, "2026-10-07T11:59:58.000Z");
  assert.equal(challenge.expiresAt, "2026-10-07T12:04:58.000Z");
  assert.equal(Date.parse(challenge.expiresAt) - Date.parse(challenge.issuedAt), 300_000);
  assert.equal(Date.parse(challenge.expiresAt) - base.now.getTime(), 298_000);
});

test("installed Agent qa.16 accepts a correctly signed challenge when its clock lags the API by up to 2,000 ms", () => {
  const signed = createSignedAgentPairingChallenge(base);
  for (const lagMs of [0, 200, 1_999, 2_000]) assert.equal(qa16Verifies(signed, lagged(lagMs)), true, `lag ${lagMs} ms`);
  assert.equal(qa16Verifies(signed, lagged(2_001)), false);
  // Agent ahead of the API: valid until expiry, never at or after it.
  assert.equal(qa16Verifies(signed, new Date(base.now.getTime() + 297_999)), true);
  assert.equal(qa16Verifies(signed, new Date(Date.parse(signed.challenge.expiresAt))), false);
});

test("the previous zero-backdate signer is the documented qa.16 failure with a 200 ms lag", () => {
  const signed = createSignedAgentPairingChallenge(base);
  // Reproduce the old wire shape: issuedAt == API now. It can no longer be produced by the signer.
  const old = { ...signed, challenge: { ...signed.challenge, issuedAt: base.now.toISOString() } };
  assert.equal(qa16Verifies(old, lagged(200)), false);
});

test("corrected Agent qa.17 remains compatible and keeps its own bounded skew", () => {
  const signed = createSignedAgentPairingChallenge(base);
  for (const lagMs of [0, 200, 1_999, 2_000, 4_000]) assert.equal(qa17Verifies(signed, lagged(lagMs)), true, `lag ${lagMs} ms`);
  assert.equal(qa17Verifies(signed, lagged(4_001)), false);
  assert.equal(qa17Verifies(signed, new Date(Date.parse(signed.challenge.expiresAt))), false);
});

test("both Agent verifiers reject expired, tampered, wrong-key, wrong-key-id, wrong-audience and wrong-installation challenges", () => {
  const signed = createSignedAgentPairingChallenge(base);
  const otherSigning = generateKeyPairSync("ed25519").publicKey.export({ type: "spki", format: "pem" }).toString();
  const lag = lagged(200);
  for (const verifier of [qa16Verifies, qa17Verifies]) {
    assert.equal(verifier(signed, lag), true);
    assert.equal(verifier(signed, new Date(base.now.getTime() + 6 * 60_000)), false, "expired");
    for (const field of ["pairingCode", "nonce", "jti", "terminalDeviceId", "issuedAt", "expiresAt"] as const) {
      const value = field === "issuedAt" ? "2026-10-07T11:59:57.000Z" : field === "expiresAt" ? "2026-10-07T12:04:57.000Z"
        : field === "nonce" ? "b".repeat(48) : "tampered";
      assert.equal(verifier({ ...signed, challenge: { ...signed.challenge, [field]: value } }, lag), false, `tampered ${field}`);
    }
    assert.equal(verifier({ ...signed, signature: signed.signature.slice(0, -2) + "AA" }, lag), false, "signature");
    assert.equal(verifier(signed, lag, { trustedSigningPublicKeyPem: otherSigning }), false, "wrong key");
    assert.equal(verifier({ ...signed, keyId: "qa-key-2" }, lag), false, "wrong key id");
    assert.equal(verifier(signed, lag, { expectedAudience: "manus-agent:prod" }), false, "wrong audience");
    assert.equal(verifier(signed, lag, { expectedInstallationId: "install-2" }), false, "wrong installation");
  }
});

test("signer rejects lifetimes outside (backdate, 300,000] ms and never widens the window", () => {
  const short = createSignedAgentPairingChallenge({ ...base, ttlMs: 60_000 });
  assert.equal(Date.parse(short.challenge.expiresAt) - Date.parse(short.challenge.issuedAt), 60_000);
  for (const ttlMs of [300_001, 2_000, 1_000, 0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.throws(() => createSignedAgentPairingChallenge({ ...base, ttlMs }), /AGENT_PAIRING_INPUT_INVALID/, `ttl ${ttlMs}`);
  }
  assert.throws(() => createSignedAgentPairingChallenge({ ...base, now: new Date(Number.NaN) }), /AGENT_PAIRING_INPUT_INVALID/);
});

test("API-side verification keeps strict deterministic clock boundaries", () => {
  const signed = createSignedAgentPairingChallenge(base);
  const verifyAt = (now: Date, candidate = signed) => verifySignedAgentPairingChallenge({ signed: candidate, publicKeyPem: signingPublic,
    expectedAudience: base.audience, expectedInstallationId: base.installationId, expectedTerminalDeviceId: base.terminalDeviceId,
    expectedEnrollmentKeyFingerprint: publicKeyFingerprint(enrollmentPublic), now });
  assert.equal(verifyAt(new Date(Date.parse(signed.challenge.issuedAt))), true);
  assert.equal(verifyAt(new Date(Date.parse(signed.challenge.issuedAt) - 1)), false, "issued in the API future");
  assert.equal(verifyAt(new Date(Date.parse(signed.challenge.expiresAt) - 1)), true);
  assert.equal(verifyAt(new Date(Date.parse(signed.challenge.expiresAt))), false, "expired");
  const widened = { ...signed, challenge: { ...signed.challenge, expiresAt: "2026-10-07T12:04:58.001Z" } };
  assert.equal(verifyAt(base.now, widened), false, "window over 300,000 ms or unsigned change");
});
