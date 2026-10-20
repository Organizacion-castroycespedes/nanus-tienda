import { Inject, Injectable } from "@nestjs/common";
import type { SaleCompletedForElectronicBillingEventEnvelope } from "../contracts/integration-outbox-events";
import {
  DEFAULT_INTEGRATION_OUTBOX_INLINE_TIMEOUT_MS,
  type IntegrationOutboxConfig,
} from "../config/integration-outbox.config";
import {
  readBillingElectronicDocumentOutcome,
  type BillingElectronicDocumentOutcome,
} from "../contracts/electronic-billing-outcome";
import { INTEGRATION_OUTBOX_CONFIG } from "../integration-outbox.tokens";
import type {
  CreateElectronicBillingProviderDto,
  UpdateElectronicBillingProviderMetadataDto,
  UpdateElectronicBillingProviderStatusDto,
} from "../../electronic-invoicing/admin/dto/electronic-billing-provider-admin.dto";

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
  electronicDocument?: BillingElectronicDocumentOutcome | null;
};

export type BillingSendOptions = {
  timeoutMs?: number;
};

export type BillingCreditNoteIssueResult =
  | { kind: "OUTCOME"; electronicDocument: BillingElectronicDocumentOutcome }
  | { kind: "NETWORK_FAILURE"; message: string }
  | { kind: "REQUEST_REJECTED"; statusCode: number; message: string };

const SALE_COMPLETED_ENDPOINT = "/internal/electronic-billing/events/sale-completed";
const STATUS_REFRESH_ENDPOINT = "/internal/electronic-billing/documents";
const RETRY_ENDPOINT = "/internal/electronic-billing/documents";
const ADMIN_PROVIDERS_ENDPOINT = "/internal/electronic-billing/admin/providers";
const ADMIN_TENANT_CONFIG_ENDPOINT = "/internal/electronic-billing/admin/tenants";
const ADMIN_FACTUCORE_CONTEXT_ENDPOINT = "/internal/electronic-billing/admin/tenants";
const ADMIN_RUNTIME_READINESS_ENDPOINT = "/internal/electronic-billing/admin/runtime/crypto-readiness";

export type BillingAdminProviderCatalog = {
  providers: Array<{
    id: string;
    code: string;
    name: string;
    active: boolean;
    capabilities: unknown;
  }>;
};

export type BillingAdminProviderMutationResponse = {
  id: string;
  code: string;
  name: string;
  providerType: "ELECTRONIC_BILLING";
  active: boolean;
  capabilities: Record<string, boolean>;
  dependencySummary?: {
    enabledTenantConfigurations: number;
    historicalDocuments: number;
  };
  createdAt: string;
  updatedAt: string;
};

export class BillingAdminRequestError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly diagnostic?: BillingFactuCoreContextDiagnostic,
  ) {
    super(message);
    this.name = "BillingAdminRequestError";
  }
}

export type BillingFactuCoreContextDiagnostic = {
  category:
    | "FACTUCORE_AUTHENTICATION_401"
    | "FACTUCORE_AUTHORIZATION_403"
    | "FACTUCORE_TIMEOUT"
    | "FACTUCORE_NETWORK"
    | "CREDENTIAL_RESOLUTION_FAILED"
    | "FACTUCORE_CONTEXT_UNAVAILABLE";
  layer: "factucore-http" | "billing-backend";
  upstreamStatus: number | null;
  responseBodyPresent: boolean;
  correlationId: string | null;
};

