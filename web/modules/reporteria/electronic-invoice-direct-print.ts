import { printTicket } from "../../domains/peripherals/api";
import type { DirectPrintTerminalContext } from "../../domains/peripherals/contracts";
import {
  POS_TERMINAL_CONFIG_SOURCES,
  type PeripheralTicketPayload,
} from "../../domains/peripherals/types";
import { resolvePeripheralTerminalConfig } from "../../domains/peripherals/terminal-config";
import {
  PARAMETER_CODES,
  PARAMETER_MODES,
  resolveTenantSettings,
} from "../../domains/parameters/api";
import {
  ELECTRONIC_DOCUMENT_STATUSES,
  type ElectronicInvoicePrintDataset,
  type PosSaleTicketPrintDataset,
} from "./types";
import {
  buildCanonicalElectronicInvoiceDocument,
  canonicalToElectronicInvoicePayload,
} from "./canonical-printable-document";

export const buildElectronicInvoiceTicketPayload = (
  invoice: ElectronicInvoicePrintDataset,
  sale: PosSaleTicketPrintDataset,
  terminal?: DirectPrintTerminalContext,
) => {
  if (
    invoice.status !== ELECTRONIC_DOCUMENT_STATUSES.ACCEPTED ||
    !invoice.representationAvailable ||
    !invoice.documentNumber
  ) {
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
  if (terminal.tenantId) {
    const resolved = await resolveTenantSettings({
      tenantId: terminal.tenantId,
      branchId: terminal.branchId ?? undefined,
      terminalId: terminal.terminalId ?? undefined,
      code: PARAMETER_CODES.PRINT_INVOICE,
    });
    if ((resolved.value ?? PARAMETER_MODES.ON_DEMAND) === PARAMETER_MODES.DISABLED) {
      throw new Error("La impresión de factura electrónica está deshabilitada para esta terminal.");
    }
  }

  const config = await resolvePeripheralTerminalConfig(terminal);
  if (
    config.source !== POS_TERMINAL_CONFIG_SOURCES.CONFIGURED ||
    !config.active ||
    !config.printerDeviceId
  ) {
    throw new Error("La terminal POS actual no tiene una impresora configurada.");
  }
  const payload: PeripheralTicketPayload = buildElectronicInvoiceTicketPayload(invoice, sale, {
    ...terminal,
    terminalId: config.agentTerminalCode ?? config.terminalId,
  });
  payload.deviceId = config.printerDeviceId;
  return printTicket(payload);
};
