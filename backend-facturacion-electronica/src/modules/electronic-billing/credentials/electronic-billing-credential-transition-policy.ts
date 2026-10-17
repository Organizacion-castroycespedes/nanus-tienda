export const ELECTRONIC_BILLING_LEGACY_REFERENCE_ENABLED =
  "ELECTRONIC_BILLING_LEGACY_REFERENCE_ENABLED";
export const ELECTRONIC_BILLING_LEGACY_REFERENCE_ALLOWLIST =
  "ELECTRONIC_BILLING_LEGACY_REFERENCE_ALLOWLIST";

export type ElectronicBillingCredentialEnvelopeVersion = "V1" | "V2" | "UNKNOWN";

export type ElectronicBillingLegacyCredentialPolicyContext = {
  tenantId: string;
  providerId: string;
  providerConfigId: string;
  providerCode: string;
  environment?: string | null;
  credentialReference?: string | null;
};

export type ElectronicBillingLegacyCredentialPolicyDecision = {
  allowed: boolean;
  category:
    | "LEGACY_ALLOWED"
    | "LEGACY_GATE_DISABLED"
    | "LEGACY_ALLOWLIST_EMPTY"
    | "LEGACY_POLICY_INVALID"
    | "LEGACY_TUPLE_NOT_ALLOWED"
    | "LEGACY_REFERENCE_MISSING";
};

type AllowlistEntry = Required<Omit<ElectronicBillingLegacyCredentialPolicyContext, "credentialReference">>;

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const isBase64Url = (value: string) => /^[A-Za-z0-9_-]+$/.test(value);

const hasShape = (value: string, version: "v1" | "v2") => {
  const parts = value.trim().split(".");
  const expectedParts = version === "v1" ? 4 : 5;
  if (parts.length !== expectedParts || parts[0] !== version) return false;

  const payloadParts = parts.slice(version === "v1" ? 1 : 2);
  if (version === "v2" && !/^[A-Za-z0-9._-]+$/.test(parts[1])) return false;
  if (!payloadParts.every(isBase64Url) || payloadParts.some((part) => part.length === 0)) return false;

  const nonce = Buffer.from(version === "v1" ? parts[1] : parts[2], "base64url");
  const tag = Buffer.from(version === "v1" ? parts[2] : parts[3], "base64url");
  const ciphertext = Buffer.from(version === "v1" ? parts[3] : parts[4], "base64url");
  return nonce.length === 12 && tag.length === 16 && ciphertext.length > 0;
};

export const classifyElectronicBillingCredentialEnvelope = (
  value: string,
): ElectronicBillingCredentialEnvelopeVersion => {
  const trimmed = value.trim();
  if (trimmed.startsWith("v2.")) return hasShape(trimmed, "v2") ? "V2" : "UNKNOWN";
  if (trimmed.startsWith("v1.")) return hasShape(trimmed, "v1") ? "V1" : "UNKNOWN";
  return "UNKNOWN";
};

const readEnabled = () =>
  process.env[ELECTRONIC_BILLING_LEGACY_REFERENCE_ENABLED]?.trim().toLowerCase() === "true";

const readAllowlist = (): { entries: AllowlistEntry[]; valid: boolean } => {
  const raw = process.env[ELECTRONIC_BILLING_LEGACY_REFERENCE_ALLOWLIST]?.trim();
  if (!raw) return { entries: [], valid: true };

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { entries: [], valid: false };
  }
  if (!Array.isArray(parsed)) return { entries: [], valid: false };

  const entries: AllowlistEntry[] = [];
  for (const candidate of parsed) {
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
      return { entries: [], valid: false };
    }
    const value = candidate as Record<string, unknown>;
    const fields = ["tenantId", "providerId", "providerConfigId", "providerCode", "environment"];
    if (!fields.every((field) => isNonEmptyString(value[field]))) {
      return { entries: [], valid: false };
    }
    entries.push({
      tenantId: (value.tenantId as string).trim(),
      providerId: (value.providerId as string).trim(),
      providerConfigId: (value.providerConfigId as string).trim(),
      providerCode: (value.providerCode as string).trim().toUpperCase(),
      environment: (value.environment as string).trim().toUpperCase(),
    });
  }
  return { entries, valid: true };
};

export class ElectronicBillingCredentialTransitionPolicy {
  classifyEnvelope(value: string): ElectronicBillingCredentialEnvelopeVersion {
    return classifyElectronicBillingCredentialEnvelope(value);
  }

  evaluateLegacyOverride(
    context: ElectronicBillingLegacyCredentialPolicyContext,
  ): ElectronicBillingLegacyCredentialPolicyDecision {
    if (!readEnabled()) return { allowed: false, category: "LEGACY_GATE_DISABLED" };
    if (!isNonEmptyString(context.credentialReference)) {
      return { allowed: false, category: "LEGACY_REFERENCE_MISSING" };
    }

    const allowlist = readAllowlist();
    if (!allowlist.valid) return { allowed: false, category: "LEGACY_POLICY_INVALID" };
    if (allowlist.entries.length === 0) return { allowed: false, category: "LEGACY_ALLOWLIST_EMPTY" };
    if (!isNonEmptyString(context.environment)) {
      return { allowed: false, category: "LEGACY_TUPLE_NOT_ALLOWED" };
    }

    const match = allowlist.entries.some((entry) =>
      entry.tenantId === context.tenantId.trim()
      && entry.providerId === context.providerId.trim()
      && entry.providerConfigId === context.providerConfigId.trim()
      && entry.providerCode === context.providerCode.trim().toUpperCase()
      && entry.environment === context.environment!.trim().toUpperCase());

    return match
      ? { allowed: true, category: "LEGACY_ALLOWED" }
      : { allowed: false, category: "LEGACY_TUPLE_NOT_ALLOWED" };
  }
}
