import { Inject, Injectable } from "@nestjs/common";
import { ControlCenterAuditService, type ControlCenterRequestContext } from "../control-center-audit.service";
import { ControlCenterDatabaseService, type ControlCenterQueryable } from "../control-center-database.service";
import { CONTROL_CENTER_ACTIONS } from "../control-center.constants";
import { addDays } from "../shared/dates";
import { mapDatabaseError, notFound, unprocessable } from "../shared/errors";
import { assertUuid } from "../shared/parsing";
import { parsePlanCreate, parsePlanPatch, parsePriceVersion } from "./plans.parsers";

const PLAN_COLUMNS = `id, code, name, description, status, created_at AS "createdAt", updated_at AS "updatedAt"`;

export type PlatformTax = { id: string; name: string; rate: string; isIncluded: boolean };

/** Impuesto activo del tenant plataforma (misma tabla que usa la venta POS). */
export const loadPlatformTax = async (
  db: ControlCenterQueryable,
  platformTenantId: string,
  taxId: string,
): Promise<PlatformTax> => {
  const result = await db.query(
    `SELECT id, name, rate::text AS rate, is_included AS "isIncluded"
     FROM public.taxes WHERE id = $1 AND tenant_id = $2 AND is_active = TRUE`,
    [taxId, platformTenantId],
  );
  if (!result.rows[0]) {
    throw unprocessable("CONTROL_CENTER_TAX_INVALID", "El impuesto no existe, no está activo o no pertenece al tenant plataforma");
  }
  return result.rows[0];
};

@Injectable()
export class PlansService {
  constructor(
    @Inject(ControlCenterDatabaseService) private readonly db: ControlCenterDatabaseService,
    @Inject(ControlCenterAuditService) private readonly audit: ControlCenterAuditService,
  ) {}

  async list() {
    const result = await this.db.query(
      `SELECT p.id, p.code, p.name, p.description, p.status, p.created_at AS "createdAt",
              v.id AS "currentVersionId", v.version_no AS "currentVersionNo", v.valid_from AS "currentValidFrom"
       FROM control_center.plans p
       LEFT JOIN control_center.plan_price_versions v ON v.plan_id = p.id AND v.valid_to IS NULL
       ORDER BY p.status ASC, p.name ASC`,
    );
    return { items: result.rows };
  }

  async listTaxes() {
    const result = await this.db.query(
      `SELECT id, name, rate::text AS rate, is_included AS "isIncluded"
       FROM public.taxes WHERE tenant_id = $1 AND is_active = TRUE ORDER BY name`,
      [this.db.getConfig().platformTenantId],
    );
    return { items: result.rows };
  }

  async create(raw: unknown, ctx: ControlCenterRequestContext) {
    const input = parsePlanCreate(raw);
    try {
      return await this.db.transaction(async (tx) => {
        const result = await tx.query(
          `INSERT INTO control_center.plans (code, name, description, created_by, updated_by)
           VALUES ($1, $2, $3, $4, $4) RETURNING ${PLAN_COLUMNS}`,
          [input.code, input.name, input.description, ctx.actorUserId],
        );
        await this.audit.record(tx, {
          ...ctx,
          action: CONTROL_CENTER_ACTIONS.PLAN_CREATED,
          entityType: "plan",
          entityId: result.rows[0].id,
          after: result.rows[0],
        });
        return result.rows[0];
      });
    } catch (error) {
      return mapDatabaseError(error, "Ya existe un plan con ese código");
    }
  }

  async update(idParam: string, raw: unknown, ctx: ControlCenterRequestContext) {
    const id = assertUuid(idParam, "planId");
    const patch = parsePlanPatch(raw);
    return this.db.transaction(async (tx) => {
      const current = await tx.query(`SELECT ${PLAN_COLUMNS} FROM control_center.plans WHERE id = $1 FOR UPDATE`, [id]);
      const before = current.rows[0];
      if (!before) throw notFound("CONTROL_CENTER_PLAN_NOT_FOUND", "Plan no encontrado");
      if (patch.retire && before.status === "RETIRED") {
        throw unprocessable("CONTROL_CENTER_PLAN_ALREADY_RETIRED", "El plan ya está retirado");
      }
      const result = await tx.query(
        `UPDATE control_center.plans SET
           name = COALESCE($2, name),
           description = CASE WHEN $3::boolean THEN $4 ELSE description END,
           status = CASE WHEN $5::boolean THEN 'RETIRED' ELSE status END,
           updated_by = $6, updated_at = NOW()
         WHERE id = $1 RETURNING ${PLAN_COLUMNS}`,
        [id, patch.name ?? null, "description" in patch, patch.description ?? null, patch.retire === true, ctx.actorUserId],
      );
      await this.audit.record(tx, {
        ...ctx,
        action: patch.retire ? CONTROL_CENTER_ACTIONS.PLAN_RETIRED : CONTROL_CENTER_ACTIONS.PLAN_UPDATED,
        entityType: "plan",
        entityId: id,
        before,
        after: result.rows[0],
        reason: patch.reason ?? null,
      });
      return result.rows[0];
    });
  }

