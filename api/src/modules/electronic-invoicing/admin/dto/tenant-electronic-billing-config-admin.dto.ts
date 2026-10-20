export const TENANT_ELECTRONIC_BILLING_ENVIRONMENTS = [
  "TEST",
  "HABILITATION",
  "PRODUCTION",
] as const;

export type TenantElectronicBillingConfigCreateDto = {
  providerId: string;
  environment: (typeof TENANT_ELECTRONIC_BILLING_ENVIRONMENTS)[number];
  baseUrl?: string | null;
  settings?: { factuCoreTenantId?: string | null };
  clientKey: string;
  clientSecret: string;
};

export type TenantElectronicBillingConfigUpdateDto = {
  baseUrl?: string | null;
  settings?: { factuCoreTenantId?: string | null };
  clientKey?: string;
  clientSecret?: string;
};
