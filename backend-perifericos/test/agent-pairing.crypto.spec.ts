import assert from "node:assert/strict";
import test from "node:test";
import { generateKeyPairSync, sign } from "node:crypto";
import {
  decryptAgentCredentialEnvelope, enrollmentKeyFingerprint, verifyAgentSignedChallenge,
} from "../src/modules/agent-security/agent-pairing.crypto";
import { createAgentCredentialEnvelope } from "../../api/src/modules/scale-authorization/domain/agent-pairing.domain";

const canonical = (value: unknown) => Buffer.from(JSON.stringify(value), "utf8");
const signing = generateKeyPairSync("ed25519");
const agent = generateKeyPairSync("rsa", { modulusLength: 3072 });
const privatePem = signing.privateKey.export({ type: "pkcs8", format: "pem" }).toString();
const publicPem = signing.publicKey.export({ type: "spki", format: "pem" }).toString();
const agentPrivate = agent.privateKey.export({ type: "pkcs8", format: "pem" }).toString();
const agentPublic = agent.publicKey.export({ type: "spki", format: "pem" }).toString();
const now = new Date();
const challenge = { typ: "MANUS_AGENT_PAIRING_V1" as const, jti: "one-time-id", audience: "manus-agent:qa",
  installationId: "installation", terminalDeviceId: "device", enrollmentKeyFingerprint: enrollmentKeyFingerprint(agentPublic),
  nonce: "n".repeat(48), pairingCode: "1234567890", issuedAt: now.toISOString(), expiresAt: new Date(now.getTime()+300000).toISOString() };
const signed = { keyId: "qa-key", challenge, signature: sign(null, canonical(challenge), privatePem).toString("base64url") };
const signChallenge = (overrides: Partial<typeof challenge>, keyId = "qa-key") => {
  const value = { ...challenge, ...overrides };
  return { keyId, challenge: value, signature: sign(null, canonical(value), privatePem).toString("base64url") };
};

test("Agent accepts only the pinned Ed25519 signature and bound identity", () => {
  const input = { signed, trustedSigningPublicKeyPem: publicPem, expectedKeyId: "qa-key",
    expectedAudience: "manus-agent:qa", expectedInstallationId: "installation", enrollmentPublicKeyPem: agentPublic, now };
  assert.equal(verifyAgentSignedChallenge(input), true);
  assert.equal(verifyAgentSignedChallenge({ ...input, trustedSigningPublicKeyPem: agentPublic }), false);
  assert.equal(verifyAgentSignedChallenge({ ...input, expectedInstallationId: "other" }), false);
  assert.equal(verifyAgentSignedChallenge({ ...input, expectedAudience: "manus-agent:prod" }), false);
  assert.equal(verifyAgentSignedChallenge({ ...input, signed: { ...signed, keyId: "other-key" } }), false);
  assert.equal(verifyAgentSignedChallenge({ ...input, signed: { ...signed, challenge: { ...challenge, nonce: "tampered" } } }), false);
  assert.equal(verifyAgentSignedChallenge({ ...input, now: new Date(now.getTime()+301000) }), false);
});

test("Agent accepts only a bounded future issuedAt clock skew", () => {
  const input = { trustedSigningPublicKeyPem: publicPem, expectedKeyId: "qa-key",
    expectedAudience: "manus-agent:qa", expectedInstallationId: "installation", enrollmentPublicKeyPem: agentPublic, now };
  const withinSkew = signChallenge({ issuedAt: new Date(now.getTime() + 200).toISOString() });
  assert.equal(verifyAgentSignedChallenge({ ...input, signed: withinSkew }), true);
  const atSkewBoundary = signChallenge({ issuedAt: new Date(now.getTime() + 2_000).toISOString() });
  assert.equal(verifyAgentSignedChallenge({ ...input, signed: atSkewBoundary }), true);

  const beyondSkew = signChallenge({ issuedAt: new Date(now.getTime() + 2_001).toISOString() });
  assert.equal(verifyAgentSignedChallenge({ ...input, signed: beyondSkew }), false);

  const expired = signChallenge({ expiresAt: now.toISOString() });
  assert.equal(verifyAgentSignedChallenge({ ...input, signed: expired }), false);

  const overlong = signChallenge({ expiresAt: new Date(now.getTime() + 300_001).toISOString() });
  assert.equal(verifyAgentSignedChallenge({ ...input, signed: overlong }), false);
});

