export type ElectronicBillingProcessingStage =
  | "PRE_PROVIDER_CREATE"
  | "PROVIDER_CREATE_INTENT"
  | "PROVIDER_LINKED"
  | "XML_GENERATE_INTENT"
  | "XML_GENERATED"
  | "SIGN_INTENT"
  | "SIGNED"
  | "PRE_TRANSMIT"
  | "TRANSMISSION_INTENT"
  | "TRANSMITTED"
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
  { from: "PROVIDER_LINKED", to: "XML_GENERATE_INTENT", trigger: "before generate-xml", externalMutation: "NONE", recoveryRule: "repeat only when provider document status permits" },
  { from: "XML_GENERATE_INTENT", to: "XML_GENERATED", trigger: "generate-xml returned", externalMutation: "NONE", recoveryRule: "inspect provider document before repeating" },
  { from: "XML_GENERATED", to: "SIGN_INTENT", trigger: "before sign", externalMutation: "NONE", recoveryRule: "repeat only when provider document status permits" },
  { from: "SIGN_INTENT", to: "SIGNED", trigger: "sign returned", externalMutation: "NONE", recoveryRule: "inspect provider document before repeating" },
  { from: "SIGNED", to: "TRANSMISSION_INTENT", trigger: "before transmit", externalMutation: "NONE", recoveryRule: "status/operations lookup before repeating" },
  { from: "TRANSMISSION_INTENT", to: "TRANSMITTED", trigger: "transmit returned", externalMutation: "TRANSMISSION", recoveryRule: "poll status; never blindly repeat" },
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
