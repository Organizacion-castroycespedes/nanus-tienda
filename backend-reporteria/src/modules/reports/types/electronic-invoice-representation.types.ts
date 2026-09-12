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
  address: string | null;
  country: string | null;
  department: string | null;
  municipality: string | null;
};

export type ElectronicInvoiceItem = {
  productName: string;
  quantity: number;
  unitValue: number;
  discount: number;
  tax: number;
  subtotal: number;
  total: number;
};

export type ElectronicInvoiceRepresentation = {
  documentType: "ELECTRONIC_INVOICE_REPRESENTATION";
  status: "ACCEPTED";
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
  };
  sale: {
    saleId: string;
    items: ElectronicInvoiceItem[];
    paymentMethod: string;
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
};

export type ElectronicInvoiceRepresentationInput = Omit<
  ElectronicInvoiceRepresentation,
  "documentType" | "status"
> & {
  status: ElectronicInvoiceStatus;
};
