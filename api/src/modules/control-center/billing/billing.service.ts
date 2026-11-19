import { Inject, Injectable } from "@nestjs/common";
import type { ControlCenterQueryable } from "../control-center-database.service";
import { ControlCenterDatabaseService } from "../control-center-database.service";
import { ControlCenterAuditService, type ControlCenterRequestContext } from "../control-center-audit.service";
import { CONTROL_CENTER_ACTIONS, CONTROL_CENTER_SYSTEM_ACTOR_ID } from "../control-center.constants";
import { resolveChargeNotices } from "../alerts/notices";
import { autoAllocate } from "../collections/allocations";
import { addDays, todayInBogota } from "../shared/dates";
import { conflict, mapDatabaseError, notFound } from "../shared/errors";
import { fromCents, toCents } from "../shared/money";
import { assertUuid } from "../shared/parsing";
import { readBillingConfig, type BillingConfig } from "./billing.config";
import {
  computeProration,
  planCharges,
  prorationAmounts,
  type BillableContract,
  type BillableVersion,
  type ChargeAmounts,
  type ChargeKind,
  type PlannedLine,
} from "./billing-periods";

export type GenerationSource = "WORKER" | "MANUAL" | "AMENDMENT";

type ContractForBilling = BillableContract & {
  status: string;
  accountId: string;
  tenantId: string;
  contractNumber: string;
};

type ChargeInsert = {
  contract: ContractForBilling;
  version: BillableVersion;
  kind: ChargeKind;
  billingFrequency: string;
  periodStart: string;
  periodEnd: string;
  dueDate: string;
  lines: PlannedLine[];
  amounts: ChargeAmounts;
  source: GenerationSource;
  issueDate: string;
  actorUserId: string;
};

const formatDay = (date: string) => `${date.slice(8, 10)}/${date.slice(5, 7)}/${date.slice(0, 4)}`;
const lockKey = (contractId: string) => `control-center:billing:${contractId}`;

/** Serializa la facturación de un contrato entre el worker, el botón manual y las enmiendas. */
export const lockContractBilling = (tx: ControlCenterQueryable, contractId: string) =>
  tx.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [lockKey(contractId)]);

export const systemContext = (platformTenantId: string): ControlCenterRequestContext => ({
  actorUserId: CONTROL_CENTER_SYSTEM_ACTOR_ID,
  actorTenantId: platformTenantId,
  requestId: null,
  ip: null,
  userAgent: "control-center-billing-worker",
});

export const loadContractForBilling = async (
  tx: ControlCenterQueryable,
  contractId: string,
): Promise<ContractForBilling | null> => {
  const result = await tx.query(
    `SELECT c.id, c.status, c.account_id AS "accountId", c.tenant_id AS "tenantId", c.contract_number AS "contractNumber",
            c.start_date::text AS "startDate", c.end_date::text AS "endDate",
            COALESCE((
              SELECT json_agg(json_build_object(
                'id', v.id, 'versionNo', v.version_no, 'effectiveFrom', v.effective_from::text,
                'effectiveTo', v.effective_to::text, 'billingAnchorDay', v.billing_anchor_day,
                'trialEndsOn', v.trial_ends_on::text, 'prorationPolicy', v.proration_policy,
                'taxName', v.tax_name_snapshot, 'taxRate', v.tax_rate_snapshot::text,
                'pricesIncludeTax', v.prices_include_tax,
                'items', COALESCE((
                  SELECT json_agg(json_build_object(
                    'id', i.id, 'itemType', i.item_type, 'description', i.description,
                    'quantity', i.quantity::text, 'unitAmount', i.unit_amount::text,
                    'discountAmount', i.discount_amount::text, 'billingFrequency', i.billing_frequency
                  ) ORDER BY i.item_type, i.description)
                  FROM control_center.contract_items i WHERE i.contract_version_id = v.id
                ), '[]'::json)
              ) ORDER BY v.version_no)
              FROM control_center.contract_versions v WHERE v.contract_id = c.id
            ), '[]'::json) AS versions
     FROM control_center.contracts c WHERE c.id = $1`,
    [contractId],
  );
  return result.rows[0] ?? null;
};

@Injectable()
export class BillingService {
  private readonly config: BillingConfig = readBillingConfig();

  constructor(
    @Inject(ControlCenterDatabaseService) private readonly db: ControlCenterDatabaseService,
    @Inject(ControlCenterAuditService) private readonly audit: ControlCenterAuditService,
  ) {}

