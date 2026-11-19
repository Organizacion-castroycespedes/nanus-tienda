import { BadGatewayException, Inject, Injectable } from "@nestjs/common";
import { ControlCenterAuditService, type ControlCenterRequestContext } from "../control-center-audit.service";
import { ControlCenterDatabaseService } from "../control-center-database.service";
import { CONTROL_CENTER_ACTIONS } from "../control-center.constants";
import { isValidEmail, escapeHtml } from "../alerts/alert-email";
import { readAlertsConfig } from "../alerts/alerts.config";
import { EMAIL_SENDER, sanitizeEmailError, type EmailSender } from "../alerts/email-sender";
import type { PriceComponent } from "../contracts/contract-items";
import { loadIssuer, renderPdf } from "../contracts/contract-pdf";
import { todayInBogota } from "../shared/dates";
import { badRequest, notFound, unprocessable } from "../shared/errors";
import { asBody, assertUuid } from "../shared/parsing";
import { assembleBillingCollections, buildBillingCollectionsWorkbook } from "./billing-collections";
import { parseDateRange, parseMonthRange } from "./report-dates";
import { renewalEvents, renewalValues, type RenewalContract } from "./renewals";
import { buildStatementDocument, statementFileName, summarizeStatement } from "./statement";

@Injectable()
export class ReportsService {
  constructor(
    @Inject(ControlCenterDatabaseService) private readonly db: ControlCenterDatabaseService,
    @Inject(ControlCenterAuditService) private readonly audit: ControlCenterAuditService,
    @Inject(EMAIL_SENDER) private readonly sender: EmailSender,
  ) {}

  // ---------------------------------------------------------------- Estado de cuenta

  private async statement(accountIdParam: string, query: Record<string, unknown>) {
    const accountId = assertUuid(accountIdParam, "accountId");
    const range = parseDateRange(query);
    const asOf = todayInBogota();
    const account = await this.db.query<any>(
      `SELECT legal_name AS "legalName", tax_id_type AS "taxIdType", tax_id AS "taxId", dv, billing_email AS "billingEmail", address, city
       FROM control_center.commercial_accounts WHERE id = $1`,
      [accountId],
    );
    if (!account.rows[0]) throw notFound("CONTROL_CENTER_ACCOUNT_NOT_FOUND", "Cuenta comercial no encontrada");
    const [charges, receipts, credit, issuer] = await Promise.all([
      this.db.query<any>(
        `SELECT ch.charge_number AS "chargeNumber", c.contract_number AS "contractNumber", ch.kind, ch.billing_frequency AS "billingFrequency",
                ch.period_start::text AS "periodStart", ch.period_end::text AS "periodEnd", ch.due_date::text AS "dueDate",
                ch.total_amount::text AS "totalAmount", ch.paid_amount::text AS "paidAmount",
                (ch.total_amount - ch.paid_amount)::text AS balance, ch.status
         FROM control_center.charges ch JOIN control_center.contracts c ON c.id = ch.contract_id
         WHERE ch.account_id = $1 AND ch.status <> 'VOID'
           AND ((ch.due_date BETWEEN $2::date AND $3::date) OR ch.status IN ('OPEN', 'PARTIALLY_PAID'))
         ORDER BY ch.due_date, ch.charge_number`,
        [accountId, range.from, range.to],
      ),
      this.db.query<any>(
        `SELECT receipt_number AS "receiptNumber", received_on::text AS "receivedOn", source, payment_method_name AS "paymentMethodName",
                financial_institution_name AS "financialInstitutionName", reference, amount::text AS amount,
                allocated_amount::text AS "allocatedAmount", (amount - allocated_amount)::text AS unallocated
         FROM control_center.receipts
         WHERE account_id = $1 AND status = 'CONFIRMED' AND received_on BETWEEN $2::date AND $3::date
         ORDER BY received_on, receipt_number`,
        [accountId, range.from, range.to],
      ),
      this.db.query<any>(
        `SELECT COALESCE(SUM(amount - allocated_amount), 0)::numeric(18, 2)::text AS credit
         FROM control_center.receipts WHERE account_id = $1 AND status = 'CONFIRMED'`,
        [accountId],
      ),
      loadIssuer(this.db, this.db.getConfig().platformTenantId),
    ]);
    const summary = summarizeStatement(charges.rows, receipts.rows, range, asOf, credit.rows[0].credit);
    const definition = buildStatementDocument({
      issuer,
      account: account.rows[0],
      range,
      asOf,
      charges: charges.rows,
      receipts: receipts.rows,
      summary,
      paymentInstructions: readAlertsConfig().paymentInstructions,
    });
    const content = await renderPdf(definition);
    return { accountId, account: account.rows[0], range, summary, content, fileName: statementFileName(account.rows[0].taxId, range.from, range.to) };
  }

