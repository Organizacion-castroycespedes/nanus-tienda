export type ElectronicBillingConsumptionStatus =
  | "ACCEPTED"
  | "ALREADY_PROCESSED"
  | "INVALID_EVENT"
  | "TEMPORARY_FAILURE";

export type ElectronicBillingConsumptionResult = {
  status: ElectronicBillingConsumptionStatus;
  eventId: string;
  tenantId: string;
  sourceType: "SALE";
  sourceId: string;
  externalReference: string;
  electronicDocumentId: string | null;
  retryable: boolean;
  message: string | null;
};
