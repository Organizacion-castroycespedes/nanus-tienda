import { Inject, Injectable } from "@nestjs/common";
import type { SaleCompletedForElectronicBillingEventEnvelope } from "../contracts/integration-outbox-events";
import type { IntegrationOutboxConfig } from "../config/integration-outbox.config";
import { INTEGRATION_OUTBOX_CONFIG } from "../integration-outbox.tokens";

export type BillingIntegrationDeliveryOutcome =
  | "PUBLISHED"
  | "ALREADY_PROCESSED"
  | "RETRYABLE_FAILURE"
  | "NON_RETRYABLE_FAILURE";

export type BillingIntegrationDeliveryResult = {
  outcome: BillingIntegrationDeliveryOutcome;
  retryable: boolean;
  statusCode: number | null;
  message: string | null;
  retryAfterMs: number | null;
};

const SALE_COMPLETED_ENDPOINT = "/internal/electronic-billing/events/sale-completed";
const STATUS_REFRESH_ENDPOINT = "/internal/electronic-billing/documents";
const RETRY_ENDPOINT = "/internal/electronic-billing/documents";

export type BillingStatusRefreshResult = {
  outcome: "UPDATED" | "UNCHANGED" | "PROVIDER_DOCUMENT_NOT_FOUND" | "NO_ELECTRONIC_DOCUMENT";
  electronicDocumentId: string;
  status: string;
  providerStatus: string | null;
  providerDocumentId: string | null;
  documentNumber: string | null;
  cufe: string | null;
  acceptedAt: string | null;
  providerStatusCode: string | null;
  providerStatusMessage: string | null;
  trackingId: string | null;
  refreshedAt: string;
};

export type BillingRetryabilityResult = {
  canRetry: boolean;
  canRecoverProviderCreateIntent: boolean;
  canRecoverExistingProvider?: boolean;
  retryClass: string;
  decision: string;
  reasonCode: string;
  requiredAction: string;
  requiresReconciliation: boolean;
  providerDocumentExists: boolean;
  processingStage: string;
  safeUserMessage: string;
};

export type BillingRetryResult = {
  allowed: boolean;
  canRetry: boolean;
  disposition: string;
  reasonCode: string;
  requiredAction: string;
  status: string | null;
  processingStage: string | null;
  safeUserMessage: string;
};

export type BillingPreProviderRecoveryResult = {
  allowed: true;
  recovery: "CONFIRMED_PROVIDER_ABSENCE" | "EXISTING_PROVIDER_RESUMED";
  resultCode: "REMOTE_FOUND_RECONCILED" | "REMOTE_NOT_FOUND_RECOVERED" | "EXISTING_PROVIDER_RECONCILED";
  safeUserMessage: string;
  electronicDocumentId: string;
  status: string | null;
  processingStage: string | null;
  providerStatus: string | null;
  providerDocumentId: string | null;
  fullNumber: string | null;
  cufe: string | null;
};

const isSuccessStatus = (status: string) =>
  status === "ACCEPTED" || status === "ALREADY_PROCESSED";

const normalizeRetryAfter = (value: string | null) => {
  if (!value) {
    return null;
  }

  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.round(seconds * 1000);
  }

  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) {
    return null;
  }

  return Math.max(parsed - Date.now(), 0);
};

const withTrailingSlash = (value: string) => (value.endsWith("/") ? value : `${value}/`);

@Injectable()
export class BillingIntegrationClient {
  constructor(
    @Inject(INTEGRATION_OUTBOX_CONFIG)
    private readonly config: IntegrationOutboxConfig,
  ) {}

