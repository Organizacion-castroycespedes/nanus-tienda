import assert from "node:assert/strict";
import test from "node:test";
import ExcelJS from "exceljs";
import { assembleBillingCollections, buildBillingCollectionsWorkbook } from "./billing-collections";
import { formatMonthLabel, monthsBetween, parseDateRange, parseMonthRange } from "./report-dates";
import { renewalEvents, renewalValues, type RenewalContract, type RenewalVersion } from "./renewals";
import { buildStatementDocument, chargeStatusText, statementFileName, summarizeStatement, type StatementCharge } from "./statement";

const code = (fn: () => unknown) => {
  try {
    fn();
    return null;
  } catch (error: any) {
    return error.getResponse().code;
  }
};

test("ranges: defaults, limits and month helpers", () => {
  assert.deepEqual(parseDateRange({}, "2026-11-10"), { from: "2025-11-11", to: "2026-11-10" });
  assert.equal(code(() => parseDateRange({ from: "2026-12-01", to: "2026-11-01" }, "2026-11-10")), "CONTROL_CENTER_INVALID_RANGE");
  assert.equal(code(() => parseDateRange({ from: "2022-01-01", to: "2026-11-10" }, "2026-11-10")), "CONTROL_CENTER_INVALID_RANGE");
  const months = parseMonthRange({}, "2026-11-10");
  assert.equal(months.from, "2025-12");
  assert.equal(months.months.length, 12);
  assert.equal(months.toDate, "2026-11-30");
  assert.equal(code(() => parseMonthRange({ from: "2024-01", to: "2026-11" }, "2026-11-10")), "CONTROL_CENTER_INVALID_RANGE");
  assert.deepEqual(monthsBetween("2026-11", "2027-02"), ["2026-11", "2026-12", "2027-01", "2027-02"]);
  assert.equal(formatMonthLabel("2026-11"), "nov 2026");
});

const charge = (over: Partial<StatementCharge>): StatementCharge => ({
  chargeNumber: "MCC-COB-2026-000001",
  contractNumber: "MCC-2026-00003",
  kind: "PERIOD",
  billingFrequency: "ANNUAL",
  periodStart: "2026-11-08",
  periodEnd: "2027-11-07",
  dueDate: "2026-11-08",
  totalAmount: "850000.00",
  paidAmount: "850000.00",
  balance: "0.00",
  status: "PAID",
  ...over,
});

test("statement summary: billed in range, paid payments, pending, overdue and credit", () => {
  const charges = [
    charge({}),
    charge({ chargeNumber: "MCC-COB-2026-000003", kind: "PRORATION", dueDate: "2026-11-10", totalAmount: "348082.00", paidAmount: "0.00", balance: "348082.00", status: "OPEN" }),
    charge({ chargeNumber: "MCC-COB-2025-000009", dueDate: "2025-06-01", totalAmount: "100000.00", paidAmount: "40000.00", balance: "60000.00", status: "PARTIALLY_PAID" }),
  ];
  const receipts = [
    { receiptNumber: "R1", receivedOn: "2026-11-08", source: "PAYMENT", paymentMethodName: "Transferencias", financialInstitutionName: null, reference: "T1", amount: "450000.00", allocatedAmount: "450000.00", unallocated: "0.00" },
    { receiptNumber: "R2", receivedOn: "2026-11-09", source: "PRORATION_CREDIT", paymentMethodName: null, financialInstitutionName: null, reference: null, amount: "1000.00", allocatedAmount: "1000.00", unallocated: "0.00" },
  ];
  const summary = summarizeStatement(charges, receipts, { from: "2025-11-11", to: "2026-11-10" }, "2026-11-20", "5000.00");
  assert.deepEqual(summary, { billed: "1198082.00", paid: "450000.00", pending: "408082.00", overdue: "408082.00", credit: "5000.00" });
  assert.equal(chargeStatusText(charges[1], "2026-11-20"), "Vencido (10 días)");
  assert.equal(chargeStatusText(charges[0], "2026-11-20"), "Pagado");
  assert.equal(statementFileName("902.067.003", "2025-11-11", "2026-11-10"), "estado-cuenta-902067003-2025-11-11-2026-11-10.pdf");
  const doc = buildStatementDocument({
    issuer: { name: "SIRLEY MAYERLIS CESPEDES ANAYA", taxId: "1045697508", dv: "5", address: null, city: "Barranquilla", phone: null, email: null, website: null, logoDataUrl: null },
    account: { legalName: "CARIBBEAN BEER LICORES SAS", taxIdType: "NIT", taxId: "902067003", dv: "2", billingEmail: "a@b.co", address: null, city: null },
    range: { from: "2025-11-11", to: "2026-11-10" },
    asOf: "2026-11-20",
    charges,
    receipts,
    summary,
    paymentInstructions: "Nequi 300",
  });
  const text = JSON.stringify(doc.content);
  for (const expected of ["ESTADO DE CUENTA", "NIT 902067003-2", "$408.082", "Vencido (10 días)", "Crédito por prorrateo", "Nequi 300", "NIT 1045697508-5"]) {
    assert.ok(text.includes(expected), `falta: ${expected}`);
  }
});

const report = () =>
  assembleBillingCollections(
    ["2026-11", "2026-12"],
    [
      { month: "2026-11", kind: "PERIOD", amount: "850000.00" },
      { month: "2026-11", kind: "PRORATION", amount: "349041.00" },
    ],
    [
      { month: "2026-11", source: "PAYMENT", methodCode: "002", methodName: "Transferencias", amount: "450000.00" },
      { month: "2026-12", source: "PAYMENT", methodCode: "002", methodName: "Transferencias", amount: "400000.00" },
      { month: "2026-12", source: "PAYMENT", methodCode: "001", methodName: "Efectivo", amount: "349041.00" },
      { month: "2026-12", source: "PRORATION_CREDIT", methodCode: null, methodName: null, amount: "1000.00" },
    ],
    "0.00",
    { from: "2026-11", to: "2026-12" },
  );

