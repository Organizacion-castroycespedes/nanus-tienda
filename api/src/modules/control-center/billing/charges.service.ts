import { Inject, Injectable } from "@nestjs/common";
import { ControlCenterAuditService, type ControlCenterRequestContext } from "../control-center-audit.service";
import { ControlCenterDatabaseService } from "../control-center-database.service";
import { CONTROL_CENTER_ACTIONS } from "../control-center.constants";
import { parseIsoDate, todayInBogota } from "../shared/dates";
import { badRequest, conflict, mapDatabaseError, notFound } from "../shared/errors";
import { toCents } from "../shared/money";
import { asBody, assertUuid, likePattern, parseLimit, parseOffset, parseSearch, requireReason } from "../shared/parsing";
import { lockContractBilling } from "./billing.service";

const CHARGE_STATUSES = ["OPEN", "PARTIALLY_PAID", "PAID", "VOID"];
const CHARGE_KINDS = ["PERIOD", "PRORATION", "ONE_TIME"];

export const CHARGE_COLUMNS = `ch.id, ch.charge_number AS "chargeNumber", ch.kind, ch.billing_frequency AS "billingFrequency",
  ch.period_start::text AS "periodStart", ch.period_end::text AS "periodEnd", ch.issue_date::text AS "issueDate",
  ch.due_date::text AS "dueDate", ch.subtotal::text AS subtotal, ch.discount_total::text AS "discountTotal",
  ch.base_amount::text AS "baseAmount", ch.tax_amount::text AS "taxAmount", ch.total_amount::text AS "totalAmount",
  ch.paid_amount::text AS "paidAmount", (ch.total_amount - ch.paid_amount)::text AS balance, ch.status,
  ch.generation_source AS "generationSource", ch.tax_name_snapshot AS "taxName", ch.tax_rate_snapshot::text AS "taxRate",
  ch.prices_include_tax AS "pricesIncludeTax", ch.void_reason AS "voidReason", ch.voided_at AS "voidedAt",
  ch.contract_id AS "contractId", c.contract_number AS "contractNumber", ch.account_id AS "accountId",
  a.legal_name AS "accountLegalName", ch.tenant_id AS "tenantId", t.nombre AS "tenantName", ch.created_at AS "createdAt"`;

export const CHARGE_FROM = `FROM control_center.charges ch
  JOIN control_center.contracts c ON c.id = ch.contract_id
  JOIN control_center.commercial_accounts a ON a.id = ch.account_id
  JOIN public.tenants t ON t.id = ch.tenant_id`;

@Injectable()
export class ChargesService {
  constructor(
    @Inject(ControlCenterDatabaseService) private readonly db: ControlCenterDatabaseService,
    @Inject(ControlCenterAuditService) private readonly audit: ControlCenterAuditService,
  ) {}

