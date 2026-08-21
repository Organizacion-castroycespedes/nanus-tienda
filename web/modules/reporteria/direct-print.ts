import {
  printReporteriaSaleTicket as printConfiguredReporteriaSaleTicket,
  type DirectPrintTerminalContext,
} from "../../domains/peripherals/contracts";
import type { SaleTicketInput } from "../../domains/peripherals/types";
import type { PosSaleTicketPrintDataset } from "./types";

export const buildReporteriaSaleTicketInput = (
  dataset: PosSaleTicketPrintDataset
): SaleTicketInput => {
  const ticket = dataset.ticket;

  return {
    tenantId: dataset.tenantId,
    branchId: ticket.header.branchId,
    businessName: ticket.header.tenantName ?? "Manus POS",
    address: ticket.header.branch ? `Sucursal: ${ticket.header.branch}` : undefined,
    cashier: ticket.header.cashier,
    customerName: ticket.header.customer,
    saleId: ticket.header.saleId,
    saleNumber: ticket.header.saleId,
    documentNumber: ticket.header.saleId,
    date: ticket.header.date,
    items: ticket.items.map((item) => ({
      name: item.productName,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      total: item.subtotal,
    })),
    subtotal: ticket.totals.subtotal,
    taxes: ticket.totals.taxes,
    total: ticket.totals.total,
    paid: ticket.totals.paid,
    change: ticket.totals.change,
    balance: ticket.totals.balance,
    payments: ticket.paymentBreakdown.map((payment) => ({
      method: payment.method,
      amount: payment.amount,
    })),
    footer: "Gracias por su compra",
  };
};

export const printReporteriaSaleTicket = (
  dataset: PosSaleTicketPrintDataset,
  terminal: DirectPrintTerminalContext
) =>
  printConfiguredReporteriaSaleTicket(
    buildReporteriaSaleTicketInput(dataset),
    terminal
  );
