import type {
  ElectronicBillingProviderContext,
  ElectronicCustomer,
  ElectronicDocumentLineInput,
  ElectronicDocumentTotals,
  ElectronicPayment,
  IssueElectronicInvoiceCommand,
} from "../../electronic-billing/contracts/electronic-billing-commands";

export type SaleElectronicInvoiceCommandInput = {
  context: ElectronicBillingProviderContext;
  documentId: string;
  saleId: string;
  externalReference?: string;
  issueDate?: Date | string | null;
  issueTime?: string | null;
  customer: ElectronicCustomer;
  payment?: ElectronicPayment | null;
  lines: ElectronicDocumentLineInput[];
  totals: ElectronicDocumentTotals;
  metadata?: Record<string, unknown>;
};

export const buildDeterministicSaleExternalReference = (
  tenantId: string,
  saleId: string,
) => `SALE-${tenantId}-${saleId}`;

export const buildSaleElectronicInvoiceCommand = (
  input: SaleElectronicInvoiceCommandInput,
): IssueElectronicInvoiceCommand => {
  const externalReference =
    input.externalReference ??
    buildDeterministicSaleExternalReference(input.context.tenantId, input.saleId);

  return {
    context: input.context,
    documentId: input.documentId,
    externalReference,
    issueDate: input.issueDate ?? null,
    issueTime: input.issueTime ?? null,
    customer: input.customer,
    payment: input.payment ?? null,
    lines: input.lines,
    totals: input.totals,
    metadata: {
      ...(input.metadata ?? {}),
      source: {
        type: "SALE",
        id: input.saleId,
      },
    },
  };
};
