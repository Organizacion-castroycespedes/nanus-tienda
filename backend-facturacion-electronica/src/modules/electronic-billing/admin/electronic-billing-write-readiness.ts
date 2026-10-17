export type ElectronicBillingOperationalApproval = {
  operationalOwnership: "APPROVED" | "UNKNOWN";
  recoveryReadiness: "APPROVED" | "UNKNOWN";
};

export type ElectronicBillingOperationalApprovalProvider = {
  getApproval: () => ElectronicBillingOperationalApproval | Promise<ElectronicBillingOperationalApproval>;
};

export type ElectronicBillingWriteReadinessInput = ElectronicBillingOperationalApproval & {
  runtimeEnvironment: string;
  schemaMigration: "READY" | "MISSING" | "UNKNOWN";
  keyringStatus: "READY" | "MISSING" | "INVALID" | "ACTIVE_KEY_MISSING" | "SELF_TEST_FAILED" | "UNKNOWN";
  syntheticSelfTest: "PASS" | "FAIL" | "NOT_RUN";
  credentialWrites: "ENABLED" | "DISABLED";
};

export const ELECTRONIC_BILLING_OPERATIONAL_APPROVAL = Symbol("ELECTRONIC_BILLING_OPERATIONAL_APPROVAL");

/** Default deny. No trusted ownership/recovery evidence source exists yet. */
export class DefaultElectronicBillingOperationalApproval {
  getApproval(): ElectronicBillingOperationalApproval {
    return { operationalOwnership: "UNKNOWN", recoveryReadiness: "UNKNOWN" };
  }
}

export const isElectronicBillingCredentialWriteReady = (
  input: ElectronicBillingWriteReadinessInput,
): boolean => input.runtimeEnvironment.trim().toLowerCase() === "qa"
  ? input.schemaMigration === "READY"
    && input.keyringStatus === "READY"
    && input.syntheticSelfTest === "PASS"
  : input.schemaMigration === "READY"
  && input.keyringStatus === "READY"
  && input.syntheticSelfTest === "PASS"
  && input.credentialWrites === "ENABLED"
  && input.operationalOwnership === "APPROVED"
  && input.recoveryReadiness === "APPROVED";