  getConfig(): Readonly<BillingConfig> {
    return this.config;
  }

  horizon(today = todayInBogota()) {
    return addDays(today, this.config.leadDays);
  }

  /**
   * Genera los cargos faltantes de un contrato activo hasta el horizonte. Debe
   * ejecutarse dentro de una transacción; toma el bloqueo consultivo del contrato.
   */
  async generateInTx(
    tx: ControlCenterQueryable,
    contractId: string,
    source: GenerationSource,
    ctx: ControlCenterRequestContext,
    today = todayInBogota(),
  ) {
    await lockContractBilling(tx, contractId);
    const contract = await loadContractForBilling(tx, contractId);
    if (!contract || contract.status !== "ACTIVE") return [];
    const planned = planCharges(contract, this.horizon(today));
    if (planned.length === 0) return [];
    const existing = await tx.query(
      `SELECT kind, billing_frequency, period_start::text AS period_start
       FROM control_center.charges
       WHERE contract_id = $1 AND status <> 'VOID' AND kind IN ('PERIOD', 'ONE_TIME')`,
      [contractId],
    );
    const taken = new Set(existing.rows.map((r: any) => `${r.kind}|${r.billing_frequency}|${r.period_start}`));
    const created: { id: string; chargeNumber: string; periodStart: string; billingFrequency: string; total: string }[] = [];
    for (const charge of planned) {
      if (taken.has(`${charge.kind}|${charge.billingFrequency}|${charge.periodStart}`)) continue;
      const inserted = await this.insertCharge(tx, {
        contract,
        version: charge.version,
        kind: charge.kind,
        billingFrequency: charge.billingFrequency,
        periodStart: charge.periodStart,
        periodEnd: charge.periodEnd,
        dueDate: charge.dueDate,
        lines: charge.lines,
        amounts: charge.amounts,
        source,
        issueDate: today,
        actorUserId: ctx.actorUserId,
      });
      if (!inserted) continue;
      await this.audit.record(tx, {
        ...ctx,
        action: CONTROL_CENTER_ACTIONS.CHARGE_GENERATED,
        entityType: "charge",
        entityId: inserted.id,
        after: {
          chargeNumber: inserted.chargeNumber,
          contractId,
          kind: charge.kind,
          billingFrequency: charge.billingFrequency,
          periodStart: charge.periodStart,
          total: charge.amounts.total,
          source,
        },
      });
      created.push({ ...inserted, periodStart: charge.periodStart, billingFrequency: charge.billingFrequency, total: charge.amounts.total });
    }
    return created;
  }

  /** Botón manual de la ficha del contrato. */
  async generateForContract(contractIdParam: string, ctx: ControlCenterRequestContext) {
    const contractId = assertUuid(contractIdParam, "contractId");
    const today = todayInBogota();
    return this.db
      .transaction(async (tx) => {
        const contract = await tx.query(`SELECT status FROM control_center.contracts WHERE id = $1`, [contractId]);
        if (!contract.rows[0]) throw notFound("CONTROL_CENTER_CONTRACT_NOT_FOUND", "Contrato no encontrado");
        if (contract.rows[0].status !== "ACTIVE") {
          throw conflict("CONTROL_CENTER_CONTRACT_NOT_ACTIVE", "Solo se generan cargos de contratos activos");
        }
        const created = await this.generateInTx(tx, contractId, "MANUAL", ctx, today);
        const run = await tx.query(
          `INSERT INTO control_center.billing_runs
             (trigger_source, actor_user_id, contract_id, run_date, lead_days, status, finished_at, contracts_scanned, charges_created)
           VALUES ('MANUAL', $1, $2, $3, $4, 'COMPLETED', NOW(), 1, $5) RETURNING id`,
          [ctx.actorUserId, contractId, today, this.config.leadDays, created.length],
        );
        await this.audit.record(tx, {
          ...ctx,
          action: CONTROL_CENTER_ACTIONS.BILLING_RUN_MANUAL,
          entityType: "contract",
          entityId: contractId,
          after: { runId: run.rows[0].id, chargesCreated: created.length },
        });
        return { runId: run.rows[0].id as string, horizon: this.horizon(today), created };
      })
      .catch((error) => mapDatabaseError(error));
  }

