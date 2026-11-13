import { formatPesos } from "../alerts/alert-email";
import { formatDay, issuerHeader, issuerIdText, PDF_STYLES, type PdfIssuer } from "../contracts/contract-pdf";
import { daysFromDue } from "../alerts/alert-stages";
import { fromCents, toCents } from "../shared/money";

export type StatementCharge = {
  chargeNumber: string;
  contractNumber: string;
  kind: string;
  billingFrequency: string;
  periodStart: string;
  periodEnd: string;
  dueDate: string;
  totalAmount: string;
  paidAmount: string;
  balance: string;
  status: string;
};

export type StatementReceipt = {
  receiptNumber: string;
  receivedOn: string;
  source: string;
  paymentMethodName: string | null;
  financialInstitutionName: string | null;
  reference: string | null;
  amount: string;
  allocatedAmount: string;
  unallocated: string;
};

export type StatementSummary = { billed: string; paid: string; pending: string; overdue: string; credit: string };

export type StatementAccount = {
  legalName: string;
  taxIdType: string;
  taxId: string;
  dv: string | null;
  billingEmail: string;
  address: string | null;
  city: string | null;
};

const isOpen = (status: string) => status === "OPEN" || status === "PARTIALLY_PAID";

/** Totales del estado de cuenta. El saldo a favor viene de todos los recaudos confirmados de la cuenta. */
export const summarizeStatement = (
  charges: StatementCharge[],
  receipts: StatementReceipt[],
  range: { from: string; to: string },
  asOf: string,
  creditTotal: string,
): StatementSummary => {
  let billed = 0n;
  let pending = 0n;
  let overdue = 0n;
  for (const charge of charges) {
    if (charge.dueDate >= range.from && charge.dueDate <= range.to && charge.status !== "VOID") billed += toCents(charge.totalAmount);
    if (isOpen(charge.status)) {
      pending += toCents(charge.balance);
      if (charge.dueDate < asOf) overdue += toCents(charge.balance);
    }
  }
  const paid = receipts
    .filter((receipt) => receipt.source === "PAYMENT" && receipt.receivedOn >= range.from && receipt.receivedOn <= range.to)
    .reduce((sum, receipt) => sum + toCents(receipt.amount), 0n);
  return { billed: fromCents(billed), paid: fromCents(paid), pending: fromCents(pending), overdue: fromCents(overdue), credit: creditTotal };
};

const KIND = { PERIOD: "Período", PRORATION: "Prorrateo", ONE_TIME: "Pago único" } as Record<string, string>;
const STATUS = { OPEN: "Pendiente", PARTIALLY_PAID: "Abono parcial", PAID: "Pagado", VOID: "Anulado" } as Record<string, string>;

export const chargeStatusText = (charge: StatementCharge, asOf: string) => {
  if (isOpen(charge.status) && charge.dueDate < asOf) {
    const days = daysFromDue(charge.dueDate, asOf);
    return `Vencido (${days} ${days === 1 ? "día" : "días"})`;
  }
  return STATUS[charge.status] ?? charge.status;
};

const right = (text: string, extra: Record<string, unknown> = {}) => ({ text, alignment: "right", ...extra });

export type StatementInput = {
  issuer: PdfIssuer;
  account: StatementAccount;
  range: { from: string; to: string };
  asOf: string;
  charges: StatementCharge[];
  receipts: StatementReceipt[];
  summary: StatementSummary;
  paymentInstructions: string | null;
};

