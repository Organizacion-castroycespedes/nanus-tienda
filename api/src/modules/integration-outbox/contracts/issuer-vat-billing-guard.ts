export type IssuerVatResponsibility =
  | "RESPONSIBLE"
  | "NOT_RESPONSIBLE"
  | "UNKNOWN";

export const hasPositiveTaxLines = (lines: Array<{
  taxAmount?: string | number | null;
  taxes: unknown[];
}>) =>
  lines.some((line) => Number(line.taxAmount ?? 0) > 0 || line.taxes.length > 0);

export const assertIssuerCanBillVat = (
  vatResponsibility: IssuerVatResponsibility,
  hasVat: boolean,
) => {
  if (hasVat && vatResponsibility !== "RESPONSIBLE") {
    throw new Error(
      "issuer vatResponsibility must be RESPONSIBLE for IVA-bearing invoices",
    );
  }
};
