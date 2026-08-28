import { ElectronicBillingProviderError } from "../../contracts/electronic-billing-errors";

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
  constructor(operation: string, httpStatus = 422, message = "FactuCore validation error") {
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
