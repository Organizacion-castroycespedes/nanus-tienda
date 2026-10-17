import type { ElectronicBillingProviderCapabilities } from "../domain/electronic-billing.types";

export const ELECTRONIC_BILLING_PROVIDER_TYPE = "ELECTRONIC_BILLING" as const;

export type CreateElectronicBillingProviderDto = {
  code: string;
  name: string;
  providerType: typeof ELECTRONIC_BILLING_PROVIDER_TYPE;
  capabilities: ElectronicBillingProviderCapabilities;
};

export type UpdateElectronicBillingProviderMetadataDto = {
  name?: string;
  capabilities?: ElectronicBillingProviderCapabilities;
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
  capabilities: ElectronicBillingProviderCapabilities;
  dependencySummary?: ElectronicBillingProviderDependencySummaryDto;
  createdAt: string;
  updatedAt: string;
};