  async sendSaleCompletedEvent(
    event: SaleCompletedForElectronicBillingEventEnvelope,
  ): Promise<BillingIntegrationDeliveryResult> {
    if (!this.config.billingBackendBaseUrl || !this.config.internalToken) {
      return {
        outcome: "NON_RETRYABLE_FAILURE",
        retryable: false,
        statusCode: null,
        message: "Billing backend internal client is not configured",
        retryAfterMs: null,
      };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);

    try {
      console.debug("[BillingIntegrationClient] dispatch", {
        eventId: event.eventId,
        eventType: event.eventType,
        schemaVersion: event.schemaVersion,
        tenantId: event.tenantId,
        sourceType: event.source?.type,
        sourceId: event.source?.id,
        payloadKeys: Object.keys(event.payload ?? {}),
      });
      const response = await fetch(
        new URL(SALE_COMPLETED_ENDPOINT, withTrailingSlash(this.config.billingBackendBaseUrl)),
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.config.internalToken}`,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify(event),
          signal: controller.signal,
        },
      );

      return await this.classifyResponse(response);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return {
          outcome: "RETRYABLE_FAILURE",
          retryable: true,
          statusCode: null,
          message: "Billing backend request timed out",
          retryAfterMs: null,
        };
      }

      return {
        outcome: "RETRYABLE_FAILURE",
        retryable: true,
        statusCode: null,
        message: error instanceof Error ? error.message : "Billing backend request failed",
        retryAfterMs: null,
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  async refreshElectronicDocumentStatus(
    tenantId: string,
    electronicDocumentId: string,
  ): Promise<BillingStatusRefreshResult> {
    if (!this.config.billingBackendBaseUrl || !this.config.internalToken) {
      throw new Error("Billing backend internal client is not configured");
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);
    try {
      const response = await fetch(
        new URL(
          `${STATUS_REFRESH_ENDPOINT}/${encodeURIComponent(electronicDocumentId)}/status-refresh`,
          withTrailingSlash(this.config.billingBackendBaseUrl),
        ),
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.config.internalToken}`,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({ tenantId }),
          signal: controller.signal,
        },
      );
      if (!response.ok) {
        throw new Error("Billing status refresh was rejected");
      }
      return await response.json() as BillingStatusRefreshResult;
    } finally {
      clearTimeout(timeout);
    }
  }

  async getElectronicDocumentRetryability(
    tenantId: string,
    electronicDocumentId: string,
  ): Promise<BillingRetryabilityResult> {
    return this.postDocumentAction<BillingRetryabilityResult>(
      `${RETRY_ENDPOINT}/${encodeURIComponent(electronicDocumentId)}/retryability`,
      tenantId,
    );
  }

  async retryElectronicDocument(
    tenantId: string,
    electronicDocumentId: string,
  ): Promise<BillingRetryResult> {
    return this.postDocumentAction<BillingRetryResult>(
      `${RETRY_ENDPOINT}/${encodeURIComponent(electronicDocumentId)}/retry`,
      tenantId,
    );
  }

  async recoverProviderCreateIntent(
    tenantId: string,
    electronicDocumentId: string,
  ): Promise<BillingPreProviderRecoveryResult> {
    return this.postDocumentAction<BillingPreProviderRecoveryResult>(
      `${RETRY_ENDPOINT}/${encodeURIComponent(electronicDocumentId)}/recover-processing`,
      tenantId,
    );
  }

  private async postDocumentAction<T>(endpoint: string, tenantId: string): Promise<T> {
    if (!this.config.billingBackendBaseUrl || !this.config.internalToken) {
      throw new Error("Billing backend internal client is not configured");
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);
    try {
      const response = await fetch(
        new URL(endpoint, withTrailingSlash(this.config.billingBackendBaseUrl)),
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.config.internalToken}`,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({ tenantId }),
          signal: controller.signal,
        },
      );
      if (!response.ok) {
        throw new Error("Billing document action was rejected");
      }
      return await response.json() as T;
    } finally {
      clearTimeout(timeout);
    }
  }

  private async classifyResponse(response: Response): Promise<BillingIntegrationDeliveryResult> {
    const retryAfterMs = normalizeRetryAfter(response.headers.get("retry-after"));

    let body: unknown = null;
    const text = await response.text();
    if (text.trim().length > 0) {
      try {
        body = JSON.parse(text);
      } catch {
        body = text;
      }
    }

    if (response.ok && typeof body === "object" && body !== null && "status" in body) {
      const status = String((body as { status?: string }).status ?? "");
      const message =
        typeof (body as { message?: unknown }).message === "string"
          ? ((body as { message?: string }).message ?? null)
          : null;

      if (isSuccessStatus(status)) {
        return {
          outcome: status === "ALREADY_PROCESSED" ? "ALREADY_PROCESSED" : "PUBLISHED",
          retryable: false,
          statusCode: response.status,
          message,
          retryAfterMs: null,
        };
      }

      if (status === "INVALID_EVENT") {
        return {
          outcome: "NON_RETRYABLE_FAILURE",
          retryable: false,
          statusCode: response.status,
          message,
          retryAfterMs: null,
        };
      }

      if (status === "TEMPORARY_FAILURE") {
        return {
          outcome: "RETRYABLE_FAILURE",
          retryable: true,
          statusCode: response.status,
          message,
          retryAfterMs,
        };
      }
    }

    if (response.status >= 200 && response.status < 300) {
      return {
        outcome: "PUBLISHED",
        retryable: false,
        statusCode: response.status,
        message: null,
        retryAfterMs: null,
      };
    }

    if (response.status === 429 || response.status >= 500) {
      return {
        outcome: "RETRYABLE_FAILURE",
        retryable: true,
        statusCode: response.status,
        message: typeof body === "string" ? body : "Billing backend unavailable",
        retryAfterMs,
      };
    }

    if (response.status === 400 || response.status === 401 || response.status === 403 || response.status === 404 || response.status === 422) {
      return {
        outcome: "NON_RETRYABLE_FAILURE",
        retryable: false,
        statusCode: response.status,
        message: typeof body === "string" ? body : "Billing backend rejected the request",
        retryAfterMs: null,
      };
    }

    return {
      outcome: "NON_RETRYABLE_FAILURE",
      retryable: false,
      statusCode: response.status,
      message: typeof body === "string" ? body : "Unexpected billing backend response",
      retryAfterMs: null,
    };
  }
}
