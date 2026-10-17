export const ELECTRONIC_BILLING_PROVIDER_TYPE = "ELECTRONIC_BILLING" as const;

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

export type ElectronicBillingProviderCapabilitiesDto = Record<
  ElectronicBillingProviderCapability,
  boolean
>;

export type CreateElectronicBillingProviderDto = {
  code: string;
  name: string;
  providerType: typeof ELECTRONIC_BILLING_PROVIDER_TYPE;
  capabilities: ElectronicBillingProviderCapabilitiesDto;
};

export type UpdateElectronicBillingProviderMetadataDto = {
  name?: string;
  capabilities?: ElectronicBillingProviderCapabilitiesDto;
};

export type UpdateElectronicBillingProviderStatusDto = {
  active: boolean;
};

export type ElectronicBillingProviderDependencySummaryDto = {
  enabledTenantConfigurations: number;
  historicalDocuments: number;
};

export type ElectronicBillingProviderAdminResponseDto = {
  id: string;
  code: string;
  name: string;
  providerType: typeof ELECTRONIC_BILLING_PROVIDER_TYPE;
  active: boolean;
  capabilities: ElectronicBillingProviderCapabilitiesDto;
  dependencySummary?: ElectronicBillingProviderDependencySummaryDto;
  createdAt: string;
  updatedAt: string;
};
