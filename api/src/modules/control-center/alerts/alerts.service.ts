import { BadGatewayException, Inject, Injectable } from "@nestjs/common";
import { ControlCenterAuditService, type ControlCenterRequestContext } from "../control-center-audit.service";
import { ControlCenterDatabaseService, type ControlCenterQueryable } from "../control-center-database.service";
import { CONTROL_CENTER_ACTIONS } from "../control-center.constants";
import { todayInBogota } from "../shared/dates";
import { badRequest, conflict, notFound, unprocessable } from "../shared/errors";
import { asBody, assertUuid, requireString } from "../shared/parsing";
import { buildReminderEmail, buildTestEmail, isValidEmail, type EmailMessage } from "./alert-email";
import { MAX_EMAIL_ATTEMPTS, daysFromDue, manualStageFor, stageFor, type AlertStage } from "./alert-stages";
import { readAlertsConfig, type AlertsConfig } from "./alerts.config";
import { EMAIL_SENDER, sanitizeEmailError, type EmailSender } from "./email-sender";
import { upsertChargeNotice } from "./notices";

type AlertTrigger = "WORKER" | "MANUAL";

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
};

const LOCK_KEY = "control-center:alerts";

const CHARGE_SELECT = `SELECT ch.id, ch.charge_number, c.contract_number, ch.account_id, ch.tenant_id, ch.status,
    ch.due_date::text AS due_date, ch.period_start::text AS period_start, ch.period_end::text AS period_end,
    (ch.total_amount - ch.paid_amount)::text AS balance, a.legal_name, a.billing_email
  FROM control_center.charges ch
  JOIN control_center.contracts c ON c.id = ch.contract_id
  JOIN control_center.commercial_accounts a ON a.id = ch.account_id`;

@Injectable()
export class ControlCenterAlertsService {
  private readonly config: AlertsConfig = readAlertsConfig();

  constructor(
    @Inject(ControlCenterDatabaseService) private readonly db: ControlCenterDatabaseService,
    @Inject(ControlCenterAuditService) private readonly audit: ControlCenterAuditService,
    @Inject(EMAIL_SENDER) private readonly sender: EmailSender,
  ) {}

  getConfig(): Readonly<AlertsConfig> {
    return this.config;
  }

