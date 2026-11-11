import { BadGatewayException, Inject, Injectable } from "@nestjs/common";
import { ControlCenterAuditService, type ControlCenterRequestContext } from "../control-center-audit.service";
import { ControlCenterDatabaseService, type ControlCenterQueryable } from "../control-center-database.service";
import { CONTROL_CENTER_ACTIONS } from "../control-center.constants";
import { todayInBogota } from "../shared/dates";
import { badRequest, conflict, notFound, unprocessable } from "../shared/errors";
import { asBody, assertUuid, requireString } from "../shared/parsing";
import { buildReminderEmail, buildTestEmail, formatPesos, isValidEmail } from "./alert-email";
import { MAX_EMAIL_ATTEMPTS, daysFromDue, manualStageFor, stageFor, type AlertStage } from "./alert-stages";
import { readAlertsConfig, type AlertsConfig } from "./alerts.config";
import { EMAIL_SENDER, sanitizeEmailError, type EmailSender } from "./email-sender";
import { upsertChargeNotice } from "./notices";
import { WHATSAPP_SENDER, type WhatsappSender } from "./whatsapp-sender";
import { isE164, readWhatsappConfig, templateKindFor, type WhatsappConfig } from "./whatsapp.config";

type AlertTrigger = "WORKER" | "MANUAL";
export type MessageChannel = "EMAIL" | "WHATSAPP";
type Outcome = "SENT" | "FAILED" | "SKIPPED" | null;

type ChargeForAlert = {
  id: string;
  charge_number: string;
  contract_number: string;
  account_id: string;
  tenant_id: string;
  status: string;
  due_date: string;
  period_start: string;
  period_end: string;
  balance: string;
  legal_name: string;
  billing_email: string | null;
  contact_phone_e164: string | null;
  whatsapp_opt_in: boolean;
};

export type AlertsRunResult = {
  skipped: boolean;
  today: string;
  chargesEvaluated: number;
  noticesPublished: number;
  noticesResolved: number;
  emailsSent: number;
  emailsFailed: number;
  emailsSkipped: number;
  whatsappSent: number;
  whatsappFailed: number;
  whatsappSkipped: number;
};

const LOCK_KEY = "control-center:alerts";

const CHARGE_SELECT = `SELECT ch.id, ch.charge_number, c.contract_number, ch.account_id, ch.tenant_id, ch.status,
    ch.due_date::text AS due_date, ch.period_start::text AS period_start, ch.period_end::text AS period_end,
    (ch.total_amount - ch.paid_amount)::text AS balance, a.legal_name, a.billing_email,
    a.contact_phone_e164, a.whatsapp_opt_in
  FROM control_center.charges ch
  JOIN control_center.contracts c ON c.id = ch.contract_id
  JOIN control_center.commercial_accounts a ON a.id = ch.account_id`;

const formatDay = (date: string) => `${date.slice(8, 10)}/${date.slice(5, 7)}/${date.slice(0, 4)}`;

const emptyResult = (today: string, skipped: boolean): AlertsRunResult => ({
  skipped,
  today,
  chargesEvaluated: 0,
  noticesPublished: 0,
  noticesResolved: 0,
  emailsSent: 0,
  emailsFailed: 0,
  emailsSkipped: 0,
  whatsappSent: 0,
  whatsappFailed: 0,
  whatsappSkipped: 0,
});

/** Parámetros posicionales de las plantillas de WhatsApp: cliente, cargo, saldo, vencimiento y días de mora. */
export const whatsappParameters = (charge: Pick<ChargeForAlert, "legal_name" | "charge_number" | "balance" | "due_date">, stage: AlertStage, days: number) => {
  const params = [charge.legal_name, charge.charge_number, formatPesos(charge.balance), formatDay(charge.due_date)];
  if (templateKindFor(stage) === "OVERDUE") params.push(String(Math.max(days, 1)));
  return params;
};

@Injectable()
export class ControlCenterAlertsService {
  private readonly config: AlertsConfig = readAlertsConfig();
  private readonly whatsapp: WhatsappConfig = readWhatsappConfig();

