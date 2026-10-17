import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const VERSION = "v2";
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const DEFAULT_KEY_ID = "default";

export type ElectronicBillingCredentialBinding = {
  tenantId: string;
  providerId: string;
  providerConfigId: string;
};

export type ElectronicBillingCredentialValues = {
  clientKey: string;
  clientSecret: string;
};

type KeyRing = {
  activeKeyId: string;
  keys: Map<string, Buffer>;
};

export type ElectronicBillingEncryptionReadiness = {
  configured: boolean;
  writesEnabled: boolean;
  keyringConfigured: boolean;
  activeKeyConfigured: boolean;
  reason: "READY" | "WRITES_DISABLED" | "KEYRING_MISSING" | "KEYRING_INVALID" | "ACTIVE_KEY_MISSING" | "CRYPTO_SELF_TEST_FAILED";
};

export type ElectronicBillingCredentialRuntimeReadiness = {
  configured: boolean;
  reason: "READY" | "KEYRING_MISSING" | "KEYRING_INVALID" | "ACTIVE_KEY_MISSING" | "CRYPTO_SELF_TEST_FAILED";
};

const requireBinding = (binding: ElectronicBillingCredentialBinding) => {
  if ([binding.tenantId, binding.providerId, binding.providerConfigId].some((value) => !value?.trim())) {
    throw new Error("Electronic billing credential binding is incomplete");
  }
  return JSON.stringify({
    providerConfigId: binding.providerConfigId,
    providerId: binding.providerId,
    tenantId: binding.tenantId,
  });
};

const decodeKey = (value: string) => {
  const trimmed = value.trim();
  const key = /^[0-9a-f]{64}$/i.test(trimmed)
    ? Buffer.from(trimmed, "hex")
    : Buffer.from(trimmed, "base64");
  if (key.length !== 32) {
    throw new Error("Electronic billing encryption keys must be 32 bytes");
  }
  return key;
};

const readKeyRing = (): KeyRing => {
  const encodedKeys = process.env.ELECTRONIC_BILLING_ENCRYPTION_KEYS?.trim();
  const keys = new Map<string, Buffer>();

  if (encodedKeys) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(encodedKeys);
    } catch {
      throw new Error("ELECTRONIC_BILLING_ENCRYPTION_KEYS is invalid");
    }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("ELECTRONIC_BILLING_ENCRYPTION_KEYS is invalid");
    }
    for (const [keyId, value] of Object.entries(parsed)) {
      if (!/^[A-Za-z0-9._-]+$/.test(keyId) || typeof value !== "string") {
        throw new Error("ELECTRONIC_BILLING_ENCRYPTION_KEYS is invalid");
      }
      keys.set(keyId, decodeKey(value));
    }
  } else {
    const legacyKey = process.env.ELECTRONIC_BILLING_ENCRYPTION_KEY?.trim();
    if (!legacyKey) {
      throw new Error("Electronic billing encryption key is not configured");
    }
    keys.set(DEFAULT_KEY_ID, decodeKey(legacyKey));
  }

  const activeKeyId = process.env.ELECTRONIC_BILLING_ENCRYPTION_ACTIVE_KEY_ID?.trim() || DEFAULT_KEY_ID;
  if (!keys.has(activeKeyId)) {
    throw new Error("Electronic billing active encryption key is not configured");
  }
  return { activeKeyId, keys };
};

