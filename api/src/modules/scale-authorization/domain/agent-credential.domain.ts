import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export type AgentCredentialState = {
  verifierSha256: string;
  expiresAt: string;
  revokedAt?: string | null;
};

export type AgentCredentialStatus = "VALID" | "EXPIRED" | "REVOKED" | "INVALID";

export const issueOpaqueAgentCredential = (): {
  secret: string;
  verifierSha256: string;
} => {
  const secret = randomBytes(32).toString("base64url");
  return { secret, verifierSha256: verifierFor(secret) };
};

export const verifierFor = (secret: string): string =>
  createHash("sha256").update(secret, "utf8").digest("hex");

export const verifyOpaqueAgentCredential = (
  secret: string,
  credential: AgentCredentialState,
  now: Date = new Date()
): AgentCredentialStatus => {
  if (!secret || !credential.verifierSha256 || !Number.isFinite(Date.parse(credential.expiresAt))) {
    return "INVALID";
  }
  if (credential.revokedAt) return "REVOKED";
  if (Date.parse(credential.expiresAt) <= now.getTime()) return "EXPIRED";

  const supplied = Buffer.from(verifierFor(secret), "hex");
  const stored = Buffer.from(credential.verifierSha256, "hex");
  if (supplied.length !== stored.length || !timingSafeEqual(supplied, stored)) return "INVALID";
  return "VALID";
};