  constructor(
    @Inject(ControlCenterDatabaseService) private readonly db: ControlCenterDatabaseService,
    @Inject(ControlCenterAuditService) private readonly audit: ControlCenterAuditService,
    @Inject(EMAIL_SENDER) private readonly sender: EmailSender,
    @Inject(WHATSAPP_SENDER) private readonly whatsappSender: WhatsappSender,
  ) {}

  getConfig(): Readonly<AlertsConfig> {
    return this.config;
  }

  /** Estado de las alertas y de los canales, sin credenciales. */
  status() {
    return {
      alertsEnabled: this.config.alertsEnabled,
      emailEnabled: this.config.emailEnabled,
      emailReady: this.config.emailReady,
      missing: this.config.missing,
      smtpHost: this.config.smtp.host,
      smtpPort: this.config.smtp.port,
      smtpSecure: this.config.smtp.secure,
      from: this.config.from,
      paymentInstructionsConfigured: this.config.paymentInstructions !== null,
      whatsappEnabled: this.whatsapp.enabled,
      whatsappReady: this.whatsapp.ready,
      whatsappMissing: this.whatsapp.missing,
      whatsappApiVersion: this.whatsapp.apiVersion,
      whatsappTemplateLang: this.whatsapp.templateLang,
    };
  }

  /** Ejecuta el calendario de alertas. Una sola instancia a la vez (bloqueo consultivo de sesión). */
  async runAll(trigger: AlertTrigger, ctx: ControlCenterRequestContext, today = todayInBogota()): Promise<AlertsRunResult> {
    const result = await this.db.withClient(async (client) => {
      const lock = await client.query(`SELECT pg_try_advisory_lock(hashtext($1)) AS ok`, [LOCK_KEY]);
      if (!lock.rows[0]?.ok) return null;
      try {
        return await this.process(client, ctx, today);
      } finally {
        await client.query(`SELECT pg_advisory_unlock(hashtext($1))`, [LOCK_KEY]).catch(() => undefined);
      }
    });
    const summary = result ?? emptyResult(today, true);
    if (trigger === "MANUAL") {
      await this.audit.record(this.db, {
        ...ctx,
        action: CONTROL_CENTER_ACTIONS.ALERTS_RUN_MANUAL,
        entityType: "alerts",
        after: summary,
      });
    }
    return summary;
  }

  private async process(q: ControlCenterQueryable, ctx: ControlCenterRequestContext, today: string): Promise<AlertsRunResult> {
    const summary = emptyResult(today, false);
    const resolved = await q.query(
      `UPDATE public.tenant_billing_notices n SET resolved_at = NOW(), updated_at = NOW()
       FROM control_center.charges ch
       WHERE n.charge_id = ch.id AND n.resolved_at IS NULL AND ch.status IN ('PAID', 'VOID')
       RETURNING n.id`,
    );
    summary.noticesResolved = resolved.rows.length;
    const candidates = await q.query(
      `${CHARGE_SELECT}
       WHERE ch.status IN ('OPEN', 'PARTIALLY_PAID') AND ch.due_date <= ($1::date + 5)
       ORDER BY ch.due_date, ch.charge_number`,
      [today],
    );
    for (const charge of candidates.rows as ChargeForAlert[]) {
      const days = daysFromDue(charge.due_date, today);
      const stage = stageFor(days);
      if (!stage) continue;
      summary.chargesEvaluated += 1;
      const notice = await upsertChargeNotice(q, {
        tenantId: charge.tenant_id,
        chargeId: charge.id,
        chargeNumber: charge.charge_number,
        stage,
        dueDate: charge.due_date,
        balance: charge.balance,
        periodStart: charge.period_start,
        periodEnd: charge.period_end,
      });
      if ((notice as { rowCount?: number }).rowCount !== 0) summary.noticesPublished += 1;
      await q.query(
        `INSERT INTO control_center.billing_alerts
           (charge_id, account_id, tenant_id, stage, channel, trigger_source, status, attempts, sent_at, created_by)
         VALUES ($1, $2, $3, $4, 'DASHBOARD', 'WORKER', 'SENT', 1, NOW(), $5)
         ON CONFLICT (charge_id, stage, channel) WHERE trigger_source = 'WORKER' DO NOTHING`,
        [charge.id, charge.account_id, charge.tenant_id, stage, ctx.actorUserId],
      );
      const email = await this.processChannel(q, "EMAIL", charge, stage, days, ctx);
      if (email === "SENT") summary.emailsSent += 1;
      if (email === "FAILED") summary.emailsFailed += 1;
      if (email === "SKIPPED") summary.emailsSkipped += 1;
      const whatsapp = await this.processChannel(q, "WHATSAPP", charge, stage, days, ctx);
      if (whatsapp === "SENT") summary.whatsappSent += 1;
      if (whatsapp === "FAILED") summary.whatsappFailed += 1;
      if (whatsapp === "SKIPPED") summary.whatsappSkipped += 1;
    }
    return summary;
  }

