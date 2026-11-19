import ExcelJS from "exceljs";
import { fromCents, toCents } from "../shared/money";
import { formatMonthLabel } from "./report-dates";

export type BilledRow = { month: string; kind: string; amount: string };
export type CollectedRow = { month: string; source: string; methodCode: string | null; methodName: string | null; amount: string };

export type MonthTotals = {
  month: string;
  label: string;
  billed: string;
  billedByKind: Record<"PERIOD" | "PRORATION" | "ONE_TIME", string>;
  collected: string;
  collectedByMethod: Record<string, string>;
  prorationCredits: string;
  difference: string;
};

export type BillingCollectionsReport = {
  from: string;
  to: string;
  months: MonthTotals[];
  methods: { code: string; name: string }[];
  totals: { billed: string; collected: string; prorationCredits: string; difference: string; pending: string; collectedByMethod: Record<string, string> };
};

/** Agrupa por mes lo facturado (por vencimiento) y lo recaudado (por fecha de pago), en centavos. */
export const assembleBillingCollections = (
  months: string[],
  billed: BilledRow[],
  collected: CollectedRow[],
  pending: string,
  range: { from: string; to: string },
): BillingCollectionsReport => {
  const methods = new Map<string, string>();
  for (const row of collected) {
    if (row.source === "PAYMENT") methods.set(row.methodCode ?? "OTRO", row.methodName ?? row.methodCode ?? "Otro");
  }
  const methodCodes = [...methods.keys()].sort((a, b) => (methods.get(a) ?? a).localeCompare(methods.get(b) ?? b));
  const totalsByMethod = new Map<string, bigint>(methodCodes.map((code) => [code, 0n]));
  let totalBilled = 0n;
  let totalCollected = 0n;
  let totalCredits = 0n;
  const result = months.map((month) => {
    const kinds = { PERIOD: 0n, PRORATION: 0n, ONE_TIME: 0n } as Record<string, bigint>;
    for (const row of billed.filter((r) => r.month === month)) kinds[row.kind] = (kinds[row.kind] ?? 0n) + toCents(row.amount);
    const monthBilled = Object.values(kinds).reduce((sum, value) => sum + value, 0n);
    const byMethod = new Map<string, bigint>(methodCodes.map((code) => [code, 0n]));
    let credits = 0n;
    for (const row of collected.filter((r) => r.month === month)) {
      if (row.source === "PAYMENT") {
        const code = row.methodCode ?? "OTRO";
        byMethod.set(code, (byMethod.get(code) ?? 0n) + toCents(row.amount));
      } else {
        credits += toCents(row.amount);
      }
    }
    const monthCollected = [...byMethod.values()].reduce((sum, value) => sum + value, 0n);
    totalBilled += monthBilled;
    totalCollected += monthCollected;
    totalCredits += credits;
    for (const [code, value] of byMethod) totalsByMethod.set(code, (totalsByMethod.get(code) ?? 0n) + value);
    return {
      month,
      label: formatMonthLabel(month),
      billed: fromCents(monthBilled),
      billedByKind: { PERIOD: fromCents(kinds.PERIOD), PRORATION: fromCents(kinds.PRORATION), ONE_TIME: fromCents(kinds.ONE_TIME) },
      collected: fromCents(monthCollected),
      collectedByMethod: Object.fromEntries([...byMethod].map(([code, value]) => [code, fromCents(value)])),
      prorationCredits: fromCents(credits),
      difference: fromCents(monthBilled - monthCollected),
    };
  });
  return {
    from: range.from,
    to: range.to,
    months: result,
    methods: methodCodes.map((code) => ({ code, name: methods.get(code) ?? code })),
    totals: {
      billed: fromCents(totalBilled),
      collected: fromCents(totalCollected),
      prorationCredits: fromCents(totalCredits),
      difference: fromCents(totalBilled - totalCollected),
      pending,
      collectedByMethod: Object.fromEntries([...totalsByMethod].map(([code, value]) => [code, fromCents(value)])),
    },
  };
};

const money = (value: string | null | undefined) => (value === null || value === undefined ? null : Number(value));
const COP = '"$"#,##0;-"$"#,##0';

export type ChargeDetailRow = {
  chargeNumber: string; contractNumber: string; accountLegalName: string; kind: string; periodStart: string; periodEnd: string;
  dueDate: string; totalAmount: string; paidAmount: string; balance: string; status: string;
};
export type ReceiptDetailRow = {
  receiptNumber: string; accountLegalName: string; receivedOn: string; source: string; paymentMethodName: string | null;
  financialInstitutionName: string | null; reference: string | null; amount: string; allocatedAmount: string; unallocated: string;
};

const styleSheet = (sheet: ExcelJS.Worksheet, moneyColumns: number[]) => {
  sheet.getRow(1).font = { bold: true };
  sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE2E8F0" } };
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  if (sheet.rowCount > 1) sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: sheet.columnCount } };
  for (const index of moneyColumns) sheet.getColumn(index).numFmt = COP;
};

