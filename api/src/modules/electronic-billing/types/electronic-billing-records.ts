import type { QueryResultRow } from "pg";

export type ElectronicBillingEnvironment = "TEST" | "HABILITATION" | "PRODUCTION";

export type ElectronicDocumentStatus =
  | "PENDING"
  | "PROCESSING"
  | "ACCEPTED"
  | "REJECTED"
  | "TECHNICAL_ERROR"
  | "CANCELLED";

export type ElectronicDocumentType = "INVOICE" | "CREDIT_NOTE" | "DEBIT_NOTE";

export type ElectronicDocumentSourceType = "SALE" | "RETURN" | "ORDER" | "MANUAL";

export type ElectronicDocumentEventType =
  | "DOCUMENT_CREATED"
  | "PROCESSING_STARTED"
  | "XML_GENERATED"
  | "SIGNED"
  | "TRANSMISSION_REQUESTED"
  | "STATUS_CHANGED"
  | "ACCEPTED"
  | "REJECTED"
  | "TECHNICAL_ERROR"
  | "RETRY_REQUESTED";

export type ElectronicDocumentDeliveryType = "EMAIL" | "WHATSAPP" | "PORTAL";

export type ElectronicDocumentAttachmentType =
  | "XML"
  | "SIGNED_XML"
  | "PDF"
  | "PROVIDER_RESPONSE";

export type ElectronicDocumentReferenceType = "ORIGIN" | "CREDIT_NOTE" | "DEBIT_NOTE";

export type ElectronicBillingProviderRecord = QueryResultRow & {
  id: string;
  code: string;
  name: string;
  provider_type: string;
  active: boolean;
  capabilities: Record<string, unknown>[] | string[] | null;
  created_at: string | Date;
  updated_at: string | Date;
};

export type TenantElectronicBillingConfigRecord = QueryResultRow & {
  id: string;
  tenant_id: string;
  provider_id: string;
  environment: ElectronicBillingEnvironment;
  enabled: boolean;
  base_url: string | null;
  credential_reference: string | null;
  settings: Record<string, unknown>;
  is_default: boolean;
  created_at: string | Date;
  updated_at: string | Date;
};

export type ElectronicDocumentRecord = QueryResultRow & {
  id: string;
  tenant_id: string;
  provider_id: string;
  provider_config_id: string;
  document_type: ElectronicDocumentType;
  source_type: ElectronicDocumentSourceType;
  source_id: string | null;
  external_reference: string;
  provider_document_id: string | null;
  prefix: string | null;
  number: number | string | null;
  full_number: string | null;
  status: ElectronicDocumentStatus;
  provider_status: string | null;
  provider_status_detail: string | null;
  cufe: string | null;
  cude: string | null;
  currency_code: string;
  subtotal_amount: number | string;
  discount_amount: number | string;
  tax_amount: number | string;
  total_amount: number | string;
  issue_date: string | Date | null;
  issue_time: string | null;
  sent_at: string | Date | null;
  accepted_at: string | Date | null;
  rejected_at: string | Date | null;
  last_status_check_at: string | Date | null;
  last_error_code: string | null;
  last_error_message: string | null;
  metadata: Record<string, unknown>;
  created_at: string | Date;
  updated_at: string | Date;
};

export type ElectronicDocumentBackgroundSyncRecord = ElectronicDocumentRecord & {
  latest_attempt: number;
};

export type ElectronicDocumentLineRecord = QueryResultRow & {
  id: string;
  electronic_document_id: string;
  source_line_type: ElectronicDocumentSourceType;
  source_line_id: string | null;
  provider_line_id: string | null;
  sku: string | null;
  description: string;
  quantity: number | string;
  unit_code: string | null;
  unit_price: number | string;
  discount_amount: number | string;
  subtotal_amount: number | string;
  tax_amount: number | string;
  total_amount: number | string;
  tax_treatment: string | null;
  metadata: Record<string, unknown>;
  created_at: string | Date;
  updated_at: string | Date;
};

export type ElectronicDocumentTaxRecord = QueryResultRow & {
  id: string;
  electronic_document_id: string;
  electronic_document_line_id: string | null;
  tax_type: string;
  tax_code: string | null;
  tax_scheme_id: string | null;
  tax_scheme_name: string | null;
  rate: number | string;
  taxable_base: number | string;
  tax_amount: number | string;
  metadata: Record<string, unknown>;
  created_at: string | Date;
};

export type ElectronicDocumentReferenceRecord = QueryResultRow & {
  id: string;
  electronic_document_id: string;
  referenced_electronic_document_id: string | null;
  reference_type: ElectronicDocumentReferenceType;
  provider_referenced_document_id: string | null;
  reference_number: string | null;
  external_reference: string | null;
  reason_code: string | null;
  reason_description: string | null;
  metadata: Record<string, unknown>;
  created_at: string | Date;
};

export type ElectronicDocumentEventRecord = QueryResultRow & {
  id: string;
  electronic_document_id: string;
  event_type: ElectronicDocumentEventType;
  status: ElectronicDocumentStatus | null;
  provider_status: string | null;
  operation: string;
  attempt: number;
  http_status: number | null;
  error_code: string | null;
  error_message: string | null;
  metadata: Record<string, unknown>;
  created_at: string | Date;
};

export type ElectronicDocumentAttachmentRecord = QueryResultRow & {
  id: string;
  electronic_document_id: string;
  attachment_type: ElectronicDocumentAttachmentType;
  provider_attachment_id: string | null;
  storage_provider: string | null;
  storage_key: string | null;
  file_name: string | null;
  mime_type: string | null;
  checksum: string | null;
  size_bytes: number | string | null;
  status: "PENDING" | "AVAILABLE" | "FAILED";
  created_at: string | Date;
  updated_at: string | Date;
};

