export type ElectronicBillingConfigurationStatus =
  | "COMPLETE"
  | "INCOMPLETE"
  | "INCONSISTENT";

export type ElectronicBillingProvider = {
  id: string;
  code: string;
  name: string;
  active: boolean;
  capabilities: unknown;
};

export const ELECTRONIC_BILLING_PROVIDER_CAPABILITIES = [
  "invoice",
  "creditNote",
  "debitNote",
  "retry",
  "pdf",
  "xml",
  "signedXml",
  "asyncStatus",
  "attachmentDownload",
] as const;

export type ElectronicBillingProviderCapability =
  (typeof ELECTRONIC_BILLING_PROVIDER_CAPABILITIES)[number];

export type ElectronicBillingProviderMutation = {
  id: string;
  code: string;
  name: string;
  providerType: "ELECTRONIC_BILLING";
  active: boolean;
  capabilities: Record<ElectronicBillingProviderCapability, boolean>;
  dependencySummary?: {
    enabledTenantConfigurations: number;
    historicalDocuments: number;
  };
  createdAt: string;
  updatedAt: string;
};

export type CreateElectronicBillingProviderInput = {
  code: string;
  name: string;
  providerType: "ELECTRONIC_BILLING";
  capabilities: Record<ElectronicBillingProviderCapability, boolean>;
};

export type UpdateElectronicBillingProviderInput = {
  name: string;
  capabilities: Record<ElectronicBillingProviderCapability, boolean>;
};

export type ElectronicBillingProviderCatalog = {
  providers: ElectronicBillingProvider[];
};

export type ElectronicBillingTenantConfiguration = {
  id: string;
  tenantId: string;
  providerId: string;
  providerCode: string;
  providerName: string;
  providerActive: boolean;
  environment: string;
  enabled: boolean;
  isDefault: boolean;
  configurationStatus: ElectronicBillingConfigurationStatus;
  baseUrlConfigured: boolean;
  credentialStatus: {
    encryptedConfigured: boolean;
    legacyReferenceConfigured: boolean;
  };
  settings: {
    factuCoreTenantId: string | null;
  };
};

export type ElectronicBillingTenantConfigurationResponse = {
  tenantId: string;
  configurations: ElectronicBillingTenantConfiguration[];
};

export type FactuCoreIdentityStatus = "MATCH" | "MISMATCH" | "UNKNOWN" | "UNAVAILABLE";

export type ElectronicBillingFactuCoreContext = {
  apiClientId: string;
  tenantId: string;
  environment: string;
  issuer: {
    identificationTypeCode: string | null;
    identificationNumber: string | null;
    verificationDigit: string | null;
    legalName: string | null;
    tradeName: string | null;
    complete: boolean;
  };
  resolution: {
    configured: boolean;
    status: string | null;
    isDefault: boolean;
    validTo: string | null;
    remaining: number | null;
  };
  dianReadiness: {
    status: "READY" | "NOT_READY" | "UNKNOWN";
    configurationComplete: boolean;
    issuerComplete: boolean;
    resolutionConfigured: boolean;
    configurationEnvironment: string | null;
    failedChecks: string[];
    basis: "CONFIGURATION_ONLY";
  };
};

export type ElectronicBillingFactuCoreContextResponse = {
  tenantId: string;
  identityStatus: FactuCoreIdentityStatus;
  factuCore: ElectronicBillingFactuCoreContext | null;
};

export type ElectronicBillingRuntimeCryptoReadiness = {
  schemaMigration: "READY" | "MISSING" | "UNKNOWN";
  keyringStatus: "READY" | "MISSING" | "INVALID" | "ACTIVE_KEY_MISSING" | "SELF_TEST_FAILED" | "UNKNOWN";
  syntheticSelfTest: "PASS" | "FAIL" | "NOT_RUN";
  historicalDecryptReady: "UNKNOWN";
  operationalOwnership: "APPROVED" | "UNKNOWN";
  recoveryReadiness: "APPROVED" | "UNKNOWN";
  credentialWrites: "ENABLED" | "DISABLED";
  writeReady: boolean;
};

export type SafeElectronicBillingConfiguration = Pick<
  ElectronicBillingTenantConfiguration,
  | "id"
  | "tenantId"
  | "providerId"
  | "providerCode"
  | "providerName"
  | "providerActive"
  | "environment"
  | "enabled"
  | "isDefault"
  | "configurationStatus"
  | "baseUrlConfigured"
> & {
  credentialStatus: {
    encryptedConfigured: boolean;
    legacyReferenceConfigured: boolean;
  };
  settings: {
    factuCoreTenantId: string | null;
  };
};