  private recipientFor(channel: MessageChannel, charge: ChargeForAlert) {
    return channel === "EMAIL" ? charge.billing_email?.trim() ?? null : charge.contact_phone_e164?.trim() ?? null;
  }

  /** Motivo para omitir el canal, o null si se puede enviar. */
  private skipReason(channel: MessageChannel, charge: ChargeForAlert): string | null {
    if (channel === "EMAIL") {
      if (!this.config.emailEnabled) return "Correo deshabilitado (CONTROL_CENTER_ALERTS_EMAIL_ENABLED)";
      if (this.config.missing.length > 0) return `Configuración SMTP incompleta: ${this.config.missing.join(", ")}`;
      if (!isValidEmail(charge.billing_email)) return "La cuenta no tiene un correo de facturación válido";
      return null;
    }
    if (!this.whatsapp.enabled) return "WhatsApp deshabilitado (CONTROL_CENTER_WHATSAPP_ENABLED)";
    if (this.whatsapp.missing.length > 0) return `Configuración de WhatsApp incompleta: ${this.whatsapp.missing.join(", ")}`;
    if (!charge.whatsapp_opt_in) return "La cuenta no autorizó mensajes por WhatsApp";
    if (!isE164(charge.contact_phone_e164)) return "La cuenta no tiene un teléfono E.164 válido";
    return null;
  }

  private async processChannel(
    q: ControlCenterQueryable,
    channel: MessageChannel,
    charge: ChargeForAlert,
    stage: AlertStage,
    days: number,
    ctx: ControlCenterRequestContext,
  ): Promise<Outcome> {
    const existing = await q.query(
      `SELECT id, status, attempts FROM control_center.billing_alerts
       WHERE charge_id = $1 AND stage = $2 AND channel = $3 AND trigger_source = 'WORKER'`,
      [charge.id, stage, channel],
    );
    const row = existing.rows[0] as { id: string; status: string; attempts: number } | undefined;
    const skipReason = this.skipReason(channel, charge);
    const recipient = this.recipientFor(channel, charge);
    if (row) {
      if (row.status !== "FAILED" || row.attempts >= MAX_EMAIL_ATTEMPTS || skipReason) return null;
      return this.sendAndRecord(q, row.id, recipient as string, () => this.deliver(channel, charge, stage, days));
    }
    if (skipReason) {
      const skipped = await q.query(
        `INSERT INTO control_center.billing_alerts
           (charge_id, account_id, tenant_id, stage, channel, trigger_source, status, recipient, last_error, created_by)
         VALUES ($1, $2, $3, $4, $5, 'WORKER', 'SKIPPED', $6, $7, $8)
         ON CONFLICT (charge_id, stage, channel) WHERE trigger_source = 'WORKER' DO NOTHING
         RETURNING id`,
        [charge.id, charge.account_id, charge.tenant_id, stage, channel, recipient, skipReason, ctx.actorUserId],
      );
      return skipped.rows[0] ? "SKIPPED" : null;
    }
    const reserved = await q.query(
      `INSERT INTO control_center.billing_alerts
         (charge_id, account_id, tenant_id, stage, channel, trigger_source, status, recipient, attempts, created_by)
       VALUES ($1, $2, $3, $4, $5, 'WORKER', 'FAILED', $6, 0, $7)
       ON CONFLICT (charge_id, stage, channel) WHERE trigger_source = 'WORKER' DO NOTHING
       RETURNING id`,
      [charge.id, charge.account_id, charge.tenant_id, stage, channel, recipient, ctx.actorUserId],
    );
    if (!reserved.rows[0]) return null;
    return this.sendAndRecord(q, reserved.rows[0].id, recipient as string, () => this.deliver(channel, charge, stage, days));
  }

