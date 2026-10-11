import { createPrivateKey } from "node:crypto";

export type PairingSigningConfig = {
  keyId: string;
  privateKeyPem: string;
  audience: string;
};

export const readPairingSigningConfig = (
  environment: NodeJS.ProcessEnv = process.env,
): PairingSigningConfig => {
  const keyId = environment.AGENT_ENROLLMENT_SIGNING_KEY_ID?.trim();
  const privateKeyPem = environment.AGENT_ENROLLMENT_SIGNING_PRIVATE_KEY_PEM?.replace(/\\n/g, "\n");
  const audience = environment.AGENT_ENROLLMENT_AUDIENCE?.trim();
  if (!keyId || !privateKeyPem || !audience) throw new Error("AGENT_PAIRING_SIGNING_NOT_CONFIGURED");
  const key = createPrivateKey(privateKeyPem);
  if (key.asymmetricKeyType !== "ed25519") throw new Error("AGENT_PAIRING_SIGNING_KEY_MUST_BE_ED25519");
  return { keyId, privateKeyPem, audience };
};
