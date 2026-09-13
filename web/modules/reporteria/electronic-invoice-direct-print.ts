import {
  printTicket,
} from "../../domains/peripherals/api";
import type { DirectPrintTerminalContext } from "../../domains/peripherals/contracts";
import type { PeripheralTicketPayload } from "../../domains/peripherals/types";
import { resolvePeripheralTerminalConfig } from "../../domains/peripherals/terminal-config";
import type { ElectronicInvoicePrintDataset, PosSaleTicketPrintDataset } from "./types";

const money = (value: number) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP" }).format(value);

export const buildElectronicInvoiceTicketPayload = (
  invoice: ElectronicInvoicePrintDataset,
  sale: PosSaleTicketPrintDataset,
  terminal?: DirectPrintTerminalContext
) => {
  if (invoice.status !== "ACCEPTED" || !invoice.representationAvailable || !invoice.documentNumber) {
    throw new Error("La factura electrónica aceptada no tiene representación fiscal disponible.");
  }
  const ticket = sale.ticket;
  const customer = invoice.customerFiscalSnapshot;
  const lines = [
    "FACTURA ELECTRÓNICA DE VENTA",
    `Número: ${invoice.documentNumber}`,
    ...(customer?.name ? [`Cliente: ${customer.name}`] : []),
    ...(customer?.identificationNumber ? [`Identificación: ${customer.identificationNumber}`] : []),
    ...(customer?.address ? [`Dirección fiscal: ${customer.address}`] : []),
    ...(invoice.acceptedAt ? [`Validación: ${invoice.acceptedAt}`] : []),
    ...(invoice.cufe ? [`CUFE: ${invoice.cufe}`] : []),
    ...(invoice.qrPayload ? [`QR autorizado: ${invoice.qrPayload}`] : []),
    ...(invoice.taxLines ?? []).map((tax) => `${tax.type} ${tax.rate}%: ${money(tax.amount)} (base ${money(tax.taxableBase)})`),
    ...ticket.items.map(
      (item) => `${item.productName} | ${item.quantity} x ${money(item.unitPrice)} | ${money(item.subtotal)}`
    ),
    `Subtotal: ${money(ticket.totals.subtotal)}`,
    `Impuestos: ${money(ticket.totals.taxes)}`,
    `TOTAL: ${money(ticket.totals.total)}`,
    ...ticket.paymentBreakdown.map((payment) => `Pago ${payment.method}: ${money(payment.amount)}`),
  ];
  return {
    tenantId: terminal?.tenantId ?? undefined,
    branchId: terminal?.branchId ?? undefined,
    terminalId: terminal?.terminalId ?? undefined,
    deviceId: undefined,
    ticketType: "ELECTRONIC_INVOICE" as const,
    content: {
      title: "FACTURA ELECTRÓNICA DE VENTA",
      businessName: ticket.header.tenantName ?? undefined,
      address: ticket.header.branch ? `Sucursal: ${ticket.header.branch}` : undefined,
      date: ticket.header.date,
      qrPayload: invoice.qrPayload ?? undefined,
      lines,
      footer: "Representación fiscal. Reimpresión sin retransmisión.",
    },
  };
};

export const printElectronicInvoiceTicket = async (
  invoice: ElectronicInvoicePrintDataset,
  sale: PosSaleTicketPrintDataset,
  terminal: DirectPrintTerminalContext
) => {
  const config = await resolvePeripheralTerminalConfig(terminal);
  if (config.source !== "CONFIGURED" || !config.active || !config.printerDeviceId) {
    throw new Error("La terminal POS actual no tiene una impresora configurada.");
  }
  const payload: PeripheralTicketPayload = buildElectronicInvoiceTicketPayload(invoice, sale, {
    ...terminal,
    terminalId: config.agentTerminalCode ?? config.terminalId,
  });
  payload.deviceId = config.printerDeviceId;
  return printTicket(payload);
};
