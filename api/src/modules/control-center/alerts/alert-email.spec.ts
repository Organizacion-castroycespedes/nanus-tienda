import assert from "node:assert/strict";
import test from "node:test";
import { buildReminderEmail, buildTestEmail, escapeHtml, formatPesos, isValidEmail, reminderSubject } from "./alert-email";
import { sanitizeEmailError } from "./email-sender";

const base = {
  accountName: "Caribbean Beer <Licores> & Cía",
  chargeNumber: "MCC-COB-2026-000001",
  contractNumber: "MCC-2026-00003",
  periodStart: "2026-12-08",
  periodEnd: "2027-12-07",
  balance: "850000.00",
  dueDate: "2026-12-08",
  paymentInstructions: "Bancolombia ahorros 123\nNequi 300",
};

test("subjects per stage", () => {
  assert.equal(reminderSubject({ ...base, stage: "UPCOMING", daysFromDue: -5 }), "MANUS: tu pago de $850.000 vence el 08/12/2026");
  assert.equal(reminderSubject({ ...base, stage: "DUE", daysFromDue: 0 }), "MANUS: tu pago de $850.000 vence hoy");
  assert.equal(reminderSubject({ ...base, stage: "OVERDUE_1", daysFromDue: 1 }), "MANUS: pago de $850.000 vencido hace 1 día");
  assert.equal(reminderSubject({ ...base, stage: "OVERDUE_7", daysFromDue: 8 }), "MANUS: pago de $850.000 vencido hace 8 días");
});

test("reminder body has the charge data, instructions and escaped HTML", () => {
  const email = buildReminderEmail("cliente@caribbean.co", { ...base, stage: "OVERDUE_7", daysFromDue: 7 });
  assert.equal(email.to, "cliente@caribbean.co");
  assert.match(email.text, /MCC-COB-2026-000001/);
  assert.match(email.text, /Saldo pendiente: \$850\.000/);
  assert.match(email.text, /7 días de mora/);
  assert.match(email.text, /Nequi 300/);
  assert.ok(email.html.includes("Caribbean Beer &lt;Licores&gt; &amp; Cía"));
  assert.ok(!email.html.includes("<Licores>"));
  assert.ok(email.html.includes("Bancolombia ahorros 123<br>Nequi 300"));
});

test("fallback instructions and test email", () => {
  const email = buildReminderEmail("a@b.co", { ...base, paymentInstructions: null, stage: "DUE", daysFromDue: 0 });
  assert.match(email.text, /Comunícate con MANUS/);
  assert.match(buildTestEmail("a@b.co").subject, /correo de prueba/);
});

test("helpers", () => {
  assert.equal(formatPesos("1200000.00"), "$1.200.000");
  assert.equal(formatPesos("99900.00"), "$99.900");
  assert.equal(escapeHtml(`"x'`), "&quot;x&#39;");
  assert.equal(isValidEmail("cobros@manus.co"), true);
  assert.equal(isValidEmail("sin-arroba"), false);
  assert.equal(isValidEmail(null), false);
  assert.equal(sanitizeEmailError(new Error("Invalid login: password=abc auth failed")).includes("abc"), false);
});
