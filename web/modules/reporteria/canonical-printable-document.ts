import type { PeripheralTicketPayload } from "../../domains/peripherals/types";
import type {
  ElectronicInvoicePrintDataset,
  PosSaleTicketPrintDataset,
} from "./types";

export type PrintableSectionKind =
  | "company"
  | "identity"
  | "branch"
  | "customer"
  | "items"
  | "taxes"
  | "totals"
  | "payments"
  | "regulatory"
  | "qr_cufe"
  | "footer";

export const PRINTABLE_SECTION_ORDER: readonly PrintableSectionKind[] = [
  "company",
  "identity",
  "branch",
  "customer",
  "items",
  "taxes",
  "totals",
  "payments",
  "regulatory",
  "qr_cufe",
  "footer",
];

export type PrintableCompany = {
  legalName?: string;
  nit?: string;
  phone?: string;
  email?: string;
  logo?: string;
  address?: string;
};

export type PrintableItem = {
  name: string;
  quantity?: number;
  unitPrice?: number;
  total?: number;
};

export type PrintablePayment = { method: string; amount?: number };
export type PrintableTax = { label: string; amount?: number };

export type PosPeripheralPrintableSource = {
  saleId: string;
  saleNumber?: string | null;
  documentNumber?: string | null;
  date?: string | null;
  tenantId?: string | null;
  branchId?: string | null;
  terminalId?: string | null;
  businessName?: string | null;
  nit?: string | null;
  phone?: string | null;
  email?: string | null;
  logo?: string | null;
  address?: string | null;
  branchName?: string | null;
  cashier?: string | null;
  customerName?: string | null;
  items: PrintableItem[];
  subtotal: number;
  taxes: number;
  discounts: number;
  total: number;
  payments: PrintablePayment[];
};

export type CanonicalPrintableDocument = {
  variant: "POS_SALE_RECEIPT" | "ELECTRONIC_INVOICE_RECEIPT";
  company: PrintableCompany;
  identity: { title: string; documentNumber?: string; date?: string };
  branch?: { name?: string; address?: string };
  customer?: { name?: string; identification?: string; address?: string };
  cashier?: string;
  items: PrintableItem[];
  taxes: PrintableTax[];
  totals: {
    subtotal?: number;
    discounts?: number;
    taxes?: number;
    total?: number;
    paid?: number;
    change?: number;
    balance?: number;
  };
  payments: PrintablePayment[];
  regulatory?: {
    status?: string;
    cufe?: string;
    qrPayload?: string;
  };
  footer?: string;
  sections: readonly PrintableSectionKind[];
};

const companyFrom = (
  dataset: PosSaleTicketPrintDataset,
  fiscalIssuer?: ElectronicInvoicePrintDataset["fiscalIssuerSnapshot"],
): PrintableCompany => ({
  legalName: fiscalIssuer?.name ?? dataset.company?.legalName ?? undefined,
  nit: fiscalIssuer?.identificationNumber
    ? `${fiscalIssuer.identificationNumber}${fiscalIssuer.verificationDigit ? `-${fiscalIssuer.verificationDigit}` : ""}`
    : dataset.company?.nit
    ? `${dataset.company.nit}${dataset.company.dv ? `-${dataset.company.dv}` : ""}`
    : undefined,
  phone: fiscalIssuer?.phone ?? dataset.company?.phone ?? undefined,
  email: fiscalIssuer?.email ?? dataset.company?.email ?? undefined,
  logo: dataset.company?.logo ?? undefined,
  address: [fiscalIssuer?.address ?? dataset.company?.address, fiscalIssuer?.municipality ?? dataset.company?.city, fiscalIssuer?.department ?? dataset.company?.department]
    .filter(Boolean)
    .join(", ") || undefined,
});

const paymentsFrom = (ticket: PosSaleTicketPrintDataset["ticket"]): PrintablePayment[] =>
  ticket.paymentBreakdown.length > 0
    ? ticket.paymentBreakdown
    : ticket.totals.paid > 0
      ? [{ method: "Detalle de pago no disponible", amount: ticket.totals.paid }]
      : [];

export const buildCanonicalPosDocument = (
  dataset: PosSaleTicketPrintDataset
): CanonicalPrintableDocument => ({
  variant: "POS_SALE_RECEIPT",
  company: companyFrom(dataset),
  identity: { title: "VENTA", date: dataset.ticket.header.date },
  branch: { name: dataset.company?.branchName ?? dataset.ticket.header.branch ?? undefined },
  customer: { name: dataset.ticket.header.customer },
  cashier: dataset.ticket.header.cashier,
  items: dataset.ticket.items.map((item) => ({
    name: item.productName,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    total: item.subtotal,
  })),
  taxes: (dataset.ticket.totals.taxBreakdown ?? []).map((tax) => ({
    label: tax.label,
    amount: tax.taxAmount,
  })),
  totals: dataset.ticket.totals,
  payments: paymentsFrom(dataset.ticket),
  footer: "Gracias por su compra",
  sections: PRINTABLE_SECTION_ORDER,
});

