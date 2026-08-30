import { Inject, Injectable } from "@nestjs/common";
import { ElectronicBillingProviderError } from "../../contracts/electronic-billing-errors";
import type {
  DownloadElectronicDocumentAttachmentCommand,
  ElectronicBillingProviderCapabilities,
  ElectronicBillingProviderContext,
  ElectronicBillingProviderDocumentResult,
  ElectronicBillingProviderOperationsResult,
  ElectronicBillingProviderStatusResult,
  GetElectronicDocumentStatusCommand,
  IssueElectronicCreditNoteCommand,
  IssueElectronicInvoiceCommand,
  RetryElectronicDocumentCommand,
} from "../../contracts/electronic-billing-commands";
import type { ElectronicBillingProvider } from "../../contracts/electronic-billing-provider";
import { assertElectronicBillingProviderCapability } from "../../contracts/electronic-billing-provider";
import {
  ElectronicBillingCredentialResolutionError,
  ELECTRONIC_BILLING_CREDENTIAL_RESOLVER,
} from "../../credentials";
import type {
  ElectronicBillingCredentialResolver,
  ElectronicBillingResolvedCredential,
} from "../../credentials";
import {
  FactuCoreConfigurationError,
  FactuCoreError,
  FactuCoreMissingCredentialsError,
} from "./factucore.errors";
import { FactuCoreClient } from "./factucore.client";
import { FactuCoreMapper } from "./factucore.mapper";
import {
  FACTUCORE_DEFAULT_TIMEOUT_MS,
  type FactuCoreCredentials,
  type FactuCoreDocumentResponse,
  type FactuCoreRuntimeContext,
  type FactuCoreStatusResponse,
} from "./factucore.types";

type FactuCoreDocumentSnapshot = FactuCoreDocumentResponse | FactuCoreStatusResponse;

const DEFAULT_CAPABILITIES: ElectronicBillingProviderCapabilities = {
  invoice: true,
  creditNote: true,
  debitNote: true,
  retry: true,
  pdf: true,
  xml: true,
  signedXml: true,
  asyncStatus: true,
  attachmentDownload: true,
};

const buildDocumentResult = (
  mapper: FactuCoreMapper,
  documentId: string,
  response: FactuCoreDocumentSnapshot,
  fallbackStatus?: string | null,
): ElectronicBillingProviderDocumentResult => mapper.mapDocumentResult(documentId, response, fallbackStatus);

const buildStatusResult = (
  mapper: FactuCoreMapper,
  documentId: string,
  response: FactuCoreStatusResponse,
): ElectronicBillingProviderStatusResult => mapper.mapStatusResult(documentId, response);

const mergeDocumentResponses = (...responses: FactuCoreDocumentSnapshot[]) => {
  const merged: FactuCoreDocumentSnapshot = {};
  for (const response of responses) {
    if (!response) {
      continue;
    }

    Object.assign(merged, response);
  }

  return merged;
};

@Injectable()
export class FactuCoreProvider implements ElectronicBillingProvider {
  readonly code = "FACTUCORE";
  readonly capabilities = DEFAULT_CAPABILITIES;

  constructor(
    private readonly client: FactuCoreClient,
    @Inject(ELECTRONIC_BILLING_CREDENTIAL_RESOLVER)
    private readonly credentialResolver: ElectronicBillingCredentialResolver,
    private readonly mapper: FactuCoreMapper = new FactuCoreMapper(),
  ) {}

  async issueInvoice(command: IssueElectronicInvoiceCommand) {
    const runtime = await this.resolveRuntimeContext("issue_invoice", command.context);
    assertElectronicBillingProviderCapability(this, "invoice");

    const created = await this.client.createInvoice(runtime, this.mapper.buildInvoiceRequest(command));
    const createdDocumentId = this.resolveProviderDocumentId(created);
    if (!createdDocumentId) {
      throw new FactuCoreConfigurationError("issue_invoice", "FactuCore create invoice response did not include a document id");
    }

    const generated = await this.client.generateXml(runtime, createdDocumentId);
    const signed = await this.client.sign(runtime, createdDocumentId);
    const transmitted = await this.client.transmit(runtime, createdDocumentId);
    const merged = mergeDocumentResponses(created, generated, signed, transmitted);

    return buildDocumentResult(this.mapper, command.documentId, merged, transmitted.status ?? transmitted.providerStatus ?? "SENT");
  }

  async issueCreditNote(command: IssueElectronicCreditNoteCommand) {
    const runtime = await this.resolveRuntimeContext("issue_credit_note", command.context);
    assertElectronicBillingProviderCapability(this, "creditNote");

    const created = await this.client.createCreditNote(runtime, this.mapper.buildCreditNoteRequest(command));
    const createdDocumentId = this.resolveProviderDocumentId(created);
    if (!createdDocumentId) {
      throw new FactuCoreConfigurationError("issue_credit_note", "FactuCore create credit note response did not include a document id");
    }

    const generated = await this.client.generateXml(runtime, createdDocumentId);
    const signed = await this.client.sign(runtime, createdDocumentId);
    const transmitted = await this.client.transmit(runtime, createdDocumentId);
    const merged = mergeDocumentResponses(created, generated, signed, transmitted);

    return buildDocumentResult(this.mapper, command.documentId, merged, transmitted.status ?? transmitted.providerStatus ?? "SENT");
  }