  async downloadStatement(accountIdParam: string, query: Record<string, unknown>, ctx: ControlCenterRequestContext) {
    const result = await this.statement(accountIdParam, query);
    await this.audit.record(this.db, {
      ...ctx,
      action: CONTROL_CENTER_ACTIONS.ACCOUNT_STATEMENT_DOWNLOADED,
      entityType: "account",
      entityId: result.accountId,
      after: { ...result.range, summary: result.summary },
    });
    return result;
  }

  async sendStatement(accountIdParam: string, raw: unknown, ctx: ControlCenterRequestContext) {
    const body = raw === undefined || raw === null ? {} : asBody(raw);
    const config = readAlertsConfig();
    if (!config.emailReady) {
      throw unprocessable(
        "CONTROL_CENTER_EMAIL_DISABLED",
        config.emailEnabled ? `Falta configurar: ${config.missing.join(", ")}` : "El correo está deshabilitado (CONTROL_CENTER_ALERTS_EMAIL_ENABLED)",
      );
    }
    const result = await this.statement(accountIdParam, body);
    const to = String(result.account.billingEmail ?? "").trim();
    if (!isValidEmail(to)) throw unprocessable("CONTROL_CENTER_ACCOUNT_EMAIL_INVALID", "La cuenta no tiene un correo de facturación válido");
    const period = `${result.range.from.split("-").reverse().join("/")} – ${result.range.to.split("-").reverse().join("/")}`;
    const name = result.account.legalName as string;
    let error: string | null = null;
    try {
      await this.sender.send({
        to,
        subject: `MANUS: estado de cuenta de ${name}`,
        text: `Hola, ${name}:\n\nAdjuntamos tu estado de cuenta del período ${period}.\nSaldo pendiente: $${result.summary.pending.split(".")[0].replace(/\B(?=(\d{3})+(?!\d))/g, ".")}.\n\nSi tienes preguntas, responde este correo.\nMANUS POS`,
        html: `<p>Hola, ${escapeHtml(name)}:</p><p>Adjuntamos tu estado de cuenta del período <strong>${escapeHtml(period)}</strong>.</p><p>Si tienes preguntas, responde este correo.<br>MANUS POS</p>`,
        attachments: [{ filename: result.fileName, content: result.content, contentType: "application/pdf" }],
      });
    } catch (caught) {
      error = sanitizeEmailError(caught);
    }
    await this.audit.record(this.db, {
      ...ctx,
      action: CONTROL_CENTER_ACTIONS.ACCOUNT_STATEMENT_SENT,
      entityType: "account",
      entityId: result.accountId,
      after: { ...result.range, to, sent: error === null, error },
    });
    if (error) throw new BadGatewayException({ code: "CONTROL_CENTER_EMAIL_FAILED", message: `No se pudo enviar el correo: ${error}` });
    return { sent: true, to, fileName: result.fileName, summary: result.summary };
  }

  // ---------------------------------------------------- Facturado frente a recaudado

