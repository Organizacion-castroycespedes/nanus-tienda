import type {
  ElectronicBillingProviderAttachmentResult,
  ElectronicBillingProviderDocumentResult,
  ElectronicBillingProviderOperationsResult,
  ElectronicBillingProviderStatusResult,
  ElectronicBillingProviderContext,
  ElectronicCustomer,
  ElectronicDocumentLineInput,
  ElectronicTaxInput,
  IssueElectronicCreditNoteCommand,
  IssueElectronicInvoiceCommand,
} from "../../contracts/electronic-billing-commands";
import type { ElectronicDocumentStatus } from "../../domain/electronic-billing.types";
import { FactuCoreConfigurationError } from "./factucore.errors";
import { FACTUCORE_DEFAULT_TIMEOUT_MS } from "./factucore.types";
import type {
  FactuCoreBinaryResponse,
  FactuCoreCreditNoteRequest,
  FactuCoreCustomer,
  FactuCoreDocumentLine,
  FactuCoreDocumentOperationsResponse,
  FactuCoreDocumentResponse,
  FactuCoreInvoiceRequest,
  FactuCoreRuntimeContext,
  FactuCoreStatusResponse,
  FactuCoreTax,
  FactuCoreTaxType,
} from "./factucore.types";

const DOCUMENT_STATUS_MAP: Record<string, ElectronicDocumentStatus> = {
  DRAFT: "PROCESSING",
  VALIDATING: "PROCESSING",
  VALIDATED_INTERNAL: "PROCESSING",
  XML_GENERATED: "PROCESSING",
  SIGNED: "PROCESSING",
  READY_TO_SEND: "PROCESSING",
  SENT: "PROCESSING",
  PENDING_RETRY: "TECHNICAL_ERROR",
  ACCEPTED: "ACCEPTED",
  REJECTED: "REJECTED",
  TECHNICAL_ERROR: "TECHNICAL_ERROR",
  CANCELLED_LOGICALLY: "CANCELLED",
};

const IDENTIFICATION_TYPE_MAP: Record<string, string> = {
  "12": "TI",
  "13": "CC",
  "22": "CE",
  "31": "NIT",
  "41": "PASSPORT",
  "42": "FOREIGN_ID",
  "50": "NIT_OTHER_COUNTRY",
};

const normalizeString = (value: unknown) => (typeof value === "string" ? value.trim() : "");

const normalizeNullableString = (value: unknown) => {
  const normalized = normalizeString(value);
  return normalized.length > 0 ? normalized : null;
};

type NormalizedFactuCorePaymentMeans = {
  paymentMeansCode: "10";
  paymentMeansId: "1";
};

const normalizePaymentMeans = (methodCode: string | null | undefined): NormalizedFactuCorePaymentMeans => {
  const normalizedMethodCode = normalizeString(methodCode).toUpperCase();

  if (normalizedMethodCode === "CASH" || normalizedMethodCode === "10") {
    return {
      paymentMeansCode: "10",
      paymentMeansId: "1",
    };
  }

  throw new FactuCoreConfigurationError(
    "payment_normalization",
    "Payment method is not mapped to the FactuCore fiscal contract",
  );
};

const mapUnitCode = (value: string | null | undefined) => value === "UNIT" || value === "UND" || !value ? "EA" : value;