  /** Ejecución completa del worker: un contrato por transacción. */
  async runAll(today = todayInBogota()) {
    const ctx = systemContext(this.db.getConfig().platformTenantId);
    const run = await this.db.query<{ id: string }>(
      `INSERT INTO control_center.billing_runs (trigger_source, actor_user_id, run_date, lead_days)
       VALUES ('WORKER', $1, $2, $3) RETURNING id`,
      [ctx.actorUserId, today, this.config.leadDays],
    );
    const runId = run.rows[0].id;
    const contracts = await this.db.query<{ id: string }>(
      `SELECT id FROM control_center.contracts WHERE status = 'ACTIVE' ORDER BY id`,
    );
    let created = 0;
    const errors: { contractId: string; message: string }[] = [];
    for (const { id } of contracts.rows) {
      try {
        const result = await this.db.transaction((tx) => this.generateInTx(tx, id, "WORKER", ctx, today));
        created += result.length;
      } catch (error) {
        errors.push({ contractId: id, message: String((error as Error)?.message ?? error).slice(0, 300) });
      }
    }
    const status = errors.length > 0 && errors.length === contracts.rows.length ? "FAILED" : "COMPLETED";
    await this.db.query(
      `UPDATE control_center.billing_runs
       SET status = $2, finished_at = NOW(), contracts_scanned = $3, charges_created = $4, errors = $5::jsonb
       WHERE id = $1`,
      [runId, status, contracts.rows.length, created, JSON.stringify(errors)],
    );
    return { runId, status, contractsScanned: contracts.rows.length, chargesCreated: created, errors };
  }

  /**
   * Anula los cargos de período y de pago único que inician desde `fromDate`
   * (o después, si `exclusive`). Rechaza con 409 si alguno tiene pagos aplicados.
   */
  async voidFutureCharges(
    tx: ControlCenterQueryable,
    contractId: string,
    fromDate: string,
    exclusive: boolean,
    reason: string,
    ctx: ControlCenterRequestContext,
  ) {
    const result = await tx.query(
      `SELECT id, charge_number, paid_amount::text AS paid_amount, status, period_start::text AS period_start
       FROM control_center.charges
       WHERE contract_id = $1 AND status <> 'VOID' AND kind IN ('PERIOD', 'ONE_TIME')
         AND (period_start > $2::date OR (NOT $3::boolean AND period_start = $2::date))
       ORDER BY id FOR UPDATE`,
      [contractId, fromDate, exclusive],
    );
    const withPayments = result.rows.filter((row: any) => toCents(row.paid_amount) > 0n);
    if (withPayments.length > 0) {
      const list = withPayments.map((row: any) => `${row.charge_number} (período desde ${formatDay(row.period_start)})`).join(", ");
      const latest = withPayments.map((row: any) => row.period_start as string).sort().at(-1) as string;
      throw conflict(
        "CONTROL_CENTER_FUTURE_CHARGE_HAS_PAYMENTS",
        `La fecha ${formatDay(fromDate)} reemplazaría cargos que ya tienen pagos: ${list}. ` +
          `Usa una fecha posterior al ${formatDay(latest)} (el cambio se prorratea en el período en curso) ` +
          `o revierte primero esas aplicaciones.`,
      );
    }
    await resolveChargeNotices(tx, result.rows.map((row: any) => row.id));
    for (const row of result.rows) {
      await tx.query(
        `UPDATE control_center.charges
         SET status = 'VOID', void_reason = $2, voided_at = NOW(), voided_by = $3, updated_by = $3, updated_at = NOW()
         WHERE id = $1`,
        [row.id, reason, ctx.actorUserId],
      );
      await this.audit.record(tx, {
        ...ctx,
        action: CONTROL_CENTER_ACTIONS.CHARGE_VOIDED,
        entityType: "charge",
        entityId: row.id,
        before: { status: row.status },
        after: { status: "VOID", automatic: true },
        reason,
      });
    }
    return result.rows.length;
  }

