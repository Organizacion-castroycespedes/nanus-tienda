import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import test from "node:test";
import {
  createAgentCredentialEnvelope,
  createSignedAgentPairingChallenge,
  publicKeyFingerprint,
  verifyAgentCredentialEnvelope,
  verifySignedAgentPairingChallenge,
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