export const buildCanonicalPosDocumentFromPeripheralSource = (
  source: PosPeripheralPrintableSource,
): CanonicalPrintableDocument => ({
  variant: "POS_SALE_RECEIPT",
  company: {
    legalName: source.businessName ?? undefined,
    nit: source.nit ?? undefined,
    phone: source.phone ?? undefined,
    email: source.email ?? undefined,
    logo: source.logo ?? undefined,
    address: source.address ?? undefined,
  },
  identity: {
    title: "VENTA",
    documentNumber: source.documentNumber ?? source.saleNumber ?? source.saleId,
    date: source.date ?? undefined,
  },
  branch: { name: source.branchName ?? undefined },
  customer: { name: source.customerName ?? "Consumidor final" },
  cashier: source.cashier ?? undefined,
  items: source.items,
  taxes: [],
  totals: {
    subtotal: source.subtotal,
    taxes: source.taxes,
    discounts: source.discounts,
    total: source.total,
    paid: source.payments.reduce((sum, payment) => sum + Number(payment.amount ?? 0), 0),
  },
  payments: source.payments,
  footer: "Gracias por su compra",
  sections: PRINTABLE_SECTION_ORDER,
});

export const canonicalPosSourceToSaleTicketInput = (
  source: PosPeripheralPrintableSource,
): PeripheralTicketPayload["content"] => {
  const document = buildCanonicalPosDocumentFromPeripheralSource(source);
  return canonicalToSaleTicketPayload(
    document,
    source.tenantId ?? undefined,
    source.branchId ?? undefined,
    source.terminalId ?? undefined,
  ).content;
};

export const buildCanonicalElectronicInvoiceDocument = (
  invoice: ElectronicInvoicePrintDataset,
  sale: PosSaleTicketPrintDataset
): CanonicalPrintableDocument => {
  const customer = invoice.customerFiscalSnapshot;
  return {
    variant: "ELECTRONIC_INVOICE_RECEIPT",
    company: companyFrom(sale, invoice.fiscalIssuerSnapshot),
    identity: {
      title: "FACTURA ELECTRÓNICA DE VENTA",
      documentNumber: invoice.documentNumber ?? undefined,
      date: sale.ticket.header.date,
    },
    branch: { name: sale.company?.branchName ?? sale.ticket.header.branch ?? undefined },
    customer: {
      name: customer?.name ?? sale.ticket.header.customer,
      identification: customer?.identificationNumber
        ? [customer.identificationType, customer.identificationNumber].filter(Boolean).join(" ")
        : undefined,
      address: [customer?.address, customer?.municipality, customer?.department]
        .filter(Boolean)
        .join(", ") || undefined,
    },
    cashier: sale.ticket.header.cashier,
    items: sale.ticket.items.map((item) => ({
      name: item.productName,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      total: item.subtotal,
    })),
    taxes: (invoice.taxLines ?? []).map((tax) => ({
      label: `${tax.type} ${tax.rate}%`,
      amount: tax.amount,
    })),
    totals: {
      ...sale.ticket.totals,
      taxes: sale.ticket.totals.taxes,
    },
    payments: paymentsFrom(sale.ticket),
    regulatory: {
      status: "ACEPTADA POR LA DIAN",
      cufe: invoice.cufe ?? undefined,
      qrPayload: invoice.qrPayload ?? undefined,
    },
    footer: "Representación fiscal. Reimpresión sin retransmisión.",
    sections: PRINTABLE_SECTION_ORDER,
  };
};

export const canonicalToSaleTicketPayload = (
  document: CanonicalPrintableDocument,
  tenantId?: string,
  branchId?: string,
  terminalId?: string,
  deviceId?: string
): PeripheralTicketPayload => ({
  tenantId,
  branchId,
  terminalId,
  deviceId,
  ticketType: "SALE",
  content: {
    title: document.identity.title,
    businessName: document.company.legalName,
    nit: document.company.nit,
    phone: document.company.phone,
    email: document.company.email,
    logo: document.company.logo,
    address: document.company.address,
    cashier: document.cashier,
    customerName: document.customer?.name,
    date: document.identity.date,
    items: document.items,
    taxLines: document.taxes,
    subtotal: document.totals.subtotal,
    taxes: document.totals.taxes,
    discounts: document.totals.discounts,
    total: document.totals.total,
    paid: document.totals.paid,
    change: document.totals.change,
    balance: document.totals.balance,
    payments: document.payments,
    footer: document.footer,
  },
});

export const canonicalToElectronicInvoicePayload = (
  document: CanonicalPrintableDocument,
  tenantId?: string,
  branchId?: string,
  terminalId?: string,
  deviceId?: string
): PeripheralTicketPayload => ({
  tenantId,
  branchId,
  terminalId,
  deviceId,
  ticketType: "ELECTRONIC_INVOICE",
  content: {
    title: document.identity.title,
    businessName: document.company.legalName,
    nit: document.company.nit,
    phone: document.company.phone,
    email: document.company.email,
    logo: document.company.logo,
    address: document.company.address,
    cashier: document.cashier,
    customerName: document.customer?.name,
    customerIdentification: document.customer?.identification,
    customerAddress: document.customer?.address,
    fiscalStatus: document.regulatory?.status,
    cufe: document.regulatory?.cufe,
    qrPayload: document.regulatory?.qrPayload,
    documentNumber: document.identity.documentNumber,
    date: document.identity.date,
    items: document.items,
    taxLines: document.taxes,
    subtotal: document.totals.subtotal,
    taxes: document.totals.taxes,
    discounts: document.totals.discounts,
    total: document.totals.total,
    paid: document.totals.paid,
    change: document.totals.change,
    balance: document.totals.balance,
    payments: document.payments,
    footer: document.footer,
  },
});