/** Definición pdfmake del estado de cuenta (función pura). */
export const buildStatementDocument = (input: StatementInput): Record<string, unknown> => {
  const { issuer, account, summary } = input;
  const accountId = `${account.taxIdType} ${account.taxId}${account.dv ? `-${account.dv}` : ""}`;
  return {
    pageSize: "LETTER",
    pageMargins: [40, 44, 40, 52],
    info: { title: `Estado de cuenta ${account.legalName}`, author: issuer.name },
    defaultStyle: { font: "Helvetica", fontSize: 9, lineHeight: 1.15, color: "#0f172a" },
    styles: PDF_STYLES,
    footer: (currentPage: number, pageCount: number) => ({
      columns: [
        { text: `${issuer.name} · Estado de cuenta de ${account.legalName}`, style: "small" },
        { text: `Página ${currentPage} de ${pageCount}`, alignment: "right", style: "small" },
      ],
      margin: [40, 16, 40, 0],
    }),
    content: [
      issuerHeader(issuer),
      { text: "ESTADO DE CUENTA", style: "title" },
      {
        text: `Período ${formatDay(input.range.from)} – ${formatDay(input.range.to)} · Fecha de corte ${formatDay(input.asOf)}`,
        style: "subtitle",
      },
      {
        columns: [
          {
            width: "*",
            stack: [
              { text: "CLIENTE", bold: true },
              { text: account.legalName },
              { text: accountId, style: "small" },
              { text: [account.address, account.city].filter(Boolean).join(", ") || "", style: "small" },
              { text: account.billingEmail, style: "small" },
            ],
          },
          {
            width: 250,
            table: {
              widths: ["*", 100],
              body: [
                [{ text: "Facturado en el período", style: "label" }, right(formatPesos(summary.billed))],
                [{ text: "Pagado en el período", style: "label" }, right(formatPesos(summary.paid))],
                [{ text: "Saldo pendiente", bold: true }, right(formatPesos(summary.pending), { bold: true })],
                [{ text: "Vencido", style: "label" }, right(formatPesos(summary.overdue), { color: summary.overdue !== "0.00" ? "#b91c1c" : undefined })],
                [{ text: "Saldo a favor", style: "label" }, right(formatPesos(summary.credit))],
              ],
            },
            layout: "lightHorizontalLines",
          },
        ],
        columnGap: 20,
      },
      { text: "Cargos", style: "section" },
      input.charges.length === 0
        ? { text: "Sin cargos en el período ni saldos pendientes.", style: "small" }
        : {
            table: {
              headerRows: 1,
              widths: [72, 62, "*", 50, 58, 58, 58, 66],
              body: [
                ["Cargo", "Contrato", "Concepto", "Vence", "Total", "Pagado", "Saldo", "Estado"].map((label, index) => ({
                  text: label,
                  style: "tableHeader",
                  alignment: index >= 4 && index <= 6 ? "right" : "left",
                })),
                ...input.charges.map((charge) => [
                  charge.chargeNumber,
                  charge.contractNumber,
                  `${KIND[charge.kind] ?? charge.kind} ${formatDay(charge.periodStart)} – ${formatDay(charge.periodEnd)}`,
                  formatDay(charge.dueDate),
                  right(formatPesos(charge.totalAmount)),
                  right(formatPesos(charge.paidAmount)),
                  right(formatPesos(charge.balance), { bold: true }),
                  { text: chargeStatusText(charge, input.asOf), color: isOpen(charge.status) && charge.dueDate < input.asOf ? "#b91c1c" : undefined },
                ]),
              ],
            },
            layout: "lightHorizontalLines",
            fontSize: 8,
          },
      { text: "Pagos y créditos del período", style: "section" },
      input.receipts.length === 0
        ? { text: "Sin pagos en el período.", style: "small" }
        : {
            table: {
              headerRows: 1,
              widths: [82, 50, "*", 80, 62, 62, 62],
              body: [
                ["Pago", "Fecha", "Medio", "Referencia", "Valor", "Aplicado", "A favor"].map((label, index) => ({
                  text: label,
                  style: "tableHeader",
                  alignment: index >= 4 ? "right" : "left",
                })),
                ...input.receipts.map((receipt) => [
                  receipt.receiptNumber,
                  formatDay(receipt.receivedOn),
                  receipt.source === "PRORATION_CREDIT"
                    ? "Crédito por prorrateo"
                    : [receipt.paymentMethodName, receipt.financialInstitutionName].filter(Boolean).join(" · "),
                  receipt.reference ?? "—",
                  right(formatPesos(receipt.amount)),
                  right(formatPesos(receipt.allocatedAmount)),
                  right(formatPesos(receipt.unallocated)),
                ]),
              ],
            },
            layout: "lightHorizontalLines",
            fontSize: 8,
          },
      ...(input.paymentInstructions
        ? [
            { text: "Cómo pagar", style: "section" },
            { text: input.paymentInstructions, style: "small" },
          ]
        : []),
      {
        text: `Este estado de cuenta refleja los registros de ${issuer.name}${issuerIdText(issuer) ? ` (${issuerIdText(issuer)})` : ""} a la fecha de corte. Si ya realizaste un pago que no aparece, envíanos el soporte.`,
        style: "small",
        margin: [0, 14, 0, 0],
      },
    ],
  };
};

export const statementFileName = (taxId: string, from: string, to: string) =>
  `estado-cuenta-${taxId.replace(/[^A-Za-z0-9]/g, "")}-${from}-${to}.pdf`;
