import { Inject, Injectable } from "@nestjs/common";
import type { PoolClient } from "pg";
import { ControlCenterAuditService, type ControlCenterRequestContext } from "../control-center-audit.service";
import { ControlCenterDatabaseService } from "../control-center-database.service";
import { CONTROL_CENTER_ACTIONS } from "../control-center.constants";
import { badRequest, conflict, mapDatabaseError, notFound, unprocessable } from "../shared/errors";
import {
  asBody,
  assertUuid,
  likePattern,
  parseLimit,
  parseOffset,
  parseSearch,
  requireReason,
  requireUuid,
} from "../shared/parsing";
import { ACCOUNT_STATUSES, parseAccountCreate, parseAccountPatch } from "./accounts.parsers";

const accountColumns = (alias = "") => {
  const a = alias ? `${alias}.` : "";
  return `
  ${a}id, ${a}legal_name AS "legalName", ${a}tax_id_type AS "taxIdType", ${a}tax_id AS "taxId", ${a}dv,
  ${a}billing_email AS "billingEmail", ${a}contact_name AS "contactName", ${a}contact_phone_e164 AS "contactPhoneE164",
  ${a}whatsapp_opt_in AS "whatsappOptIn", ${a}whatsapp_opt_in_at AS "whatsappOptInAt", ${a}address, ${a}city,
  ${a}status, ${a}notes, ${a}created_at AS "createdAt", ${a}updated_at AS "updatedAt"`;
};
const ACCOUNT_COLUMNS = accountColumns();

const COLUMN_MAP: Record<string, string> = {
  legalName: "legal_name",
  billingEmail: "billing_email",
  dv: "dv",
  contactName: "contact_name",
  contactPhoneE164: "contact_phone_e164",
  address: "address",
  city: "city",
  notes: "notes",
  status: "status",
};

@Injectable()
export class AccountsService {
  constructor(
    @Inject(ControlCenterDatabaseService) private readonly db: ControlCenterDatabaseService,
    @Inject(ControlCenterAuditService) private readonly audit: ControlCenterAuditService,
  ) {}

