import {
  printReporteriaSaleTicket as printConfiguredReporteriaSaleTicket,
  type DirectPrintTerminalContext,
} from "../../domains/peripherals/contracts";
import type { SaleTicketInput } from "../../domains/peripherals/types";
import type { PosSaleTicketPrintDataset } from "./types";
import {
  buildCanonicalPosDocument,
  canonicalToSaleTicketPayload,
} from "./canonical-printable-document";

export const buildReporteriaSaleTicketInput = (
  dataset: PosSaleTicketPrintDataset
): SaleTicketInput => {
  const document = buildCanonicalPosDocument(dataset);
  const payload = canonicalToSaleTicketPayload(
    document,
    dataset.tenantId,
    dataset.ticket.header.branchId,
  );
  return {
    ...payload.content,
    tenantId: payload.tenantId,
    branchId: payload.branchId,
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
