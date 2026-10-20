import type {
  ElectronicBillingProviderDocumentResult,
  ElectronicBillingProviderStatusResult,
  ElectronicDocumentStatus,
  ElectronicFailureClass,
} from "./electronic-billing.types";

export type ElectronicFailureOrigin = "FACTUCORE" | "DIAN" | "MANUS";

export type ElectronicFailureDetailClass =
  | "NETWORK_OR_TRANSIENT"
  | "DIAN_REJECTED"
  | "VALIDATION"
  | "CONFIGURATION"
  | "PENDING"
  | "UNKNOWN";

export type ElectronicFailureDetailInput = {
  origin: ElectronicFailureOrigin;
  code: string | null;
  message: string;
  path: string | null;
  severity: string | null;
  httpStatus: number | null;
  failureClass: ElectronicFailureDetailClass;
  resolutionCandidates: string[];
  rawDetail: Record<string, unknown>;
};

export type ElectronicDocumentOutcomeFailureClass = ElectronicFailureDetailClass | "ACCEPTED";

export type ElectronicDocumentOutcomeFailure = {
  code: string | null;
  message: string;
  origin: ElectronicFailureOrigin;
  path: string | null;
  severity: string | null;
  title: string | null;
  solution: string | null;
  retryable: boolean;
};

export type ElectronicDocumentOutcome = {
  electronicDocumentId: string;
  documentType: string;
  status: ElectronicDocumentStatus;
  fullNumber: string | null;
  cufe: string | null;
  cude: string | null;
  providerStatus: string | null;
  failureClass: ElectronicDocumentOutcomeFailureClass;
  retryable: boolean;
  errorCode: string | null;
  errorMessage: string | null;
  failures: ElectronicDocumentOutcomeFailure[];
};

type ProviderResult = ElectronicBillingProviderDocumentResult | ElectronicBillingProviderStatusResult;

const DIAN_RULE_IN_MESSAGE = /Regla:\s*([A-Z]{2,4}\d+[a-z]?)/;
const DIAN_RULE_CODE = /^[A-Z]{2,4}\d+[a-z]?$/;
const MAX_MESSAGE_LENGTH = 1000;
const MAX_DETAILS = 50;

const trimToNull = (value: unknown) => {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
};

export const extractDianRuleCode = (code: string | null, message: string | null): string | null => {
  const normalizedCode = trimToNull(code);
  if (normalizedCode && DIAN_RULE_CODE.test(normalizedCode)) {
    return normalizedCode;
  }
  const match = message ? DIAN_RULE_IN_MESSAGE.exec(message) : null;
  return match?.[1] ?? null;
};

export const buildResolutionCandidates = (code: string | null, message: string | null): string[] => {
  const rule = extractDianRuleCode(code, message);
  const candidates = [
    rule,
    trimToNull(code),
    rule ? `DIAN_PREFIX_${rule.slice(0, 3).toUpperCase()}` : null,
  ].filter((candidate): candidate is string => Boolean(candidate));
  return [...new Set(candidates)];
};

const resolveOrigin = (code: string | null, message: string | null): ElectronicFailureOrigin => {
  const normalized = (code ?? "").toUpperCase();
  if (normalized.startsWith("FACTUCORE")) {
    return "FACTUCORE";
  }
  if (normalized.startsWith("ELECTRONIC_") || normalized.startsWith("MANUS")) {
    return "MANUS";
  }
  if (normalized.startsWith("DIAN") || extractDianRuleCode(code, message) || /^\d{2}$/.test(normalized)) {
    return "DIAN";
  }
  return "FACTUCORE";
};

const toDetailClass = (
  failureClass: ElectronicFailureClass | null | undefined,
  status: ElectronicDocumentStatus,
): ElectronicFailureDetailClass => {
  switch (failureClass) {
    case "DIAN_REJECTED":
    case "VALIDATION":
    case "NETWORK_OR_TRANSIENT":
    case "PENDING":
      return failureClass;
    default:
      if (status === "REJECTED") {
        return "DIAN_REJECTED";
      }
      if (status === "TECHNICAL_ERROR") {
        return "NETWORK_OR_TRANSIENT";
      }
      return "UNKNOWN";
  }
};

export const isFailureStatus = (status: ElectronicDocumentStatus) =>
  status === "REJECTED" || status === "TECHNICAL_ERROR";

