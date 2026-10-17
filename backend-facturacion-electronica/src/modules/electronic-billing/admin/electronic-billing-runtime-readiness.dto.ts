export type ElectronicBillingRuntimeKeyringStatus =
  | "READY"
  | "MISSING"
  | "INVALID"
  | "ACTIVE_KEY_MISSING"
  | "SELF_TEST_FAILED"
  | "UNKNOWN";

export type ElectronicBillingRuntimeCryptoReadinessDto = {
  schemaMigration: "READY" | "MISSING" | "UNKNOWN";
  keyringStatus: ElectronicBillingRuntimeKeyringStatus;
  syntheticSelfTest: "PASS" | "FAIL" | "NOT_RUN";
  historicalDecryptReady: "UNKNOWN";
  operationalOwnership: "APPROVED" | "UNKNOWN";
  recoveryReadiness: "APPROVED" | "UNKNOWN";
  credentialWrites: "ENABLED" | "DISABLED";
  writeReady: boolean;
};
