import type {
  ElectronicCustomer,
  ElectronicBillingProviderContext,
  ElectronicDocumentLineInput,
  ElectronicDocumentTotals,
  ElectronicPayment,
  IssueElectronicInvoiceCommand,
} from "../contracts/electronic-billing-commands";
import {
  SALE_COMPLETED_FOR_ELECTRONIC_BILLING_EVENT_TYPE,
  type DecimalWireValue,
  type SaleCompletedForElectronicBillingEventEnvelope,
  type SaleLineSnapshot,
  type SalePaymentSnapshot,
} from "../contracts/electronic-billing-integration-events";

const toDecimalWireValue = (value: DecimalWireValue | number | null | undefined) => {
  if (value === null || value === undefined) {
    return "0";
  }

  return typeof value === "number" ? String(value) : value;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

export const buildDeterministicSaleExternalReference = (
  tenantId: string,
  saleId: string,
) => `SALE-${tenantId}-${saleId}`;

export const buildElectronicBillingCustomer = (
  customer: ElectronicCustomer | Record<string, unknown>,
): ElectronicCustomer => {
  if (isRecord(customer) && isRecord(customer.identification)) {
    return customer as ElectronicCustomer;
  }

  const flattened = (isRecord(customer) ? customer : {}) as Record<string, unknown>;
  const identificationNumber =
    typeof flattened.identificationNumber === "string" ? flattened.identificationNumber : "";

  return {
    customerType:
      flattened.customerType === "PERSON" ||
      flattened.customerType === "COMPANY" ||
      flattened.customerType === "FOREIGN" ||
      flattened.customerType === "OTHER"
        ? (flattened.customerType as ElectronicCustomer["customerType"])
        : undefined,
    identification: {
      typeCode:
        typeof flattened.identificationTypeCode === "string"
          ? flattened.identificationTypeCode
          : typeof flattened.identificationType === "string"
            ? flattened.identificationType
            : null,
      number: identificationNumber,
      verificationDigit:
        typeof flattened.verificationDigit === "string" ||
        typeof flattened.verificationDigit === "number"
          ? flattened.verificationDigit
          : null,
    },
    legalName: typeof flattened.legalName === "string" ? flattened.legalName : null,
    firstName: null,
    lastName: null,
    email: typeof flattened.email === "string" ? flattened.email : null,
    phone: typeof flattened.phone === "string" ? flattened.phone : null,
    address:
      typeof flattened.addressLine1 === "string"
        ? flattened.addressLine1
        : typeof flattened.address === "string"
          ? flattened.address
          : null,
    municipalityCode:
      typeof flattened.municipalityCode === "string" ? flattened.municipalityCode : null,
    taxProfile: {
      identificationTypeCode:
        typeof flattened.identificationTypeCode === "string"
          ? flattened.identificationTypeCode
          : typeof flattened.identificationType === "string"
            ? flattened.identificationType
            : null,
      fiscalResponsibilityCodes: Array.isArray(flattened.fiscalResponsibilityCodes)
        ? (flattened.fiscalResponsibilityCodes as unknown[]).filter(
            (code): code is string => typeof code === "string" && code.trim().length > 0,
          )
        : null,
      taxScheme:
        typeof flattened.taxSchemeId === "string"
          ? flattened.taxSchemeId
          : typeof flattened.taxSchemeName === "string"
            ? flattened.taxSchemeName
            : null,
      liabilityTypeCode:
        typeof flattened.taxLevelCode === "string" ? flattened.taxLevelCode : null,
    },
    metadata: {
      ...(isRecord(flattened.metadata) ? flattened.metadata : {}),
      ...(typeof flattened.cityName === "string" ? { cityName: flattened.cityName } : {}),
      ...(typeof flattened.departmentCode === "string"
        ? { departmentCode: flattened.departmentCode }
        : {}),
      ...(typeof flattened.municipalityCode === "string"
        ? { municipalityCode: flattened.municipalityCode }
        : {}),
      ...(typeof flattened.departmentName === "string"
        ? { departmentName: flattened.departmentName }
        : {}),
      ...(typeof flattened.countryName === "string" ? { countryName: flattened.countryName } : {}),
    },
  };
};

const mapElectronicBillingPayment = (primaryPayment: SalePaymentSnapshot, payments: SalePaymentSnapshot[]): ElectronicPayment => {
  return {
    methodCode: primaryPayment.methodCode,
    amount: primaryPayment.amount ?? null,
    reference: primaryPayment.reference ?? null,
    paymentMeansCode: primaryPayment.electronicPaymentMeansCode ?? null,
    paymentMeansId: primaryPayment.electronicPaymentMeansId ?? null,
    requiresReference: primaryPayment.requiresReference ?? false,
    term: primaryPayment.term ?? null,
    dueDate: primaryPayment.dueDate ?? null,
    metadata: {
      paymentMethodId: primaryPayment.paymentMethodId ?? null,
      paymentMethodCode: primaryPayment.paymentMethodCode ?? null,
      paymentMethodName: primaryPayment.paymentMethodName ?? null,
      paymentMethodType: primaryPayment.paymentMethodType ?? null,
      requiresReference: primaryPayment.requiresReference ?? null,
      electronicBillingEnabled: primaryPayment.electronicBillingEnabled ?? null,
      electronicPaymentMeansCode: primaryPayment.electronicPaymentMeansCode ?? null,
      electronicPaymentMeansId: primaryPayment.electronicPaymentMeansId ?? null,
      amount: primaryPayment.amount ?? null,
      reference: primaryPayment.reference ?? null,
      paymentBreakdown: payments,
    },
  };
};

export const buildElectronicBillingPayments = (
  payments: SalePaymentSnapshot[],
): ElectronicPayment[] => payments.map((payment) => mapElectronicBillingPayment(payment, payments));

export const buildElectronicBillingPayment = (
  payments: SalePaymentSnapshot[],
): ElectronicPayment | null => payments.length === 1 ? buildElectronicBillingPayments(payments)[0] : null;

const mapTaxes = (line: SaleLineSnapshot) =>
  line.taxes.map((tax) => ({
    type: tax.type,
    code: tax.code ?? null,
    schemeId: tax.schemeId ?? null,
    schemeName: tax.schemeName ?? null,
    rate: toDecimalWireValue(tax.rate),
    taxableBase: toDecimalWireValue(tax.taxableBase),
    amount: toDecimalWireValue(tax.amount),
    metadata: tax.metadata ?? {},
  }));

export const buildElectronicBillingInvoiceCommandFromSaleEvent = (
  event: SaleCompletedForElectronicBillingEventEnvelope,
  context: ElectronicBillingProviderContext,
  documentId: string,
): IssueElectronicInvoiceCommand => {
  const externalReference = buildDeterministicSaleExternalReference(
    event.tenantId,
    event.source.id,
  );
  const payments = buildElectronicBillingPayments(event.payload.payments);
  const payment = payments.length === 1 ? payments[0] : null;
  const lines: ElectronicDocumentLineInput[] = event.payload.lines.map((line) => ({
    sourceLineId: line.sourceLineId,
    sku: line.sku ?? null,
    description: line.description,
    quantity: toDecimalWireValue(line.quantity),
    unitCode: line.unitCode ?? null,
    unitPrice: toDecimalWireValue(line.unitPrice),
    discountAmount: line.discountAmount ?? null,
    subtotalAmount: toDecimalWireValue(line.subtotalAmount),
    taxAmount: toDecimalWireValue(line.taxAmount),
    totalAmount: toDecimalWireValue(line.totalAmount),
    taxTreatment: line.taxTreatment ?? null,
    standardItemId: line.standardItemId ?? null,
    standardItemSchemeId: line.standardItemSchemeId ?? null,
    taxes: mapTaxes(line),
    metadata: {
      ...(line.metadata ?? {}),
      saleLine: {
        sourceLineId: line.sourceLineId,
        productId: line.productId ?? null,
      },
    },
  }));

  const totals: ElectronicDocumentTotals = {
    subtotalAmount: toDecimalWireValue(event.payload.totals.subtotalAmount),
    discountAmount: toDecimalWireValue(event.payload.totals.discountAmount),
    taxAmount: toDecimalWireValue(event.payload.totals.taxAmount),
    totalAmount: toDecimalWireValue(event.payload.totals.totalAmount),
    currencyCode: event.payload.currencyCode,
  };

  return {
    context,
    documentId,
    externalReference,
    issueDate: event.payload.sale.completedAt ?? null,
    issueTime: null,
    customer: buildElectronicBillingCustomer(event.payload.customer),
    payments,
    payment,
    lines,
    totals,
    metadata: {
      ...(event.payload.metadata ?? {}),
      ...(event.payload.issuerVatResponsibility
        ? { issuerVatResponsibility: event.payload.issuerVatResponsibility }
        : {}),
      integrationEvent: {
        eventId: event.eventId,
        eventType: event.eventType,
        schemaVersion: event.schemaVersion,
        correlationId: event.correlationId,
        occurredAt: event.occurredAt,
        source: event.source,
      },
      sale: event.payload.sale,
      payments: event.payload.payments,
      taxes: event.payload.taxes,
      eventType: SALE_COMPLETED_FOR_ELECTRONIC_BILLING_EVENT_TYPE,
    },
  };
};

export const isSaleCompletedForElectronicBillingEvent = (
  value: unknown,
): value is SaleCompletedForElectronicBillingEventEnvelope => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const event = value as SaleCompletedForElectronicBillingEventEnvelope;
  return (
    event.eventType === SALE_COMPLETED_FOR_ELECTRONIC_BILLING_EVENT_TYPE &&
    event.schemaVersion === 1 &&
    event.source?.type === "SALE" &&
    typeof event.eventId === "string" &&
    typeof event.tenantId === "string" &&
    typeof event.correlationId === "string" &&
    typeof event.occurredAt === "string" &&
    typeof event.source.id === "string" &&
    Boolean(event.payload)
  );
};