  async billingCollections(query: Record<string, unknown>) {
    const range = parseMonthRange(query);
    const [billed, collected, pending] = await Promise.all([
      this.db.query<any>(
        `SELECT to_char(due_date, 'YYYY-MM') AS month, kind, SUM(total_amount)::text AS amount
         FROM control_center.charges WHERE status <> 'VOID' AND due_date BETWEEN $1::date AND $2::date
         GROUP BY 1, 2`,
        [range.fromDate, range.toDate],
      ),
      this.db.query<any>(
        `SELECT to_char(received_on, 'YYYY-MM') AS month, source, payment_method_code AS "methodCode",
                MAX(payment_method_name) AS "methodName", SUM(amount)::text AS amount
         FROM control_center.receipts WHERE status = 'CONFIRMED' AND received_on BETWEEN $1::date AND $2::date
         GROUP BY 1, 2, 3`,
        [range.fromDate, range.toDate],
      ),
      this.db.query<any>(
        `SELECT COALESCE(SUM(total_amount - paid_amount), 0)::numeric(18, 2)::text AS pending
         FROM control_center.charges WHERE status IN ('OPEN', 'PARTIALLY_PAID') AND due_date BETWEEN $1::date AND $2::date`,
        [range.fromDate, range.toDate],
      ),
    ]);
    return {
      range,
      report: assembleBillingCollections(range.months, billed.rows, collected.rows, pending.rows[0].pending, { from: range.from, to: range.to }),
    };
  }

  async billingCollectionsWorkbook(query: Record<string, unknown>, ctx: ControlCenterRequestContext) {
    const { range, report } = await this.billingCollections(query);
    const [charges, receipts] = await Promise.all([
      this.db.query<any>(
        `SELECT ch.charge_number AS "chargeNumber", c.contract_number AS "contractNumber", a.legal_name AS "accountLegalName", ch.kind,
                ch.period_start::text AS "periodStart", ch.period_end::text AS "periodEnd", ch.due_date::text AS "dueDate",
                ch.total_amount::text AS "totalAmount", ch.paid_amount::text AS "paidAmount", (ch.total_amount - ch.paid_amount)::text AS balance, ch.status
         FROM control_center.charges ch
         JOIN control_center.contracts c ON c.id = ch.contract_id
         JOIN control_center.commercial_accounts a ON a.id = ch.account_id
         WHERE ch.status <> 'VOID' AND ch.due_date BETWEEN $1::date AND $2::date
         ORDER BY ch.due_date, ch.charge_number`,
        [range.fromDate, range.toDate],
      ),
      this.db.query<any>(
        `SELECT r.receipt_number AS "receiptNumber", a.legal_name AS "accountLegalName", r.received_on::text AS "receivedOn", r.source,
                r.payment_method_name AS "paymentMethodName", r.financial_institution_name AS "financialInstitutionName", r.reference,
                r.amount::text AS amount, r.allocated_amount::text AS "allocatedAmount", (r.amount - r.allocated_amount)::text AS unallocated
         FROM control_center.receipts r JOIN control_center.commercial_accounts a ON a.id = r.account_id
         WHERE r.status = 'CONFIRMED' AND r.received_on BETWEEN $1::date AND $2::date
         ORDER BY r.received_on, r.receipt_number`,
        [range.fromDate, range.toDate],
      ),
    ]);
    const content = await buildBillingCollectionsWorkbook(report, charges.rows, receipts.rows);
    await this.audit.record(this.db, {
      ...ctx,
      action: CONTROL_CENTER_ACTIONS.REPORT_EXPORTED,
      entityType: "report",
      after: { report: "billing-collections", from: range.from, to: range.to, charges: charges.rows.length, receipts: receipts.rows.length },
    });
    return { content, fileName: `facturado-vs-recaudado-${range.from}-${range.to}.xlsx` };
  }

  // ---------------------------------------------------------------- Renovaciones

