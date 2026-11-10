import type { AlertStage } from "./alert-stages";

export type ReminderEmailInput = {
  accountName: string;
  chargeNumber: string;
  contractNumber: string;
  periodStart: string;
  periodEnd: string;
  balance: string;
  dueDate: string;
  stage: AlertStage;
  daysFromDue: number;
  paymentInstructions: string | null;
};

export type EmailMessage = { to: string; subject: string; text: string; html: string };

const EMAIL_RE = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[^\s@<>()[\]\\,;:"]{2,}$/;

export const isValidEmail = (value: string | null | undefined): value is string =>
  typeof value === "string" && value.length <= 254 && EMAIL_RE.test(value.trim());

export const escapeHtml = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

const formatDay = (date: string) => `${date.slice(8, 10)}/${date.slice(5, 7)}/${date.slice(0, 4)}`;

/** "850000.00" -> "$850.000" sin aritmética de punto flotante. */
export const formatPesos = (amount: string) => {
  const [integer] = amount.split(".");
  return `$${integer.replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`;
};

const daysText = (days: number) => (days === 1 ? "1 día" : `${days} días`);

export const reminderSubject = (input: Pick<ReminderEmailInput, "stage" | "balance" | "dueDate" | "daysFromDue">) => {
  const amount = formatPesos(input.balance);
  if (input.stage === "UPCOMING") return `MANUS: tu pago de ${amount} vence el ${formatDay(input.dueDate)}`;
  if (input.stage === "DUE") return `MANUS: tu pago de ${amount} vence hoy`;
  return `MANUS: pago de ${amount} vencido hace ${daysText(input.daysFromDue)}`;
};

const statusLine = (input: ReminderEmailInput) => {
  if (input.stage === "UPCOMING") return `Tu próximo pago vence el ${formatDay(input.dueDate)}.`;
  if (input.stage === "DUE") return "Tu pago vence hoy.";
  return `Tu pago está vencido desde el ${formatDay(input.dueDate)} (${daysText(input.daysFromDue)} de mora).`;
};

/** Correo de recordatorio en español, en texto y HTML con los valores escapados. */
export const buildReminderEmail = (to: string, input: ReminderEmailInput): EmailMessage => {
  const rows: [string, string][] = [
    ["Cliente", input.accountName],
    ["Cargo", input.chargeNumber],
    ["Contrato", input.contractNumber],
    ["Período", `${formatDay(input.periodStart)} – ${formatDay(input.periodEnd)}`],
    ["Saldo pendiente", formatPesos(input.balance)],
    ["Vencimiento", formatDay(input.dueDate)],
  ];
  const instructions = input.paymentInstructions ?? "Comunícate con MANUS para coordinar el pago.";
  const text = [
    `Hola, ${input.accountName}:`,
    "",
    statusLine(input),
    "",
    ...rows.map(([label, value]) => `${label}: ${value}`),
    "",
    "Cómo pagar:",
    instructions,
    "",
    "Si ya realizaste el pago, ignora este mensaje.",
    "MANUS POS",
  ].join("\n");
  const html = `<!doctype html><html lang="es"><body style="font-family:Arial,Helvetica,sans-serif;color:#0f172a;line-height:1.5">
<p>Hola, ${escapeHtml(input.accountName)}:</p>
<p><strong>${escapeHtml(statusLine(input))}</strong></p>
<table cellpadding="6" style="border-collapse:collapse;border:1px solid #e2e8f0">
${rows.map(([label, value]) => `<tr><td style="color:#64748b;border-bottom:1px solid #e2e8f0">${escapeHtml(label)}</td><td style="border-bottom:1px solid #e2e8f0"><strong>${escapeHtml(value)}</strong></td></tr>`).join("\n")}
</table>
<p><strong>Cómo pagar</strong><br>${escapeHtml(instructions).replace(/\n/g, "<br>")}</p>
<p style="color:#64748b">Si ya realizaste el pago, ignora este mensaje.<br>MANUS POS</p>
</body></html>`;
  return { to, subject: reminderSubject(input), text, html };
};

export const buildTestEmail = (to: string): EmailMessage => ({
  to,
  subject: "MANUS Control Center: correo de prueba",
  text: "Este es un correo de prueba del MANUS Control Center. Si lo recibes, la configuración SMTP funciona.",
  html: "<p>Este es un correo de prueba del <strong>MANUS Control Center</strong>. Si lo recibes, la configuración SMTP funciona.</p>",
});
