import type {
  ElectronicBillingCredentialContext,
  ElectronicBillingCredentialResolver,
  ElectronicBillingResolvedCredential,
} from "../../credentials";
import type { ElectronicDocumentStatus } from "../../domain/electronic-billing.types";

export { ELECTRONIC_BILLING_CREDENTIAL_RESOLVER as FACTUCORE_CREDENTIAL_RESOLVER } from "../../credentials";

export type FactuCoreCredentials = {
  clientKey: string;
  clientSecret: string;
};

export type FactuCoreCredentialContext = ElectronicBillingCredentialContext;
export type FactuCoreResolvedCredential = ElectronicBillingResolvedCredential;
export type FactuCoreCredentialResolver = ElectronicBillingCredentialResolver;

export type FactuCoreIdentification = {
  typeCode: string;
  typeName?: string | null;
  number: string;
  verificationDigit?: string | number | null;
};

export type FactuCoreCustomer = {
  customerType?: "PERSON" | "COMPANY" | "FOREIGN" | "OTHER" | null;
  identificationType?: string | null;
  identificationTypeCode: string;
  identificationNumber: string;
  verificationDigit?: string | number | null;
  legalName: string;
  tradeName?: string | null;
  firstName?: string | null;
  middleName?: string | null;
  familyName?: string | null;
  secondFamilyName?: string | null;
  taxLevelCode?: string | null;
  taxSchemeId?: string | null;
  taxSchemeName?: string | null;
  fiscalResponsibilityCode?: string | null;
  fiscalResponsibilityCodes?: string[] | null;
  fiscalResponsibilities?: string[] | null;
  email?: string | null;
  phone?: string | null;
  addressLine1?: string | null;
  countryCode?: string | null;
  departmentCode?: string | null;
  municipalityCode?: string | null;
  cityName?: string | null;
  departmentName?: string | null;
  countryName?: string | null;
  postalZone?: string | null;
  taxRegime?: string | null;
  merchantRegistration?: string | null;
};

export type FactuCoreTax = {
  taxType: string;
  rate: number | string;
  taxableBase: number | string;
  taxAmount: number | string;
  taxCode?: string | null;
  taxSchemeId?: string | null;
  taxSchemeName?: string | null;
  metadata?: Record<string, unknown>;
};

export type FactuCoreDocumentLine = {
  sku?: string | null;
  originLineId?: string | null;
  standardItemId?: string | null;
  standardItemSchemeId?: string | null;
  description: string;
  unitCode: string;
  taxTreatment?: string | null;
  taxSchemeId?: string | null;
  taxSchemeName?: string | null;
  quantity: number | string;
  unitPrice: number | string;
  discountAmount?: number | string | null;
  taxes?: FactuCoreTax[];
  metadata?: Record<string, unknown>;
};

export type FactuCoreDocumentReference = {
  referencedDocumentId?: string | null;
  referenceType: string;
  referenceNumber?: string | null;
  reasonCode?: string | null;
  reasonDescription?: string | null;
  metadata?: Record<string, unknown>;
};

export type FactuCoreDocumentTotals = {
  subtotalAmount: number | string;
  discountAmount: number | string;
  taxAmount: number | string;
  totalAmount: number | string;
  currencyCode: string;
};

export type FactuCoreInvoiceRequest = {
  customerId?: string | null;
  customer?: FactuCoreCustomer | null;
  resolutionId?: string | null;
  externalReference: string;
  issueDate: string;
  issueTime?: string | null;
  dueDate?: string | null;
  paymentMeansCode?: string | null;
  paymentMeansId?: string | null;
  invoiceTypeCode?: string | null;
  operationType?: string | null;
  sourceSystem?: string | null;
  notes?: string | null;
  lines: FactuCoreDocumentLine[];
  references?: FactuCoreDocumentReference[];
  metadata?: Record<string, unknown>;
};

export type FactuCoreCreditNoteRequest = {
  customerId?: string | null;
  originDocumentId?: string | null;
  originFullNumber?: string | null;
  originExternalReference?: string | null;
  discrepancyResponseCode?: string | null;
  discrepancyResponseDescription?: string | null;
  noteReason?: string | null;
  resolutionId?: string | null;
  externalReference: string;
  issueDate: string;
  issueTime?: string | null;
  dueDate?: string | null;
  paymentMeansCode?: string | null;
  paymentMeansId?: string | null;
  invoiceTypeCode?: string | null;
  operationType?: string | null;
  sourceSystem?: string | null;
  notes?: string | null;
  lines: FactuCoreDocumentLine[];
  references?: FactuCoreDocumentReference[];
  metadata?: Record<string, unknown>;
};

export type FactuCoreDocumentResponse = {
  id?: string | null;
  documentId?: string | null;
  providerDocumentId?: string | null;
  externalReference?: string | null;
  status?: string | null;
  providerStatus?: string | null;
  statusDetail?: string | null;
  providerStatusDetail?: string | null;
  prefix?: string | null;
  number?: string | number | null;
  fullNumber?: string | null;
  cufe?: string | null;
  cude?: string | null;
  acceptedAt?: string | Date | null;
  rejectedAt?: string | Date | null;
  queued?: boolean | null;
  lines?: Array<{
    id?: string | null;
    lineNumber?: number | string | null;
    originLineId?: string | null;
    providerLineId?: string | null;
    [key: string]: unknown;
  }> | null;
  idempotent?: boolean | null;
  idempotencyKey?: Record<string, unknown> | null;
  message?: string | null;
  metadata?: Record<string, unknown> | null;
  [key: string]: unknown;
};

export type FactuCoreStatusResponse = FactuCoreDocumentResponse & {
  errorCode?: string | null;
  errorMessage?: string | null;
};

export type FactuCoreDocumentOperationsResponse = {
  documentId?: string | null;
  providerDocumentId?: string | null;
  fullNumber?: string | null;
  status?: string | null;
  currentStep?: string | null;
  artifactsAvailable?: {
    xml?: boolean;
    signedXml?: boolean;
    pdf?: boolean;
  } | null;
  latestTransmission?: Record<string, unknown> | null;
  availableActions?: string[] | null;
  metadata?: Record<string, unknown> | null;
};

export type FactuCoreDownloadType = "XML" | "SIGNED_XML" | "PDF";

export type FactuCoreBinaryResponse = {
  content: Buffer;
  contentType: string | null;
  fileName: string | null;
  sizeBytes: number;
  providerAttachmentId: string | null;
};

export const FACTUCORE_DEFAULT_TIMEOUT_MS = 15_000;

export const FACTUCORE_DOCUMENT_ENDPOINT = "/api/v1/external/documents";

export type FactuCoreRuntimeContext = {
  baseUrl: string;
  credentials: FactuCoreCredentials;
  timeoutMs: number;
};

export type FactuCoreStatusMapping = {
  providerStatus: string;
  normalizedStatus: ElectronicDocumentStatus;
};
