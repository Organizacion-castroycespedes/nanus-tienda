import { BadRequestException } from "@nestjs/common";
import type {
  ElectronicInvoiceRepresentation,
  ElectronicInvoiceRepresentationInput,
} from "./types/electronic-invoice-representation.types";

const ACCEPTED_STATUS = "ACCEPTED";

export const buildElectronicInvoiceRepresentation = (
  input: ElectronicInvoiceRepresentationInput
): ElectronicInvoiceRepresentation => {
  if (input.status !== ACCEPTED_STATUS) {
    throw new BadRequestException(
      "only an accepted electronic document can be represented as an invoice"
    );
  }

  return {
    documentType: "ELECTRONIC_INVOICE_REPRESENTATION",
    status: ACCEPTED_STATUS,
    logo: input.logo ?? null,
    issuer: input.issuer,
    customer: input.customer,
    invoice: input.invoice,
    sale: {
      ...input.sale,
      items: input.sale.items.map((item) => ({ ...item })),
    },
  };
};