  async list(query: Record<string, unknown>) {
    const limit = parseLimit(query.limit, 20, 100);
    const offset = parseOffset(query.offset);
    const params: unknown[] = [];
    const where: string[] = [];
    if (typeof query.status === "string" && query.status) {
      const statuses = query.status.toUpperCase().split(",");
      if (statuses.some((s) => !CHARGE_STATUSES.includes(s))) throw badRequest("CONTROL_CENTER_INVALID_FIELD", "status inválido");
      params.push(statuses);
      where.push(`ch.status = ANY($${params.length}::text[])`);
    }
    if (typeof query.kind === "string" && query.kind) {
      const kind = query.kind.toUpperCase();
      if (!CHARGE_KINDS.includes(kind)) throw badRequest("CONTROL_CENTER_INVALID_FIELD", "kind inválido");
      params.push(kind);
      where.push(`ch.kind = $${params.length}`);
    }
    for (const [field, column] of [["accountId", "ch.account_id"], ["tenantId", "ch.tenant_id"], ["contractId", "ch.contract_id"]] as const) {
      if (query[field] !== undefined && query[field] !== "") {
        params.push(assertUuid(query[field], field));
        where.push(`${column} = $${params.length}`);
      }
    }
    if (query.dueFrom) {
      params.push(parseIsoDate(query.dueFrom, "dueFrom"));
      where.push(`ch.due_date >= $${params.length}::date`);
    }
    if (query.dueTo) {
      params.push(parseIsoDate(query.dueTo, "dueTo"));
      where.push(`ch.due_date <= $${params.length}::date`);
    }
    if (query.overdue === "true") {
      params.push(todayInBogota());
      where.push(`ch.status IN ('OPEN', 'PARTIALLY_PAID') AND ch.due_date < $${params.length}::date`);
    }
    const search = parseSearch(query.search);
    if (search) {
      params.push(likePattern(search));
      where.push(`(ch.charge_number ILIKE $${params.length} OR c.contract_number ILIKE $${params.length} OR a.legal_name ILIKE $${params.length})`);
    }
    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const [rows, count] = await Promise.all([
      this.db.query(
        `SELECT ${CHARGE_COLUMNS} ${CHARGE_FROM} ${whereSql}
         ORDER BY ch.due_date DESC, ch.charge_number DESC
         LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, limit, offset],
      ),
      this.db.query(`SELECT COUNT(*)::int AS total ${CHARGE_FROM} ${whereSql}`, params),
    ]);
    return { items: rows.rows, total: count.rows[0]?.total ?? 0, limit, offset };
  }

  async get(idParam: string) {
    const id = assertUuid(idParam, "chargeId");
    const charge = await this.db.query(`SELECT ${CHARGE_COLUMNS} ${CHARGE_FROM} WHERE ch.id = $1`, [id]);
    if (!charge.rows[0]) throw notFound("CONTROL_CENTER_CHARGE_NOT_FOUND", "Cargo no encontrado");
    const [lines, allocations] = await Promise.all([
      this.db.query(
        `SELECT id, item_type AS "itemType", description, quantity::text AS quantity, unit_amount::text AS "unitAmount",
                discount_amount::text AS "discountAmount", proration_factor::text AS "prorationFactor", line_total::text AS "lineTotal"
         FROM control_center.charge_lines WHERE charge_id = $1 ORDER BY item_type, description`,
        [id],
      ),
      this.db.query(
        `SELECT ra.id, ra.amount::text AS amount, ra.created_at AS "createdAt", ra.reversed_at AS "reversedAt",
                ra.reversal_reason AS "reversalReason", r.id AS "receiptId", r.receipt_number AS "receiptNumber",
                r.received_on::text AS "receivedOn", r.source, r.payment_method_name AS "paymentMethodName"
         FROM control_center.receipt_allocations ra
         JOIN control_center.receipts r ON r.id = ra.receipt_id
         WHERE ra.charge_id = $1 ORDER BY ra.created_at`,
        [id],
      ),
    ]);
    return { ...charge.rows[0], lines: lines.rows, allocations: allocations.rows };
  }

  async void(idParam: string, raw: unknown, ctx: ControlCenterRequestContext) {
    const id = assertUuid(idParam, "chargeId");
    const reason = requireReason(asBody(raw ?? {}));
    await this.db
      .transaction(async (tx) => {
        const found = await tx.query(`SELECT contract_id FROM control_center.charges WHERE id = $1`, [id]);
        if (!found.rows[0]) throw notFound("CONTROL_CENTER_CHARGE_NOT_FOUND", "Cargo no encontrado");
        await lockContractBilling(tx, found.rows[0].contract_id);
        const locked = await tx.query(
          `SELECT status, paid_amount::text AS paid_amount, charge_number FROM control_center.charges WHERE id = $1 FOR UPDATE`,
          [id],
        );
        const charge = locked.rows[0];
        if (charge.status === "VOID") throw conflict("CONTROL_CENTER_CHARGE_ALREADY_VOID", "El cargo ya está anulado");
        if (toCents(charge.paid_amount) > 0n) {
          throw conflict("CONTROL_CENTER_CHARGE_HAS_PAYMENTS", "Revierte primero los pagos aplicados al cargo");
        }
        await tx.query(
          `UPDATE control_center.charges
           SET status = 'VOID', void_reason = $2, voided_at = NOW(), voided_by = $3, updated_by = $3, updated_at = NOW()
           WHERE id = $1`,
          [id, reason, ctx.actorUserId],
        );
        await this.audit.record(tx, {
          ...ctx,
          action: CONTROL_CENTER_ACTIONS.CHARGE_VOIDED,
          entityType: "charge",
          entityId: id,
          before: { status: charge.status, chargeNumber: charge.charge_number },
          after: { status: "VOID" },
          reason,
        });
      })
      .catch((error) => mapDatabaseError(error));
    return this.get(id);
  }

  async listRuns(query: Record<string, unknown>) {
    const limit = parseLimit(query.limit, 20, 50);
    const result = await this.db.query(
      `SELECT br.id, br.trigger_source AS "triggerSource", br.actor_user_id AS "actorUserId", br.contract_id AS "contractId",
              c.contract_number AS "contractNumber", br.run_date::text AS "runDate", br.lead_days AS "leadDays", br.status,
              br.started_at AS "startedAt", br.finished_at AS "finishedAt", br.contracts_scanned AS "contractsScanned",
              br.charges_created AS "chargesCreated", br.errors
       FROM control_center.billing_runs br
       LEFT JOIN control_center.contracts c ON c.id = br.contract_id
       ORDER BY br.started_at DESC LIMIT $1`,
      [limit],
    );
    return { items: result.rows };
  }
}
