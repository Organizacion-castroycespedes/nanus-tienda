import {
  Body,
  Controller,
  Inject,
  Headers,
  ForbiddenException,
  Param,
  Post,
  UnauthorizedException,
} from "@nestjs/common";
import { SaleCompletedForElectronicBillingConsumerService } from "./electronic-billing-sale-event.consumer";
import type { ElectronicBillingConsumptionResult } from "./electronic-billing-consumer.types";
import type { SaleCompletedForElectronicBillingEventEnvelope } from "../contracts/electronic-billing-integration-events";
import {
  ElectronicBillingProcessingService,
  type ElectronicBillingRetryability,
  type ProcessingResult,
  type SafeStatusReconciliationResult,
} from "../services";

type StatusRefreshBody = { tenantId?: unknown };
type RetryBody = { tenantId?: unknown };

const stringValue = (value: unknown) => typeof value === "string" && value.trim() ? value.trim() : null;

const documentNumber = (document: SafeStatusReconciliationResult["document"]) =>
  stringValue(document.full_number)
  ?? (`${document.prefix ?? ""}${document.number ?? ""}`.trim() || null);

const providerResponse = (document: SafeStatusReconciliationResult["document"]) => {
  const value = document.metadata?.providerResponse;
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
};

const mapStatusRefreshResult = (result: SafeStatusReconciliationResult) => {
  const response = providerResponse(result.document);
  return {
    outcome: result.outcome,
    electronicDocumentId: result.document.id,
    status: result.document.status,
    providerStatus: result.document.provider_status,
    providerDocumentId: result.document.provider_document_id,
    documentNumber: documentNumber(result.document),
    cufe: result.document.cufe,
    acceptedAt: result.document.accepted_at,
    providerStatusCode: stringValue(response.code),
    providerStatusMessage: stringValue(response.message),
    trackingId: stringValue(response.trackingId),
    refreshedAt: new Date().toISOString(),
  };
};

const mapRetryability = (decision: ElectronicBillingRetryability) => ({
  canRetry: decision.canRetry,
  canRecoverProviderCreateIntent: decision.canRecoverProviderCreateIntent,
  canRecoverExistingProvider: decision.canRecoverExistingProvider ?? false,
  retryClass: decision.retryClass,
  decision: decision.decision,
  reasonCode: decision.reason,
  requiredAction: decision.requiredAction,
  requiresReconciliation: decision.requiresReconciliation,
  providerDocumentExists: decision.providerDocumentExists,
  processingStage: decision.processingStage,
  safeUserMessage: decision.safeUserMessage,
});

const mapRetryResult = (result: ProcessingResult, decision: ElectronicBillingRetryability) => ({
  allowed: true,
  canRetry: decision.canRetry,
  disposition: "RETRY_STARTED",
  reasonCode: decision.reason,
  requiredAction: decision.requiredAction,
  status: result.document.status,
  processingStage: result.document.processing_stage,
  safeUserMessage: "El procesamiento FE fue reintentado.",
});

const normalizeBearer = (value: string | undefined) => {
  if (!value) {
    return null;
  }

  return value.toLowerCase().startsWith("bearer ") ? value.slice(7).trim() : value.trim();
};

@Controller("internal/electronic-billing")
export class ElectronicBillingSaleEventController {
  constructor(
    @Inject(SaleCompletedForElectronicBillingConsumerService)
    private readonly consumer: SaleCompletedForElectronicBillingConsumerService,
    @Inject(ElectronicBillingProcessingService)
    private readonly processingService: ElectronicBillingProcessingService,
  ) {}

  @Post("events/sale-completed")
  async receiveSaleCompletedEvent(
    @Headers("authorization") authorization: string | undefined,
    @Body() body: SaleCompletedForElectronicBillingEventEnvelope,
  ): Promise<ElectronicBillingConsumptionResult> {
    console.debug("[ElectronicBillingSaleEventController] receive", {
      eventId: body?.eventId,
      eventType: body?.eventType,
      schemaVersion: body?.schemaVersion,
      tenantId: body?.tenantId,
      sourceType: body?.source?.type,
      sourceId: body?.source?.id,
      payloadKeys: Object.keys(body?.payload ?? {}),
    });
    this.assertInternalToken(authorization);
    return this.consumer.consume(body);
  }

  @Post("documents/:documentId/status-refresh")
  async refreshDocumentStatus(
    @Headers("authorization") authorization: string | undefined,
    @Param("documentId") documentId: string,
    @Body() body: StatusRefreshBody,
  ) {
    this.assertInternalToken(authorization);
    const tenantId = stringValue(body?.tenantId);
    if (!tenantId || !stringValue(documentId)) {
      throw new ForbiddenException("Status refresh identity is required");
    }

    const result = await this.processingService.reconcileExistingProviderStatus(tenantId, documentId);
    return mapStatusRefreshResult(result);
  }

  @Post("documents/:documentId/staged-resume")
  async resumeLinkedProviderDocument(
    @Headers("authorization") authorization: string | undefined,
    @Param("documentId") documentId: string,
    @Body() body: StatusRefreshBody,
  ) {
    this.assertInternalToken(authorization);
    const tenantId = stringValue(body?.tenantId);
    if (!tenantId || !stringValue(documentId)) {
      throw new ForbiddenException("Staged recovery identity is required");
    }
    const result = await this.processingService.resumeLinkedProviderDocument(tenantId, documentId);
    const response = providerResponse(result.document);
    return {
      electronicDocumentId: result.document.id,
      status: result.document.status,
      processingStage: result.document.processing_stage,
      providerStatus: result.document.provider_status,
      providerDocumentId: result.document.provider_document_id,
      documentNumber: documentNumber(result.document),
      cufe: result.document.cufe,
      providerStatusCode: stringValue(response.code),
      providerStatusMessage: stringValue(response.message),
    };
  }