/** Libro de Excel con Resumen mensual, Cargos y Pagos. Los valores son numéricos con formato de moneda. */
export const buildBillingCollectionsWorkbook = async (
  report: BillingCollectionsReport,
  charges: ChargeDetailRow[],
  receipts: ReceiptDetailRow[],
): Promise<Buffer> => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "MANUS Control Center";
  workbook.created = new Date();

  const summary = workbook.addWorksheet("Resumen mensual");
  summary.columns = [
    { header: "Mes", key: "label", width: 12 },
    { header: "Facturado", key: "billed", width: 16 },
    { header: "Período", key: "period", width: 14 },
    { header: "Prorrateo", key: "proration", width: 14 },
    { header: "Pago único", key: "oneTime", width: 14 },
    { header: "Recaudado", key: "collected", width: 16 },
    ...report.methods.map((method) => ({ header: method.name, key: `m_${method.code}`, width: 16 })),
    { header: "Créditos por prorrateo", key: "credits", width: 20 },
    { header: "Diferencia (facturado − recaudado)", key: "difference", width: 30 },
  ];
  for (const month of report.months) {
    summary.addRow({
      label: month.label,
      billed: money(month.billed),
      period: money(month.billedByKind.PERIOD),
      proration: money(month.billedByKind.PRORATION),
      oneTime: money(month.billedByKind.ONE_TIME),
      collected: money(month.collected),
      ...Object.fromEntries(report.methods.map((method) => [`m_${method.code}`, money(month.collectedByMethod[method.code])])),
      credits: money(month.prorationCredits),
      difference: money(month.difference),
    });
  }
  const totalRow = summary.addRow({
    label: "Total",
    billed: money(report.totals.billed),
    period: money(report.months.reduce((s, m) => s + Number(m.billedByKind.PERIOD), 0).toFixed(2)),
    proration: money(report.months.reduce((s, m) => s + Number(m.billedByKind.PRORATION), 0).toFixed(2)),
    oneTime: money(report.months.reduce((s, m) => s + Number(m.billedByKind.ONE_TIME), 0).toFixed(2)),
    collected: money(report.totals.collected),
    ...Object.fromEntries(report.methods.map((method) => [`m_${method.code}`, money(report.totals.collectedByMethod[method.code])])),
    credits: money(report.totals.prorationCredits),
    difference: money(report.totals.difference),
  });
  totalRow.font = { bold: true };
  summary.addRow({});
  summary.addRow({ label: `Saldo pendiente actual de los cargos del rango: ${Number(report.totals.pending).toLocaleString("es-CO")}` });
  summary.addRow({ label: "Facturado se cuenta por mes de vencimiento; recaudado por mes de pago." });
  styleSheet(summary, Array.from({ length: summary.columnCount - 1 }, (_, i) => i + 2));
  summary.autoFilter = undefined as unknown as ExcelJS.AutoFilter;

  const chargesSheet = workbook.addWorksheet("Cargos");
  chargesSheet.columns = [
    { header: "Cargo", key: "chargeNumber", width: 22 },
    { header: "Contrato", key: "contractNumber", width: 16 },
    { header: "Cliente", key: "accountLegalName", width: 32 },
    { header: "Tipo", key: "kind", width: 12 },
    { header: "Inicio período", key: "periodStart", width: 14 },
    { header: "Fin período", key: "periodEnd", width: 14 },
    { header: "Vence", key: "dueDate", width: 12 },
    { header: "Total", key: "totalAmount", width: 14 },
    { header: "Pagado", key: "paidAmount", width: 14 },
    { header: "Saldo", key: "balance", width: 14 },
    { header: "Estado", key: "status", width: 16 },
  ];
  for (const row of charges) {
    chargesSheet.addRow({ ...row, totalAmount: money(row.totalAmount), paidAmount: money(row.paidAmount), balance: money(row.balance) });
  }
  styleSheet(chargesSheet, [8, 9, 10]);

  const receiptsSheet = workbook.addWorksheet("Pagos");
  receiptsSheet.columns = [
    { header: "Pago", key: "receiptNumber", width: 22 },
    { header: "Cliente", key: "accountLegalName", width: 32 },
    { header: "Fecha", key: "receivedOn", width: 12 },
    { header: "Origen", key: "source", width: 18 },
    { header: "Medio", key: "paymentMethodName", width: 18 },
    { header: "Entidad", key: "financialInstitutionName", width: 18 },
    { header: "Referencia", key: "reference", width: 20 },
    { header: "Valor", key: "amount", width: 14 },
    { header: "Aplicado", key: "allocatedAmount", width: 14 },
    { header: "A favor", key: "unallocated", width: 14 },
  ];
  for (const row of receipts) {
    receiptsSheet.addRow({
      ...row,
      source: row.source === "PRORATION_CREDIT" ? "Crédito por prorrateo" : "Pago",
      amount: money(row.amount),
      allocatedAmount: money(row.allocatedAmount),
      unallocated: money(row.unallocated),
    });
  }
  styleSheet(receiptsSheet, [8, 9, 10]);

  return Buffer.from(await workbook.xlsx.writeBuffer());
};