  async getDocumentStatus(command: GetElectronicDocumentStatusCommand) {
    const runtime = await this.resolveRuntimeContext("get_document_status", command.context);
    assertElectronicBillingProviderCapability(this, "asyncStatus");

    const statusResponse = command.providerDocumentId
      ? await this.client.getStatus(runtime, command.providerDocumentId)
      : command.externalReference
        ? await this.client.getStatusByExternalReference(runtime, command.externalReference)
        : null;

    if (!statusResponse) {
      throw new FactuCoreConfigurationError("get_document_status", "FactuCore status lookup requires providerDocumentId or externalReference");
    }

    return buildStatusResult(this.mapper, command.documentId, statusResponse);
  }

  async getDocumentOperations(command: GetElectronicDocumentStatusCommand): Promise<ElectronicBillingProviderOperationsResult> {
    const runtime = await this.resolveRuntimeContext("get_document_operations", command.context);
    const providerDocumentId = await this.resolveProviderDocumentIdForLookup(runtime, command);
    const operations = await this.client.getOperations(runtime, providerDocumentId);
    return this.mapper.mapOperationsResult(command.documentId, operations);
  }

  async retryDocument(command: RetryElectronicDocumentCommand) {
    const runtime = await this.resolveRuntimeContext("retry_document", command.context);
    assertElectronicBillingProviderCapability(this, "retry");

    const providerDocumentId = await this.resolveProviderDocumentIdForLookup(runtime, command);
    const retried = await this.client.retryTransmission(runtime, providerDocumentId);
    return buildStatusResult(this.mapper, command.documentId, retried);
  }

  async downloadAttachment(command: DownloadElectronicDocumentAttachmentCommand) {
    const runtime = await this.resolveRuntimeContext("download_attachment", command.context);
    assertElectronicBillingProviderCapability(this, command.attachmentType === "PDF" ? "pdf" : command.attachmentType === "SIGNED_XML" ? "signedXml" : "xml");

    const providerDocumentId = await this.resolveProviderDocumentIdForLookup(runtime, command);
    const attachment =
      command.attachmentType === "XML"
        ? await this.client.downloadXml(runtime, providerDocumentId)
        : command.attachmentType === "SIGNED_XML"
          ? await this.client.downloadSignedXml(runtime, providerDocumentId)
          : await this.client.downloadPdf(runtime, providerDocumentId);

    return this.mapper.mapAttachmentResult(command.documentId, command.attachmentType, attachment);
  }

  private async resolveRuntimeContext(operation: string, context: ElectronicBillingProviderContext): Promise<FactuCoreRuntimeContext> {
    if (!context.baseUrl || context.baseUrl.trim().length === 0) {
      throw new FactuCoreConfigurationError(operation, "FactuCore baseUrl is required");
    }

    const credentials = await this.resolveCredentials(operation, context);
    const timeoutMs = this.mapper.resolveTimeoutMs(context.settings) ?? FACTUCORE_DEFAULT_TIMEOUT_MS;

    return {
      baseUrl: context.baseUrl,
      credentials,
      timeoutMs,
    };
  }

  private async resolveCredentials(operation: string, context: ElectronicBillingProviderContext): Promise<FactuCoreCredentials> {
    let credentials: ElectronicBillingResolvedCredential | null;

    try {
      credentials = await this.credentialResolver.resolve({
        tenantId: context.tenantId,
        providerId: context.providerId,
        providerCode: this.code,
        providerConfigId: context.providerConfigId,
        credentialReference: context.credentialReference ?? null,
        settings: context.settings ?? null,
      });
    } catch (error) {
      if (error instanceof ElectronicBillingCredentialResolutionError) {
        throw new FactuCoreConfigurationError(operation, error.message);
      }

      throw error;
    }

    if (!credentials) {
      throw new FactuCoreMissingCredentialsError(operation);
    }

    const clientKey = typeof credentials.values.clientKey === "string" ? credentials.values.clientKey.trim() : "";
    const clientSecret = typeof credentials.values.clientSecret === "string" ? credentials.values.clientSecret.trim() : "";

    if (!clientKey || !clientSecret) {
      throw new FactuCoreConfigurationError(
        operation,
        "FactuCore credential payload must include clientKey and clientSecret",
      );
    }

    return {
      clientKey,
      clientSecret,
    };
  }

  private resolveProviderDocumentId(response: FactuCoreDocumentSnapshot) {
    return (
      (typeof response.providerDocumentId === "string" && response.providerDocumentId.trim().length > 0
        ? response.providerDocumentId.trim()
        : null)
      ?? (typeof response.id === "string" && response.id.trim().length > 0 ? response.id.trim() : null)
      ?? (typeof response.documentId === "string" && response.documentId.trim().length > 0 ? response.documentId.trim() : null)
    );
  }

  private async resolveProviderDocumentIdForLookup(
    runtime: FactuCoreRuntimeContext,
    command: GetElectronicDocumentStatusCommand | RetryElectronicDocumentCommand | DownloadElectronicDocumentAttachmentCommand,
  ) {
    if (command.providerDocumentId && command.providerDocumentId.trim().length > 0) {
      return command.providerDocumentId.trim();
    }

    if (command.externalReference && command.externalReference.trim().length > 0) {
      const status = await this.client.getStatusByExternalReference(runtime, command.externalReference);
      const resolved = this.resolveProviderDocumentId(status);
      if (resolved) {
        return resolved;
      }
    }

    throw new FactuCoreConfigurationError("resolve_provider_document_id", "FactuCore provider document id is required for this operation");
  }
}

export function isFactuCoreError(error: unknown): error is FactuCoreError {
  return error instanceof ElectronicBillingProviderError && String((error as ElectronicBillingProviderError).code).startsWith("FACTUCORE_");
}
