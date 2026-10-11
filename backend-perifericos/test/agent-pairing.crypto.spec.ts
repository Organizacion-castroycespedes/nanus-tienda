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

test("Agent accepts only the pinned Ed25519 signature and bound identity", () => {
  const input = { signed, trustedSigningPublicKeyPem: publicPem, expectedKeyId: "qa-key",
    expectedAudience: "manus-agent:qa", expectedInstallationId: "installation", enrollmentPublicKeyPem: agentPublic, now };
  assert.equal(verifyAgentSignedChallenge(input), true);
  assert.equal(verifyAgentSignedChallenge({ ...input, trustedSigningPublicKeyPem: agentPublic }), false);
  assert.equal(verifyAgentSignedChallenge({ ...input, expectedInstallationId: "other" }), false);
  assert.equal(verifyAgentSignedChallenge({ ...input, expectedAudience: "manus-agent:prod" }), false);
  assert.equal(verifyAgentSignedChallenge({ ...input, signed: { ...signed, challenge: { ...challenge, nonce: "tampered" } } }), false);
  assert.equal(verifyAgentSignedChallenge({ ...input, now: new Date(now.getTime()+301000) }), false);
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
