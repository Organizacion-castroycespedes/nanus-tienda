import { ElectronicBillingProviderError } from "../../contracts/electronic-billing-errors";

export type FactuCoreValidationDetail = {
  path: string | null;
  message: string;
};

const SENSITIVE_KEY = /clientsecret|clientkey|authorization|token|password|secret|apikey/i;
const MAX_DETAIL_COUNT = 20;
const MAX_DETAIL_MESSAGE_LENGTH = 300;

const sanitizeText = (value: string) => value
  .replace(/(clientSecret|clientKey|authorization|token|password|secret|apiKey)\s*[:=]\s*[^,\s}\]]+/gi, "$1=[redacted]")
  .slice(0, MAX_DETAIL_MESSAGE_LENGTH);

const readPath = (value: Record<string, unknown>, inheritedPath: string | null) => {
  for (const key of ["path", "field", "property", "fieldPath"]) {
    if (typeof value[key] === "string" && value[key].trim()) {
      const ownPath = value[key].trim();
      return inheritedPath ? `${inheritedPath}.${ownPath}` : ownPath;
    }
  }

  return null;
};

export const extractFactuCoreValidationDetails = (payload: unknown): FactuCoreValidationDetail[] => {
  const details: FactuCoreValidationDetail[] = [];
  const visit = (value: unknown, inheritedPath: string | null = null) => {
    if (details.length >= MAX_DETAIL_COUNT || value === null || value === undefined) {
      return;
    }

    if (typeof value === "string") {
      const message = sanitizeText(value.trim());
      if (message) {
        details.push({ path: inheritedPath, message });
      }
      return;
    }

    if (Array.isArray(value)) {
      value.forEach((item) => visit(item, inheritedPath));
      return;
    }

    if (typeof value !== "object") {
      return;
    }

    const record = value as Record<string, unknown>;
    const path = readPath(record, inheritedPath) ?? inheritedPath;
    for (const [key, child] of Object.entries(record)) {
      if (SENSITIVE_KEY.test(key)) {
        continue;
      }

      if (key === "constraints" && typeof child === "object" && child !== null) {
        Object.entries(child as Record<string, unknown>)
          .filter(([constraintKey]) => !SENSITIVE_KEY.test(constraintKey))
          .forEach(([, item]) => visit(item, path));
      } else if (["message", "detail", "reason"].includes(key)) {
        visit(child, path);
      } else if (["children", "errors", "details", "response", "failedChecks", "missing"].includes(key)) {
        visit(child, path);
      }
    }
  };

  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    const record = payload as Record<string, unknown>;
    if (Array.isArray(record.failedChecks)) {
      visit(record.failedChecks);
      return details;
    }
  }

  visit(payload);
  return details;
};

export class FactuCoreError extends ElectronicBillingProviderError {
  constructor(
    message: string,
    code: string,
    public readonly operation: string,
    public readonly retryable = false,
    public readonly httpStatus?: number,
  ) {
    super(message, code);
    this.name = "FactuCoreError";
  }
}

export class FactuCoreMissingCredentialsError extends FactuCoreError {
  constructor(operation: string) {
    super(
      "FactuCore credentials are not available for this operation",
      "FACTUCORE_MISSING_CREDENTIALS",
      operation,
      false,
    );
    this.name = "FactuCoreMissingCredentialsError";
  }
}

export class FactuCoreConfigurationError extends FactuCoreError {
  constructor(operation: string, message = "FactuCore configuration is invalid") {
    super(message, "FACTUCORE_CONFIGURATION", operation, false);
    this.name = "FactuCoreConfigurationError";
  }
}

export class FactuCoreAuthenticationError extends FactuCoreError {
  constructor(operation: string, httpStatus: number, message = "FactuCore authentication failed") {
    super(message, "FACTUCORE_AUTHENTICATION", operation, false, httpStatus);
    this.name = "FactuCoreAuthenticationError";
  }
}

export class FactuCoreConflictError extends FactuCoreError {
  constructor(operation: string, httpStatus = 409, message = "FactuCore conflict") {
    super(message, "FACTUCORE_CONFLICT", operation, false, httpStatus);
    this.name = "FactuCoreConflictError";
  }
}

export class FactuCoreValidationError extends FactuCoreError {
  constructor(
    operation: string,
    httpStatus = 422,
    message = "FactuCore validation error",
    public readonly validationDetails: FactuCoreValidationDetail[] = [],
    public readonly providerCode: string | null = null,
  ) {
    super(message, "FACTUCORE_VALIDATION", operation, false, httpStatus);
    this.name = "FactuCoreValidationError";
  }
}

export class FactuCoreRateLimitError extends FactuCoreError {
  constructor(
    operation: string,
    httpStatus = 429,
    public readonly retryAfterSeconds: number | null = null,
    public readonly rateLimitLimit: string | null = null,
    public readonly rateLimitRemaining: string | null = null,
    public readonly rateLimitReset: string | null = null,
    message = "FactuCore rate limit exceeded",
  ) {
    super(message, "FACTUCORE_RATE_LIMIT", operation, true, httpStatus);
    this.name = "FactuCoreRateLimitError";
  }
}

export class FactuCoreUnavailableError extends FactuCoreError {
  constructor(operation: string, httpStatus?: number, message = "FactuCore service unavailable") {
    super(message, "FACTUCORE_UNAVAILABLE", operation, true, httpStatus);
    this.name = "FactuCoreUnavailableError";
  }
}

export class FactuCoreTimeoutError extends FactuCoreError {
  constructor(operation: string, message = "FactuCore request timed out") {
    super(message, "FACTUCORE_TIMEOUT", operation, true);
    this.name = "FactuCoreTimeoutError";
  }
}

export class FactuCoreNetworkError extends FactuCoreError {
  constructor(operation: string, message = "FactuCore network request failed") {
    super(message, "FACTUCORE_NETWORK", operation, true);
    this.name = "FactuCoreNetworkError";
  }
}

export class FactuCoreAttachmentNotFoundError extends FactuCoreError {
  constructor(operation: string, message = "FactuCore attachment not available") {
    super(message, "FACTUCORE_ATTACHMENT_NOT_FOUND", operation, false);
    this.name = "FactuCoreAttachmentNotFoundError";
  }
}