export type ElectronicDocumentDeliveryRecord = QueryResultRow & {
  id: string;
  electronic_document_id: string;
  delivery_type: ElectronicDocumentDeliveryType;
  destination: string;
  status: "PENDING" | "SENT" | "FAILED" | "DELIVERED";
  attempts: number;
  last_attempt_at: string | Date | null;
  sent_at: string | Date | null;
  last_error: string | null;
  metadata: Record<string, unknown>;
  created_at: string | Date;
  updated_at: string | Date;
};

export type NewElectronicBillingProviderInput = {
  id: string;
  code: string;
  name: string;
  providerType?: string;
  active?: boolean;
  capabilities?: Record<string, unknown>[] | string[] | null;
  createdAt: Date | string;
  updatedAt: Date | string;
};

export type NewTenantElectronicBillingConfigInput = {
  id: string;
  tenantId: string;
  providerId: string;
  environment: ElectronicBillingEnvironment;
  enabled?: boolean;
  baseUrl?: string | null;
  credentialReference?: string | null;
  settings?: Record<string, unknown>;
  isDefault?: boolean;
  createdAt: Date | string;
  updatedAt: Date | string;
};

export type NewElectronicDocumentInput = {
  id: string;
  tenantId: string;
  providerId: string;
  providerConfigId: string;
  documentType: ElectronicDocumentType;
  sourceType: ElectronicDocumentSourceType;
  sourceId?: string | null;
  externalReference: string;
  providerDocumentId?: string | null;
  prefix?: string | null;
  number?: number | string | null;
  fullNumber?: string | null;
  status?: ElectronicDocumentStatus;
  providerStatus?: string | null;
  providerStatusDetail?: string | null;
  cufe?: string | null;
  cude?: string | null;
  currencyCode?: string;
  subtotalAmount: number | string;
  discountAmount: number | string;
  taxAmount: number | string;
  totalAmount: number | string;
  issueDate?: Date | string | null;
  issueTime?: string | null;
  sentAt?: Date | string | null;
  acceptedAt?: Date | string | null;
  rejectedAt?: Date | string | null;
  lastStatusCheckAt?: Date | string | null;
  lastErrorCode?: string | null;
  lastErrorMessage?: string | null;
  metadata?: Record<string, unknown>;
  createdAt: Date | string;
  updatedAt: Date | string;
};

export type NewElectronicDocumentLineInput = {
  id: string;
  electronicDocumentId: string;
  sourceLineType: ElectronicDocumentSourceType;
  sourceLineId?: string | null;
  providerLineId?: string | null;
  sku?: string | null;
  description: string;
  quantity: number | string;
  unitCode?: string | null;
  unitPrice: number | string;
  discountAmount: number | string;
  subtotalAmount: number | string;
  taxAmount: number | string;
  totalAmount: number | string;
  taxTreatment?: string | null;
  metadata?: Record<string, unknown>;
  createdAt: Date | string;
  updatedAt: Date | string;
};

export type NewElectronicDocumentTaxInput = {
  id: string;
  electronicDocumentId: string;
  electronicDocumentLineId?: string | null;
  taxType: string;
  taxCode?: string | null;
  taxSchemeId?: string | null;
  taxSchemeName?: string | null;
  rate: number | string;
  taxableBase: number | string;
  taxAmount: number | string;
  metadata?: Record<string, unknown>;
  createdAt: Date | string;
};

export type NewElectronicDocumentReferenceInput = {
  id: string;
  electronicDocumentId: string;
  referencedElectronicDocumentId?: string | null;
  referenceType: ElectronicDocumentReferenceType;
  providerReferencedDocumentId?: string | null;
  referenceNumber?: string | null;
  externalReference?: string | null;
  reasonCode?: string | null;
  reasonDescription?: string | null;
  metadata?: Record<string, unknown>;
  createdAt: Date | string;
};

export type NewElectronicDocumentEventInput = {
  id: string;
  electronicDocumentId: string;
  eventType: ElectronicDocumentEventType;
  status?: ElectronicDocumentStatus | null;
  providerStatus?: string | null;
  operation: string;
  attempt?: number;
  httpStatus?: number | null;
  errorCode?: string | null;
  errorMessage?: string | null;
  metadata?: Record<string, unknown>;
  createdAt: Date | string;
};

export type NewElectronicDocumentAttachmentInput = {
  id: string;
  electronicDocumentId: string;
  attachmentType: ElectronicDocumentAttachmentType;
  providerAttachmentId?: string | null;
  storageProvider?: string | null;
  storageKey?: string | null;
  fileName?: string | null;
  mimeType?: string | null;
  checksum?: string | null;
  sizeBytes?: number | null;
  status?: "PENDING" | "AVAILABLE" | "FAILED";
  createdAt: Date | string;
  updatedAt: Date | string;
};

export type NewElectronicDocumentDeliveryInput = {
  id: string;
  electronicDocumentId: string;
  deliveryType: ElectronicDocumentDeliveryType;
  destination: string;
  status?: "PENDING" | "SENT" | "FAILED" | "DELIVERED";
  attempts?: number;
  lastAttemptAt?: Date | string | null;
  sentAt?: Date | string | null;
  lastError?: string | null;
  metadata?: Record<string, unknown>;
  createdAt: Date | string;
  updatedAt: Date | string;
};

export class ElectronicDocumentConflictError extends Error {
  constructor(message = "Electronic document conflict") {
    super(message);
    this.name = "ElectronicDocumentConflictError";
  }
}