  /** Estado de las alertas y del canal de correo, sin credenciales. */
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
    const summary: AlertsRunResult = result ?? {
      skipped: true,
      today,
      chargesEvaluated: 0,
      noticesPublished: 0,
      noticesResolved: 0,
      emailsSent: 0,
      emailsFailed: 0,
      emailsSkipped: 0,
    };
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
    const summary: AlertsRunResult = {
      skipped: false,
      today,
      chargesEvaluated: 0,
      noticesPublished: 0,
      noticesResolved: 0,
      emailsSent: 0,
      emailsFailed: 0,
      emailsSkipped: 0,
    };
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
      const outcome = await this.processEmail(q, charge, stage, days, ctx);
      if (outcome === "SENT") summary.emailsSent += 1;
      if (outcome === "FAILED") summary.emailsFailed += 1;
      if (outcome === "SKIPPED") summary.emailsSkipped += 1;
    }
    return summary;
  }

  private async processEmail(
    q: ControlCenterQueryable,
    charge: ChargeForAlert,
    stage: AlertStage,
    days: number,
    ctx: ControlCenterRequestContext,
  ): Promise<"SENT" | "FAILED" | "SKIPPED" | null> {
    const existing = await q.query(
      `SELECT id, status, attempts FROM control_center.billing_alerts
       WHERE charge_id = $1 AND stage = $2 AND channel = 'EMAIL' AND trigger_source = 'WORKER'`,
      [charge.id, stage],
    );
    const row = existing.rows[0] as { id: string; status: string; attempts: number } | undefined;
    if (row) {
      if (row.status !== "FAILED" || row.attempts >= MAX_EMAIL_ATTEMPTS || !this.config.emailReady || !isValidEmail(charge.billing_email)) {
        return null;
      }
      return this.sendAndRecord(q, row.id, this.reminderFor(charge, stage, days));
    }
    const skipReason = !this.config.emailEnabled
      ? "Correo deshabilitado (CONTROL_CENTER_ALERTS_EMAIL_ENABLED)"
      : this.config.missing.length > 0
        ? `Configuración SMTP incompleta: ${this.config.missing.join(", ")}`
        : !isValidEmail(charge.billing_email)
          ? "La cuenta no tiene un correo de facturación válido"
          : null;
    if (skipReason) {
      const skipped = await q.query(
        `INSERT INTO control_center.billing_alerts
           (charge_id, account_id, tenant_id, stage, channel, trigger_source, status, recipient, last_error, created_by)
         VALUES ($1, $2, $3, $4, 'EMAIL', 'WORKER', 'SKIPPED', $5, $6, $7)
         ON CONFLICT (charge_id, stage, channel) WHERE trigger_source = 'WORKER' DO NOTHING
         RETURNING id`,
        [charge.id, charge.account_id, charge.tenant_id, stage, charge.billing_email, skipReason, ctx.actorUserId],
      );
      return skipped.rows[0] ? "SKIPPED" : null;
    }
    const reserved = await q.query(
      `INSERT INTO control_center.billing_alerts
         (charge_id, account_id, tenant_id, stage, channel, trigger_source, status, recipient, attempts, created_by)
       VALUES ($1, $2, $3, $4, 'EMAIL', 'WORKER', 'FAILED', $5, 0, $6)
       ON CONFLICT (charge_id, stage, channel) WHERE trigger_source = 'WORKER' DO NOTHING
       RETURNING id`,
      [charge.id, charge.account_id, charge.tenant_id, stage, charge.billing_email, ctx.actorUserId],
    );
    if (!reserved.rows[0]) return null;
    return this.sendAndRecord(q, reserved.rows[0].id, this.reminderFor(charge, stage, days));
  }

  private reminderFor(charge: ChargeForAlert, stage: AlertStage, days: number): EmailMessage {
    return buildReminderEmail(String(charge.billing_email).trim(), {
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
    });
  }

  /** Envía fuera de cualquier transacción y deja el resultado en la bitácora. */
  private async sendAndRecord(q: ControlCenterQueryable, alertId: string, message: EmailMessage): Promise<"SENT" | "FAILED"> {
    try {
      await this.sender.send(message);
      await q.query(
        `UPDATE control_center.billing_alerts
         SET status = 'SENT', attempts = attempts + 1, sent_at = NOW(), last_error = NULL, recipient = $2 WHERE id = $1`,
        [alertId, message.to],
      );
      return "SENT";
    } catch (error) {
      await q.query(
        `UPDATE control_center.billing_alerts SET status = 'FAILED', attempts = attempts + 1, last_error = $2, recipient = $3 WHERE id = $1`,
        [alertId, sanitizeEmailError(error), message.to],
      );
      return "FAILED";
    }
  }

  /** Recordatorio manual del cargo por correo (botón "Enviar recordatorio"). */
  async sendReminder(chargeIdParam: string, ctx: ControlCenterRequestContext) {
    const chargeId = assertUuid(chargeIdParam, "chargeId");
    const found = await this.db.query(`${CHARGE_SELECT} WHERE ch.id = $1`, [chargeId]);
    const charge = found.rows[0] as ChargeForAlert | undefined;
    if (!charge) throw notFound("CONTROL_CENTER_CHARGE_NOT_FOUND", "Cargo no encontrado");
    if (charge.status !== "OPEN" && charge.status !== "PARTIALLY_PAID") {
      throw conflict("CONTROL_CENTER_CHARGE_NOT_OPEN", "El cargo no tiene saldo pendiente");
    }
    if (!this.config.emailReady) {
      throw unprocessable(
        "CONTROL_CENTER_EMAIL_DISABLED",
        this.config.emailEnabled
          ? `Falta configurar: ${this.config.missing.join(", ")}`
          : "El correo está deshabilitado (CONTROL_CENTER_ALERTS_EMAIL_ENABLED)",
      );
    }
    if (!isValidEmail(charge.billing_email)) {
      throw unprocessable("CONTROL_CENTER_ACCOUNT_EMAIL_INVALID", "La cuenta no tiene un correo de facturación válido");
    }
    const days = daysFromDue(charge.due_date, todayInBogota());
    const stage = manualStageFor(days);
    const reserved = await this.db.query(
      `INSERT INTO control_center.billing_alerts
         (charge_id, account_id, tenant_id, stage, channel, trigger_source, status, recipient, attempts, created_by)
       VALUES ($1, $2, $3, $4, 'EMAIL', 'MANUAL', 'FAILED', $5, 0, $6) RETURNING id`,
      [charge.id, charge.account_id, charge.tenant_id, stage, charge.billing_email, ctx.actorUserId],
    );
    const message = this.reminderFor(charge, stage, days);
    const outcome = await this.sendAndRecord(this.db, reserved.rows[0].id, message);
    await this.audit.record(this.db, {
      ...ctx,
      action: CONTROL_CENTER_ACTIONS.CHARGE_REMINDER_SENT,
      entityType: "charge",
      entityId: charge.id,
      after: { stage, recipient: message.to, status: outcome },
    });
    if (outcome === "FAILED") {
      const last = await this.db.query(`SELECT last_error FROM control_center.billing_alerts WHERE id = $1`, [reserved.rows[0].id]);
      throw new BadGatewayException({ code: "CONTROL_CENTER_EMAIL_FAILED", message: `No se pudo enviar el correo: ${last.rows[0]?.last_error ?? "error SMTP"}` });
    }
    return { status: outcome, stage, recipient: message.to };
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
      error = sanitizeEmailError(caught);
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
}
