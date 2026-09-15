export type ElectronicBillingMode = "AUTOMATIC" | "ON_DEMAND";

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
