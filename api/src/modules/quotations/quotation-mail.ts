import { Injectable } from "@nestjs/common";
import { escapeHtml, isValidEmail } from "../control-center/alerts/alert-email";
import { readAlertsConfig } from "../control-center/alerts/alerts.config";

// Envío de cotizaciones por correo. Reutiliza la conexión SMTP ya configurada en MANUS
// (CONTROL_CENTER_SMTP_* y CONTROL_CENTER_ALERTS_FROM, la misma del estado de cuenta del
// control center) y el PDF que genera backend-reporteria. El PDF solo vive en memoria:
// se descarga, se adjunta y se descarta; no se guarda en disco ni en la base de datos.

export const QUOTATION_PDF_MAX_BYTES = 10 * 1024 * 1024;
const PDF_TIMEOUT_MS = 20_000;

export type QuotationMailConfig = {
  ready: boolean;
  missing: string[];
  smtp: { host: string | null; port: number; secure: boolean; user: string | null; password: string | null };
  from: string | null;
};

type Env = Record<string, string | undefined>;

/** Solo exige los datos de conexión; no depende del interruptor de alertas del control center. */
export const readQuotationMailConfig = (env: Env = process.env): QuotationMailConfig => {
  const alerts = readAlertsConfig(env);
  return { ready: alerts.missing.length === 0, missing: alerts.missing, smtp: alerts.smtp, from: alerts.from };
};

export const resolveReportsBaseUrl = (env: Env = process.env) =>
  (env.REPORTS_API_BASE_URL?.trim() || "http://localhost:4021/api").replace(/\/+$/, "");

export { isValidEmail };

export type QuotationEmailContent = { subject: string; text: string; html: string };

const formatMoney = (value: number) => {
  const amount = Math.round((Number(value) || 0) * 100) / 100;
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    maximumFractionDigits: Number.isInteger(amount) ? 0 : 2,
  }).format(amount);
};

const MONTHS = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];
const formatLongDate = (value: string) => {
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  return year && month && day ? `${day} de ${MONTHS[month - 1]} de ${year}` : value;
};

export const quotationPdfFileName = (code: string) => `cotizacion-${code.replace(/[^A-Za-z0-9-]/g, "")}.pdf`;

export const buildQuotationEmail = (input: {
  code: string;
  companyName: string;
  customerName: string;
  total: number;
  validUntil: string;
  message?: string | null;
}): QuotationEmailContent => {
  const message = input.message?.trim() || null;
  const validUntil = formatLongDate(input.validUntil);
  const total = formatMoney(input.total);
  const subject = `Cotización ${input.code} - ${input.companyName}`;
  const text = [
    `Hola, ${input.customerName}:`,
    "",
    `Adjuntamos la cotización ${input.code} por ${total}, válida hasta el ${validUntil}.`,
    ...(message ? ["", message] : []),
    "",
    "Si tienes preguntas, responde este correo.",
    input.companyName,
  ].join("\n");
  const html = [
    `<p>Hola, ${escapeHtml(input.customerName)}:</p>`,
    `<p>Adjuntamos la cotización <strong>${escapeHtml(input.code)}</strong> por <strong>${escapeHtml(total)}</strong>, válida hasta el <strong>${escapeHtml(validUntil)}</strong>.</p>`,
    ...(message ? [`<p>${escapeHtml(message).replace(/\r?\n/g, "<br>")}</p>`] : []),
    `<p>Si tienes preguntas, responde este correo.<br>${escapeHtml(input.companyName)}</p>`,
  ].join("");
  return { subject, text, html };
};

export type QuotationMailMessage = QuotationEmailContent & {
  to: string;
  replyTo?: string | null;
  attachment: { filename: string; content: Buffer };
};

type Transport = { sendMail: (options: Record<string, unknown>) => Promise<{ messageId?: string }> };

/** Resume el error sin credenciales ni trazas largas. */
export const sanitizeMailError = (error: unknown) =>
  String((error as Error)?.message ?? error)
    .replace(/bearer\s+\S+/gi, "Bearer ***")
    .replace(/(pass(word)?|auth|authorization)[^\s,;]*/gi, "$1=***")
    .slice(0, 300);

@Injectable()
export class QuotationMailer {
  private transport: Transport | null = null;
  private transportKey: string | null = null;

  config(): QuotationMailConfig {
    return readQuotationMailConfig();
  }

  private getTransport(config: QuotationMailConfig): Transport {
    const key = JSON.stringify([config.smtp.host, config.smtp.port, config.smtp.secure, config.smtp.user]);
    if (!this.transport || this.transportKey !== key) {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const nodemailer = require("nodemailer") as { createTransport: (options: Record<string, unknown>) => Transport };
      this.transport = nodemailer.createTransport({
        host: config.smtp.host,
        port: config.smtp.port,
        secure: config.smtp.secure,
        auth: config.smtp.user ? { user: config.smtp.user, pass: config.smtp.password ?? "" } : undefined,
        connectionTimeout: 15_000,
        greetingTimeout: 10_000,
        socketTimeout: 20_000,
      });
      this.transportKey = key;
    }
    return this.transport;
  }

  async send(message: QuotationMailMessage) {
    const config = this.config();
    if (!config.ready || !config.from) {
      throw new Error(`SMTP no configurado: ${config.missing.join(", ")}`);
    }
    const info = await this.getTransport(config).sendMail({
      from: config.from,
      to: message.to,
      ...(message.replyTo ? { replyTo: message.replyTo } : {}),
      subject: message.subject,
      text: message.text,
      html: message.html,
      attachments: [{ filename: message.attachment.filename, content: message.attachment.content, contentType: "application/pdf" }],
    });
    return { messageId: info.messageId ?? null };
  }
}

/** Pide el PDF a backend-reporteria con el token del usuario; lo devuelve solo en memoria. */
@Injectable()
export class QuotationPdfClient {
  async fetchPdf(quotationId: string, authorization: string | undefined): Promise<Buffer> {
    if (!authorization) {
      throw new Error("Falta el token del usuario para generar el PDF");
    }
    const response = await fetch(`${resolveReportsBaseUrl()}/reports/quotations/${quotationId}/pdf`, {
      headers: { Authorization: authorization, Accept: "application/pdf" },
      signal: AbortSignal.timeout(PDF_TIMEOUT_MS),
    });
    if (!response.ok) {
      throw new Error(`Reportería respondió ${response.status} al generar el PDF`);
    }
    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("application/pdf")) {
      throw new Error("Reportería no devolvió un PDF");
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length === 0 || buffer.length > QUOTATION_PDF_MAX_BYTES) {
      throw new Error("El PDF generado está vacío o supera el tamaño permitido");
    }
    return buffer;
  }
}
