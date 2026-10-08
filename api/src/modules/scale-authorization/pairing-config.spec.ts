import assert from "node:assert/strict";
import test from "node:test";
import { generateKeyPairSync } from "node:crypto";
import { readPairingSigningConfig } from "./pairing-config";

test("API pairing signer accepts a configured Ed25519 private key only", () => {
  const pair = generateKeyPairSync("ed25519");
  const privateKeyPem = pair.privateKey.export({ type: "pkcs8", format: "pem" }).toString();
  assert.deepEqual(readPairingSigningConfig({
    AGENT_ENROLLMENT_SIGNING_KEY_ID: "qa-fixture-key",
    AGENT_ENROLLMENT_SIGNING_PRIVATE_KEY_PEM: privateKeyPem,
    AGENT_ENROLLMENT_AUDIENCE: "manus-agent:qa",
  } as NodeJS.ProcessEnv), { keyId: "qa-fixture-key", privateKeyPem, audience: "manus-agent:qa" });
  assert.throws(() => readPairingSigningConfig({} as NodeJS.ProcessEnv), /AGENT_PAIRING_SIGNING_NOT_CONFIGURED/);
});

test("API refuses a non-Ed25519 enrollment signing key", () => {
  const pair = generateKeyPairSync("rsa", { modulusLength: 2048 });
  assert.throws(() => readPairingSigningConfig({
    AGENT_ENROLLMENT_SIGNING_KEY_ID: "qa-fixture-key",
    AGENT_ENROLLMENT_SIGNING_PRIVATE_KEY_PEM: pair.privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
    AGENT_ENROLLMENT_AUDIENCE: "manus-agent:qa",
  } as NodeJS.ProcessEnv), /AGENT_PAIRING_SIGNING_KEY_MUST_BE_ED25519/);
});
