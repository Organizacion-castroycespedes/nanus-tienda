import type { AgentPairingStatus, ScaleAuthorizationSnapshot } from "./scale-authorization.api";

export const KG_CONFIRMATION_EVIDENCE_MAX_AGE_MS = 15_000;

export type KgConfirmationEvidence = {
  weight: number;
  unit: string | null;
  source: string;
  unitVerified: boolean;
  stable: boolean | null;
  stabilityVerified: boolean;
  observedAt: string;
  bindingId: string;
  installationId: string;
  branchId: string;
  terminalId: string;
  profileId: string;
  posTerminalId: string;
  operationalTerminalId: string;
  logicalScaleId: string;
};

export const isCurrentKgConfirmationEvidence = (input: {
  evidence: KgConfirmationEvidence | null;
  snapshot: ScaleAuthorizationSnapshot | null;
  localAgent: AgentPairingStatus | null;
  configuredScaleId: string | null;
  expectedPosTerminalId?: string | null;
  expectedOperationalTerminalId?: string | null;
  expectedBranchId?: string | null;
  configuredDevice: { id: string; type: string; connectionType: string; terminalId: string; profileId?: string;
    metadata?: Record<string, unknown> } | null;
  now?: Date;
}) => {
  const evidence = input.evidence;
  const snapshot = input.snapshot;
  const binding = snapshot?.binding;
  const device = input.configuredDevice;
  if (!evidence || !snapshot || !binding || !snapshot.agent.authenticated
    || !input.localAgent?.enrolled || !device) return false;
  const observedAt = Date.parse(evidence.observedAt);
  const age = (input.now ?? new Date()).getTime() - observedAt;
  const validUnitEvidence = evidence.unit === null && evidence.unitVerified === false;
  return evidence.source === "REAL"
    && Number.isFinite(evidence.weight)
    && validUnitEvidence
    && Number.isFinite(observedAt)
    && age >= 0 && age <= KG_CONFIRMATION_EVIDENCE_MAX_AGE_MS
    && evidence.installationId.length > 0
    && evidence.bindingId === binding.id
    && evidence.installationId === snapshot.agent.installationId
    && evidence.installationId === input.localAgent.installationId
    && evidence.terminalId === "local-terminal"
    && evidence.profileId === "ROCHI_A01E"
    && evidence.posTerminalId === snapshot.posTerminalId
    && (!input.expectedPosTerminalId || evidence.posTerminalId === input.expectedPosTerminalId)
    && evidence.branchId === snapshot.branchId
    && (!input.expectedBranchId || evidence.branchId === input.expectedBranchId)
    && evidence.operationalTerminalId === snapshot.operationalTerminalId
    && (!input.expectedOperationalTerminalId || evidence.operationalTerminalId === input.expectedOperationalTerminalId)
    && evidence.logicalScaleId === snapshot.scaleDeviceId
    && evidence.logicalScaleId === input.configuredScaleId
    && evidence.logicalScaleId === binding.logicalScaleId
    && device.id === evidence.logicalScaleId
    && device.type === "SCALE"
    && device.connectionType === "SERIAL"
    && device.profileId === "ROCHI_A01E"
    && device.terminalId === "local-terminal"
    && device.metadata?.configured === true
    && binding.status === "PENDING"
    && binding.unitState === "NOT_VERIFIED";
};

export const buildAgentUnitVerificationFromConfirmedBinding = (
  binding: ScaleAuthorizationSnapshot["binding"] | {
    status: string; unit_state: string; unitVerification?: {
      method: string; unit: string; operatorId: string; verifiedAt: string;
    };
  } | null,
) => {
  const unitState = binding && "unitState" in binding ? binding.unitState
    : binding && "unit_state" in binding ? binding.unit_state : null;
  const verification = binding && "unitVerification" in binding ? binding.unitVerification
    : binding && "verificationMethod" in binding ? {
      method: binding.verificationMethod ?? "", unit: binding.unit ?? "",
      operatorId: binding.verifiedBy ?? "", verifiedAt: binding.verifiedAt ?? "",
    } : null;
  return binding?.status === "AUTHORIZED" && unitState === "KG_VERIFIED"
    && verification?.method === "OPERATOR_CONFIRMATION" && verification.unit === "kg"
    && Boolean(verification.operatorId && verification.verifiedAt && Number.isFinite(Date.parse(verification.verifiedAt)))
    ? { unit: "KG" as const, method: "OPERATOR_CONFIRMATION" as const, verifiedAt: verification.verifiedAt }
    : null;
};

