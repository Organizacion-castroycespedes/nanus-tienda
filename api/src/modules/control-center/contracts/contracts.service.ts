import { Inject, Injectable } from "@nestjs/common";
import type { PoolClient } from "pg";
import { ControlCenterAuditService, type ControlCenterRequestContext } from "../control-center-audit.service";
import { ControlCenterDatabaseService } from "../control-center-database.service";
import { CONTROL_CENTER_ACTIONS, CONTROL_CENTER_MIN_REASON_LENGTH } from "../control-center.constants";
import { loadPlatformTax, type PlatformTax } from "../plans/plans.service";
import { addDays, addMonthsClamped, dayOfMonth } from "../shared/dates";
import { badRequest, conflict, mapDatabaseError, notFound, unprocessable } from "../shared/errors";
import { asBody, assertUuid, isUuid, optionalReason, parseLimit, parseOffset, parseSearch, likePattern, requireReason } from "../shared/parsing";
import {
  buildContractItems,
  contractedPosTerminals,
  summarizeItems,
  type BillingFrequency,
  type ContractItemDraft,
  type PriceComponent,
  type TermPhase,
} from "./contract-items";
import {
  parseContractAmend,
  parseContractCreate,
  parseContractEnd,
  parseIdempotencyKey,
  type ProrationPolicy,
} from "./contracts.parsers";

const IDEMPOTENCY_SCOPE = "contracts.create";
const CONTRACT_STATUSES = ["DRAFT", "ACTIVE", "ENDED", "CANCELLED"];

type PriceVersionRow = {
  id: string;
  version_no: number;
  tax_id: string;
  prices_include_tax: boolean;
  included_pos_terminals: number;
  default_trial_months: number;
  components: PriceComponent[];
};

type VersionInsert = {
  contractId: string;
  versionNo: number;
  effectiveFrom: string;
  termPhase: TermPhase;
  billingFrequency: BillingFrequency;
  anchorDay: number;
  trialEndsOn: string | null;
  prorationPolicy: ProrationPolicy;
  tax: PlatformTax;
  pricesIncludeTax: boolean;
  includedPosTerminals: number;
  sourcePriceVersionId: string;
  reason: string | null;
  createdBy: string;
};

const ensureReason = (reason: string | null, why: string) => {
  if (!reason || reason.length < CONTROL_CENTER_MIN_REASON_LENGTH) {
    throw badRequest("CONTROL_CENTER_REASON_REQUIRED", `${why} requiere un motivo de al menos ${CONTROL_CENTER_MIN_REASON_LENGTH} caracteres`);
  }
  return reason;
};

@Injectable()
export class ContractsService {
  constructor(
    @Inject(ControlCenterDatabaseService) private readonly db: ControlCenterDatabaseService,
    @Inject(ControlCenterAuditService) private readonly audit: ControlCenterAuditService,
  ) {}