const readSafeContextDiagnostic = (body: unknown): BillingFactuCoreContextDiagnostic | undefined => {
  if (!body || typeof body !== "object" || !("diagnostic" in body)) return undefined;
  const value = (body as { diagnostic?: unknown }).diagnostic;
  if (!value || typeof value !== "object") return undefined;
  const candidate = value as Record<string, unknown>;
  const categories = new Set([
    "FACTUCORE_AUTHENTICATION_401",
    "FACTUCORE_AUTHORIZATION_403",
    "FACTUCORE_TIMEOUT",
    "FACTUCORE_NETWORK",
    "CREDENTIAL_RESOLUTION_FAILED",
    "FACTUCORE_CONTEXT_UNAVAILABLE",
  ]);
  if (!categories.has(String(candidate.category))) return undefined;
  if (candidate.layer !== "factucore-http" && candidate.layer !== "billing-backend") return undefined;
  if (typeof candidate.upstreamStatus !== "number" && candidate.upstreamStatus !== null) return undefined;
  if (typeof candidate.responseBodyPresent !== "boolean") return undefined;
  if (candidate.correlationId !== null && typeof candidate.correlationId !== "string") return undefined;
  return {
    category: candidate.category as BillingFactuCoreContextDiagnostic["category"],
    layer: candidate.layer,
    upstreamStatus: candidate.upstreamStatus as number | null,
    responseBodyPresent: candidate.responseBodyPresent,
    correlationId: candidate.correlationId as string | null,
  };
};

export type BillingAdminTenantConfiguration = {
  tenantId: string;
  configurations: Array<{
    id: string;
    tenantId: string;
    providerId: string;
    providerCode: string;
    providerName: string;
    providerActive: boolean;
    environment: string;
    enabled: boolean;
    isDefault: boolean;
    configurationStatus: "COMPLETE" | "INCOMPLETE" | "INCONSISTENT";
    baseUrlConfigured: boolean;
    credentialStatus: {
      encryptedConfigured: boolean;
      legacyReferenceConfigured: boolean;
    };
    settings: {
      factuCoreTenantId: string | null;
    };
  }>;
};

export type BillingAdminTenantConfigCreateRequest = {
  providerId: string;
  environment: "TEST" | "HABILITATION" | "PRODUCTION";
  baseUrl?: string | null;
  settings?: { factuCoreTenantId?: string | null };
  clientKey: string;
  clientSecret: string;
};

export type BillingAdminTenantConfigUpdateRequest = {
  baseUrl?: string | null;
  settings?: { factuCoreTenantId?: string | null };
  clientKey?: string;
  clientSecret?: string;
};

export type BillingAdminTenantConfigMutationResponse = {
  id: string;
  tenantId: string;
  providerId: string;
  environment: "TEST" | "HABILITATION" | "PRODUCTION";
  enabled: boolean;
  isDefault: boolean;
  credentialConfigured: true;
};

export type BillingAdminRuntimeCryptoReadiness = {
  schemaMigration: "READY" | "MISSING" | "UNKNOWN";
  keyringStatus: "READY" | "MISSING" | "INVALID" | "ACTIVE_KEY_MISSING" | "SELF_TEST_FAILED" | "UNKNOWN";
  syntheticSelfTest: "PASS" | "FAIL" | "NOT_RUN";
  historicalDecryptReady: "UNKNOWN";
  operationalOwnership: "APPROVED" | "UNKNOWN";
  recoveryReadiness: "APPROVED" | "UNKNOWN";
  credentialWrites: "ENABLED" | "DISABLED";
  writeReady: boolean;
};

