import { printTicket } from "../../domains/peripherals/api";
import type { DirectPrintTerminalContext } from "../../domains/peripherals/contracts";
import type { PeripheralTicketPayload } from "../../domains/peripherals/types";
import { resolvePeripheralTerminalConfig } from "../../domains/peripherals/terminal-config";
import type { ElectronicInvoicePrintDataset, PosSaleTicketPrintDataset } from "./types";
import {
  buildCanonicalElectronicInvoiceDocument,
  canonicalToElectronicInvoicePayload,
} from "./canonical-printable-document";

export const buildElectronicInvoiceTicketPayload = (
  invoice: ElectronicInvoicePrintDataset,
  sale: PosSaleTicketPrintDataset,
  terminal?: DirectPrintTerminalContext,
) => {
  if (invoice.status !== "ACCEPTED" || !invoice.representationAvailable || !invoice.documentNumber) {
    throw new Error("La factura electrónica aceptada no tiene representación fiscal disponible.");
  }

  const document = buildCanonicalElectronicInvoiceDocument(invoice, sale);
  return canonicalToElectronicInvoicePayload(
    document,
    terminal?.tenantId ?? undefined,
    terminal?.branchId ?? undefined,
    terminal?.terminalId ?? undefined,
  );
};

export const printElectronicInvoiceTicket = async (
  invoice: ElectronicInvoicePrintDataset,
  sale: PosSaleTicketPrintDataset,
  terminal: DirectPrintTerminalContext,
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
