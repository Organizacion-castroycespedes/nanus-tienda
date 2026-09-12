import type { ElectronicBillingEligibility } from "./electronic-billing-mode";

export type ElectronicBillingEligibilityInput = {
  saleStatus: string;
  paymentStatus: string;
  customerId: string | null;
  documentStatuses: string[];
  requestExists: boolean;
};

export const evaluateElectronicBillingEligibility = (
  input: ElectronicBillingEligibilityInput,
): ElectronicBillingEligibility => {
  if (input.saleStatus === "CANCELLED" || input.saleStatus === "REFUNDED") {
    return "CANCELLED";
  }
  if (input.saleStatus !== "CONFIRMED" || !["PAID", "OVERPAID"].includes(input.paymentStatus)) {
    return "INVALID_SALE_STATE";
  }
  if (!input.customerId) {
    return "NO_CUSTOMER";
  }
  if (input.documentStatuses.length > 1) {
    return "AMBIGUOUS_DOCUMENT";
  }
  const status = input.documentStatuses[0];
  if (status === "ACCEPTED") {
    return "ALREADY_ACCEPTED";
  }
  if (status === "PENDING" || status === "PROCESSING") {
    return status === "PROCESSING" ? "PROCESSING" : "ALREADY_REQUESTED";
  }
  if (status === "REJECTED") {
    return "REJECTED";
  }
  if (input.requestExists) {
    return "ALREADY_REQUESTED";
  }
  return "ELIGIBLE";
};