  /**
   * Anula todos los cargos de un contrato y sus créditos de prorrateo sin
   * aplicar (contrato registrado por error). Rechaza con 409 si algún cargo
   * tiene pagos aplicados.
   */
  async voidAllContractCharges(tx: ControlCenterQueryable, contractId: string, reason: string, ctx: ControlCenterRequestContext) {
    const charges = await tx.query(
      `SELECT id, charge_number, paid_amount::text AS paid_amount, status
       FROM control_center.charges WHERE contract_id = $1 AND status <> 'VOID' ORDER BY id FOR UPDATE`,
      [contractId],
    );
    const withPayments = charges.rows.filter((row: any) => toCents(row.paid_amount) > 0n);
    if (withPayments.length > 0) {
      throw conflict(
        "CONTROL_CENTER_CONTRACT_HAS_PAYMENTS",
        `Revierte primero los pagos aplicados a los cargos ${withPayments.map((row: any) => row.charge_number).join(", ")}`,
      );
    }
    await resolveChargeNotices(tx, charges.rows.map((row: any) => row.id));
    for (const row of charges.rows) {
      await tx.query(
        `UPDATE control_center.charges
         SET status = 'VOID', void_reason = $2, voided_at = NOW(), voided_by = $3, updated_by = $3, updated_at = NOW()
         WHERE id = $1`,
        [row.id, reason, ctx.actorUserId],
      );
      await this.audit.record(tx, {
        ...ctx,
        action: CONTROL_CENTER_ACTIONS.CHARGE_VOIDED,
        entityType: "charge",
        entityId: row.id,
        before: { status: row.status, chargeNumber: row.charge_number },
        after: { status: "VOID", automatic: true },
        reason,
      });
    }
    const credits = await tx.query(
      `SELECT id, receipt_number FROM control_center.receipts
       WHERE contract_id = $1 AND source = 'PRORATION_CREDIT' AND status = 'CONFIRMED' AND allocated_amount = 0
       ORDER BY id FOR UPDATE`,
      [contractId],
    );
    for (const row of credits.rows) {
      await tx.query(
        `UPDATE control_center.receipts
         SET status = 'VOID', void_reason = $2, voided_at = NOW(), voided_by = $3, updated_by = $3, updated_at = NOW()
         WHERE id = $1`,
        [row.id, reason, ctx.actorUserId],
      );
      await this.audit.record(tx, {
        ...ctx,
        action: CONTROL_CENTER_ACTIONS.RECEIPT_VOIDED,
        entityType: "receipt",
        entityId: row.id,
        before: { status: "CONFIRMED", receiptNumber: row.receipt_number },
        after: { status: "VOID", automatic: true },
        reason,
      });
    }
    return { voidedCharges: charges.rows.length, voidedCredits: credits.rows.length };
  }