test("billing vs collections: billed by due month, collected by payment month and method", () => {
  const result = report();
  assert.deepEqual(result.methods, [{ code: "001", name: "Efectivo" }, { code: "002", name: "Transferencias" }]);
  assert.equal(result.months[0].billed, "1199041.00");
  assert.equal(result.months[0].billedByKind.PRORATION, "349041.00");
  assert.equal(result.months[0].collected, "450000.00");
  assert.equal(result.months[0].difference, "749041.00");
  assert.equal(result.months[1].billed, "0.00");
  assert.equal(result.months[1].collected, "749041.00");
  assert.deepEqual(result.months[1].collectedByMethod, { "001": "349041.00", "002": "400000.00" });
  assert.equal(result.months[1].prorationCredits, "1000.00");
  assert.deepEqual(result.totals, {
    billed: "1199041.00",
    collected: "1199041.00",
    prorationCredits: "1000.00",
    difference: "0.00",
    pending: "0.00",
    collectedByMethod: { "001": "349041.00", "002": "850000.00" },
  });
});

test("excel workbook: three sheets whose totals match the report", async () => {
  const buffer = await buildBillingCollectionsWorkbook(report(), [], []);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  assert.deepEqual(workbook.worksheets.map((sheet) => sheet.name), ["Resumen mensual", "Cargos", "Pagos"]);
  const summary = workbook.getWorksheet("Resumen mensual")!;
  const total = summary.getRow(4);
  assert.equal(total.getCell(1).value, "Total");
  assert.equal(total.getCell(2).value, 1199041);
  assert.equal(total.getCell(6).value, 1199041);
});

const version = (over: Partial<RenewalVersion>): RenewalVersion => ({
  versionNo: 1,
  effectiveFrom: "2025-11-08",
  effectiveTo: null,
  termPhase: "INITIAL",
  billingFrequency: "ANNUAL",
  billingAnchorDay: 8,
  trialEndsOn: "2025-12-08",
  initialTermMonths: 12,
  taxRate: "0.1900",
  pricesIncludeTax: true,
  items: [
    { itemType: "BASE", quantity: "1.00", unitAmount: "850000.00", discountAmount: "0.00", billingFrequency: "ANNUAL" },
    { itemType: "EXTRA_POS_TERMINAL", quantity: "1.00", unitAmount: "350000.00", discountAmount: "0.00", billingFrequency: "ANNUAL" },
  ],
  ...over,
});

const contract = (versions: RenewalVersion[]): RenewalContract => ({
  id: "c1",
  contractNumber: "MCC-2025-00001",
  startDate: "2025-11-08",
  accountLegalName: "Cliente",
  tenantName: "Tenant",
  versions,
});

test("renewals: end of initial term inside the window", () => {
  const events = renewalEvents(contract([version({})]), "2026-11-10", 30);
  assert.deepEqual(events, [
    { type: "INITIAL_TERM_END", date: "2026-12-08", daysRemaining: 28, renewalRegistered: false, currentFrequency: "ANNUAL", currentValue: "1200000.00" },
  ]);
  assert.deepEqual(renewalEvents(contract([version({})]), "2026-10-01", 30), []);
});

test("renewals: trial ending, registered renewal and monthly renewals excluded", () => {
  const trial = renewalEvents(contract([version({ effectiveFrom: "2026-11-01", trialEndsOn: "2026-12-01" })]), "2026-11-10", 30);
  assert.equal(trial[0].type, "TRIAL_END");
  const registered = renewalEvents(
    contract([version({ effectiveTo: "2026-12-07" }), version({ versionNo: 2, effectiveFrom: "2026-12-08", termPhase: "RENEWAL" })]),
    "2026-11-10",
    30,
  );
  assert.equal(registered[0].renewalRegistered, true);
  const annual = renewalEvents(contract([version({ effectiveTo: "2026-12-07" }), version({ versionNo: 2, effectiveFrom: "2026-12-08", termPhase: "RENEWAL" })]), "2027-11-20", 30);
  assert.deepEqual(annual.map((e) => [e.type, e.date, e.daysRemaining]), [["ANNUAL_RENEWAL", "2027-12-08", 18]]);
  const monthly = renewalEvents(contract([version({ effectiveTo: "2026-12-07" }), version({ versionNo: 2, effectiveFrom: "2026-12-08", termPhase: "RENEWAL", billingFrequency: "MONTHLY" })]), "2027-11-20", 30);
  assert.deepEqual(monthly, []);
});

test("renewal values with the current catalog and the same extra terminals", () => {
  const components = [
    { component: "BASE_RENEWAL" as const, billingFrequency: "MONTHLY" as const, amount: "99900.00" },
    { component: "BASE_RENEWAL" as const, billingFrequency: "ANNUAL" as const, amount: "850000.00" },
    { component: "EXTRA_POS_TERMINAL" as const, billingFrequency: "MONTHLY" as const, amount: "29900.00" },
    { component: "EXTRA_POS_TERMINAL" as const, billingFrequency: "ANNUAL" as const, amount: "350000.00" },
    { component: "CERTIFICATION" as const, billingFrequency: "ANNUAL" as const, amount: "119000.00" },
  ];
  assert.deepEqual(renewalValues(components, version({})), { annual: "1200000.00", monthly: "129800.00", monthlyAnnualExtras: "119000.00" });
  assert.deepEqual(renewalValues(null, version({})), { monthly: null, monthlyAnnualExtras: null, annual: null });
});
