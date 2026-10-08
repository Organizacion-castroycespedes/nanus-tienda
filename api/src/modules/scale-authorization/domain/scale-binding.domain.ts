export type ScaleBindingStatus = "PENDING" | "AUTHORIZED" | "REVOKED" | "DISABLED";
export type ScaleUnitState = "NOT_VERIFIED" | "KG_VERIFIED";

export type ScaleBindingContext = {
  tenantId: string;
  branchId: string;
  posTerminalId: string;
  operationalTerminalId: string;
  terminalDeviceId: string;
  logicalScaleId: string;
};

export type ScaleBinding = ScaleBindingContext & {
  id: string;
  status: ScaleBindingStatus;
  unitState: ScaleUnitState;
  unitVerification?: { method: "OPERATOR_CONFIRMATION"; unit: "kg"; operatorId: string; verifiedAt: string };
};

export type KgOperatorConfirmation = {
  method: "OPERATOR_CONFIRMATION";
  displayedUnit: "kg";
  operatorId: string;
  confirmedAt: string;
};

export const bindingContextMatches = (actual: ScaleBindingContext, expected: ScaleBindingContext): boolean =>
  (Object.keys(expected) as Array<keyof ScaleBindingContext>).every(
    (key) => Boolean(expected[key]) && actual[key] === expected[key]
  );

export const authorizeScaleBinding = (
  binding: ScaleBinding,
  confirmation: KgOperatorConfirmation | null,
  expectedContext: ScaleBindingContext,
  now = new Date()
): ScaleBinding => {
  if (!bindingContextMatches(binding, expectedContext)) throw new Error("SCALE_BINDING_CONTEXT_MISMATCH");
  if (binding.status !== "PENDING") throw new Error("SCALE_BINDING_NOT_PENDING");
  const confirmedAt = confirmation ? Date.parse(confirmation.confirmedAt) : NaN;
  if (!confirmation || confirmation.displayedUnit !== "kg" || !confirmation.operatorId || !Number.isFinite(confirmedAt) || confirmedAt > now.getTime()) {
    throw new Error("KG_OPERATOR_CONFIRMATION_REQUIRED");
  }
  const unitVerification = {
    method: confirmation.method,
    unit: confirmation.displayedUnit,
    operatorId: confirmation.operatorId,
    verifiedAt: confirmation.confirmedAt,
  } as const;
  return { ...binding, unitState: "KG_VERIFIED", unitVerification, status: "AUTHORIZED" };
};

export const revokeScaleBinding = (binding: ScaleBinding): ScaleBinding => ({ ...binding, status: "REVOKED" });

export const disableScaleBinding = (binding: ScaleBinding): ScaleBinding => ({ ...binding, status: "DISABLED" });

export const assertBindingInvariant = (binding: ScaleBinding): void => {
  if (binding.status === "AUTHORIZED" && (binding.unitState !== "KG_VERIFIED" || !binding.unitVerification)) {
    throw new Error("AUTHORIZED_BINDING_REQUIRES_KG_VERIFIED");
  }
  if (binding.unitState === "KG_VERIFIED" && (!binding.unitVerification || binding.unitVerification.unit !== "kg")) {
    throw new Error("KG_VERIFIED_REQUIRES_OPERATOR_EVIDENCE");
  }
};