export const inspectElectronicBillingEncryptionReadiness = (): ElectronicBillingEncryptionReadiness => {
  const writesEnabled = process.env.ELECTRONIC_BILLING_CREDENTIAL_WRITES_ENABLED?.trim().toLowerCase() === "true";
  const encodedKeys = process.env.ELECTRONIC_BILLING_ENCRYPTION_KEYS?.trim();
  const legacyKey = process.env.ELECTRONIC_BILLING_ENCRYPTION_KEY?.trim();
  if (!writesEnabled) {
    return {
      configured: false,
      writesEnabled: false,
      keyringConfigured: Boolean(encodedKeys || legacyKey),
      activeKeyConfigured: false,
      reason: "WRITES_DISABLED",
    };
  }
  if (!encodedKeys && !legacyKey) {
    return {
      configured: false,
      writesEnabled,
      keyringConfigured: false,
      activeKeyConfigured: false,
      reason: "KEYRING_MISSING",
    };
  }
  try {
    readKeyRing();
    const probe = {
      tenantId: "readiness-probe-tenant",
      providerId: "readiness-probe-provider",
      providerConfigId: "readiness-probe-config",
    };
    const ciphertext = encryptElectronicBillingCredentials(
      { clientKey: "readiness-probe-key", clientSecret: "readiness-probe-secret" },
      probe,
    );
    decryptElectronicBillingCredentials(ciphertext, probe);
    return {
      configured: true,
      writesEnabled,
      keyringConfigured: true,
      activeKeyConfigured: true,
      reason: "READY",
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const activeKeyMissing = message.includes("active encryption key");
    const selfTestFailed = !activeKeyMissing && !message.includes("encryption key is not configured")
      && !message.includes("ENCRYPTION_KEYS is invalid")
      && !message.includes("encryption keys must be 32 bytes");
    return {
      configured: false,
      writesEnabled,
      keyringConfigured: true,
      activeKeyConfigured: !activeKeyMissing,
      reason: activeKeyMissing
        ? "ACTIVE_KEY_MISSING"
        : selfTestFailed ? "CRYPTO_SELF_TEST_FAILED" : "KEYRING_INVALID",
    };
  }
};

export const inspectElectronicBillingCredentialRuntimeReadiness = (): ElectronicBillingCredentialRuntimeReadiness => {
  const encodedKeys = process.env.ELECTRONIC_BILLING_ENCRYPTION_KEYS?.trim();
  const legacyKey = process.env.ELECTRONIC_BILLING_ENCRYPTION_KEY?.trim();
  if (!encodedKeys && !legacyKey) {
    return { configured: false, reason: "KEYRING_MISSING" };
  }

  try {
    readKeyRing();
    const binding = {
      tenantId: "runtime-readiness-tenant",
      providerId: "runtime-readiness-provider",
      providerConfigId: "runtime-readiness-config",
    };
    const ciphertext = encryptElectronicBillingCredentials(
      { clientKey: "runtime-readiness-key", clientSecret: "runtime-readiness-secret" },
      binding,
    );
    decryptElectronicBillingCredentials(ciphertext, binding);
    return { configured: true, reason: "READY" };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("active encryption key")) {
      return { configured: false, reason: "ACTIVE_KEY_MISSING" };
    }
    if (message.includes("ENCRYPTION_KEYS is invalid") || message.includes("encryption keys must be 32 bytes")) {
      return { configured: false, reason: "KEYRING_INVALID" };
    }
    return { configured: false, reason: "CRYPTO_SELF_TEST_FAILED" };
  }
};

const decodeBase64Url = (value: string, label: string) => {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) {
    throw new Error(`Electronic billing encrypted credential ${label} is invalid`);
  }
  return Buffer.from(value, "base64url");
};

const validateValues = (value: unknown): ElectronicBillingCredentialValues => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Electronic billing encrypted credential payload is invalid");
  }
  const record = value as Record<string, unknown>;
  if (typeof record.clientKey !== "string" || !record.clientKey.trim()
    || typeof record.clientSecret !== "string" || !record.clientSecret.trim()) {
    throw new Error("Electronic billing encrypted credential payload is incomplete");
  }
  return { clientKey: record.clientKey, clientSecret: record.clientSecret };
};

export const encryptElectronicBillingCredentials = (
  values: ElectronicBillingCredentialValues,
  binding: ElectronicBillingCredentialBinding,
) => {
  const ring = readKeyRing();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, ring.keys.get(ring.activeKeyId)!, iv);
  cipher.setAAD(Buffer.from(requireBinding(binding), "utf8"));
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(validateValues(values)), "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return [
    VERSION,
    ring.activeKeyId,
    iv.toString("base64url"),
    tag.toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(".");
};

export const decryptElectronicBillingCredentials = (
  value: string,
  binding: ElectronicBillingCredentialBinding,
): ElectronicBillingCredentialValues => {
  const ring = readKeyRing();
  const parts = value.trim().split(".");
  if (parts.length !== 5 || parts[0] !== VERSION || !/^[A-Za-z0-9._-]+$/.test(parts[1])) {
    throw new Error("Electronic billing encrypted credential format is unsupported");
  }
  const key = ring.keys.get(parts[1]);
  if (!key) {
    throw new Error("Electronic billing encryption key is unavailable");
  }
  const iv = decodeBase64Url(parts[2], "nonce");
  const tag = decodeBase64Url(parts[3], "tag");
  const ciphertext = decodeBase64Url(parts[4], "ciphertext");
  if (iv.length !== IV_LENGTH || tag.length !== TAG_LENGTH || ciphertext.length === 0) {
    throw new Error("Electronic billing encrypted credential bytes are invalid");
  }

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAAD(Buffer.from(requireBinding(binding), "utf8"));
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
  let parsed: unknown;
  try {
    parsed = JSON.parse(plaintext);
  } catch {
    throw new Error("Electronic billing encrypted credential payload is invalid");
  }
  return validateValues(parsed);
};