  async listVersions(idParam: string) {
    const id = assertUuid(idParam, "planId");
    const plan = await this.db.query(`SELECT ${PLAN_COLUMNS} FROM control_center.plans WHERE id = $1`, [id]);
    if (!plan.rows[0]) throw notFound("CONTROL_CENTER_PLAN_NOT_FOUND", "Plan no encontrado");
    const versions = await this.db.query(
      `SELECT v.id, v.version_no AS "versionNo", v.valid_from AS "validFrom", v.valid_to AS "validTo", v.currency,
              v.tax_id AS "taxId", t.name AS "taxName", t.rate::text AS "taxRate", v.prices_include_tax AS "pricesIncludeTax",
              v.included_pos_terminals AS "includedPosTerminals", v.initial_term_months AS "initialTermMonths",
              v.default_trial_months AS "defaultTrialMonths", v.reason, v.created_at AS "createdAt",
              COALESCE(json_agg(json_build_object(
                'component', c.component, 'billingFrequency', c.billing_frequency, 'amount', c.amount::text
              ) ORDER BY c.component, c.billing_frequency) FILTER (WHERE c.id IS NOT NULL), '[]') AS components
       FROM control_center.plan_price_versions v
       LEFT JOIN public.taxes t ON t.id = v.tax_id
       LEFT JOIN control_center.plan_price_components c ON c.price_version_id = v.id
       WHERE v.plan_id = $1
       GROUP BY v.id, t.name, t.rate
       ORDER BY v.version_no DESC`,
      [id],
    );
    return { plan: plan.rows[0], versions: versions.rows };
  }

  async publishVersion(idParam: string, raw: unknown, ctx: ControlCenterRequestContext) {
    const id = assertUuid(idParam, "planId");
    const input = parsePriceVersion(raw);
    try {
      return await this.db.transaction(async (tx) => {
        const plan = await tx.query(`SELECT id, status FROM control_center.plans WHERE id = $1 FOR UPDATE`, [id]);
        if (!plan.rows[0]) throw notFound("CONTROL_CENTER_PLAN_NOT_FOUND", "Plan no encontrado");
        if (plan.rows[0].status !== "ACTIVE") {
          throw unprocessable("CONTROL_CENTER_PLAN_RETIRED", "No se publican precios en un plan retirado");
        }
        const tax = await loadPlatformTax(tx, this.db.getConfig().platformTenantId, input.taxId);
        const last = await tx.query(
          `SELECT id, version_no, valid_from::text AS valid_from, valid_to
           FROM control_center.plan_price_versions WHERE plan_id = $1 ORDER BY version_no DESC LIMIT 1`,
          [id],
        );
        const previous = last.rows[0];
        if (previous && input.validFrom <= previous.valid_from) {
          throw unprocessable(
            "CONTROL_CENTER_PRICE_VERSION_OVERLAP",
            `La nueva vigencia debe iniciar después del ${previous.valid_from} (versión ${previous.version_no})`,
          );
        }
        if (previous && previous.valid_to === null) {
          await tx.query(`UPDATE control_center.plan_price_versions SET valid_to = $2 WHERE id = $1`, [
            previous.id,
            addDays(input.validFrom, -1),
          ]);
        }
        const version = await tx.query(
          `INSERT INTO control_center.plan_price_versions (
             plan_id, version_no, valid_from, tax_id, prices_include_tax, included_pos_terminals,
             initial_term_months, default_trial_months, reason, created_by
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
           RETURNING id, version_no AS "versionNo", valid_from AS "validFrom", prices_include_tax AS "pricesIncludeTax"`,
          [
            id, (previous?.version_no ?? 0) + 1, input.validFrom, tax.id, input.pricesIncludeTax ?? tax.isIncluded,
            input.includedPosTerminals, input.initialTermMonths, input.defaultTrialMonths, input.reason, ctx.actorUserId,
          ],
        );
        for (const component of input.components) {
          await tx.query(
            `INSERT INTO control_center.plan_price_components (price_version_id, component, billing_frequency, amount)
             VALUES ($1, $2, $3, $4)`,
            [version.rows[0].id, component.component, component.billingFrequency, component.amount],
          );
        }
        const created = { ...version.rows[0], tax, components: input.components };
        await this.audit.record(tx, {
          ...ctx,
          action: CONTROL_CENTER_ACTIONS.PLAN_PRICE_VERSION_PUBLISHED,
          entityType: "plan_price_version",
          entityId: version.rows[0].id,
          before: previous ?? null,
          after: created,
          reason: input.reason,
        });
        return created;
      });
    } catch (error) {
      return mapDatabaseError(error, "Ya existe una versión de precio con esos datos");
    }
  }
}
