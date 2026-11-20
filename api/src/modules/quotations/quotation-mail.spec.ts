import assert from "node:assert/strict";
import test from "node:test";
import {
  buildQuotationEmail,
  quotationPdfFileName,
  readQuotationMailConfig,
  resolveReportsBaseUrl,
  sanitizeMailError,
} from "./quotation-mail";

test("el correo resume codigo, total y vigencia, incluye el mensaje y escapa HTML", () => {
  const email = buildQuotationEmail({
    code: "COT-000123",
    companyName: "Tienda <Demo> SAS",
    customerName: "Ana & Cía",
    total: 14101.5,
    validUntil: "2026-12-04",
    message: "Línea 1\n<b>Línea 2</b>",
  });
  assert.equal(email.subject, "Cotización COT-000123 - Tienda <Demo> SAS");
  assert.match(email.text, /COT-000123 por \$\s?14\.101,50, válida hasta el 4 de diciembre de 2026/);
  assert.match(email.text, /Línea 1\n<b>Línea 2<\/b>/);
  assert.ok(email.html.includes("Ana &amp; Cía"));
  assert.ok(email.html.includes("Línea 1<br>&lt;b&gt;Línea 2&lt;/b&gt;"));
  assert.ok(email.html.includes("Tienda &lt;Demo&gt; SAS"));
  assert.ok(!email.html.includes("<b>Línea 2</b>"));
});

test("sin mensaje no agrega parrafo vacio", () => {
  const email = buildQuotationEmail({
    code: "COT-1",
    companyName: "T",
    customerName: "C",
    total: 1000,
    validUntil: "2026-12-04",
    message: "   ",
  });
  assert.equal((email.html.match(/<p>/g) ?? []).length, 3);
});

test("la configuracion reutiliza el SMTP de MANUS sin depender del interruptor de alertas", () => {
  const ready = readQuotationMailConfig({
    CONTROL_CENTER_SMTP_HOST: "smtp.manus.co",
    CONTROL_CENTER_ALERTS_FROM: "MANUS <no-reply@manus.co>",
    CONTROL_CENTER_ALERTS_EMAIL_ENABLED: "false",
  });
  assert.equal(ready.ready, true);
  assert.equal(ready.smtp.port, 587);
  const missing = readQuotationMailConfig({});
  assert.equal(missing.ready, false);
  assert.deepEqual(missing.missing, ["CONTROL_CENTER_SMTP_HOST", "CONTROL_CENTER_ALERTS_FROM"]);
});

test("URL de reporteria, nombre del adjunto y errores saneados", () => {
  assert.equal(resolveReportsBaseUrl({ REPORTS_API_BASE_URL: "http://reporteria:4021/api/" }), "http://reporteria:4021/api");
  assert.equal(resolveReportsBaseUrl({}), "http://localhost:4021/api");
  assert.equal(quotationPdfFileName("COT-000123"), "cotizacion-COT-000123.pdf");
  assert.equal(quotationPdfFileName("../x"), "cotizacion-x.pdf");
  const clean = sanitizeMailError(new Error("Invalid login: password=supersecreto authorization=Bearer abc"));
  assert.ok(!clean.includes("supersecreto"));
  assert.ok(!clean.includes("abc"));
});