  private async deliver(channel: MessageChannel, charge: ChargeForAlert, stage: AlertStage, days: number) {
    if (channel === "EMAIL") {
      await this.sender.send(
        buildReminderEmail(String(charge.billing_email).trim(), {
          accountName: charge.legal_name,
          chargeNumber: charge.charge_number,
          contractNumber: charge.contract_number,
          periodStart: charge.period_start,
          periodEnd: charge.period_end,
          balance: charge.balance,
          dueDate: charge.due_date,
          stage,
          daysFromDue: days,
          paymentInstructions: this.config.paymentInstructions,
        }),
      );
      return;
    }
    const kind = templateKindFor(stage);
    await this.whatsappSender.sendTemplate({
      to: String(charge.contact_phone_e164).trim(),
      template: this.whatsapp.templates[kind] as string,
      language: this.whatsapp.templateLang,
      bodyParameters: whatsappParameters(charge, stage, days),
    });
  }

  /** Envía fuera de cualquier transacción y deja el resultado en la bitácora. */
  private async sendAndRecord(q: ControlCenterQueryable, alertId: string, recipient: string, send: () => Promise<void>): Promise<"SENT" | "FAILED"> {
    try {
      await send();
      await q.query(
        `UPDATE control_center.billing_alerts
         SET status = 'SENT', attempts = attempts + 1, sent_at = NOW(), last_error = NULL, recipient = $2 WHERE id = $1`,
        [alertId, recipient],
      );
      return "SENT";
    } catch (error) {
      await q.query(
        `UPDATE control_center.billing_alerts SET status = 'FAILED', attempts = attempts + 1, last_error = $2, recipient = $3 WHERE id = $1`,
        [alertId, this.sanitize(error), recipient],
      );
      return "FAILED";
    }
  }

  private sanitize(error: unknown) {
    let text = sanitizeEmailError(error);
    if (this.whatsapp.accessToken) text = text.split(this.whatsapp.accessToken).join("***");
    return text;
  }

  /** Recordatorio manual del cargo por correo o WhatsApp (botón "Enviar recordatorio"). */
  async sendReminder(chargeIdParam: string, raw: unknown, ctx: ControlCenterRequestContext) {
    const chargeId = assertUuid(chargeIdParam, "chargeId");
    const body = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
    const channelRaw = typeof body.channel === "string" ? body.channel.toUpperCase() : "EMAIL";
    if (channelRaw !== "EMAIL" && channelRaw !== "WHATSAPP") throw badRequest("CONTROL_CENTER_INVALID_FIELD", "channel debe ser EMAIL o WHATSAPP");
    const channel = channelRaw as MessageChannel;
    const found = await this.db.query(`${CHARGE_SELECT} WHERE ch.id = $1`, [chargeId]);
    const charge = found.rows[0] as ChargeForAlert | undefined;
    if (!charge) throw notFound("CONTROL_CENTER_CHARGE_NOT_FOUND", "Cargo no encontrado");
    if (charge.status !== "OPEN" && charge.status !== "PARTIALLY_PAID") {
      throw conflict("CONTROL_CENTER_CHARGE_NOT_OPEN", "El cargo no tiene saldo pendiente");
    }
    const reason = this.skipReason(channel, charge);
    if (reason) {
      throw unprocessable(channel === "EMAIL" ? "CONTROL_CENTER_EMAIL_DISABLED" : "CONTROL_CENTER_WHATSAPP_UNAVAILABLE", reason);
    }
    const days = daysFromDue(charge.due_date, todayInBogota());
    const stage = manualStageFor(days);
    const recipient = this.recipientFor(channel, charge) as string;
    const reserved = await this.db.query(
      `INSERT INTO control_center.billing_alerts
         (charge_id, account_id, tenant_id, stage, channel, trigger_source, status, recipient, attempts, created_by)
       VALUES ($1, $2, $3, $4, $5, 'MANUAL', 'FAILED', $6, 0, $7) RETURNING id`,
      [charge.id, charge.account_id, charge.tenant_id, stage, channel, recipient, ctx.actorUserId],
    );
    const outcome = await this.sendAndRecord(this.db, reserved.rows[0].id, recipient, () => this.deliver(channel, charge, stage, days));
    await this.audit.record(this.db, {
      ...ctx,
      action: CONTROL_CENTER_ACTIONS.CHARGE_REMINDER_SENT,
      entityType: "charge",
      entityId: charge.id,
      after: { stage, channel, recipient, status: outcome },
    });
    if (outcome === "FAILED") {
      const last = await this.db.query(`SELECT last_error FROM control_center.billing_alerts WHERE id = $1`, [reserved.rows[0].id]);
      throw new BadGatewayException({
        code: channel === "EMAIL" ? "CONTROL_CENTER_EMAIL_FAILED" : "CONTROL_CENTER_WHATSAPP_FAILED",
        message: `No se pudo enviar: ${last.rows[0]?.last_error ?? "error del proveedor"}`,
      });
    }
    return { status: outcome, stage, channel, recipient };
  }