  /**
   * Prorrateo diario de una enmienda (política DAILY de la nueva versión).
   * Diferencias positivas: un cargo PRORATION por frecuencia. Negativas: un
   * crédito PRORATION_CREDIT que se aplica a los cargos abiertos del contrato.
   */
  async applyAmendmentProration(
    tx: ControlCenterQueryable,
    contractId: string,
    previousVersionId: string,
    nextVersionId: string,
    effectiveFrom: string,
    ctx: ControlCenterRequestContext,
  ) {
    const contract = await loadContractForBilling(tx, contractId);
    if (!contract) return { charges: [], credit: null };
    const previous = contract.versions.find((v) => v.id === previousVersionId);
    const next = contract.versions.find((v) => v.id === nextVersionId);
    if (!previous || !next || next.prorationPolicy !== "DAILY") return { charges: [], credit: null };
    const charges: { id: string; chargeNumber: string; total: string; billingFrequency: string }[] = [];
    let creditCents = 0n;
    const details: unknown[] = [];
    for (const frequency of ["MONTHLY", "ANNUAL"] as const) {
      const result = computeProration(contract, previous, next, effectiveFrom, frequency);
      if (!result) continue;
      details.push({
        frequency,
        periodStart: result.periodStart,
        periodEnd: result.periodEnd,
        remainingDays: result.remainingDays,
        totalDays: result.totalDays,
        amount: fromCents(result.proratedCents < 0n ? -result.proratedCents : result.proratedCents),
        direction: result.proratedCents > 0n ? "CHARGE" : "CREDIT",
      });
      if (result.proratedCents > 0n) {
        const amounts = prorationAmounts(result, next);
        const inserted = await this.insertCharge(tx, {
          contract,
          version: next,
          kind: "PRORATION",
          billingFrequency: frequency,
          periodStart: result.periodStart,
          periodEnd: result.periodEnd,
          dueDate: result.periodStart,
          lines: result.lines,
          amounts,
          source: "AMENDMENT",
          issueDate: todayInBogota(),
          actorUserId: ctx.actorUserId,
        });
        if (inserted) charges.push({ ...inserted, total: amounts.total, billingFrequency: frequency });
      } else {
        creditCents += -result.proratedCents;
      }
    }
    for (const charge of charges) {
      await this.audit.record(tx, {
        ...ctx,
        action: CONTROL_CENTER_ACTIONS.PRORATION_CHARGED,
        entityType: "charge",
        entityId: charge.id,
        after: { contractId, versionId: nextVersionId, ...charge },
      });
    }
    let credit: { receiptId: string; receiptNumber: string; amount: string; applied: string } | null = null;
    if (creditCents > 0n) {
      const sequence = await tx.query(`SELECT nextval('control_center.receipt_number_seq') AS n`);
      const receiptNumber = `MCC-REC-${effectiveFrom.slice(0, 4)}-${String(sequence.rows[0].n).padStart(6, "0")}`;
      const inserted = await tx.query(
        `INSERT INTO control_center.receipts
           (receipt_number, account_id, received_on, amount, source, contract_id, source_contract_version_id, notes, created_by, updated_by)
         VALUES ($1, $2, $3, $4, 'PRORATION_CREDIT', $5, $6, $7, $8, $8) RETURNING id`,
        [
          receiptNumber,
          contract.accountId,
          effectiveFrom,
          fromCents(creditCents),
          contractId,
          nextVersionId,
          `Crédito por prorrateo de la enmienda v${next.versionNo} del contrato ${contract.contractNumber}`,
          ctx.actorUserId,
        ],
      );
      const receiptId: string = inserted.rows[0].id;
      const allocation = await autoAllocate(tx, receiptId, ctx.actorUserId, contractId);
      credit = { receiptId, receiptNumber, amount: fromCents(creditCents), applied: fromCents(allocation.totalCents) };
      await this.audit.record(tx, {
        ...ctx,
        action: CONTROL_CENTER_ACTIONS.PRORATION_CREDITED,
        entityType: "receipt",
        entityId: receiptId,
        after: { contractId, versionId: nextVersionId, ...credit, allocations: allocation.applied },
      });
    }
    return { charges, credit, details };
  }

  private async insertCharge(tx: ControlCenterQueryable, input: ChargeInsert) {
    const sequence = await tx.query(`SELECT nextval('control_center.charge_number_seq') AS n`);
    const chargeNumber = `MCC-COB-${input.issueDate.slice(0, 4)}-${String(sequence.rows[0].n).padStart(6, "0")}`;
    const status = toCents(input.amounts.total) === 0n ? "PAID" : "OPEN";
    const conflictClause =
      input.kind === "PRORATION"
        ? ""
        : `ON CONFLICT (contract_id, kind, billing_frequency, period_start)
           WHERE status <> 'VOID' AND kind IN ('PERIOD', 'ONE_TIME') DO NOTHING`;
    const result = await tx.query(
      `INSERT INTO control_center.charges (
         charge_number, contract_id, account_id, tenant_id, contract_version_id, kind, billing_frequency,
         period_start, period_end, issue_date, due_date, tax_name_snapshot, tax_rate_snapshot, prices_include_tax,
         subtotal, discount_total, base_amount, tax_amount, total_amount, status, generation_source, created_by, updated_by
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $22)
       ${conflictClause}
       RETURNING id`,
      [
        chargeNumber, input.contract.id, input.contract.accountId, input.contract.tenantId, input.version.id,
        input.kind, input.billingFrequency, input.periodStart, input.periodEnd, input.issueDate, input.dueDate,
        input.version.taxName, input.version.taxRate, input.version.pricesIncludeTax,
        input.amounts.subtotal, input.amounts.discountTotal, input.amounts.base, input.amounts.tax, input.amounts.total,
        status, input.source, input.actorUserId,
      ],
    );
    const id: string | undefined = result.rows[0]?.id;
    if (!id) return null;
    for (const line of input.lines) {
      await tx.query(
        `INSERT INTO control_center.charge_lines
           (charge_id, contract_item_id, item_type, description, quantity, unit_amount, discount_amount, proration_factor, line_total)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [id, line.contractItemId, line.itemType, line.description, line.quantity, line.unitAmount, line.discountAmount, line.prorationFactor, line.lineTotal],
      );
    }
    return { id, chargeNumber };
  }
}