  async renewals(query: Record<string, unknown>) {
    const days = query.days === undefined || query.days === "" ? 30 : Number(query.days);
    if (![30, 60, 90].includes(days)) throw badRequest("CONTROL_CENTER_INVALID_FIELD", "days debe ser 30, 60 o 90");
    const today = todayInBogota();
    const result = await this.db.query<any>(
      `SELECT c.id, c.contract_number AS "contractNumber", c.start_date::text AS "startDate", c.plan_id AS "planId",
              a.legal_name AS "accountLegalName", t.nombre AS "tenantName",
              json_agg(json_build_object(
                'versionNo', v.version_no, 'effectiveFrom', v.effective_from::text, 'effectiveTo', v.effective_to::text,
                'termPhase', v.term_phase, 'billingFrequency', v.billing_frequency, 'billingAnchorDay', v.billing_anchor_day,
                'trialEndsOn', v.trial_ends_on::text, 'initialTermMonths', ppv.initial_term_months,
                'taxRate', v.tax_rate_snapshot::text, 'pricesIncludeTax', v.prices_include_tax,
                'items', COALESCE((SELECT json_agg(json_build_object('itemType', i.item_type, 'quantity', i.quantity::text,
                  'unitAmount', i.unit_amount::text, 'discountAmount', i.discount_amount::text, 'billingFrequency', i.billing_frequency))
                  FROM control_center.contract_items i WHERE i.contract_version_id = v.id), '[]'::json)
              ) ORDER BY v.version_no) AS versions
       FROM control_center.contracts c
       JOIN control_center.commercial_accounts a ON a.id = c.account_id
       JOIN public.tenants t ON t.id = c.tenant_id
       JOIN control_center.contract_versions v ON v.contract_id = c.id
       JOIN control_center.plan_price_versions ppv ON ppv.id = v.source_price_version_id
       WHERE c.status = 'ACTIVE'
       GROUP BY c.id, a.legal_name, t.nombre`,
    );
    const priceCache = new Map<string, PriceComponent[] | null>();
    const componentsAt = async (planId: string, date: string) => {
      const key = `${planId}|${date}`;
      if (!priceCache.has(key)) {
        const found = await this.db.query<any>(
          `SELECT COALESCE(json_agg(json_build_object('component', pc.component, 'billingFrequency', pc.billing_frequency, 'amount', pc.amount::text))
                    FILTER (WHERE pc.id IS NOT NULL), '[]') AS components
           FROM control_center.plan_price_versions pv
           LEFT JOIN control_center.plan_price_components pc ON pc.price_version_id = pv.id
           WHERE pv.id = (SELECT id FROM control_center.plan_price_versions WHERE plan_id = $1 AND valid_from <= $2::date
                          AND (valid_to IS NULL OR valid_to >= $2::date) ORDER BY version_no DESC LIMIT 1)`,
          [planId, date],
        );
        const components = found.rows[0]?.components;
        priceCache.set(key, Array.isArray(components) && components.length > 0 ? components : null);
      }
      return priceCache.get(key) ?? null;
    };
    const rows = [];
    for (const contract of result.rows as (RenewalContract & { planId: string })[]) {
      for (const event of renewalEvents(contract, today, days)) {
        const current = [...contract.versions].sort((a, b) => b.versionNo - a.versionNo).find((v) => v.effectiveFrom <= today) ?? contract.versions[0];
        const values = event.type === "TRIAL_END" ? { monthly: null, monthlyAnnualExtras: null, annual: null } : renewalValues(await componentsAt(contract.planId, event.date), current);
        rows.push({
          contractId: contract.id,
          contractNumber: contract.contractNumber,
          accountLegalName: contract.accountLegalName,
          tenantName: contract.tenantName,
          ...event,
          renewal: values,
        });
      }
    }
    rows.sort((a, b) => a.date.localeCompare(b.date) || a.contractNumber.localeCompare(b.contractNumber));
    return { today, days, items: rows };
  }
}