  async list(query: Record<string, unknown>) {
    const limit = parseLimit(query.limit, 20, 50);
    const offset = parseOffset(query.offset);
    const params: unknown[] = [];
    const where: string[] = [];
    if (typeof query.status === "string" && query.status) {
      const status = query.status.toUpperCase();
      if (!CONTRACT_STATUSES.includes(status)) throw badRequest("CONTROL_CENTER_INVALID_FIELD", "status inválido");
      params.push(status);
      where.push(`c.status = $${params.length}`);
    }
    for (const [field, column] of [["tenantId", "c.tenant_id"], ["accountId", "c.account_id"]] as const) {
      if (query[field] !== undefined && query[field] !== "") {
        params.push(assertUuid(query[field], field));
        where.push(`${column} = $${params.length}`);
      }
    }
    const search = parseSearch(query.search);
    if (search) {
      params.push(likePattern(search));
      where.push(`(c.contract_number ILIKE $${params.length} OR a.legal_name ILIKE $${params.length} OR t.nombre ILIKE $${params.length})`);
    }
    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const from = `FROM control_center.contracts c
      JOIN control_center.commercial_accounts a ON a.id = c.account_id
      JOIN public.tenants t ON t.id = c.tenant_id
      JOIN control_center.plans p ON p.id = c.plan_id
      LEFT JOIN control_center.contract_versions v ON v.id = c.current_version_id`;
    const [rows, count] = await Promise.all([
      this.db.query(
        `SELECT c.id, c.contract_number AS "contractNumber", c.status, c.start_date::text AS "startDate", c.end_date::text AS "endDate",
                c.account_id AS "accountId", a.legal_name AS "accountLegalName", c.tenant_id AS "tenantId", t.nombre AS "tenantName",
                t.slug AS "tenantSlug", p.code AS "planCode", p.name AS "planName", v.term_phase AS "termPhase",
                v.billing_frequency AS "billingFrequency", c.created_at AS "createdAt"
         ${from} ${whereSql}
         ORDER BY c.created_at DESC, c.id DESC
         LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, limit, offset],
      ),
      this.db.query(`SELECT COUNT(*)::int AS total ${from} ${whereSql}`, params),
    ]);
    return { items: rows.rows, total: count.rows[0]?.total ?? 0, limit, offset };
  }

  async get(idParam: string) {
    const id = assertUuid(idParam, "contractId");
    const contract = await this.db.query(
      `SELECT c.id, c.contract_number AS "contractNumber", c.status, c.start_date::text AS "startDate", c.end_date::text AS "endDate",
              c.current_version_id AS "currentVersionId", c.created_at AS "createdAt", c.updated_at AS "updatedAt",
              json_build_object('id', a.id, 'legalName', a.legal_name, 'taxIdType', a.tax_id_type, 'taxId', a.tax_id, 'billingEmail', a.billing_email) AS account,
              json_build_object('id', t.id, 'slug', t.slug, 'name', t.nombre) AS tenant,
              json_build_object('id', p.id, 'code', p.code, 'name', p.name, 'status', p.status) AS plan,
              (SELECT COUNT(*)::int FROM public.pos_terminals pt WHERE pt.tenant_id = c.tenant_id AND pt.active) AS "activePosTerminals"
       FROM control_center.contracts c
       JOIN control_center.commercial_accounts a ON a.id = c.account_id
       JOIN public.tenants t ON t.id = c.tenant_id
       JOIN control_center.plans p ON p.id = c.plan_id
       WHERE c.id = $1`,
      [id],
    );
    if (!contract.rows[0]) throw notFound("CONTROL_CENTER_CONTRACT_NOT_FOUND", "Contrato no encontrado");
    const versions = await this.db.query(
      `SELECT v.id, v.version_no AS "versionNo", v.effective_from::text AS "effectiveFrom", v.effective_to::text AS "effectiveTo",
              v.term_phase AS "termPhase", v.billing_frequency AS "billingFrequency", v.billing_anchor_day AS "billingAnchorDay",
              v.trial_ends_on::text AS "trialEndsOn", v.proration_policy AS "prorationPolicy", v.tax_name_snapshot AS "taxName",
              v.tax_rate_snapshot::text AS "taxRate", v.prices_include_tax AS "pricesIncludeTax",
              v.included_pos_terminals AS "includedPosTerminals", v.reason, v.created_at AS "createdAt",
              COALESCE(json_agg(json_build_object(
                'id', i.id, 'itemType', i.item_type, 'description', i.description, 'quantity', i.quantity::text,
                'unitAmount', i.unit_amount::text, 'billingFrequency', i.billing_frequency,
                'discountAmount', i.discount_amount::text, 'metadata', i.metadata
              ) ORDER BY i.item_type, i.description) FILTER (WHERE i.id IS NOT NULL), '[]') AS items
       FROM control_center.contract_versions v
       LEFT JOIN control_center.contract_items i ON i.contract_version_id = v.id
       WHERE v.contract_id = $1
       GROUP BY v.id
       ORDER BY v.version_no DESC`,
      [id],
    );
    const audit = await this.db.query(
      `SELECT id, occurred_at AS "occurredAt", action, actor_user_id AS "actorUserId", reason
       FROM control_center.admin_audit_events
       WHERE entity_type = 'contract' AND entity_id = $1
       ORDER BY occurred_at DESC LIMIT 50`,
      [id],
    );
    return {
      ...contract.rows[0],
      versions: versions.rows.map((version) => ({
        ...version,
        contractedPosTerminals: contractedPosTerminals(version.includedPosTerminals, version.items),
        totals: summarizeItems(version.items, version.taxRate, version.pricesIncludeTax),
      })),
      audit: audit.rows,
    };
  }

  async preview(raw: unknown) {
    const input = parseContractCreate(raw);
    const priceVersion = await this.loadPriceVersion(this.db, input.planId, input.startDate);
    const tax = await loadPlatformTax(this.db, this.db.getConfig().platformTenantId, priceVersion.tax_id);
    const { items, priceAdjusted } = buildContractItems(priceVersion.components, {
      termPhase: "INITIAL",
      billingFrequency: input.billingFrequency,
      extraPosTerminals: input.extraPosTerminals,
      customItems: input.customItems,
      overrides: input.overrides,
    });
    const trialMonths = input.trialMonths ?? priceVersion.default_trial_months;
    return {
      priceVersionId: priceVersion.id,
      priceVersionNo: priceVersion.version_no,
      tax: { name: tax.name, rate: tax.rate, pricesIncludeTax: priceVersion.prices_include_tax },
      billingAnchorDay: dayOfMonth(input.startDate),
      trialEndsOn: trialMonths > 0 ? addMonthsClamped(input.startDate, trialMonths) : null,
      contractedPosTerminals: contractedPosTerminals(priceVersion.included_pos_terminals, items),
      priceAdjusted,
      items,
      totals: summarizeItems(items, tax.rate, priceVersion.prices_include_tax),
    };
  }

  async create(raw: unknown, idempotencyHeader: unknown, ctx: ControlCenterRequestContext) {
    const input = parseContractCreate(raw);
    const idempotencyKey = parseIdempotencyKey(idempotencyHeader);
    if (idempotencyKey) {
      const existing = await this.findIdempotent(idempotencyKey);
      if (existing) return this.get(existing);
    }
    try {
      const contractId = await this.db.transaction(async (tx) => {
        const link = await tx.query(
          `SELECT l.id FROM control_center.account_tenants l
           JOIN control_center.commercial_accounts a ON a.id = l.account_id
           WHERE l.account_id = $1 AND l.tenant_id = $2 AND l.status = 'ACTIVE' AND a.status = 'ACTIVE'
           FOR UPDATE OF l`,
          [input.accountId, input.tenantId],
        );
        if (!link.rows[0]) {
          throw unprocessable("CONTROL_CENTER_TENANT_NOT_LINKED", "El tenant no tiene un vínculo activo con la cuenta comercial indicada");
        }
        const plan = await tx.query(`SELECT id, status FROM control_center.plans WHERE id = $1`, [input.planId]);
        if (!plan.rows[0]) throw notFound("CONTROL_CENTER_PLAN_NOT_FOUND", "Plan no encontrado");
        if (plan.rows[0].status !== "ACTIVE") {
          throw unprocessable("CONTROL_CENTER_PLAN_RETIRED", "No se crean contratos con un plan retirado");
        }
        const priceVersion = await this.loadPriceVersion(tx, input.planId, input.startDate);
        const tax = await loadPlatformTax(tx, this.db.getConfig().platformTenantId, priceVersion.tax_id);
        const { items, priceAdjusted } = buildContractItems(priceVersion.components, {
          termPhase: "INITIAL",
          billingFrequency: input.billingFrequency,
          extraPosTerminals: input.extraPosTerminals,
          customItems: input.customItems,
          overrides: input.overrides,
        });
        const trialModified = input.trialMonths !== null && input.trialMonths !== priceVersion.default_trial_months;
        if (priceAdjusted) ensureReason(input.reason, "Ajustar precios o descuentos");
        if (trialModified) ensureReason(input.reason, "Modificar el período de prueba");
        const trialMonths = input.trialMonths ?? priceVersion.default_trial_months;

        const sequence = await tx.query(`SELECT nextval('control_center.contract_number_seq') AS n`);
        const contractNumber = `MCC-${input.startDate.slice(0, 4)}-${String(sequence.rows[0].n).padStart(5, "0")}`;
        const created = await tx.query(
          `INSERT INTO control_center.contracts (contract_number, account_id, tenant_id, plan_id, start_date, created_by, updated_by)
           VALUES ($1, $2, $3, $4, $5, $6, $6) RETURNING id`,
          [contractNumber, input.accountId, input.tenantId, input.planId, input.startDate, ctx.actorUserId],
        );
        const contractId: string = created.rows[0].id;
        const versionId = await this.insertVersion(
          tx,
          {
            contractId,
            versionNo: 1,
            effectiveFrom: input.startDate,
            termPhase: "INITIAL",
            billingFrequency: input.billingFrequency,
            anchorDay: dayOfMonth(input.startDate),
            trialEndsOn: trialMonths > 0 ? addMonthsClamped(input.startDate, trialMonths) : null,
            prorationPolicy: input.prorationPolicy,
            tax,
            pricesIncludeTax: priceVersion.prices_include_tax,
            includedPosTerminals: priceVersion.included_pos_terminals,
            sourcePriceVersionId: priceVersion.id,
            reason: input.reason,
            createdBy: ctx.actorUserId,
          },
          items,
        );
        await tx.query(`UPDATE control_center.contracts SET current_version_id = $2 WHERE id = $1`, [contractId, versionId]);
        if (idempotencyKey) {
          await tx.query(
            `INSERT INTO control_center.idempotency_keys (scope, key, resource_id, created_by) VALUES ($1, $2, $3, $4)`,
            [IDEMPOTENCY_SCOPE, idempotencyKey, contractId, ctx.actorUserId],
          );
        }
        const after = { contractNumber, accountId: input.accountId, tenantId: input.tenantId, planId: input.planId, versionId, items };
        await this.audit.record(tx, {
          ...ctx,
          action: CONTROL_CENTER_ACTIONS.CONTRACT_CREATED,
          entityType: "contract",
          entityId: contractId,
          after,
          reason: input.reason,
        });
        if (priceAdjusted) {
          await this.audit.record(tx, {
            ...ctx,
            action: CONTROL_CENTER_ACTIONS.CONTRACT_PRICE_ADJUSTED,
            entityType: "contract",
            entityId: contractId,
            after: { overrides: input.overrides },
            reason: input.reason,
          });
        }
        if (trialModified) {
          await this.audit.record(tx, {
            ...ctx,
            action: CONTROL_CENTER_ACTIONS.CONTRACT_TRIAL_MODIFIED,
            entityType: "contract",
            entityId: contractId,
            before: { trialMonths: priceVersion.default_trial_months },
            after: { trialMonths },
            reason: input.reason,
          });
        }
        return contractId;
      });
      return this.get(contractId);
    } catch (error) {
      const pg = error as { code?: string; constraint?: string };
      if (idempotencyKey && pg?.code === "23505" && pg.constraint === "idempotency_keys_pkey") {
        const existing = await this.findIdempotent(idempotencyKey);
        if (existing) return this.get(existing);
      }
      if (pg?.code === "23505" && pg.constraint === "uq_cc_contracts_open_per_tenant") {
        throw conflict("CONTROL_CENTER_OPEN_CONTRACT_EXISTS", "El tenant ya tiene un contrato en borrador o activo");
      }
      return mapDatabaseError(error);
    }
  }

  async activate(idParam: string, raw: unknown, ctx: ControlCenterRequestContext) {
    const id = assertUuid(idParam, "contractId");
    const reason = requireReason(asBody(raw ?? {}));
    await this.db.transaction(async (tx) => {
      const contract = await this.lockContract(tx, id);
      if (contract.status !== "DRAFT") {
        throw conflict("CONTROL_CENTER_INVALID_TRANSITION", `No se puede activar un contrato en estado ${contract.status}`);
      }
      const link = await tx.query(
        `SELECT id FROM control_center.account_tenants
         WHERE account_id = $1 AND tenant_id = $2 AND status = 'ACTIVE' FOR UPDATE`,
        [contract.account_id, contract.tenant_id],
      );
      if (!link.rows[0]) {
        throw unprocessable("CONTROL_CENTER_TENANT_NOT_LINKED", "El vínculo entre la cuenta y el tenant ya no está activo");
      }
      await tx.query(
        `UPDATE control_center.contracts SET status = 'ACTIVE', updated_by = $2, updated_at = NOW() WHERE id = $1`,
        [id, ctx.actorUserId],
      );
      await this.audit.record(tx, {
        ...ctx,
        action: CONTROL_CENTER_ACTIONS.CONTRACT_ACTIVATED,
        entityType: "contract",
        entityId: id,
        before: { status: "DRAFT" },
        after: { status: "ACTIVE" },
        reason,
      });
    });
    return this.get(id);
  }

  async amend(idParam: string, raw: unknown, ctx: ControlCenterRequestContext) {
    const id = assertUuid(idParam, "contractId");
    const input = parseContractAmend(raw);
    await this.db
      .transaction(async (tx) => {
        const contract = await this.lockContract(tx, id);
        if (contract.status !== "ACTIVE") {
          throw conflict("CONTROL_CENTER_INVALID_TRANSITION", "Solo se enmiendan contratos activos");
        }
        const current = await tx.query(
          `SELECT id, version_no, effective_from::text AS effective_from, billing_anchor_day, trial_ends_on::text AS trial_ends_on,
                  proration_policy
           FROM control_center.contract_versions WHERE id = $1 FOR UPDATE`,
          [contract.current_version_id],
        );
        const currentVersion = current.rows[0];
        if (!currentVersion) throw conflict("CONTROL_CENTER_VERSION_MISSING", "El contrato no tiene versión vigente");
        if (input.effectiveFrom <= currentVersion.effective_from) {
          throw unprocessable(
            "CONTROL_CENTER_AMENDMENT_DATE_INVALID",
            `La enmienda debe regir después del ${currentVersion.effective_from}`,
          );
        }
        const priceVersion = await this.loadPriceVersion(tx, contract.plan_id, input.effectiveFrom);
        const tax = await loadPlatformTax(tx, this.db.getConfig().platformTenantId, priceVersion.tax_id);
        const { items, priceAdjusted } = buildContractItems(priceVersion.components, {
          termPhase: input.termPhase,
          billingFrequency: input.billingFrequency,
          extraPosTerminals: input.extraPosTerminals,
          customItems: input.customItems,
          overrides: input.overrides,
        });
        await tx.query(`UPDATE control_center.contract_versions SET effective_to = $2 WHERE id = $1`, [
          currentVersion.id,
          addDays(input.effectiveFrom, -1),
        ]);
        const versionId = await this.insertVersion(
          tx,
          {
            contractId: id,
            versionNo: currentVersion.version_no + 1,
            effectiveFrom: input.effectiveFrom,
            termPhase: input.termPhase,
            billingFrequency: input.billingFrequency,
            anchorDay: currentVersion.billing_anchor_day,
            trialEndsOn: currentVersion.trial_ends_on,
            prorationPolicy: input.prorationPolicy ?? currentVersion.proration_policy,
            tax,
            pricesIncludeTax: priceVersion.prices_include_tax,
            includedPosTerminals: priceVersion.included_pos_terminals,
            sourcePriceVersionId: priceVersion.id,
            reason: input.reason,
            createdBy: ctx.actorUserId,
          },
          items,
        );
        await tx.query(
          `UPDATE control_center.contracts SET current_version_id = $2, updated_by = $3, updated_at = NOW() WHERE id = $1`,
          [id, versionId, ctx.actorUserId],
        );
        await this.audit.record(tx, {
          ...ctx,
          action: CONTROL_CENTER_ACTIONS.CONTRACT_AMENDED,
          entityType: "contract",
          entityId: id,
          before: { versionId: currentVersion.id, versionNo: currentVersion.version_no },
          after: { versionId, versionNo: currentVersion.version_no + 1, termPhase: input.termPhase, billingFrequency: input.billingFrequency, items },
          reason: input.reason,
        });
        if (priceAdjusted) {
          await this.audit.record(tx, {
            ...ctx,
            action: CONTROL_CENTER_ACTIONS.CONTRACT_PRICE_ADJUSTED,
            entityType: "contract",
            entityId: id,
            after: { versionId, overrides: input.overrides },
            reason: input.reason,
          });
        }
      })
      .catch((error) => mapDatabaseError(error));
    return this.get(id);
  }

  async end(idParam: string, raw: unknown, ctx: ControlCenterRequestContext) {
    const id = assertUuid(idParam, "contractId");
    const input = parseContractEnd(raw);
    await this.db.transaction(async (tx) => {
      const contract = await this.lockContract(tx, id);
      if (contract.status !== "ACTIVE") {
        throw conflict("CONTROL_CENTER_INVALID_TRANSITION", "Solo se terminan contratos activos");
      }
      const current = await tx.query(
        `SELECT id, effective_from::text AS effective_from, effective_to FROM control_center.contract_versions WHERE id = $1 FOR UPDATE`,
        [contract.current_version_id],
      );
      const version = current.rows[0];
      if (version && input.endDate < version.effective_from) {
        throw unprocessable("CONTROL_CENTER_END_DATE_INVALID", `La terminación no puede ser anterior al ${version.effective_from}`);
      }
      if (version && version.effective_to === null) {
        await tx.query(`UPDATE control_center.contract_versions SET effective_to = $2 WHERE id = $1`, [version.id, input.endDate]);
      }
      await tx.query(
        `UPDATE control_center.contracts SET status = 'ENDED', end_date = $2, updated_by = $3, updated_at = NOW() WHERE id = $1`,
        [id, input.endDate, ctx.actorUserId],
      );
      await this.audit.record(tx, {
        ...ctx,
        action: CONTROL_CENTER_ACTIONS.CONTRACT_ENDED,
        entityType: "contract",
        entityId: id,
        before: { status: "ACTIVE" },
        after: { status: "ENDED", endDate: input.endDate },
        reason: input.reason,
      });
    });
    return this.get(id);
  }

  async cancel(idParam: string, raw: unknown, ctx: ControlCenterRequestContext) {
    const id = assertUuid(idParam, "contractId");
    const reason = optionalReason(asBody(raw ?? {}));
    await this.db.transaction(async (tx) => {
      const contract = await this.lockContract(tx, id);
      if (contract.status !== "DRAFT") {
        throw conflict("CONTROL_CENTER_INVALID_TRANSITION", "Solo se cancelan contratos en borrador");
      }
      await tx.query(
        `UPDATE control_center.contracts SET status = 'CANCELLED', updated_by = $2, updated_at = NOW() WHERE id = $1`,
        [id, ctx.actorUserId],
      );
      await this.audit.record(tx, {
        ...ctx,
        action: CONTROL_CENTER_ACTIONS.CONTRACT_CANCELLED,
        entityType: "contract",
        entityId: id,
        before: { status: "DRAFT" },
        after: { status: "CANCELLED" },
        reason,
      });
    });
    return this.get(id);
  }

  private async findIdempotent(key: string): Promise<string | null> {
    const result = await this.db.query(
      `SELECT resource_id FROM control_center.idempotency_keys WHERE scope = $1 AND key = $2`,
      [IDEMPOTENCY_SCOPE, key],
    );
    const id = result.rows[0]?.resource_id;
    return isUuid(id) ? id : null;
  }

  private async lockContract(tx: PoolClient, id: string) {
    const result = await tx.query(
      `SELECT id, status, account_id, tenant_id, plan_id, start_date::text AS start_date, current_version_id
       FROM control_center.contracts WHERE id = $1 FOR UPDATE`,
      [id],
    );
    if (!result.rows[0]) throw notFound("CONTROL_CENTER_CONTRACT_NOT_FOUND", "Contrato no encontrado");
    return result.rows[0];
  }

  private async loadPriceVersion(
    db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[] }> },
    planId: string,
    date: string,
  ): Promise<PriceVersionRow> {
    const result = await db.query(
      `SELECT v.id, v.version_no, v.tax_id, v.prices_include_tax, v.included_pos_terminals, v.default_trial_months,
              COALESCE(json_agg(json_build_object(
                'component', c.component, 'billingFrequency', c.billing_frequency, 'amount', c.amount::text
              )) FILTER (WHERE c.id IS NOT NULL), '[]') AS components
       FROM control_center.plan_price_versions v
       LEFT JOIN control_center.plan_price_components c ON c.price_version_id = v.id
       WHERE v.plan_id = $1 AND v.valid_from <= $2::date AND (v.valid_to IS NULL OR v.valid_to >= $2::date)
       GROUP BY v.id
       ORDER BY v.version_no DESC
       LIMIT 1`,
      [planId, date],
    );
    if (!result.rows[0]) {
      throw unprocessable("CONTROL_CENTER_NO_PRICE_FOR_DATE", `El plan no tiene una versión de precio vigente para ${date}`);
    }
    return result.rows[0];
  }

  private async insertVersion(tx: PoolClient, version: VersionInsert, items: ContractItemDraft[]) {
    const result = await tx.query(
      `INSERT INTO control_center.contract_versions (
         contract_id, version_no, effective_from, term_phase, billing_frequency, billing_anchor_day, trial_ends_on,
         proration_policy, tax_id, tax_name_snapshot, tax_rate_snapshot, prices_include_tax, included_pos_terminals,
         source_price_version_id, reason, created_by
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
       RETURNING id`,
      [
        version.contractId, version.versionNo, version.effectiveFrom, version.termPhase, version.billingFrequency,
        version.anchorDay, version.trialEndsOn, version.prorationPolicy, version.tax.id, version.tax.name,
        version.tax.rate, version.pricesIncludeTax, version.includedPosTerminals, version.sourcePriceVersionId,
        version.reason, version.createdBy,
      ],
    );
    const versionId: string = result.rows[0].id;
    for (const item of items) {
      await tx.query(
        `INSERT INTO control_center.contract_items (
           contract_version_id, item_type, description, quantity, unit_amount, billing_frequency, discount_amount, metadata
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)`,
        [versionId, item.itemType, item.description, item.quantity, item.unitAmount, item.billingFrequency, item.discountAmount, JSON.stringify(item.metadata)],
      );
    }
    return versionId;
  }
}
