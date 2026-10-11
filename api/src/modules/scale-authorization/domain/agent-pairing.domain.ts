import {
  createHash,
  createPublicKey,
  publicEncrypt,
  randomBytes,
  randomUUID,
  createCipheriv,
  sign,
  verify,
  constants,
} from "node:crypto";

export type AgentPairingChallenge = {
  typ: "MANUS_AGENT_PAIRING_V1";
  jti: string;
  audience: string;
  installationId: string;
  terminalDeviceId: string;
  enrollmentKeyFingerprint: string;
  nonce: string;
  pairingCode: string;
  issuedAt: string;
  expiresAt: string;
};

export type SignedAgentPairingChallenge = {
  keyId: string;
  challenge: AgentPairingChallenge;
  signature: string;
};

export type AgentCredentialEnvelope = {
  keyId: string;
  jti: string;
  enrollmentKeyFingerprint: string;
  wrappedKey: string;
  iv: string;
  tag: string;
  ciphertext: string;
  signature: string;
};

const canonical = (value: unknown): Buffer =>
  Buffer.from(JSON.stringify(value), "utf8");

export const publicKeyFingerprint = (pem: string): string => {
  const key = createPublicKey(pem);
  if (key.asymmetricKeyType !== "rsa" || (key.asymmetricKeyDetails?.modulusLength ?? 0) < 3072) {
    throw new Error("AGENT_ENROLLMENT_RSA_KEY_UNSUPPORTED");
  }
  return createHash("sha256").update(key.export({ type: "spki", format: "der" })).digest("hex");
};

export const createSignedAgentPairingChallenge = (input: {
  keyId: string;
  privateKeyPem: string;
  audience: string;
  installationId: string;
  terminalDeviceId: string;
  enrollmentPublicKeyPem: string;
  nonce: string;
  now?: Date;
  ttlMs?: number;
  jti?: string;
  pairingCode?: string;
}): SignedAgentPairingChallenge => {
  if (!input.keyId || !input.audience || !input.installationId || !input.terminalDeviceId
    || !input.nonce || input.nonce.length < 32) throw new Error("AGENT_PAIRING_INPUT_INVALID");
  const now = input.now ?? new Date();
  const expiresAt = new Date(now.getTime() + (input.ttlMs ?? 5 * 60_000));
  const challenge: AgentPairingChallenge = {
    typ: "MANUS_AGENT_PAIRING_V1",
    jti: input.jti ?? randomUUID(),
    audience: input.audience,
    installationId: input.installationId,
    terminalDeviceId: input.terminalDeviceId,
    enrollmentKeyFingerprint: publicKeyFingerprint(input.enrollmentPublicKeyPem),
    nonce: input.nonce,
    pairingCode: input.pairingCode ?? randomBytes(4).readUInt32BE().toString().padStart(10, "0").slice(-10),
    issuedAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
  };
  const signed = canonical(challenge);
  const signature = sign(null, signed, input.privateKeyPem).toString("base64url");
  return { keyId: input.keyId, challenge, signature };
};

export const verifySignedAgentPairingChallenge = (input: {
  signed: SignedAgentPairingChallenge;
  publicKeyPem: string;
  expectedAudience: string;
  expectedInstallationId: string;
  expectedTerminalDeviceId: string;
  expectedEnrollmentKeyFingerprint: string;
  now?: Date;
}): boolean => {
  const { challenge } = input.signed;
  const now = input.now ?? new Date();
  const expiry = Date.parse(challenge.expiresAt);
  const issued = Date.parse(challenge.issuedAt);
  if (challenge.typ !== "MANUS_AGENT_PAIRING_V1" || !challenge.jti
    || challenge.audience !== input.expectedAudience
    || challenge.installationId !== input.expectedInstallationId
    || challenge.terminalDeviceId !== input.expectedTerminalDeviceId
    || challenge.enrollmentKeyFingerprint !== input.expectedEnrollmentKeyFingerprint
    || !Number.isFinite(expiry) || !Number.isFinite(issued) || issued > now.getTime()
    || expiry <= now.getTime() || expiry - issued > 5 * 60_000) return false;
  try {
    return verify(null, canonical(challenge), input.publicKeyPem, Buffer.from(input.signed.signature, "base64url"));
  } catch {
    return false;
  }
};

export const createAgentCredentialEnvelope = (input: {
  keyId: string;
  privateKeyPem: string;
  challenge: AgentPairingChallenge;
  enrollmentPublicKeyPem: string;
  credentialSecret: string;
  credentialExpiresAt: string;
}): AgentCredentialEnvelope => {
  if (publicKeyFingerprint(input.enrollmentPublicKeyPem) !== input.challenge.enrollmentKeyFingerprint) {
    throw new Error("AGENT_ENROLLMENT_KEY_MISMATCH");
  }
  const contentKey = randomBytes(32);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", contentKey, iv);
  const plaintext = Buffer.from(JSON.stringify({
    jti: input.challenge.jti,
    nonce: input.challenge.nonce,
    installationId: input.challenge.installationId,
    terminalDeviceId: input.challenge.terminalDeviceId,
    enrollmentKeyFingerprint: input.challenge.enrollmentKeyFingerprint,
    audience: input.challenge.audience,
    challengeExpiresAt: input.challenge.expiresAt,
    credentialExpiresAt: input.credentialExpiresAt,
    credentialId: input.challenge.jti,
    secret: input.credentialSecret,
  }), "utf8");
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]).toString("base64url");
  const wrappedKey = publicEncrypt({
    key: input.enrollmentPublicKeyPem,
    padding: constants.RSA_PKCS1_OAEP_PADDING,
    oaepHash: "sha256",
  }, contentKey).toString("base64url");
  const tag = cipher.getAuthTag().toString("base64url");
  const body = { keyId: input.keyId, jti: input.challenge.jti,
    enrollmentKeyFingerprint: input.challenge.enrollmentKeyFingerprint,
    wrappedKey, iv: iv.toString("base64url"), tag, ciphertext };
  return { ...body, signature: sign(null, canonical(body), input.privateKeyPem).toString("base64url") };
};

export const verifyAgentCredentialEnvelope = (input: {
  envelope: AgentCredentialEnvelope;
  publicKeyPem: string;
  expectedKeyId: string;
  expectedJti: string;
  expectedFingerprint: string;
}): boolean => {
  const { envelope } = input;
  if (envelope.keyId !== input.expectedKeyId || envelope.jti !== input.expectedJti
    || envelope.enrollmentKeyFingerprint !== input.expectedFingerprint) return false;
  const { signature, ...body } = envelope;
  try { return verify(null, canonical(body), input.publicKeyPem, Buffer.from(signature, "base64url")); }
  catch { return false; }
};
