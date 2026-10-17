export const TENANT_ELECTRONIC_BILLING_ENVIRONMENTS = [
  "TEST",
  "HABILITATION",
  "PRODUCTION",
] as const;

export type TenantElectronicBillingEnvironment =
  (typeof TENANT_ELECTRONIC_BILLING_ENVIRONMENTS)[number];

export type CreateTenantElectronicBillingConfigDto = {
  providerId: string;
  environment: TenantElectronicBillingEnvironment;
  baseUrl?: string | null;
  settings?: { factuCoreTenantId?: string | null };
  clientKey: string;
  clientSecret: string;
};

export type UpdateTenantElectronicBillingConfigDto = {
  baseUrl?: string | null;
  settings?: { factuCoreTenantId?: string | null };
  clientKey?: string;
  clientSecret?: string;
};

export type SafeTenantElectronicBillingWriteResponse = {
  id: string;
  tenantId: string;
  providerId: string;
  environment: TenantElectronicBillingEnvironment;
  enabled: boolean;
  isDefault: boolean;
  credentialConfigured: true;
};
