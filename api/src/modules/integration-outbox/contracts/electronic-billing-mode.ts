export type ElectronicBillingMode = "AUTOMATIC" | "ON_DEMAND";

export type ElectronicBillingPolicy = {
  enabled: boolean;
  mode: ElectronicBillingMode;
};

/**
 * Backend-owned tenant policy. Missing keys preserve the historical behavior:
 * electronic billing is enabled and requested automatically.
 */
export const resolveElectronicBillingPolicy = (config: unknown): ElectronicBillingPolicy => {
  const value = config && typeof config === "object" ? config as Record<string, unknown> : {};
  return {
    enabled: value.electronicBillingEnabled !== false,
    mode: value.electronicBillingMode === "ON_DEMAND" ? "ON_DEMAND" : "AUTOMATIC",
  };
};

export const getElectronicBillingMode = (): ElectronicBillingMode =>
  process.env.ELECTRONIC_BILLING_MODE?.trim().toUpperCase() === "ON_DEMAND"
    ? "ON_DEMAND"
    : "AUTOMATIC";

export type ElectronicBillingEligibility =
  | "ELIGIBLE"
  | "NO_CUSTOMER"
  | "INVALID_SALE_STATE"
  | "CANCELLED"
  | "ALREADY_REQUESTED"
  | "ALREADY_ACCEPTED"
  | "PROCESSING"
  | "REJECTED"
  | "INCOMPLETE_CUSTOMER_FISCAL_DATA"
  | "AMBIGUOUS_DOCUMENT";
