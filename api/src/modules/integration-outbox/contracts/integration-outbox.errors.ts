export class IntegrationOutboxConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IntegrationOutboxConflictError";
  }
}

export class IntegrationOutboxConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IntegrationOutboxConfigurationError";
  }
}