  @Post("documents/:documentId/provider-data-recovery")
  async recoverAcceptedProviderData(
    @Headers("authorization") authorization: string | undefined,
    @Param("documentId") documentId: string,
    @Body() body: StatusRefreshBody,
  ) {
    this.assertInternalToken(authorization);
    const tenantId = stringValue(body?.tenantId);
    if (!tenantId || !stringValue(documentId)) {
      throw new ForbiddenException("Provider recovery identity is required");
    }
    const result = await this.processingService.recoverAcceptedProviderData(tenantId, documentId);
    return {
      recovered: result.recovered,
      electronicDocumentId: result.document.id,
      status: result.document.status,
      fullNumber: documentNumber(result.document),
      cufe: result.document.cufe,
      providerDocumentId: result.document.provider_document_id,
      providerStatus: result.document.provider_status,
      acceptedAt: result.document.accepted_at,
      providerResponse: providerResponse(result.document),
      readOperations: result.readOperations,
    };
  }

  @Post("documents/:documentId/retryability")
  async evaluateDocumentRetryability(
    @Headers("authorization") authorization: string | undefined,
    @Param("documentId") documentId: string,
    @Body() body: RetryBody,
  ) {
    this.assertInternalToken(authorization);
    const tenantId = stringValue(body?.tenantId);
    if (!tenantId || !stringValue(documentId)) {
      throw new ForbiddenException("Retry identity is required");
    }
    return mapRetryability(await this.processingService.evaluateRetryability(tenantId, documentId));
  }

  @Post("documents/:documentId/retry")
  async retryDocument(
    @Headers("authorization") authorization: string | undefined,
    @Param("documentId") documentId: string,
    @Body() body: RetryBody,
  ) {
    this.assertInternalToken(authorization);
    const tenantId = stringValue(body?.tenantId);
    if (!tenantId || !stringValue(documentId)) {
      throw new ForbiddenException("Retry identity is required");
    }
    const decision = await this.processingService.evaluateRetryability(tenantId, documentId);
    if (!decision.canRetry) {
      return {
        allowed: false,
        canRetry: false,
        disposition: decision.decision,
        reasonCode: decision.reason,
        requiredAction: decision.requiredAction,
        status: null,
        processingStage: null,
        safeUserMessage: decision.safeUserMessage,
      };
    }
    return mapRetryResult(
      await this.processingService.retryRecoverableDocument(tenantId, documentId),
      decision,
    );
  }

  @Post("documents/:documentId/recover-after-provider-absence")
  async recoverAfterConfirmedProviderAbsence(
    @Headers("authorization") authorization: string | undefined,
    @Param("documentId") documentId: string,
    @Body() body: RetryBody,
  ) {
    this.assertInternalToken(authorization);
    const tenantId = stringValue(body?.tenantId);
    if (!tenantId || !stringValue(documentId)) {
      throw new ForbiddenException("Confirmed-absence recovery identity is required");
    }
    const result = await this.processingService.recoverAfterConfirmedProviderAbsence(
      tenantId,
      documentId,
    );
    return {
      allowed: true,
      recovery: "CONFIRMED_PROVIDER_ABSENCE",
      resultCode: result.providerResult
        ? "REMOTE_FOUND_RECONCILED"
        : "REMOTE_NOT_FOUND_RECOVERED",
      safeUserMessage: result.providerResult
        ? "Se encontr\u00f3 y reconcili\u00f3 el documento existente en FactuCore."
        : "FactuCore confirm\u00f3 que no existe el documento. El procesamiento continuar\u00e1 de forma segura.",
      electronicDocumentId: result.document.id,
      status: result.document.status,
      processingStage: result.document.processing_stage,
      providerStatus: result.document.provider_status,
      providerDocumentId: result.document.provider_document_id,
      fullNumber: documentNumber(result.document),
      cufe: result.document.cufe,
    };
  }

  @Post("documents/:documentId/recover-processing")
  async recoverProcessing(
    @Headers("authorization") authorization: string | undefined,
    @Param("documentId") documentId: string,
    @Body() body: RetryBody,
  ) {
    this.assertInternalToken(authorization);
    const tenantId = stringValue(body?.tenantId);
    if (!tenantId || !stringValue(documentId)) {
      throw new ForbiddenException("Recovery identity is required");
    }
    const result = await this.processingService.recoverProcessing(tenantId, documentId);
    return {
      allowed: true,
      recovery: result.recovery,
      resultCode: result.resultCode,
      safeUserMessage: result.recovery === "EXISTING_PROVIDER_RESUMED"
        ? "Se reutilizó el documento existente en FactuCore y se continuó su procesamiento."
        : result.providerResult
          ? "Se encontró y reconcilió el documento existente en FactuCore."
          : "FactuCore confirmó que el documento no existía. El procesamiento continuará de forma segura.",
      electronicDocumentId: result.document.id,
      status: result.document.status,
      processingStage: result.document.processing_stage,
      providerStatus: result.document.provider_status,
      providerDocumentId: result.document.provider_document_id,
      fullNumber: documentNumber(result.document),
      cufe: result.document.cufe,
    };
  }

  private assertInternalToken(authorization: string | undefined) {
    const configuredToken = process.env.API_INTERNAL_TOKEN?.trim();
    if (!configuredToken) {
      throw new UnauthorizedException("Internal auth token is not configured");
    }

    const token = normalizeBearer(authorization);
    if (!token) {
      throw new ForbiddenException("Missing internal authorization token");
    }

    if (token !== configuredToken) {
      throw new ForbiddenException("Invalid internal authorization token");
    }
  }
}
