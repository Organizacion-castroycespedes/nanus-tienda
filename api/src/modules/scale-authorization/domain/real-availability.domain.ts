import { assertBindingInvariant, bindingContextMatches, type ScaleBinding, type ScaleBindingContext } from "./scale-binding.domain";
import { verifyOpaqueAgentCredential, type AgentCredentialState } from "./agent-credential.domain";

export type RealAvailabilityReason =
  | "READY" | "NO_AGENT_CREDENTIAL" | "AGENT_REVOKED" | "AGENT_CREDENTIAL_EXPIRED"
  | "NO_BINDING" | "BINDING_PENDING" | "BINDING_REVOKED" | "BINDING_DISABLED"
  | "UNIT_NOT_VERIFIED" | "SCALE_MISMATCH" | "AGENT_UNAVAILABLE_OR_STALE";

export type AgentObservation = { available: boolean; observedAt: string; logicalScaleId: string };
export type RealAvailabilityInput = {
  credential?: AgentCredentialState | null;
  credentialSecret?: string;
  binding?: ScaleBinding | null;
  expectedContext: ScaleBindingContext;
  observation?: AgentObservation | null;
  maxObservationAgeMs: number;
  now?: Date;
};

export const deriveRealAvailability = (input: RealAvailabilityInput): { available: boolean; reason: RealAvailabilityReason } => {
  const now = input.now ?? new Date();
  if (!input.credential || !input.credentialSecret) return { available: false, reason: "NO_AGENT_CREDENTIAL" };
  const credentialStatus = verifyOpaqueAgentCredential(input.credentialSecret, input.credential, now);
  if (credentialStatus === "REVOKED") return { available: false, reason: "AGENT_REVOKED" };
  if (credentialStatus === "EXPIRED") return { available: false, reason: "AGENT_CREDENTIAL_EXPIRED" };
  if (credentialStatus !== "VALID") return { available: false, reason: "NO_AGENT_CREDENTIAL" };
  if (!input.binding) return { available: false, reason: "NO_BINDING" };
  if (input.binding.status === "PENDING") return { available: false, reason: "BINDING_PENDING" };
  if (input.binding.status === "REVOKED") return { available: false, reason: "BINDING_REVOKED" };
  if (input.binding.status === "DISABLED") return { available: false, reason: "BINDING_DISABLED" };
  try { assertBindingInvariant(input.binding); } catch { return { available: false, reason: "UNIT_NOT_VERIFIED" }; }
  if (input.binding.unitState !== "KG_VERIFIED") return { available: false, reason: "UNIT_NOT_VERIFIED" };
  if (!bindingContextMatches(input.binding, input.expectedContext)) return { available: false, reason: "SCALE_MISMATCH" };
  if (input.binding.logicalScaleId !== input.observation?.logicalScaleId) return { available: false, reason: "SCALE_MISMATCH" };
  const observedAt = input.observation ? Date.parse(input.observation.observedAt) : NaN;
  if (!input.observation?.available || !Number.isFinite(observedAt) || now.getTime() - observedAt > input.maxObservationAgeMs || observedAt > now.getTime()) {
    return { available: false, reason: "AGENT_UNAVAILABLE_OR_STALE" };
  }
  return { available: true, reason: "READY" };
};
