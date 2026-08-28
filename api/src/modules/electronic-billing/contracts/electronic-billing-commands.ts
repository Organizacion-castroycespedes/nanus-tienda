import type { ElectronicBillingEnvironment, ElectronicDocumentStatus } from "../types/electronic-billing-records";

export type ElectronicBillingProviderCode = string;

export type ElectronicBillingProviderCapabilities = {
  invoice: boolean;
  creditNote: boolean;
  debitNote: boolean;
  retry: boolean;
  pdf: boolean;
  xml: boolean;
  signedXml: boolean;
  asyncStatus: boolean;
  attachmentDownload: boolean;
};

export type ElectronicBillingProviderContext = {
  tenantId: string;
  providerId: string;
  providerConfigId: string;
  environment: ElectronicBillingEnvironment;
  baseUrl: string | null;
  credentialReference: string | null;
  settings: Record<string, unknown>;
};

export type ElectronicOriginalDocumentReference = {
  internalDocumentId?: string | null;
  providerDocumentId?: string | null;
  externalReference?: string | null;
  fullNumber?: string | null;
};

export type ElectronicCustomerIdentification = {
  typeCode?: string | null;
  number: string;
  verificationDigit?: string | number | null;
};

export type ElectronicCustomer = {
  customerType?: "PERSON" | "COMPANY" | "FOREIGN" | "OTHER";
  identification: ElectronicCustomerIdentification;
  legalName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  municipalityCode?: string | null;
  taxProfile?: {
    identificationTypeCode?: string | null;
    fiscalResponsibilityCodes?: string[] | null;
    taxScheme?: string | null;
    liabilityTypeCode?: string | null;
  };
  metadata?: Record<string, unknown>;
};

export type ElectronicTaxInput = {
  type: string;
  code?: string | null;
  schemeId?: string | null;
  schemeName?: string | null;
  rate: number | string;
  taxableBase: number | string;
  amount: number | string;
  metadata?: Record<string, unknown>;
};

export type ElectronicDocumentLineInput = {
  sourceLineId?: string | null;
  originalElectronicDocumentLineId?: string | null;
  providerOriginalLineId?: string | null;
  sku?: string | null;
  description: string;
  quantity: number | string;
  unitCode?: string | null;
  unitPrice: number | string;
  discountAmount?: number | string | null;
  subtotalAmount: number | string;
  taxAmount: number | string;
  totalAmount: number | string;
  taxTreatment?: string | null;
  standardItemId?: string | null;
  standardItemSchemeId?: string | null;
  taxes?: ElectronicTaxInput[];
  metadata?: Record<string, unknown>;
};

export type ElectronicDocumentTotals = {
  subtotalAmount: number | string;
  discountAmount: number | string;
  taxAmount: number | string;
  totalAmount: number | string;
  currencyCode: string;
};

export type ElectronicPayment = {
  methodCode: string;
  term?: string | null;
  dueDate?: Date | string | null;
  metadata?: Record<string, unknown>;
};

export type ElectronicDocumentIssueBaseCommand = {
  context: ElectronicBillingProviderContext;
  documentId: string;
  externalReference: string;
  issueDate?: string | Date | null;
  issueTime?: string | null;
  customer: ElectronicCustomer;
  payment?: ElectronicPayment | null;
  lines: ElectronicDocumentLineInput[];
  totals: ElectronicDocumentTotals;
  metadata?: Record<string, unknown>;
};

export type ElectronicCreditNoteReason = {
  reasonCode?: string | null;
  reasonDescription?: string | null;
  reasonType?: string | null;
  metadata?: Record<string, unknown>;
};

export type IssueElectronicInvoiceCommand = ElectronicDocumentIssueBaseCommand;

export type IssueElectronicCreditNoteCommand = ElectronicDocumentIssueBaseCommand & {
  originalDocument: ElectronicOriginalDocumentReference;
  reason: ElectronicCreditNoteReason;
};

export type GetElectronicDocumentStatusCommand = {
  context: ElectronicBillingProviderContext;
  documentId: string;
  providerDocumentId?: string | null;
  externalReference?: string | null;
  metadata?: Record<string, unknown>;
};

export type RetryElectronicDocumentCommand = GetElectronicDocumentStatusCommand & {
  reason?: string | null;
};

export type DownloadElectronicDocumentAttachmentCommand = GetElectronicDocumentStatusCommand & {
  attachmentType: "XML" | "SIGNED_XML" | "PDF" | "PROVIDER_RESPONSE";
};

export type ResolveElectronicBillingProviderCommand = {
  tenantId: string;
  providerConfigId?: string | null;
};

export type ResolvedElectronicBillingProviderConfig = {
  configId: string;
  tenantId: string;
  providerId: string;
  providerCode: string;
  providerName: string;
  environment: ElectronicBillingEnvironment;
  enabled: boolean;
  baseUrl: string | null;
  credentialReference: string | null;
  settings: Record<string, unknown>;
  isDefault: boolean;
};

export type ElectronicBillingProviderDocumentResult = {
  documentId: string;
  providerDocumentId?: string | null;
  providerStatus: string;
  normalizedStatus?: ElectronicDocumentStatus | null;
  providerStatusDetail?: string | null;
  prefix?: string | null;
  number?: string | number | null;
  fullNumber?: string | null;
  cufe?: string | null;
  cude?: string | null;
  acceptedAt?: Date | string | null;
  rejectedAt?: Date | string | null;
  metadata?: Record<string, unknown>;
};

export type ElectronicBillingProviderOperationsResult = {
  documentId: string;
  providerDocumentId?: string | null;
  providerStatus?: string | null;
  normalizedStatus?: ElectronicDocumentStatus | null;
  currentStep?: string | null;
  availableActions?: string[];
  artifactsAvailable?: {
    xml?: boolean;
    signedXml?: boolean;
    pdf?: boolean;
  } | null;
  latestTransmission?: Record<string, unknown> | null;
  metadata?: Record<string, unknown>;
};

export type ElectronicBillingProviderStatusResult = {
  documentId: string;
  providerDocumentId?: string | null;
  providerStatus: string;
  normalizedStatus: ElectronicDocumentStatus;
  providerStatusDetail?: string | null;
  prefix?: string | null;
  number?: string | number | null;
  fullNumber?: string | null;
  cufe?: string | null;
  cude?: string | null;
  acceptedAt?: Date | string | null;
  rejectedAt?: Date | string | null;
  errorCode?: string | null;
  errorMessage?: string | null;
  metadata?: Record<string, unknown>;
};

export type ElectronicBillingProviderAttachmentResult = {
  documentId: string;
  providerDocumentId?: string | null;
  attachmentType: "XML" | "SIGNED_XML" | "PDF" | "PROVIDER_RESPONSE";
  providerAttachmentId?: string | null;
  content?: Buffer | Uint8Array | null;
  fileName?: string | null;
  mimeType?: string | null;
  storageProvider?: string | null;
  storageKey?: string | null;
  checksum?: string | null;
  sizeBytes?: number | null;
  metadata?: Record<string, unknown>;
};
