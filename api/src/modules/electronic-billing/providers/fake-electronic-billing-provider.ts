import type {
  DownloadElectronicDocumentAttachmentCommand,
  ElectronicBillingProviderAttachmentResult,
  ElectronicBillingProviderCapabilities,
  ElectronicBillingProviderContext,
  ElectronicBillingProviderDocumentResult,
  ElectronicBillingProviderOperationsResult,
  ElectronicBillingProviderStatusResult,
  IssueElectronicCreditNoteCommand,
  IssueElectronicInvoiceCommand,
  RetryElectronicDocumentCommand,
  GetElectronicDocumentStatusCommand,
} from "../contracts/electronic-billing-commands";
import type { ElectronicBillingProvider } from "../contracts/electronic-billing-provider";

type FakeProviderHandlers = {
  issueInvoice?: (command: IssueElectronicInvoiceCommand) => Promise<ElectronicBillingProviderDocumentResult> | ElectronicBillingProviderDocumentResult;
  issueCreditNote?: (command: IssueElectronicCreditNoteCommand) => Promise<ElectronicBillingProviderDocumentResult> | ElectronicBillingProviderDocumentResult;
  getDocumentStatus?: (command: GetElectronicDocumentStatusCommand) => Promise<ElectronicBillingProviderStatusResult> | ElectronicBillingProviderStatusResult;
  getDocumentOperations?: (command: GetElectronicDocumentStatusCommand) => Promise<ElectronicBillingProviderOperationsResult> | ElectronicBillingProviderOperationsResult;
  retryDocument?: (command: RetryElectronicDocumentCommand) => Promise<ElectronicBillingProviderStatusResult> | ElectronicBillingProviderStatusResult;
  downloadAttachment?: (command: DownloadElectronicDocumentAttachmentCommand) => Promise<ElectronicBillingProviderAttachmentResult> | ElectronicBillingProviderAttachmentResult;
};

type FakeProviderState = {
  issueInvoice: IssueElectronicInvoiceCommand[];
  issueCreditNote: IssueElectronicCreditNoteCommand[];
  getDocumentStatus: GetElectronicDocumentStatusCommand[];
  getDocumentOperations: GetElectronicDocumentStatusCommand[];
  retryDocument: RetryElectronicDocumentCommand[];
  downloadAttachment: DownloadElectronicDocumentAttachmentCommand[];
};

const defaultCapabilities: ElectronicBillingProviderCapabilities = {
  invoice: true,
  creditNote: true,
  debitNote: false,
  retry: true,
  pdf: true,
  xml: true,
  signedXml: true,
  asyncStatus: true,
  attachmentDownload: true,
};

const makeDocumentResult = (
  documentId: string,
  providerStatus: string,
  overrides: Partial<ElectronicBillingProviderDocumentResult> = {},
): ElectronicBillingProviderDocumentResult => ({
  documentId,
  providerStatus,
  normalizedStatus: overrides.normalizedStatus ?? "PROCESSING",
  providerStatusDetail: overrides.providerStatusDetail ?? null,
  providerDocumentId: overrides.providerDocumentId ?? `FAKE-${documentId}`,
  prefix: overrides.prefix ?? "FKE",
  number: overrides.number ?? "1",
  fullNumber: overrides.fullNumber ?? "FKE-1",
  cufe: overrides.cufe ?? null,
  cude: overrides.cude ?? null,
  acceptedAt: overrides.acceptedAt ?? null,
  rejectedAt: overrides.rejectedAt ?? null,
  metadata: overrides.metadata ?? {},
});

const makeStatusResult = (
  documentId: string,
  normalizedStatus: ElectronicBillingProviderStatusResult["normalizedStatus"],
  overrides: Partial<ElectronicBillingProviderStatusResult> = {},
): ElectronicBillingProviderStatusResult => ({
  documentId,
  providerStatus: overrides.providerStatus ?? normalizedStatus,
  normalizedStatus,
  providerStatusDetail: overrides.providerStatusDetail ?? null,
  providerDocumentId: overrides.providerDocumentId ?? `FAKE-${documentId}`,
  prefix: overrides.prefix ?? "FKE",
  number: overrides.number ?? "1",
  fullNumber: overrides.fullNumber ?? "FKE-1",
  cufe: overrides.cufe ?? null,
  cude: overrides.cude ?? null,
  acceptedAt: overrides.acceptedAt ?? null,
  rejectedAt: overrides.rejectedAt ?? null,
  errorCode: overrides.errorCode ?? null,
  errorMessage: overrides.errorMessage ?? null,
  metadata: overrides.metadata ?? {},
});