  async list(query: Record<string, unknown>) {
    const limit = parseLimit(query.limit, 20, 50);
    const offset = parseOffset(query.offset);
    const search = parseSearch(query.search);
    const status = typeof query.status === "string" ? query.status.toUpperCase() : null;
    const params: unknown[] = [];
    const where: string[] = [];
    if (search) {
      params.push(likePattern(search));
      where.push(`(a.legal_name ILIKE $${params.length} OR a.tax_id ILIKE $${params.length} OR a.billing_email ILIKE $${params.length})`);
    }
    if (status) {
      if (!(ACCOUNT_STATUSES as readonly string[]).includes(status)) {
        throw badRequest("CONTROL_CENTER_INVALID_FIELD", "status inválido");
      }
      params.push(status);
      where.push(`a.status = $${params.length}`);
    }
    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const [rows, count] = await Promise.all([
      this.db.query(
        `SELECT ${accountColumns("a")},
           (SELECT COUNT(*) FROM control_center.account_tenants l WHERE l.account_id = a.id AND l.status = 'ACTIVE')::int AS "activeTenants"
         FROM control_center.commercial_accounts a ${whereSql}
         ORDER BY a.legal_name ASC, a.id ASC
         LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, limit, offset],
      ),
      this.db.query(`SELECT COUNT(*)::int AS total FROM control_center.commercial_accounts a ${whereSql}`, params),
    ]);
    return { items: rows.rows, total: count.rows[0]?.total ?? 0, limit, offset };
  }

  async get(idParam: string) {
    const id = assertUuid(idParam, "accountId");
    const account = await this.db.query(`SELECT ${ACCOUNT_COLUMNS} FROM control_center.commercial_accounts WHERE id = $1`, [id]);
    if (!account.rows[0]) throw notFound("CONTROL_CENTER_ACCOUNT_NOT_FOUND", "Cuenta comercial no encontrada");
    const links = await this.db.query(
      `SELECT l.id, l.tenant_id AS "tenantId", t.slug AS "tenantSlug", t.nombre AS "tenantName", l.status,
              l.linked_at AS "linkedAt", l.ended_at AS "endedAt", l.end_reason AS "endReason"
       FROM control_center.account_tenants l
       JOIN public.tenants t ON t.id = l.tenant_id
       WHERE l.account_id = $1
       ORDER BY l.status ASC, l.linked_at DESC`,
      [id],
    );
    return { ...account.rows[0], tenants: links.rows };
  }

  async create(raw: unknown, ctx: ControlCenterRequestContext) {
    const input = parseAccountCreate(raw);
    try {
      return await this.db.transaction(async (tx) => {
        const result = await tx.query(
          `INSERT INTO control_center.commercial_accounts (
             legal_name, tax_id_type, tax_id, dv, billing_email, contact_name, contact_phone_e164,
             whatsapp_opt_in, whatsapp_opt_in_at, address, city, notes, created_by, updated_by
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CASE WHEN $8 THEN NOW() END, $9, $10, $11, $12, $12)
           RETURNING ${ACCOUNT_COLUMNS}`,
          [
            input.legalName, input.taxIdType, input.taxId, input.dv, input.billingEmail, input.contactName,
            input.contactPhoneE164, input.whatsappOptIn, input.address, input.city, input.notes, ctx.actorUserId,
          ],
        );
        const created = result.rows[0];
        await this.audit.record(tx, {
          ...ctx,
          action: CONTROL_CENTER_ACTIONS.ACCOUNT_CREATED,
          entityType: "commercial_account",
          entityId: created.id,
          after: created,
        });
        return created;
      });
    } catch (error) {
      return mapDatabaseError(error, "Ya existe una cuenta con ese tipo y número de identificación");
    }
  }

  async update(idParam: string, raw: unknown, ctx: ControlCenterRequestContext) {
    const id = assertUuid(idParam, "accountId");
    const patch = parseAccountPatch(raw);
    try {
      return await this.db.transaction(async (tx) => {
        const before = await this.lockAccount(tx, id);
        const sets: string[] = [];
        const params: unknown[] = [];
        for (const [field, column] of Object.entries(COLUMN_MAP)) {
          if (field in patch) {
            params.push((patch as Record<string, unknown>)[field]);
            sets.push(`${column} = $${params.length}`);
          }
        }
        if ("whatsappOptIn" in patch) {
          params.push(patch.whatsappOptIn);
          const p = `$${params.length}`;
          sets.push(`whatsapp_opt_in = ${p}`);
          sets.push(`whatsapp_opt_in_at = CASE WHEN ${p} THEN COALESCE(whatsapp_opt_in_at, NOW()) END`);
        }
        params.push(ctx.actorUserId);
        sets.push(`updated_by = $${params.length}`, "updated_at = NOW()");
        params.push(id);
        const result = await tx.query(
          `UPDATE control_center.commercial_accounts SET ${sets.join(", ")} WHERE id = $${params.length} RETURNING ${ACCOUNT_COLUMNS}`,
          params,
        );
        const after = result.rows[0];
        await this.audit.record(tx, {
          ...ctx,
          action: CONTROL_CENTER_ACTIONS.ACCOUNT_UPDATED,
          entityType: "commercial_account",
          entityId: id,
          before,
          after,
        });
        return after;
      });
    } catch (error) {
      return mapDatabaseError(error);
    }
  }

  async linkTenant(idParam: string, raw: unknown, ctx: ControlCenterRequestContext) {
    const id = assertUuid(idParam, "accountId");
    const tenantId = requireUuid(asBody(raw), "tenantId");
    if (tenantId === this.db.getConfig().platformTenantId) {
      throw unprocessable("CONTROL_CENTER_PLATFORM_TENANT", "El tenant plataforma no se vincula a cuentas comerciales");
    }
    try {
      return await this.db.transaction(async (tx) => {
        const account = await this.lockAccount(tx, id);
        if (account.status !== "ACTIVE") {
          throw unprocessable("CONTROL_CENTER_ACCOUNT_INACTIVE", "La cuenta comercial está inactiva");
        }
        const tenant = await tx.query("SELECT id FROM public.tenants WHERE id = $1", [tenantId]);
        if (!tenant.rows[0]) throw notFound("CONTROL_CENTER_TENANT_NOT_FOUND", "El tenant no existe");
        const result = await tx.query(
          `INSERT INTO control_center.account_tenants (account_id, tenant_id, linked_by)
           VALUES ($1, $2, $3)
           RETURNING id, account_id AS "accountId", tenant_id AS "tenantId", status, linked_at AS "linkedAt"`,
          [id, tenantId, ctx.actorUserId],
        );
        await this.audit.record(tx, {
          ...ctx,
          action: CONTROL_CENTER_ACTIONS.TENANT_LINKED,
          entityType: "account_tenant",
          entityId: result.rows[0].id,
          after: result.rows[0],
        });
        return result.rows[0];
      });
    } catch (error) {
      return mapDatabaseError(error, "El tenant ya tiene un vínculo activo con una cuenta comercial");
    }
  }

  async endTenantLink(idParam: string, tenantIdParam: string, raw: unknown, ctx: ControlCenterRequestContext) {
    const id = assertUuid(idParam, "accountId");
    const tenantId = assertUuid(tenantIdParam, "tenantId");
    const reason = requireReason(asBody(raw ?? {}));
    return this.db.transaction(async (tx) => {
      const link = await tx.query(
        `SELECT id, status FROM control_center.account_tenants
         WHERE account_id = $1 AND tenant_id = $2 AND status = 'ACTIVE' FOR UPDATE`,
        [id, tenantId],
      );
      if (!link.rows[0]) throw notFound("CONTROL_CENTER_LINK_NOT_FOUND", "No existe un vínculo activo entre la cuenta y el tenant");
      const open = await tx.query(
        `SELECT contract_number FROM control_center.contracts
         WHERE account_id = $1 AND tenant_id = $2 AND status IN ('DRAFT', 'ACTIVE') LIMIT 1`,
        [id, tenantId],
      );
      if (open.rows[0]) {
        throw conflict(
          "CONTROL_CENTER_OPEN_CONTRACT",
          `El tenant tiene el contrato ${open.rows[0].contract_number} abierto; termínalo o cancélalo primero`,
        );
      }
      const result = await tx.query(
        `UPDATE control_center.account_tenants
         SET status = 'ENDED', ended_at = NOW(), ended_by = $2, end_reason = $3
         WHERE id = $1
         RETURNING id, account_id AS "accountId", tenant_id AS "tenantId", status, ended_at AS "endedAt", end_reason AS "endReason"`,
        [link.rows[0].id, ctx.actorUserId, reason],
      );
      await this.audit.record(tx, {
        ...ctx,
        action: CONTROL_CENTER_ACTIONS.TENANT_UNLINKED,
        entityType: "account_tenant",
        entityId: link.rows[0].id,
        before: link.rows[0],
        after: result.rows[0],
        reason,
      });
      return result.rows[0];
    });
  }

  private async lockAccount(tx: PoolClient, id: string) {
    const result = await tx.query(
      `SELECT ${ACCOUNT_COLUMNS} FROM control_center.commercial_accounts WHERE id = $1 FOR UPDATE`,
      [id],
    );
    if (!result.rows[0]) throw notFound("CONTROL_CENTER_ACCOUNT_NOT_FOUND", "Cuenta comercial no encontrada");
    return result.rows[0];
  }
}
