import {
  ELECTRONIC_BILLING_PROVIDER_CAPABILITIES,
  type ElectronicBillingProviderCapability,
} from "./types";

export const normalizeProviderCode = (value: string) => value.trim().toUpperCase();

export const isSafeProviderPayload = (value: unknown) => {
  if (!value || typeof value !== "object") return false;
  const forbidden = new Set([
    "apiKey",
    "clientSecret",
    "credentialReference",
    "credential_reference",
    "encryptedCredentials",
    "encrypted_credentials",
    "keyId",
    "key_id",
    "baseUrl",
    "headers",
  ]);
  return !Object.keys(value).some((key) => forbidden.has(key));
};
export const safeCapabilityKeys = (value: unknown): ElectronicBillingProviderCapability[] => {
  if (!value || typeof value !== "object") return [];
  return ELECTRONIC_BILLING_PROVIDER_CAPABILITIES.filter(
    (key) => (value as Record<string, unknown>)[key] === true,
  );
};