const makeAttachmentResult = (
  command: DownloadElectronicDocumentAttachmentCommand,
): ElectronicBillingProviderAttachmentResult => ({
  documentId: command.documentId,
  providerDocumentId: command.providerDocumentId ?? `FAKE-${command.documentId}`,
  attachmentType: command.attachmentType,
  providerAttachmentId: `FAKE-ATT-${command.documentId}`,
  fileName: `${command.attachmentType.toLowerCase()}.bin`,
  mimeType: "application/octet-stream",
  storageProvider: "fake",
  storageKey: `fake/${command.documentId}/${command.attachmentType.toLowerCase()}`,
  checksum: null,
  sizeBytes: null,
  metadata: {},
});

export class FakeElectronicBillingProvider implements ElectronicBillingProvider {
  public readonly code: string;
  public readonly capabilities: ElectronicBillingProviderCapabilities;
  public readonly received: FakeProviderState = {
    issueInvoice: [],
    issueCreditNote: [],
    getDocumentStatus: [],
    getDocumentOperations: [],
    retryDocument: [],
    downloadAttachment: [],
  };

  constructor(
    code = "FAKE_PROVIDER",
    private readonly handlers: FakeProviderHandlers = {},
    capabilities: Partial<ElectronicBillingProviderCapabilities> = {},
  ) {
    this.code = code;
    this.capabilities = {
      ...defaultCapabilities,
      ...capabilities,
    };
  }

  async issueInvoice(command: IssueElectronicInvoiceCommand) {
    this.received.issueInvoice.push(command);
    const handler = this.handlers.issueInvoice;
    if (handler) {
      return handler(command);
    }
    return makeDocumentResult(command.documentId, "SENT");
  }

  async issueCreditNote(command: IssueElectronicCreditNoteCommand) {
    this.received.issueCreditNote.push(command);
    const handler = this.handlers.issueCreditNote;
    if (handler) {
      return handler(command);
    }
    return makeDocumentResult(command.documentId, "SENT", {
      normalizedStatus: "PROCESSING",
    });
  }

  async getDocumentStatus(command: GetElectronicDocumentStatusCommand) {
    this.received.getDocumentStatus.push(command);
    const handler = this.handlers.getDocumentStatus;
    if (handler) {
      return handler(command);
    }
    return makeStatusResult(command.documentId, "PROCESSING");
  }

  async getDocumentOperations(command: GetElectronicDocumentStatusCommand) {
    this.received.getDocumentOperations.push(command);
    const handler = this.handlers.getDocumentOperations;
    if (handler) {
      return handler(command);
    }
    return {
      documentId: command.documentId,
      providerDocumentId: command.providerDocumentId ?? `FAKE-${command.documentId}`,
      providerStatus: "PROCESSING",
      normalizedStatus: "PROCESSING",
      currentStep: "TRANSMISSION_REQUESTED",
      availableActions: ["read", "transmit"],
      artifactsAvailable: {
        xml: true,
        signedXml: true,
        pdf: true,
      },
      latestTransmission: null,
      metadata: {},
    } satisfies ElectronicBillingProviderOperationsResult;
  }

  async retryDocument(command: RetryElectronicDocumentCommand) {
    this.received.retryDocument.push(command);
    const handler = this.handlers.retryDocument;
    if (handler) {
      return handler(command);
    }
    return makeStatusResult(command.documentId, "PROCESSING", {
      providerStatus: "RETRY_REQUESTED",
    });
  }

  async downloadAttachment(command: DownloadElectronicDocumentAttachmentCommand) {
    this.received.downloadAttachment.push(command);
    const handler = this.handlers.downloadAttachment;
    if (handler) {
      return handler(command);
    }
    return makeAttachmentResult(command);
  }
}