export type BillingAdminFactuCoreContext = {
  tenantId: string;
  providerCode: "FACTUCORE";
  configuredFactuCoreTenantId: string | null;
  context: {
    apiClientId: string;
    tenantId: string;
    environment: string;
    issuer: {
      identificationTypeCode: string | null;
      identificationNumber: string | null;
      verificationDigit: string | null;
      legalName: string | null;
      tradeName: string | null;
      complete: boolean;
    };
    resolution: {
      configured: boolean;
      status: string | null;
      isDefault: boolean;
      validTo: string | null;
      remaining: number | null;
    };
    dianReadiness: {
      status: "READY" | "NOT_READY" | "UNKNOWN";
      configurationComplete: boolean;
      issuerComplete: boolean;
      resolutionConfigured: boolean;
      configurationEnvironment: string | null;
      failedChecks: string[];
      basis: "CONFIGURATION_ONLY";
    };
  };
};

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

  async getElectronicBillingProviders(): Promise<BillingAdminProviderCatalog> {
    return this.getInternalAdminRead<BillingAdminProviderCatalog>(ADMIN_PROVIDERS_ENDPOINT);
  }

  async createElectronicBillingProvider(
    payload: CreateElectronicBillingProviderDto,
  ): Promise<BillingAdminProviderMutationResponse> {
    return this.requestInternalAdmin<BillingAdminProviderMutationResponse>(
      "POST",
      ADMIN_PROVIDERS_ENDPOINT,
      payload,
    );
  }

  async updateElectronicBillingProvider(
    providerId: string,
    payload: UpdateElectronicBillingProviderMetadataDto,
  ): Promise<BillingAdminProviderMutationResponse> {
    return this.requestInternalAdmin<BillingAdminProviderMutationResponse>(
      "PATCH",
      `${ADMIN_PROVIDERS_ENDPOINT}/${encodeURIComponent(providerId)}`,
      payload,
    );
  }

  async updateElectronicBillingProviderStatus(
    providerId: string,
    payload: UpdateElectronicBillingProviderStatusDto,
  ): Promise<BillingAdminProviderMutationResponse> {
    return this.requestInternalAdmin<BillingAdminProviderMutationResponse>(
      "PATCH",
      `${ADMIN_PROVIDERS_ENDPOINT}/${encodeURIComponent(providerId)}/status`,
      payload,
    );
  }

  async getTenantElectronicBillingConfiguration(
    tenantId: string,
  ): Promise<BillingAdminTenantConfiguration> {
    return this.getInternalAdminRead<BillingAdminTenantConfiguration>(
      `${ADMIN_TENANT_CONFIG_ENDPOINT}/${encodeURIComponent(tenantId)}/config`,
    );
  }

  async createTenantElectronicBillingConfiguration(
    tenantId: string,
    payload: BillingAdminTenantConfigCreateRequest,
  ): Promise<BillingAdminTenantConfigMutationResponse> {
    return this.requestInternalAdmin<BillingAdminTenantConfigMutationResponse>(
      "POST",
      `${ADMIN_TENANT_CONFIG_ENDPOINT}/${encodeURIComponent(tenantId)}/config`,
      payload,
    );
  }

  async updateTenantElectronicBillingConfiguration(
    tenantId: string,
    configId: string,
    payload: BillingAdminTenantConfigUpdateRequest,
  ): Promise<BillingAdminTenantConfigMutationResponse> {
    return this.requestInternalAdmin<BillingAdminTenantConfigMutationResponse>(
      "PATCH",
      `${ADMIN_TENANT_CONFIG_ENDPOINT}/${encodeURIComponent(tenantId)}/config/${encodeURIComponent(configId)}`,
      payload,
    );
  }

  async activateTenantElectronicBillingConfiguration(
    tenantId: string,
    configId: string,
  ): Promise<BillingAdminTenantConfigMutationResponse> {
    return this.requestInternalAdmin<BillingAdminTenantConfigMutationResponse>(
      "POST",
      `${ADMIN_TENANT_CONFIG_ENDPOINT}/${encodeURIComponent(tenantId)}/config/${encodeURIComponent(configId)}/activate`,
      { clearLegacyReference: true },
    );
  }

  async getElectronicBillingRuntimeReadiness(): Promise<BillingAdminRuntimeCryptoReadiness> {
    return this.getInternalAdminRead<BillingAdminRuntimeCryptoReadiness>(ADMIN_RUNTIME_READINESS_ENDPOINT);
  }

  async getTenantFactuCoreContext(tenantId: string, correlationId?: string, configId?: string): Promise<BillingAdminFactuCoreContext> {
    const suffix = configId ? `?configId=${encodeURIComponent(configId)}` : "";
    return this.getInternalAdminRead<BillingAdminFactuCoreContext>(
      `${ADMIN_FACTUCORE_CONTEXT_ENDPOINT}/${encodeURIComponent(tenantId)}/factucore-context${suffix}`,
      correlationId,
    );
  }

  async sendSaleCompletedEvent(
    event: SaleCompletedForElectronicBillingEventEnvelope,
    options: BillingSendOptions = {},
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
    const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? this.config.timeoutMs);

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

  async issueCreditNote(
    tenantId: string,
    electronicDocumentId: string,
    payload: {
      discrepancyResponseCode?: string;
      discrepancyResponseDescription?: string;
      noteReason?: string;
    },
  ): Promise<BillingCreditNoteIssueResult> {
    if (!this.config.billingBackendBaseUrl || !this.config.internalToken) {
      return { kind: "NETWORK_FAILURE", message: "Billing backend internal client is not configured" };
    }

    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      this.config.inlineTimeoutMs ?? DEFAULT_INTEGRATION_OUTBOX_INLINE_TIMEOUT_MS,
    );
    try {
      const response = await fetch(
        new URL(
          `${RETRY_ENDPOINT}/${encodeURIComponent(electronicDocumentId)}/credit-note/issue`,
          withTrailingSlash(this.config.billingBackendBaseUrl),
        ),
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.config.internalToken}`,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({ tenantId, ...payload }),
          signal: controller.signal,
        },
      );
      const body = await this.readJsonBody(response);
      if (response.status === 429 || response.status >= 500) {
        return { kind: "NETWORK_FAILURE", message: this.readBodyMessage(body) ?? "Billing backend unavailable" };
      }
      if (!response.ok) {
        return {
          kind: "REQUEST_REJECTED",
          statusCode: response.status,
          message: this.readBodyMessage(body) ?? "Billing credit note request was rejected",
        };
      }
      const electronicDocument = readBillingElectronicDocumentOutcome(
        body && typeof body === "object" ? (body as { electronicDocument?: unknown }).electronicDocument : null,
      );
      if (!electronicDocument) {
        return { kind: "NETWORK_FAILURE", message: "Billing backend returned no credit note outcome" };
      }
      return { kind: "OUTCOME", electronicDocument };
    } catch (error) {
      return {
        kind: "NETWORK_FAILURE",
        message: error instanceof Error && error.name === "AbortError"
          ? "Billing backend request timed out"
          : error instanceof Error ? error.message : "Billing backend request failed",
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  async issueDebitNote(
    tenantId: string,
    electronicDocumentId: string,
    payload: {
      discrepancyResponseCode?: string;
      discrepancyResponseDescription?: string;
      noteReason?: string;
      amount?: number;
    },
  ): Promise<{
    id: string;
    documentId: string;
    status: string;
    queued?: boolean;
    stages?: Record<string, unknown>;
  }> {
    return this.postDocumentAction(
      `${RETRY_ENDPOINT}/${encodeURIComponent(electronicDocumentId)}/debit-note/issue`,
      tenantId,
      payload,
    );
  }

  private async postDocumentAction<T>(
    endpoint: string,
    tenantId: string,
    extraBody?: Record<string, unknown>,
  ): Promise<T> {
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
          body: JSON.stringify({ tenantId, ...(extraBody ?? {}) }),
          signal: controller.signal,
        },
      );
      if (!response.ok) {
        let errMessage = "Billing document action was rejected";
        try {
          const body = await response.json();
          if (body?.message) errMessage = String(body.message);
        } catch {
          // ignore
        }
        throw new Error(errMessage);
      }
      return await response.json() as T;
    } finally {
      clearTimeout(timeout);
    }
  }

  private async readJsonBody(response: Response): Promise<unknown> {
    const text = await response.text();
    if (text.trim().length === 0) {
      return null;
    }
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }

  private async getInternalAdminRead<T>(endpoint: string, correlationId?: string): Promise<T> {
    if (!this.config.billingBackendBaseUrl || !this.config.internalToken) {
      throw new BillingAdminRequestError(503, "Billing backend internal client is not configured");
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);
    try {
      const response = await fetch(
        new URL(endpoint, withTrailingSlash(this.config.billingBackendBaseUrl)),
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${this.config.internalToken}`,
            Accept: "application/json",
            ...(correlationId ? { "x-correlation-id": correlationId } : {}),
          },
          signal: controller.signal,
        },
      );
      if (!response.ok) {
        let body: unknown = null;
        try { body = await response.json(); } catch { /* safe metadata is optional */ }
        throw new BillingAdminRequestError(
          response.status,
          "Billing backend administrative read was rejected",
          readSafeContextDiagnostic(body),
        );
      }
      return await response.json() as T;
    } catch (error) {
      if (error instanceof BillingAdminRequestError) {
        throw error;
      }
      throw new BillingAdminRequestError(
        503,
        error instanceof Error && error.name === "AbortError"
          ? "Billing backend administrative read timed out"
          : "Billing backend administrative read failed",
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  private async requestInternalAdmin<T>(
    method: "POST" | "PATCH",
    endpoint: string,
    body: unknown,
  ): Promise<T> {
    if (!this.config.billingBackendBaseUrl || !this.config.internalToken) {
      throw new BillingAdminRequestError(503, "Billing backend internal client is not configured");
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);
    try {
      const response = await fetch(
        new URL(endpoint, withTrailingSlash(this.config.billingBackendBaseUrl)),
        {
          method,
          headers: {
            Authorization: `Bearer ${this.config.internalToken}`,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify(body),
          signal: controller.signal,
        },
      );
      if (!response.ok) {
        const statusCode = [400, 404, 409].includes(response.status)
          ? response.status
          : 503;
        throw new BillingAdminRequestError(statusCode, "Billing provider administration was rejected");
      }
      return await response.json() as T;
    } catch (error) {
      if (error instanceof BillingAdminRequestError) {
        throw error;
      }
      throw new BillingAdminRequestError(
        503,
        error instanceof Error && error.name === "AbortError"
          ? "Billing provider administration timed out"
          : "Billing provider administration is unavailable",
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  private readBodyMessage(body: unknown) {
    if (typeof body === "string") {
      return body.trim() || null;
    }
    if (body && typeof body === "object" && "message" in body) {
      const message = (body as { message?: unknown }).message;
      if (Array.isArray(message)) {
        return message.map(String).join("; ");
      }
      return typeof message === "string" ? message : null;
    }
    return null;
  }

  private async classifyResponse(response: Response): Promise<BillingIntegrationDeliveryResult> {
    const retryAfterMs = normalizeRetryAfter(response.headers.get("retry-after"));

    const body = await this.readJsonBody(response);

    if (response.ok && typeof body === "object" && body !== null && "status" in body) {
      const status = String((body as { status?: string }).status ?? "");
      const message =
        typeof (body as { message?: unknown }).message === "string"
          ? ((body as { message?: string }).message ?? null)
          : null;
      const electronicDocument = readBillingElectronicDocumentOutcome(
        (body as { electronicDocument?: unknown }).electronicDocument,
      );

      if (isSuccessStatus(status)) {
        return {
          outcome: status === "ALREADY_PROCESSED" ? "ALREADY_PROCESSED" : "PUBLISHED",
          retryable: false,
          statusCode: response.status,
          message,
          retryAfterMs: null,
          electronicDocument,
        };
      }

      if (status === "INVALID_EVENT") {
        return {
          outcome: "NON_RETRYABLE_FAILURE",
          retryable: false,
          statusCode: response.status,
          message,
          retryAfterMs: null,
          electronicDocument,
        };
      }

      if (status === "TEMPORARY_FAILURE") {
        return {
          outcome: "RETRYABLE_FAILURE",
          retryable: true,
          statusCode: response.status,
          message,
          retryAfterMs,
          electronicDocument,
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
