import type {
  ElectronicBillingTenantConfiguration,
  SafeElectronicBillingConfiguration,
} from "./types";

export const toSafeElectronicBillingConfiguration = (
  configuration: ElectronicBillingTenantConfiguration,
): SafeElectronicBillingConfiguration => ({
  id: configuration.id,
  tenantId: configuration.tenantId,
  providerId: configuration.providerId,
  providerCode: configuration.providerCode,
  providerName: configuration.providerName,
  providerActive: configuration.providerActive,
  environment: configuration.environment,
  enabled: configuration.enabled,
  isDefault: configuration.isDefault,
  configurationStatus: configuration.configurationStatus,
  baseUrlConfigured: configuration.baseUrlConfigured,
  credentialStatus: {
    encryptedConfigured: configuration.credentialStatus.encryptedConfigured,
    legacyReferenceConfigured:
      configuration.credentialStatus.legacyReferenceConfigured,
  },
  settings: {
    factuCoreTenantId: configuration.settings.factuCoreTenantId,
  },
});

export const hasUnsafeCredentialField = (value: unknown) => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const unsafeNames = new Set([
    "apiKey",
    "clientSecret",
    "credentialReference",
    "credential_reference",
    "encryptedCredentials",
    "encrypted_credentials",
    "keyId",
    "key_id",
  ]);

  return Object.keys(value).some((key) => unsafeNames.has(key));
};