test("Agent rejects malformed, tampered and context-mismatched signed challenges", () => {
  const input = { trustedSigningPublicKeyPem: publicPem, expectedKeyId: "qa-key",
    expectedAudience: "manus-agent:qa", expectedInstallationId: "installation", enrollmentPublicKeyPem: agentPublic, now };
  assert.equal(verifyAgentSignedChallenge({ ...input, signed: { ...signed, signature: "%%%malformed%%%" } }), false);
  assert.equal(verifyAgentSignedChallenge({ ...input, signed: { ...signed,
    signature: `${signed.signature[0] === "A" ? "B" : "A"}${signed.signature.slice(1)}` } }), false);
  assert.equal(verifyAgentSignedChallenge({ ...input, signed: { ...signed,
    challenge: { ...challenge, audience: "manus-agent:prod" } } }), false);

  const otherAgent = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const otherFingerprint = enrollmentKeyFingerprint(otherAgent.publicKey.export({ type: "spki", format: "pem" }).toString());
  const mismatchedFingerprint = signChallenge({ enrollmentKeyFingerprint: otherFingerprint });
  assert.equal(verifyAgentSignedChallenge({ ...input, signed: mismatchedFingerprint }), false);
  const invalidNonce = signChallenge({ nonce: "short" });
  assert.equal(verifyAgentSignedChallenge({ ...input, signed: invalidNonce }), false);
});

test("Agent rejects signing-key substitution regardless of self-signed challenge", () => {
  const attacker = generateKeyPairSync("ed25519");
  const forged = { ...signed, signature: sign(null, canonical(challenge), attacker.privateKey).toString("base64url") };
  assert.equal(verifyAgentSignedChallenge({ signed: forged, trustedSigningPublicKeyPem: publicPem,
    expectedKeyId: "qa-key", expectedAudience: "manus-agent:qa", expectedInstallationId: "installation",
    enrollmentPublicKeyPem: agentPublic, now }), false);
});

test("Agent envelope decrypts only when its server signature and challenge context match", () => {
  const agentSecret = "a".repeat(43);
  const credentialExpiresAt = new Date(now.getTime() + 90 * 24 * 60 * 60_000).toISOString();
  const envelope = createAgentCredentialEnvelope({ keyId: "qa-key", privateKeyPem: privatePem, challenge,
    enrollmentPublicKeyPem: agentPublic, credentialSecret: agentSecret,
    credentialExpiresAt });
  const decrypted = decryptAgentCredentialEnvelope({ envelope, challenge: signed,
    enrollmentPrivateKeyPem: agentPrivate, trustedSigningPublicKeyPem: publicPem, expectedKeyId: "qa-key" });
  assert.equal(decrypted.credentialId, challenge.jti);
  assert.equal(decrypted.secret.toString("utf8"), agentSecret);
  assert.equal(decrypted.expiresAt, credentialExpiresAt);
  decrypted.secret.fill(0);
  assert.throws(() => decryptAgentCredentialEnvelope({ envelope: { ...envelope, ciphertext: "tampered" }, challenge: signed,
    enrollmentPrivateKeyPem: agentPrivate, trustedSigningPublicKeyPem: publicPem, expectedKeyId: "qa-key" }));
  assert.throws(() => decryptAgentCredentialEnvelope({ envelope, challenge: { ...signed, challenge: { ...challenge, installationId: "other" } },
    enrollmentPrivateKeyPem: agentPrivate, trustedSigningPublicKeyPem: publicPem, expectedKeyId: "qa-key" }));
});
