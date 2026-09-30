import type { PosSaleTicketTaxBreakdown } from "./sales-report.types";

export type ElectronicInvoiceStatus =
  | "PENDING"
  | "PROCESSING"
  | "ACCEPTED"
  | "REJECTED"
  | "TECHNICAL_ERROR"
  | "CANCELLED";

export type ElectronicInvoiceParty = {
  name: string;
  identificationType: string | null;
  identificationNumber: string | null;
  verificationDigit?: string | null;
  address: string | null;
  country: string | null;
  department: string | null;
  municipality: string | null;
  phone?: string | null;
  email?: string | null;
};

export type FiscalIssuerSnapshot = ElectronicInvoiceParty;

export type ElectronicInvoiceItem = {
  productName: string;
  quantity: number;
  unitValue: number;
  discount: number;
  tax: number;
  subtotal: number;
  total: number;
};

export type FiscalGraphicParty = {
  legalName: string;
  tradeName: string | null;
  personType: "JURIDICA" | "NATURAL";
  identificationTypeCode: string | null;
  identificationNumber: string;
  verificationDigit: string | null;
  fiscalResponsibilityCodes: string[];
  taxSchemeId: string | null;
  taxSchemeName: string | null;
  address: string | null;
  city: string | null;
  department: string | null;
  country: string | null;
  phone: string | null;
  email: string | null;
};

export type FiscalGraphicTax = {
  type: string;
  rate: number;
  taxableBase: number;
  amount: number;
};

/** Datos fiscales devueltos por FactuCore y guardados por billing al aceptar el documento. */
export type FiscalGraphicRepresentation = {
  version: number;
  documentType: string;
  environment: string;
  fullNumber: string;
  prefix: string | null;
  number: number | null;
  issueDate: string;
  issueTime: string | null;
  dueDate: string | null;
  currency: string;
  documentKey: { type: "CUFE" | "CUDE"; value: string | null };
  resolution: {
    number: string;
    prefix: string | null;
    rangeStart: number;
    rangeEnd: number;
    validFrom: string;
    validTo: string;
  } | null;
  issuer: FiscalGraphicParty;
  customer: FiscalGraphicParty;
  payments: Array<{ formCode: string; meansCode: string; amount: number | null; dueDate: string | null }>;
  lines: Array<{
    lineNumber: number;
    code: string | null;
    description: string;
    unitCode: string;
    quantity: number;
    unitPrice: number;
    discount: number;
    lineExtensionAmount: number;
    taxAmount: number;
    total: number;
    taxes: FiscalGraphicTax[];
  }>;
  taxTotals: FiscalGraphicTax[];
  totals: {
    lineExtension: number;
    discount: number;
    tax: number;
    payable: number;
  };
  referencedDocument: { fullNumber: string | null; documentKey: string | null; issueDate: string | null } | null;
  notes: string | null;
  softwareProvider: {
    name: string;
    identificationNumber: string;
    verificationDigit: string | null;
    softwareName: string;
  };
};

export type ElectronicInvoiceRepresentation = {
  documentType: "ELECTRONIC_INVOICE_REPRESENTATION";
  status: "ACCEPTED";
  logo?: string | null;
  fiscal?: FiscalGraphicRepresentation | null;
  issuer: ElectronicInvoiceParty;
  customer: ElectronicInvoiceParty;
  invoice: {
    prefix: string | null;
    number: string;
    issuedAt: string | null;
    acceptedAt: string | null;
    providerStatusCode: string | null;
    providerStatusMessage: string | null;
    trackingId: string | null;
    cufe: string | null;
    qrPayload?: string | null;
  };
    sale: {
      saleId: string;
      items: ElectronicInvoiceItem[];
      paymentMethod: string;
      paymentBreakdown?: Array<{ method: string; amount: number }>;
    subtotal: number;
    discounts: number;
    taxes: number;
    taxBreakdown?: PosSaleTicketTaxBreakdown[];
    total: number;
  };
};

export type ElectronicInvoiceReadModel = {
  saleId: string;
  electronicDocumentId: string;
  status: ElectronicInvoiceStatus;
  documentNumber: string | null;
  cufe: string | null;
  acceptedAt: string | null;
  providerStatusCode: string | null;
  providerStatusMessage: string | null;
  trackingId: string | null;
  representationAvailable: boolean;
  customerFiscalSnapshot?: {
    name: string | null;
    identificationType: string | null;
    identificationNumber: string | null;
    address: string | null;
    country: string | null;
    department: string | null;
    municipality: string | null;
    phone: string | null;
    email: string | null;
    taxRegime: string | null;
    fiscalResponsibilityCodes: string[];
  } | null;
  fiscalIssuerSnapshot?: FiscalIssuerSnapshot | null;
  graphicRepresentation?: FiscalGraphicRepresentation | null;
  taxLines?: Array<{
    type: string;
    code: string | null;
    rate: number;
    taxableBase: number;
    amount: number;
  }>;
  qrPayload?: string | null;
};

export type ElectronicInvoiceRepresentationInput = Omit<
  ElectronicInvoiceRepresentation,
  "documentType" | "status"
> & {
  status: ElectronicInvoiceStatus;
};
