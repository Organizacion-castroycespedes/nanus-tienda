export type ElectronicBillingProcessingStage =
  | "PRE_PROVIDER_CREATE"
  | "PROVIDER_CREATE_INTENT"
  | "PROVIDER_LINKED"
  | "PRE_TRANSMIT"
  | "TRANSMISSION_INTENT"
  | "RECONCILIATION_REQUIRED"
  | "COMPLETED"
  | "UNKNOWN";

export type ProcessingStageTransition = {
  from: ElectronicBillingProcessingStage;
  to: ElectronicBillingProcessingStage;
  trigger: string;
  externalMutation: "NONE" | "PROVIDER_CREATE" | "TRANSMISSION";
  recoveryRule: string;
};

export const PROCESSING_STAGE_TRANSITIONS: readonly ProcessingStageTransition[] = [
  { from: "PRE_PROVIDER_CREATE", to: "PROVIDER_CREATE_INTENT", trigger: "before combined issueInvoice", externalMutation: "NONE", recoveryRule: "reconcile before issueInvoice if recovery starts from intent" },
  { from: "PROVIDER_CREATE_INTENT", to: "PROVIDER_LINKED", trigger: "combined issueInvoice returned provider identity", externalMutation: "PROVIDER_CREATE", recoveryRule: "lookup external reference before repeating combined issueInvoice" },
  { from: "PROVIDER_LINKED", to: "RECONCILIATION_REQUIRED", trigger: "provider identity exists", externalMutation: "NONE", recoveryRule: "reconcile provider status; no separate transmission seam exists" },
  { from: "PRE_TRANSMIT", to: "RECONCILIATION_REQUIRED", trigger: "legacy stage encountered", externalMutation: "NONE", recoveryRule: "reconcile provider status; stage is not produced by normal flow" },
  { from: "TRANSMISSION_INTENT", to: "RECONCILIATION_REQUIRED", trigger: "legacy ambiguous stage encountered", externalMutation: "NONE", recoveryRule: "provider status lookup before any further combined issueInvoice" },
  { from: "RECONCILIATION_REQUIRED", to: "COMPLETED", trigger: "terminal provider result", externalMutation: "NONE", recoveryRule: "terminal canonical status wins" },
  { from: "UNKNOWN", to: "RECONCILIATION_REQUIRED", trigger: "ambiguous historical evidence", externalMutation: "NONE", recoveryRule: "fail closed and require manual review" },
] as const;

export type ElectronicBillingProcessingState = {
  stage: ElectronicBillingProcessingStage;
  updatedAt: string;
};

export const ELECTRONIC_BILLING_PROCESSING_STATE_KEY = "electronicBillingProcessing";

export const buildProcessingState = (
  stage: ElectronicBillingProcessingStage,
  updatedAt = new Date(),
): ElectronicBillingProcessingState => ({
  stage,
  updatedAt: updatedAt.toISOString(),
});
