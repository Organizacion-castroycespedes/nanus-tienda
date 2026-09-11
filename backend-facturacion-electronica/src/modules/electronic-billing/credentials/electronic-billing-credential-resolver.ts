import { Injectable } from "@nestjs/common";

export const ELECTRONIC_BILLING_CREDENTIAL_RESOLVER = Symbol(
  "ELECTRONIC_BILLING_CREDENTIAL_RESOLVER",
);

export type ElectronicBillingCredentialContext = {
  tenantId: string;
  providerId: string;
  providerCode: string;
  providerConfigId: string;
  credentialReference: string | null;
  settings?: Record<string, unknown> | null;
};

export type ElectronicBillingResolvedCredential = {
  reference: string;
  values: Record<string, string>;
};

export interface ElectronicBillingCredentialResolver {
  resolve(
    context: ElectronicBillingCredentialContext,
  ): Promise<ElectronicBillingResolvedCredential | null> | ElectronicBillingResolvedCredential | null;
}

export class ElectronicBillingCredentialResolutionError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
    this.name = "ElectronicBillingCredentialResolutionError";
  }
}

export class ElectronicBillingCredentialReferenceMissingError extends ElectronicBillingCredentialResolutionError {
  constructor(providerCode: string, providerConfigId: string, tenantId: string) {
    super(
      `Electronic billing credential reference is missing for provider ${providerCode} in config ${providerConfigId} for tenant ${tenantId}`,
      "ELECTRONIC_BILLING_CREDENTIAL_REFERENCE_MISSING",
    );
    this.name = "ElectronicBillingCredentialReferenceMissingError";
  }
}

export class ElectronicBillingCredentialNotFoundError extends ElectronicBillingCredentialResolutionError {
  constructor(reference: string, providerCode: string) {
    super(
      `Electronic billing credential reference not found for provider ${providerCode}: ${reference}`,
      "ELECTRONIC_BILLING_CREDENTIAL_NOT_FOUND",
    );
    this.name = "ElectronicBillingCredentialNotFoundError";
  }
}

export class ElectronicBillingCredentialInvalidError extends ElectronicBillingCredentialResolutionError {
  constructor(reference: string, providerCode: string, reason: string) {
    super(
      `Electronic billing credential reference ${reference} for provider ${providerCode} is invalid: ${reason}`,
      "ELECTRONIC_BILLING_CREDENTIAL_INVALID",
    );
    this.name = "ElectronicBillingCredentialInvalidError";
  }
}

const normalizeReference = (value: string) => {
  const trimmed = value.trim();
  return trimmed.toLowerCase().startsWith("env:") ? trimmed.slice(4).trim() : trimmed;
};

const parseCredentialValues = (reference: string, raw: string, providerCode: string) => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new ElectronicBillingCredentialInvalidError(
      reference,
      providerCode,
      "expected a JSON object with string values",
    );
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new ElectronicBillingCredentialInvalidError(
      reference,
      providerCode,
      "expected a JSON object with string values",
    );
  }

  const values: Record<string, string> = {};
  for (const [key, value] of Object.entries(parsed)) {
    if (typeof value !== "string" || value.trim().length === 0) {
      throw new ElectronicBillingCredentialInvalidError(
        reference,
        providerCode,
        `field ${key} must be a non-empty string`,
      );
    }

    values[key] = value.trim();
  }

  if (Object.keys(values).length === 0) {
    throw new ElectronicBillingCredentialInvalidError(
      reference,
      providerCode,
      "expected at least one credential value",
    );
  }

  return values;
};

@Injectable()
export class EnvironmentElectronicBillingCredentialResolver
  implements ElectronicBillingCredentialResolver
{
  async resolve(
    context: ElectronicBillingCredentialContext,
  ): Promise<ElectronicBillingResolvedCredential | null> {
    const credentialReference = context.credentialReference?.trim();
    if (!credentialReference) {
      return null;
    }

    const reference = normalizeReference(credentialReference);
    if (!reference) {
      return null;
    }

    const raw = process.env[reference]?.trim();
    if (!raw) {
      throw new ElectronicBillingCredentialNotFoundError(reference, context.providerCode);
    }

    return {
      reference,
      values: parseCredentialValues(reference, raw, context.providerCode),
    };
  }
}
