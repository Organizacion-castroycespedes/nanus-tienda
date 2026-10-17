import type { SafeElectronicBillingConfiguration } from "./types";

export const ELECTRONIC_BILLING_ENVIRONMENTS = [
  "TEST",
  "HABILITATION",
  "PRODUCTION",
] as const;

export type TenantElectronicBillingDraft = {
  providerId: string;
  environment: (typeof ELECTRONIC_BILLING_ENVIRONMENTS)[number];
  baseUrl: string;
  factuCoreTenantId: string;
  clientKey: string;
  clientSecret: string;
};

export const emptyTenantElectronicBillingDraft = (): TenantElectronicBillingDraft => ({
  providerId: "",
  environment: "TEST",
  baseUrl: "",
  factuCoreTenantId: "",
  clientKey: "",
  clientSecret: "",
});

export const draftFromConfiguration = (
  configuration: SafeElectronicBillingConfiguration | undefined,
): TenantElectronicBillingDraft => ({
  ...emptyTenantElectronicBillingDraft(),
  providerId: configuration?.providerId ?? "",
  environment: (ELECTRONIC_BILLING_ENVIRONMENTS.includes(
    configuration?.environment as (typeof ELECTRONIC_BILLING_ENVIRONMENTS)[number],
  )
    ? configuration?.environment
    : "TEST") as TenantElectronicBillingDraft["environment"],
  factuCoreTenantId: configuration?.settings.factuCoreTenantId ?? "",
});

export const validateTenantElectronicBillingDraft = (
  draft: TenantElectronicBillingDraft,
  options: { requireCredentials?: boolean } = {},
) => {
  const errors: string[] = [];
  if (!draft.providerId.trim()) errors.push("Selecciona un proveedor.");
  if (!ELECTRONIC_BILLING_ENVIRONMENTS.includes(draft.environment)) {
    errors.push("Selecciona un ambiente válido.");
  }
  if (draft.baseUrl.trim()) {
    try {
      const url = new URL(draft.baseUrl.trim());
      if (url.protocol !== "https:" && url.protocol !== "http:") {
        errors.push("La URL base debe usar HTTP o HTTPS.");
      }
    } catch {
      errors.push("La URL base no es válida.");
    }
  }
  if (!draft.factuCoreTenantId.trim()) {
    errors.push("El tenant FactuCore es obligatorio para validar identidad.");
  }
  const hasClientKey = Boolean(draft.clientKey.trim());
  const hasClientSecret = Boolean(draft.clientSecret.trim());
  if (hasClientKey !== hasClientSecret) {
    errors.push("La nueva credencial debe incluir key y secret.");
  }
  if (options.requireCredentials && (!hasClientKey || !hasClientSecret)) {
    errors.push("La configuración inicial requiere key y secret.");
  }
  return errors;
};
