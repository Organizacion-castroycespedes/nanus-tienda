export class ElectronicBillingProviderError extends Error {
  constructor(
    message: string,
    public readonly code: string
  ) {
    super(message);
    this.name = "ElectronicBillingProviderError";
  }
}

export class ElectronicBillingProviderNotRegisteredError extends ElectronicBillingProviderError {
  constructor(providerCode: string) {
    super(
      `Electronic billing provider not registered: ${providerCode}`,
      "ELECTRONIC_BILLING_PROVIDER_NOT_REGISTERED"
    );
    this.name = "ElectronicBillingProviderNotRegisteredError";
  }
}

export class ElectronicBillingProviderDisabledError extends ElectronicBillingProviderError {
  constructor(
    message = "Electronic billing provider configuration is disabled or missing"
  ) {
    super(message, "ELECTRONIC_BILLING_PROVIDER_DISABLED");
    this.name = "ElectronicBillingProviderDisabledError";
  }
}

export class ElectronicBillingProviderCapabilityError extends ElectronicBillingProviderError {
  constructor(providerCode: string, capability: string) {
    super(
      `Electronic billing provider ${providerCode} does not support capability: ${capability}`,
      "ELECTRONIC_BILLING_PROVIDER_CAPABILITY"
    );
    this.name = "ElectronicBillingProviderCapabilityError";
  }
}

export class ElectronicDocumentProcessingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ElectronicDocumentProcessingError";
  }
}

export class ElectronicDocumentAlreadyProcessingError extends ElectronicDocumentProcessingError {
  constructor() {
    super("Electronic document is already being processed");
    this.name = "ElectronicDocumentAlreadyProcessingError";
  }
}

export class ElectronicDocumentNotProcessableError extends ElectronicDocumentProcessingError {
  constructor(message = "Electronic document is not processable in its current state") {
    super(message);
    this.name = "ElectronicDocumentNotProcessableError";
  }
}

export class ElectronicDocumentStatusTransitionError extends ElectronicDocumentProcessingError {
  constructor(message = "Electronic document status transition is not allowed") {
    super(message);
    this.name = "ElectronicDocumentStatusTransitionError";
  }
}

export class ElectronicDocumentProviderResultConflictError extends ElectronicDocumentProcessingError {
  constructor(message = "Electronic document provider identity conflict") {
    super(message);
    this.name = "ElectronicDocumentProviderResultConflictError";
  }
}
