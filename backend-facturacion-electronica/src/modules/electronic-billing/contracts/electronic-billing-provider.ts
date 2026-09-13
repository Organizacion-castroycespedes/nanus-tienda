import type {
  DownloadElectronicDocumentAttachmentCommand,
  ElectronicBillingProviderAttachmentResult,
  ElectronicBillingProviderCapabilities,
  ElectronicBillingProviderDocumentResult,
  ElectronicBillingProviderOperationsResult,
  ElectronicBillingProviderStatusResult,
  GetElectronicDocumentStatusCommand,
  IssueElectronicCreditNoteCommand,
  IssueElectronicInvoiceCommand,
  RetryElectronicDocumentCommand,
} from "./electronic-billing-commands";
import { ElectronicBillingProviderCapabilityError } from "./electronic-billing-errors";

export interface ElectronicBillingProvider {
  readonly code: string;
  readonly capabilities: ElectronicBillingProviderCapabilities;

  issueInvoice(
    command: IssueElectronicInvoiceCommand
  ): Promise<ElectronicBillingProviderDocumentResult>;

  resumeInvoice?(
    command: IssueElectronicInvoiceCommand,
    providerDocumentId: string,
  ): Promise<ElectronicBillingProviderDocumentResult>;

  issueCreditNote(
    command: IssueElectronicCreditNoteCommand
  ): Promise<ElectronicBillingProviderDocumentResult>;

  getDocumentStatus(
    command: GetElectronicDocumentStatusCommand
  ): Promise<ElectronicBillingProviderStatusResult>;

  getDocumentOperations?(
    command: GetElectronicDocumentStatusCommand
  ): Promise<ElectronicBillingProviderOperationsResult>;

  retryDocument?(
    command: RetryElectronicDocumentCommand
  ): Promise<ElectronicBillingProviderStatusResult>;

  downloadAttachment?(
    command: DownloadElectronicDocumentAttachmentCommand
  ): Promise<ElectronicBillingProviderAttachmentResult>;
}

export function assertElectronicBillingProviderCapability(
  provider: ElectronicBillingProvider,
  capability: keyof ElectronicBillingProvider["capabilities"]
) {
  if (!provider.capabilities[capability]) {
    throw new ElectronicBillingProviderCapabilityError(
      provider.code,
      capability
    );
  }
}