  /** Correo de prueba de la configuración SMTP (aunque el canal esté apagado). */
  async testEmail(raw: unknown, ctx: ControlCenterRequestContext) {
    const to = requireString(asBody(raw ?? {}), "to", 254);
    if (!isValidEmail(to)) throw badRequest("CONTROL_CENTER_INVALID_EMAIL", "El correo de destino no es válido");
    if (!this.config.smtp.host || !this.config.from) {
      throw unprocessable("CONTROL_CENTER_EMAIL_NOT_CONFIGURED", `Falta configurar: ${this.config.missing.join(", ")}`);
    }
    let error: string | null = null;
    let messageId: string | null = null;
    try {
      messageId = (await this.sender.send(buildTestEmail(to))).messageId;
    } catch (caught) {
      error = this.sanitize(caught);
    }
    await this.audit.record(this.db, {
      ...ctx,
      action: CONTROL_CENTER_ACTIONS.ALERT_TEST_EMAIL_SENT,
      entityType: "alerts",
      after: { to, sent: error === null, error },
    });
    if (error) throw new BadGatewayException({ code: "CONTROL_CENTER_EMAIL_FAILED", message: `No se pudo enviar el correo: ${error}` });
    return { sent: true, to, messageId };
  }

  /** Mensaje de prueba por WhatsApp con la plantilla de muestra hello_world de Meta. */
  async testWhatsapp(raw: unknown, ctx: ControlCenterRequestContext) {
    const to = requireString(asBody(raw ?? {}), "to", 20);
    if (!isE164(to)) throw badRequest("CONTROL_CENTER_INVALID_PHONE", "El número debe estar en formato E.164, por ejemplo +573001234567");
    if (!this.whatsapp.credentialsReady) {
      throw unprocessable(
        "CONTROL_CENTER_WHATSAPP_NOT_CONFIGURED",
        "Falta configurar CONTROL_CENTER_WHATSAPP_PHONE_NUMBER_ID y CONTROL_CENTER_WHATSAPP_ACCESS_TOKEN",
      );
    }
    let error: string | null = null;
    let messageId: string | null = null;
    try {
      messageId = (await this.whatsappSender.sendTemplate({ to, template: "hello_world", language: "en_US", bodyParameters: [] })).messageId;
    } catch (caught) {
      error = this.sanitize(caught);
    }
    await this.audit.record(this.db, {
      ...ctx,
      action: CONTROL_CENTER_ACTIONS.ALERT_TEST_WHATSAPP_SENT,
      entityType: "alerts",
      after: { to, sent: error === null, error },
    });
    if (error) throw new BadGatewayException({ code: "CONTROL_CENTER_WHATSAPP_FAILED", message: `No se pudo enviar el WhatsApp: ${error}` });
    return { sent: true, to, messageId };
  }
}