export const buildFailureDetailsFromProviderResult = (
  providerResult: ProviderResult,
  status: ElectronicDocumentStatus,
): ElectronicFailureDetailInput[] => {
  if (!isFailureStatus(status)) {
    return [];
  }

  const failureClass = toDetailClass(providerResult.failureClass, status);
  const errors = (providerResult.providerErrors ?? []).filter((item) => trimToNull(item.message));
  const fallbackMessage = trimToNull(providerResult.providerStatusMessage)
    ?? trimToNull(providerResult.providerStatusDetail)
    ?? trimToNull(providerResult.failureReason);
  const sourceErrors = errors.length > 0
    ? errors
    : fallbackMessage
      ? [{ code: trimToNull(providerResult.providerStatusCode), message: fallbackMessage, path: null, severity: null }]
      : [];

  return sourceErrors.slice(0, MAX_DETAILS).map((item) => {
    const code = trimToNull(item.code);
    const message = String(item.message).trim().slice(0, MAX_MESSAGE_LENGTH);
    return {
      origin: resolveOrigin(code, message),
      code,
      message,
      path: trimToNull(item.path),
      severity: trimToNull(item.severity),
      httpStatus: null,
      failureClass,
      resolutionCandidates: buildResolutionCandidates(code, message),
      rawDetail: {
        providerStatus: providerResult.providerStatus,
        providerStatusCode: providerResult.providerStatusCode ?? null,
        failureReason: providerResult.failureReason ?? null,
        probableCause: providerResult.probableCause ?? null,
        trackingId: providerResult.trackingId ?? null,
      },
    };
  });
};

export const resolveErrorFailureClass = (
  code: string,
  classification: { rejected: boolean; retryable: boolean },
): ElectronicFailureDetailClass => {
  const normalized = code.toUpperCase();
  if (
    normalized.includes("AUTHENTICATION")
    || normalized.includes("CONFIGURATION")
    || normalized.includes("MISSING_CREDENTIALS")
  ) {
    return "CONFIGURATION";
  }
  if (classification.retryable) {
    return "NETWORK_OR_TRANSIENT";
  }
  if (classification.rejected) {
    return "VALIDATION";
  }
  return "UNKNOWN";
};

export const buildFailureDetailsFromError = (
  error: unknown,
  input: {
    code: string;
    message: string;
    httpStatus: number | null;
    classification: { rejected: boolean; retryable: boolean };
  },
): ElectronicFailureDetailInput[] => {
  const failureClass = resolveErrorFailureClass(input.code, input.classification);
  const errorRecord = error && typeof error === "object" ? error as Record<string, unknown> : {};
  const providerCode = trimToNull(errorRecord.providerCode);
  const operation = trimToNull(errorRecord.operation);
  const validationDetails = Array.isArray(errorRecord.validationDetails)
    ? (errorRecord.validationDetails as Array<{ path?: unknown; message?: unknown }>)
        .map((detail) => ({ path: trimToNull(detail.path), message: trimToNull(detail.message) }))
        .filter((detail): detail is { path: string | null; message: string } => Boolean(detail.message))
    : [];
  const base = {
    origin: resolveOrigin(input.code, input.message),
    severity: null,
    httpStatus: input.httpStatus,
    failureClass,
    rawDetail: {
      errorCode: input.code,
      providerCode,
      operation,
      retryable: input.classification.retryable,
    },
  };

  if (validationDetails.length === 0) {
    const message = input.message.slice(0, MAX_MESSAGE_LENGTH);
    return [{
      ...base,
      code: input.code,
      message,
      path: null,
      resolutionCandidates: [
        ...buildResolutionCandidates(providerCode, message),
        ...buildResolutionCandidates(input.code, message),
      ].filter((candidate, index, list) => list.indexOf(candidate) === index),
    }];
  }

  return validationDetails.slice(0, MAX_DETAILS).map((detail) => {
    const message = detail.message.slice(0, MAX_MESSAGE_LENGTH);
    return {
      ...base,
      code: providerCode ?? input.code,
      message,
      path: detail.path,
      resolutionCandidates: [
        ...buildResolutionCandidates(providerCode, message),
        input.code,
      ].filter((candidate, index, list) => list.indexOf(candidate) === index),
    };
  });
};

export const resolveOutcomeFailureClass = (
  status: ElectronicDocumentStatus,
  detailClasses: ElectronicFailureDetailClass[],
): ElectronicDocumentOutcomeFailureClass => {
  if (status === "ACCEPTED") {
    return "ACCEPTED";
  }
  if (status === "PENDING" || status === "PROCESSING") {
    return "PENDING";
  }
  const known = detailClasses.find((item) => item !== "UNKNOWN");
  if (known) {
    return known;
  }
  if (status === "REJECTED") {
    return "DIAN_REJECTED";
  }
  if (status === "TECHNICAL_ERROR") {
    return "NETWORK_OR_TRANSIENT";
  }
  return "UNKNOWN";
};
