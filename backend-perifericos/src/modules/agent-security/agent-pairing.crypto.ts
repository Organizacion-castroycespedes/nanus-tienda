import {
  createDecipheriv, createHash, createPrivateKey, createPublicKey,
  privateDecrypt, verify, constants,
} from "node:crypto";

export type AgentCredentialEnvelope = {
  keyId: string; jti: string; enrollmentKeyFingerprint: string;
  wrappedKey: string; iv: string; tag: string; ciphertext: string; signature: string;
};

export type AgentSignedChallenge = {
  keyId: string;
  challenge: {
    typ: "MANUS_AGENT_PAIRING_V1"; jti: string; audience: string; installationId: string;
    terminalDeviceId: string; enrollmentKeyFingerprint: string; nonce: string; pairingCode: string;
    issuedAt: string; expiresAt: string;
  };
  signature: string;
};

const canonical = (value: unknown) => Buffer.from(JSON.stringify(value), "utf8");

export const enrollmentKeyFingerprint = (publicKeyPem: string) => createHash("sha256")
  .update(createPublicKey(publicKeyPem).export({ type: "spki", format: "der" })).digest("hex");

export const verifyAgentSignedChallenge = (input: {
  signed: AgentSignedChallenge; trustedSigningPublicKeyPem: string; expectedKeyId: string;
  expectedAudience: string; expectedInstallationId: string; enrollmentPublicKeyPem: string; now?: Date;
}): boolean => {
  try {
    const key = createPublicKey(input.trustedSigningPublicKeyPem);
    const { challenge } = input.signed;
    const now = input.now ?? new Date();
    const expires = Date.parse(challenge.expiresAt);
    const issued = Date.parse(challenge.issuedAt);
    return key.asymmetricKeyType === "ed25519"
      && input.signed.keyId === input.expectedKeyId
      && challenge.typ === "MANUS_AGENT_PAIRING_V1"
      && challenge.audience === input.expectedAudience
      && challenge.installationId === input.expectedInstallationId
      && challenge.enrollmentKeyFingerprint === enrollmentKeyFingerprint(input.enrollmentPublicKeyPem)
      && /^[A-Za-z0-9_-]{32,128}$/.test(challenge.nonce)
      && Number.isFinite(issued) && issued <= now.getTime()
      && Number.isFinite(expires) && expires > now.getTime() && expires - issued <= 5 * 60_000
      && verify(null, canonical(challenge), key, Buffer.from(input.signed.signature, "base64url"));
  } catch { return false; }
};

export const decryptAgentCredentialEnvelope = (input: {
  envelope: AgentCredentialEnvelope; challenge: AgentSignedChallenge;
  enrollmentPrivateKeyPem: string; trustedSigningPublicKeyPem: string; expectedKeyId: string;
}): { credentialId: string; secret: Buffer; expiresAt: string } => {
  const envelope = input.envelope;
  const body = { keyId: envelope.keyId, jti: envelope.jti,
    enrollmentKeyFingerprint: envelope.enrollmentKeyFingerprint, wrappedKey: envelope.wrappedKey,
    iv: envelope.iv, tag: envelope.tag, ciphertext: envelope.ciphertext };
  const { challenge } = input.challenge;
  const signed = verify(null, canonical(body), createPublicKey(input.trustedSigningPublicKeyPem), Buffer.from(envelope.signature, "base64url"));
  if (!signed || envelope.keyId !== input.expectedKeyId || envelope.jti !== challenge.jti
    || envelope.enrollmentKeyFingerprint !== challenge.enrollmentKeyFingerprint
    || Date.parse(challenge.expiresAt) <= Date.now()) throw new Error("AGENT_ENVELOPE_NOT_TRUSTED");
  const privateKey = createPrivateKey(input.enrollmentPrivateKeyPem);
  const contentKey = privateDecrypt({ key: privateKey, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: "sha256" }, Buffer.from(envelope.wrappedKey, "base64url"));
  const decipher = createDecipheriv("aes-256-gcm", contentKey, Buffer.from(envelope.iv, "base64url"));
  decipher.setAuthTag(Buffer.from(envelope.tag, "base64url"));
  const plaintext = Buffer.concat([decipher.update(Buffer.from(envelope.ciphertext, "base64url")), decipher.final()]);
  contentKey.fill(0);
  let payload: Record<string, unknown>;
  try { payload = JSON.parse(plaintext.toString("utf8")) as Record<string, unknown>; }
  finally { plaintext.fill(0); }
  const valid = payload.jti === challenge.jti && payload.nonce === challenge.nonce
    && payload.installationId === challenge.installationId && payload.terminalDeviceId === challenge.terminalDeviceId
    && payload.enrollmentKeyFingerprint === challenge.enrollmentKeyFingerprint && payload.audience === challenge.audience
    && payload.challengeExpiresAt === challenge.expiresAt
    && payload.credentialId === challenge.jti && typeof payload.credentialExpiresAt === "string"
    && Number.isFinite(Date.parse(payload.credentialExpiresAt as string))
    && Date.parse(payload.credentialExpiresAt as string) > Date.now()
    && typeof payload.secret === "string"
    && /^[A-Za-z0-9_-]{32,128}$/.test(payload.secret);
  if (!valid) throw new Error("AGENT_ENVELOPE_CONTEXT_MISMATCH");
  return { credentialId: challenge.jti, secret: Buffer.from(payload.secret as string, "utf8"), expiresAt: payload.credentialExpiresAt as string };
};