const toIsoString = (value: string | Date | null | undefined) => {
  if (!value) {
    return null;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  return value;
};

const toDateOnlyString = (value: string | Date | null | undefined) => {
  const iso = toIsoString(value);
  if (!iso) {
    return null;
  }
  return iso.length >= 10 ? iso.slice(0, 10) : iso;
};

const resolveIdentificationType = (typeCode: string | null | undefined) => {
  if (!typeCode) {
    return null;
  }

  return IDENTIFICATION_TYPE_MAP[typeCode] ?? null;
};

const resolveCustomerType = (customer: ElectronicCustomer) => {
  if (customer.customerType) {
    return customer.customerType;
  }

  const resolved = resolveIdentificationType(customer.identification.typeCode);
  return resolved === "NIT" || resolved === "NIT_OTHER_COUNTRY" ? "COMPANY" : "PERSON";
};

const resolveCustomerLegalName = (customer: ElectronicCustomer) => {
  const legalName = normalizeString(customer.legalName);
  if (legalName.length > 0) {
    return legalName;
  }

  const names = [customer.firstName, customer.lastName].map(normalizeString).filter(Boolean);
  return names.join(" ").trim();
};

const normalizeTaxLabel = (value: unknown) => normalizeString(value)
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .toUpperCase()
  .replace(/[^A-Z0-9]+/g, "_")
  .replace(/^_|_$/g, "");

const TAX_TYPE_ALIASES: Record<string, FactuCoreTaxType> = {
  IVA: "IVA",
  VAT: "IVA",
  IVA_0: "IVA",
  IVA_5: "IVA",
  IVA_19: "IVA",
  INC: "INC",
  IMPUESTO_NACIONAL_AL_CONSUMO: "INC",
  IMPUESTO_AL_CONSUMO: "INC",
  LIQUOR_CONSUMPTION: "INC",
  ICA: "ICA",
  IMPUESTO_DE_INDUSTRIA_Y_COMERCIO: "ICA",
  INDUSTRIA_Y_COMERCIO: "ICA",
  AD_VALOREM: "OTHER",
  RETE_FUENTE: "RETE_FUENTE",
  RETENCION_EN_LA_FUENTE: "RETE_FUENTE",
  RETENCION_FUENTE: "RETE_FUENTE",
  RETE_IVA: "RETE_IVA",
  RETENCION_DE_IVA: "RETE_IVA",
  RETENCION_IVA: "RETE_IVA",
  RETE_ICA: "RETE_ICA",
  RETENCION_DE_ICA: "RETE_ICA",
  RETENCION_ICA: "RETE_ICA",
  OTHER: "OTHER",
  OTRO: "OTHER",
  EXENTO: "OTHER",
  EXCLUIDO: "OTHER",
  NO_APLICA: "OTHER",
};

export const mapFactuCoreTaxType = (tax: ElectronicTaxInput): FactuCoreTaxType => {
  const candidates = [
    tax.type,
    tax.schemeName,
    tax.metadata?.taxType,
    tax.metadata?.taxSchemeName,
  ];

  for (const candidate of candidates) {
    const mapped = TAX_TYPE_ALIASES[normalizeTaxLabel(candidate)];
    if (mapped) {
      return mapped;
    }
  }

  throw new FactuCoreConfigurationError(
    "tax_normalization",
    "Tax type is not mapped to the FactuCore fiscal contract",
  );
};

const resolveTaxProfile = (customer: ElectronicCustomer) => {
  const identificationTypeCode = normalizeString(customer.taxProfile?.identificationTypeCode) || normalizeString(customer.identification.typeCode);
  const taxSchemeId = normalizeNullableString(customer.taxProfile?.taxScheme);
  const taxSchemeName = taxSchemeId;
  const liabilityCode = normalizeNullableString(customer.taxProfile?.liabilityTypeCode);
  const fiscalResponsibilityCodes = customer.taxProfile?.fiscalResponsibilityCodes?.filter((code) => normalizeString(code).length > 0) ?? null;

  return {
    identificationTypeCode,
    taxSchemeId,
    taxSchemeName,
    liabilityCode,
    fiscalResponsibilityCodes,
  };
};

const mapCustomer = (customer: ElectronicCustomer): FactuCoreCustomer => {
  const taxProfile = resolveTaxProfile(customer);
  const identificationType = resolveIdentificationType(customer.identification.typeCode);

  return {
    customerType: resolveCustomerType(customer),
    identificationType,
    identificationTypeCode: taxProfile.identificationTypeCode || customer.identification.typeCode || "31",
    identificationNumber: customer.identification.number,
    verificationDigit: customer.identification.verificationDigit ?? null,
    legalName: resolveCustomerLegalName(customer),
    tradeName: normalizeNullableString(customer.metadata?.tradeName),
    firstName: normalizeNullableString(customer.firstName),
    middleName: normalizeNullableString(customer.metadata?.middleName),
    familyName: normalizeNullableString(customer.lastName),
    secondFamilyName: normalizeNullableString(customer.metadata?.secondLastName),
    taxLevelCode: taxProfile.liabilityCode,
    taxSchemeId: taxProfile.taxSchemeId,
    taxSchemeName: taxProfile.taxSchemeName,
    fiscalResponsibilityCode: taxProfile.fiscalResponsibilityCodes?.[0] ?? null,
    fiscalResponsibilityCodes: taxProfile.fiscalResponsibilityCodes,
    fiscalResponsibilities: taxProfile.fiscalResponsibilityCodes,
    email: normalizeNullableString(customer.email),
    phone: normalizeNullableString(customer.phone),
    addressLine1: normalizeNullableString(customer.address),
    countryCode: "CO",
    departmentCode: normalizeNullableString(
      customer.metadata?.departmentCode ?? customer.departmentCode,
    ),
    municipalityCode: normalizeNullableString(
      customer.municipalityCode ?? customer.metadata?.municipalityCode,
    ),
    cityName: normalizeNullableString(customer.metadata?.cityName),
    departmentName: normalizeNullableString(customer.metadata?.departmentName),
    countryName: normalizeNullableString(customer.metadata?.countryName),
    postalZone: normalizeNullableString(customer.metadata?.postalZone),
    taxRegime: normalizeNullableString(customer.metadata?.taxRegime),
    merchantRegistration: normalizeNullableString(customer.metadata?.merchantRegistration),
  };
};

const mapTax = (tax: ElectronicTaxInput): FactuCoreTax => ({
  taxType: mapFactuCoreTaxType(tax),
  rate: tax.rate,
  taxableBase: tax.taxableBase,
  taxAmount: tax.amount,
  metadata: {
    ...(tax.metadata ?? {}),
    ...(tax.code ? { taxCode: tax.code } : {}),
    ...(tax.schemeId ? { taxSchemeId: tax.schemeId } : {}),
    ...(tax.schemeName ? { taxSchemeName: tax.schemeName } : {}),
  },
});

const mapLine = (line: ElectronicDocumentLineInput): FactuCoreDocumentLine => ({
  sku: normalizeNullableString(line.sku),
  originLineId: normalizeNullableString(line.providerOriginalLineId ?? line.originalElectronicDocumentLineId ?? line.sourceLineId),
  standardItemId: normalizeNullableString(line.standardItemId),
  standardItemSchemeId: normalizeNullableString(line.standardItemSchemeId),
  description: line.description,
  unitCode: mapUnitCode(line.unitCode),
  taxTreatment: normalizeNullableString(line.taxTreatment),
  taxSchemeId: normalizeNullableString(line.metadata?.taxSchemeId),
  taxSchemeName: normalizeNullableString(line.metadata?.taxSchemeName),
  quantity: line.quantity,
  unitPrice: line.unitPrice,
  discountAmount: line.discountAmount ?? null,
  taxes: line.taxTreatment === "EXCLUDED" || line.taxTreatment === "NOT_APPLICABLE"
    ? undefined
    : line.taxes?.map(mapTax),
  metadata: line.metadata ?? {},
});

const buildBaseRequest = (
  command: IssueElectronicInvoiceCommand | IssueElectronicCreditNoteCommand,
  overrides: Record<string, unknown> = {},
): Record<string, unknown> => {
  const paymentMeans = normalizePaymentMeans(command.payment?.methodCode);

  return {
    externalReference: command.externalReference,
    issueDate: toIsoString(command.issueDate) ?? new Date().toISOString(),
    issueTime: command.issueTime ?? null,
    ...paymentMeans,
    dueDate: toDateOnlyString(command.payment?.dueDate ?? null),
    lines: command.lines.map(mapLine),
    metadata: command.metadata ?? {},
    ...overrides,
  };
};

export class FactuCoreMapper {
  buildRuntimeContext(context: ElectronicBillingProviderContext, credentials: { clientKey: string; clientSecret: string }): FactuCoreRuntimeContext {
    const timeoutFromSettings = this.resolveTimeoutMs(context.settings);
    return {
      baseUrl: context.baseUrl ?? "",
      credentials,
      timeoutMs: timeoutFromSettings ?? FACTUCORE_DEFAULT_TIMEOUT_MS,
    };
  }

  buildInvoiceRequest(command: IssueElectronicInvoiceCommand): FactuCoreInvoiceRequest {
    return {
      ...buildBaseRequest(command),
      customer: mapCustomer(command.customer),
      invoiceTypeCode: "01",
      operationType: "10",
      lines: command.lines.map(mapLine),
      references: [],
    } as unknown as FactuCoreInvoiceRequest;
  }

  buildCreditNoteRequest(command: IssueElectronicCreditNoteCommand): FactuCoreCreditNoteRequest {
    const original = command.originalDocument;

    return {
      ...buildBaseRequest(command, {}),
      customerId: null,
      originDocumentId: original.internalDocumentId ?? null,
      originFullNumber: original.fullNumber ?? null,
      originExternalReference: original.externalReference ?? null,
      discrepancyResponseCode: command.reason.reasonCode ?? null,
      discrepancyResponseDescription: command.reason.reasonDescription ?? null,
      noteReason: command.reason.reasonDescription ?? command.reason.reasonType ?? null,
      invoiceTypeCode: "20",
      operationType: "20",
      lines: command.lines.map(mapLine),
      references: [],
    } as unknown as FactuCoreCreditNoteRequest;
  }

  mapDocumentResult(
    documentId: string,
    response: FactuCoreDocumentResponse | FactuCoreStatusResponse,
    fallbackStatus?: string | null,
  ): ElectronicBillingProviderDocumentResult {
    const providerStatus = normalizeString(response.providerStatus ?? response.status ?? fallbackStatus ?? "SENT") || "SENT";
    const normalizedStatus = this.normalizeStatus(
      providerStatus,
      typeof response.normalizedStatus === "string" ? response.normalizedStatus : null,
    );
    const lineResults = Array.isArray(response.lines)
      ? response.lines.map((line, index) => ({
          index,
          providerLineId: normalizeNullableString(line?.id ?? line?.providerLineId),
          originLineId: normalizeNullableString(line?.originLineId),
          lineNumber: line?.lineNumber ?? null,
        }))
      : null;
    return {
      documentId,
      providerDocumentId: normalizeNullableString(response.providerDocumentId ?? response.id ?? response.documentId),
      providerStatus,
      normalizedStatus,
      providerStatusDetail: normalizeNullableString(response.providerStatusDetail ?? response.statusDetail ?? response.message),
      prefix: normalizeNullableString(response.prefix),
      number: response.number ?? null,
      fullNumber: normalizeNullableString(response.fullNumber),
      cufe: normalizeNullableString(response.cufe),
      cude: normalizeNullableString(response.cude),
      acceptedAt: response.acceptedAt ?? null,
      rejectedAt: response.rejectedAt ?? null,
      providerStatusCode: normalizeNullableString(response.providerStatusCode),
      providerStatusMessage: normalizeNullableString(response.providerStatusMessage),
      trackingId: normalizeNullableString(response.trackingId),
      metadata: {
        ...(response.metadata ?? {}),
        ...(lineResults ? { lineResults } : {}),
      } as Record<string, unknown>,
    };
  }

  mapStatusResult(
    documentId: string,
    response: FactuCoreStatusResponse,
  ): ElectronicBillingProviderStatusResult {
    const providerStatus = normalizeString(response.providerStatus ?? response.status ?? "SENT") || "SENT";
    return {
      ...this.mapDocumentResult(documentId, response, providerStatus),
      providerStatus,
      normalizedStatus: this.normalizeStatus(
        providerStatus,
        typeof response.normalizedStatus === "string" ? response.normalizedStatus : null,
      ),
      providerStatusCode: normalizeNullableString(response.providerStatusCode),
      providerStatusMessage: normalizeNullableString(response.providerStatusMessage),
      trackingId: normalizeNullableString(response.trackingId),
      errorCode: normalizeNullableString(response.errorCode),
      errorMessage: normalizeNullableString(response.errorMessage),
    };
  }

  mapOperationsResult(
    documentId: string,
    response: FactuCoreDocumentOperationsResponse,
  ): ElectronicBillingProviderOperationsResult {
    const availableActions = Array.isArray(response.availableActions)
      ? response.availableActions
          .filter((action) => typeof action === "string" && action.trim().length > 0)
          .map((action) => action.trim())
      : [];

    return {
      documentId,
      providerDocumentId: normalizeNullableString(response.providerDocumentId ?? response.documentId),
      providerStatus: normalizeNullableString(response.status),
      normalizedStatus: response.status ? this.normalizeStatus(response.status) : null,
      currentStep: normalizeNullableString(response.currentStep),
      availableActions,
      artifactsAvailable: response.artifactsAvailable ?? null,
      latestTransmission: response.latestTransmission ?? null,
      metadata: response.metadata ?? {},
    };
  }

  mapAttachmentResult(
    documentId: string,
    attachmentType: "XML" | "SIGNED_XML" | "PDF" | "PROVIDER_RESPONSE",
    response: FactuCoreBinaryResponse,
  ): ElectronicBillingProviderAttachmentResult {
    return {
      documentId,
      providerDocumentId: null,
      attachmentType,
      providerAttachmentId: response.providerAttachmentId,
      content: response.content,
      fileName: response.fileName,
      mimeType: response.contentType,
      storageProvider: "factucore",
      storageKey: null,
      checksum: null,
      sizeBytes: response.sizeBytes,
      metadata: {},
    };
  }

  normalizeStatus(
    providerStatus: string,
    normalizedStatus?: string | ElectronicDocumentStatus | null,
  ): ElectronicDocumentStatus {
    if (normalizedStatus) {
      return normalizedStatus as ElectronicDocumentStatus;
    }

    const mapped = DOCUMENT_STATUS_MAP[providerStatus.toUpperCase()];
    return mapped ?? "PROCESSING";
  }

  resolveTimeoutMs(settings: Record<string, unknown>) {
    const raw = settings.factucoreTimeoutMs ?? settings.timeoutMs;
    if (typeof raw === "number" && Number.isInteger(raw) && raw > 0) {
      return raw;
    }

    return undefined;
  }
}
