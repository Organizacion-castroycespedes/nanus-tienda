import { apiClient } from "../../lib/http";
import { requestPeripheral } from "./api";

export type ScaleAuthorizationSnapshot = {
  posTerminalId: string;
  branchId: string;
  operationalTerminalId: string | null;
  scaleDeviceId: string | null;
  enableScale: boolean;
  agent: { deviceId: string | null; installationId: string | null; credentialId: string | null; status: string | null; authenticated: boolean };
  binding: null | { id: string; logicalScaleId: string | null; status: string; unitState: string; verificationMethod: string | null; unit: string | null; verifiedBy: string | null; verifiedAt: string | null };
  realAvailable: boolean;
  realAvailabilityReason: string;
};

export type AgentPairingStatus = {
  installationId: string;
  enrolled: boolean;
  pairing: null | { pairingCode: string; signedChallenge: unknown; enrollmentPublicKeyPem: string; expiresAt: string };
};

const post = <T>(url: string, body: unknown) => apiClient<T>(url, { method: "POST", body: JSON.stringify(body) });

export const fetchScaleAuthorizationSnapshot = (posTerminalId: string) =>
  apiClient<ScaleAuthorizationSnapshot>(`/scale-authorization/admin/state?posTerminalId=${encodeURIComponent(posTerminalId)}`);

export const approveAgentPairing = (input: {
  signedChallenge: unknown; pairingCode: string; posTerminalId: string;
  logicalScaleId: string; enrollmentPublicKeyPem: string;
}) => post<{ envelope: unknown; credentialId: string; expiresAt: string }>("/scale-authorization/admin/pairing/approve", input);

export const createScaleBinding = (posTerminalId: string, logicalScaleId: string) =>
  post<{ id: string; status: string }>("/scale-authorization/admin/bindings", { posTerminalId, logicalScaleId });

export const confirmScaleKg = (bindingId: string) =>
  post<{ id: string; status: string; unit_state: string; unitVerification: {
    method: "OPERATOR_CONFIRMATION"; unit: "kg"; operatorId: string; verifiedAt: string;
  } }>(`/scale-authorization/admin/bindings/${encodeURIComponent(bindingId)}/confirm-kg`, {});

export const revokeScaleBinding = (bindingId: string) =>
  post<{ id: string; status: string }>(`/scale-authorization/admin/bindings/${encodeURIComponent(bindingId)}/revoke`, {});

export const revokeAgentCredential = (credentialId: string) =>
  post<{ id: string; status: string }>(`/scale-authorization/admin/credentials/${encodeURIComponent(credentialId)}/revoke`, {});

export const fetchAgentPairingStatus = () => requestPeripheral<AgentPairingStatus>("/agent-security/status");
export const startAgentPairing = () => requestPeripheral<AgentPairingStatus>("/agent-security/pairing/start", { method: "POST", body: "{}" });
export const deliverAgentEnrollmentEnvelope = (envelope: unknown) => requestPeripheral<{ enrolled: boolean; credentialId: string }>("/agent-security/pairing/envelope", { method: "POST", body: JSON.stringify(envelope) });
export const testScaleAuthorizationReading = (posTerminalId: string, logicalScaleId: string) =>
  requestPeripheral<{ available: boolean; reason: string; realAvailable?: boolean; reading?: { weight?: number; unit: string | null; source: string | null; unitVerified: boolean; observedAt: string | null } }>("/scale/authorization-test", { method: "POST", body: JSON.stringify({ posTerminalId, logicalScaleId }) });
