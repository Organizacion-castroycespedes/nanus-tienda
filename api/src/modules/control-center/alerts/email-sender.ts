import type { AlertsConfig } from "./alerts.config";
import type { EmailMessage } from "./alert-email";

export const EMAIL_SENDER = Symbol("CONTROL_CENTER_EMAIL_SENDER");

export interface EmailSender {
  send(message: EmailMessage): Promise<{ messageId: string | null }>;
}

type Transport = { sendMail: (options: Record<string, unknown>) => Promise<{ messageId?: string }> };

/** Envío por SMTP con nodemailer; el transporte se crea al primer uso. */
export class SmtpEmailSender implements EmailSender {
  private transport: Transport | null = null;

  constructor(private readonly config: AlertsConfig) {}

  private getTransport(): Transport {
    if (!this.transport) {
      if (!this.config.smtp.host || !this.config.from) throw new Error("SMTP no configurado");
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const nodemailer = require("nodemailer") as { createTransport: (options: Record<string, unknown>) => Transport };
      this.transport = nodemailer.createTransport({
        host: this.config.smtp.host,
        port: this.config.smtp.port,
        secure: this.config.smtp.secure,
        auth: this.config.smtp.user ? { user: this.config.smtp.user, pass: this.config.smtp.password ?? "" } : undefined,
        connectionTimeout: 15_000,
        greetingTimeout: 10_000,
        socketTimeout: 20_000,
      });
    }
    return this.transport;
  }

  async send(message: EmailMessage) {
    const info = await this.getTransport().sendMail({
      from: this.config.from,
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html,
      ...(message.attachments?.length ? { attachments: message.attachments } : {}),
    });
    return { messageId: info.messageId ?? null };
  }
}

/** Resume el error de envío sin credenciales ni trazas largas. */
export const sanitizeEmailError = (error: unknown) =>
  String((error as Error)?.message ?? error)
    .replace(/(pass(word)?|auth)[^\s,;]*/gi, "$1=***")
    .slice(0, 500);