export const buildAgentMetadataAfterBackendKgConfirmation = (
  metadata: Record<string, unknown> | undefined,
  binding: Parameters<typeof buildAgentUnitVerificationFromConfirmedBinding>[0],
) => {
  const unitVerification = buildAgentUnitVerificationFromConfirmedBinding(binding);
  return unitVerification ? { ...(metadata ?? {}), unitVerification } : null;
};

export const loadScaleAuthorizationRefresh = async <TAgent, TSnapshot, TDevices>(loaders: {
  agent: () => Promise<TAgent>;
  snapshot: () => Promise<TSnapshot>;
  devices: () => Promise<TDevices>;
}) => {
  const [agent, snapshot, devices] = await Promise.allSettled([
    loaders.agent(), loaders.snapshot(), loaders.devices(),
  ] as const);
  return { agent, snapshot, devices };
};

export type AuthorizationTestResult = {
  available: boolean;
  reason: string;
  reading?: { source: string | null; unit: string | null; unitVerified: boolean; observedAt: string | null };
};

export const deriveScaleAuthorizationUiState = (input: {
  snapshot: ScaleAuthorizationSnapshot | null;
  localAgent: AgentPairingStatus | null;
  testResult: AuthorizationTestResult | null;
  configuredScaleId: string | null;
  hasCurrentKgConfirmationEvidence?: boolean;
  now?: Date;
}) => {
  const snapshot = input.snapshot;
  const binding = snapshot?.binding ?? null;
  const agentAuthenticated = Boolean(snapshot?.agent.authenticated && input.localAgent?.enrolled);
  const matchingScale = Boolean(snapshot?.scaleDeviceId && snapshot.scaleDeviceId === input.configuredScaleId
    && (!binding || binding.logicalScaleId === snapshot.scaleDeviceId));
  const observedAt = Date.parse(input.testResult?.reading?.observedAt ?? "");
  const age = (input.now ?? new Date()).getTime() - observedAt;
  const freshRealKgRead = Boolean(input.testResult?.available && input.testResult.reading?.source === "REAL"
    && input.testResult.reading.unit === "kg" && input.testResult.reading.unitVerified
    && Number.isFinite(observedAt) && age >= 0 && age <= 15_000);
  const authorized = binding?.status === "AUTHORIZED" && binding.unitState === "KG_VERIFIED";
  return {
    agentAuthenticated,
    matchingScale,
    authorized,
    realAvailable: Boolean(snapshot && agentAuthenticated && matchingScale && authorized && freshRealKgRead),
    canCreateBinding: Boolean(snapshot?.posTerminalId && snapshot.scaleDeviceId && agentAuthenticated && matchingScale
      && (!binding || !["PENDING", "AUTHORIZED"].includes(binding.status))),
    canConfirmKg: Boolean(binding?.status === "PENDING" && agentAuthenticated && matchingScale
      && input.hasCurrentKgConfirmationEvidence),
    canTestReal: Boolean(authorized && agentAuthenticated && matchingScale),
    reason: !snapshot ? "AUTHORIZATION_STATE_UNAVAILABLE"
      : !agentAuthenticated ? "AGENT_NOT_AUTHENTICATED"
        : !matchingScale ? "SCALE_MISMATCH"
          : !authorized ? binding?.unitState !== "KG_VERIFIED" ? "UNIT_NOT_VERIFIED" : "BINDING_NOT_AUTHORIZED"
            : freshRealKgRead ? "READY" : input.testResult?.reason ?? "FRESH_REAL_OBSERVATION_REQUIRED",
  };
};
