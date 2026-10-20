import assert from "node:assert/strict";
import test from "node:test";
import {
  issueOpaqueAgentCredential,
  verifyOpaqueAgentCredential,
} from "./agent-credential.domain";

test("issues an opaque secret once and validates only its verifier", () => {
  const issued = issueOpaqueAgentCredential();
  assert.equal(Buffer.from(issued.secret, "base64url").length, 32);
  assert.equal(verifyOpaqueAgentCredential(issued.secret, {
    verifierSha256: issued.verifierSha256,
    expiresAt: "2030-01-01T00:00:00.000Z",
  }, new Date("2029-01-01T00:00:00.000Z")), "VALID");
  assert.equal(verifyOpaqueAgentCredential("wrong", {
    verifierSha256: issued.verifierSha256,
    expiresAt: "2030-01-01T00:00:00.000Z",
  }, new Date("2029-01-01T00:00:00.000Z")), "INVALID");
});

test("credential expiry and revocation fail closed", () => {
  const credential = { verifierSha256: "0".repeat(64), expiresAt: "2025-01-01T00:00:00.000Z" };
  assert.equal(verifyOpaqueAgentCredential("secret", credential, new Date("2026-01-01T00:00:00Z")), "EXPIRED");
  assert.equal(verifyOpaqueAgentCredential("secret", { ...credential, revokedAt: "2024-01-01T00:00:00Z" }, new Date("2024-06-01T00:00:00Z")), "REVOKED");
});
