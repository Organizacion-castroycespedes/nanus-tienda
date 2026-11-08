import { Inject, Injectable } from "@nestjs/common";
import { ControlCenterDatabaseService } from "../control-center-database.service";
import { badRequest, notFound } from "../shared/errors";
import { assertUuid, likePattern, parseLimit, parseSearch } from "../shared/parsing";

export type TerminalStatus = "OK" | "EXCEEDED" | "NO_CONTRACT";

export type TenantDirectoryEntry = {
  id: string;
  slug: string;
  name: string | null;
  active: boolean;
  createdAt: string;
  legalName: string | null;
  taxId: string | null;
  dv: string | null;
  activeBranches: number;
  activePosTerminals: number;
  link: { accountId: string; accountLegalName: string } | null;
  contract: { id: string; number: string; status: string; contractedPosTerminals: number } | null;
  terminalStatus: TerminalStatus;
};

type Row = {
  id: string;
  slug: string;
  nombre: string | null;
  activo: boolean;
  created_at: Date | string;
  created_at_key: string;
  razon_social: string | null;
  nit: string | null;
  dv: string | null;
  active_branches: string | number;
  active_pos_terminals: string | number;
  account_id: string | null;
  account_legal_name: string | null;
  contract_id: string | null;
  contract_number: string | null;
  contract_status: string | null;
  contracted_pos_terminals: string | number | null;
};

const BASE_SELECT = `
  SELECT
    t.id, t.slug, t.nombre, t.activo, t.created_at, t.created_at::text AS created_at_key,
    d.razon_social, d.nit, d.dv,
    (SELECT COUNT(*) FROM public.tenant_branches b WHERE b.tenant_id = t.id AND b.estado = 'ACTIVE') AS active_branches,
    (SELECT COUNT(*) FROM public.pos_terminals p WHERE p.tenant_id = t.id AND p.active) AS active_pos_terminals,
    link.account_id, account.legal_name AS account_legal_name,
    contract.id AS contract_id, contract.contract_number, contract.status AS contract_status,
    (
      SELECT cv.included_pos_terminals + COALESCE(SUM(ci.quantity) FILTER (WHERE ci.item_type = 'EXTRA_POS_TERMINAL'), 0)
      FROM control_center.contract_versions cv
      LEFT JOIN control_center.contract_items ci ON ci.contract_version_id = cv.id
      WHERE cv.id = contract.current_version_id
      GROUP BY cv.included_pos_terminals
    ) AS contracted_pos_terminals
  FROM public.tenants t
  LEFT JOIN LATERAL (
    SELECT razon_social, nit, dv FROM public.tenants_detalles WHERE tenant_id = t.id LIMIT 1
  ) d ON TRUE
  LEFT JOIN control_center.account_tenants link ON link.tenant_id = t.id AND link.status = 'ACTIVE'
  LEFT JOIN control_center.commercial_accounts account ON account.id = link.account_id
  LEFT JOIN control_center.contracts contract
    ON contract.tenant_id = t.id AND contract.status IN ('DRAFT', 'ACTIVE')
`;

const toEntry = (row: Row): TenantDirectoryEntry => {
  const activePosTerminals = Number(row.active_pos_terminals);
  const contracted = row.contracted_pos_terminals === null ? null : Number(row.contracted_pos_terminals);
  return {
    id: row.id,
    slug: row.slug,
    name: row.nombre,
    active: row.activo,
    createdAt: new Date(row.created_at).toISOString(),
    legalName: row.razon_social,
    taxId: row.nit,
    dv: row.dv,
    activeBranches: Number(row.active_branches),
    activePosTerminals,
    link: row.account_id ? { accountId: row.account_id, accountLegalName: row.account_legal_name ?? "" } : null,
    contract:
      row.contract_id && row.contract_number && row.contract_status
        ? {
            id: row.contract_id,
            number: row.contract_number,
            status: row.contract_status,
            contractedPosTerminals: contracted ?? 0,
          }
        : null,
    terminalStatus:
      contracted === null || row.contract_status !== "ACTIVE"
        ? "NO_CONTRACT"
        : activePosTerminals > contracted
          ? "EXCEEDED"
          : "OK",
  };
};

export const encodeCursor = (createdAt: string, id: string) =>
  Buffer.from(`${createdAt}|${id}`, "utf8").toString("base64url");

export const decodeCursor = (cursor: unknown): { createdAt: string; id: string } | null => {
  if (cursor === undefined || cursor === null || cursor === "") return null;
  try {
    const [createdAt, id] = Buffer.from(String(cursor), "base64url").toString("utf8").split("|");
    if (!createdAt || !/^\d{4}-\d{2}-\d{2}[ T][0-9:.+\-]+$/.test(createdAt)) throw new Error("bad");
    return { createdAt, id: assertUuid(id, "cursor") };
  } catch {
    throw badRequest("CONTROL_CENTER_INVALID_CURSOR", "Cursor de paginación inválido");
  }
};

/** Directorio de solo lectura de tenants existentes (no crea ni modifica tenants). */
@Injectable()
export class TenantDirectoryService {
  constructor(@Inject(ControlCenterDatabaseService) private readonly db: ControlCenterDatabaseService) {}

  async list(query: Record<string, unknown>) {
    const limit = parseLimit(query.limit, 20, 50);
    const search = parseSearch(query.search);
    const cursor = decodeCursor(query.cursor);
    const params: unknown[] = [this.db.getConfig().platformTenantId];
    const where = ["t.id <> $1"];
    if (search) {
      params.push(likePattern(search));
      const p = `$${params.length}`;
      where.push(`(t.nombre ILIKE ${p} OR t.slug ILIKE ${p} OR d.razon_social ILIKE ${p} OR d.nit ILIKE ${p})`);
    }
    if (cursor) {
      params.push(cursor.createdAt, cursor.id);
      where.push(`(t.created_at, t.id) < ($${params.length - 1}::timestamptz, $${params.length}::uuid)`);
    }
    params.push(limit + 1);
    const result = await this.db.query<Row>(
      `${BASE_SELECT} WHERE ${where.join(" AND ")} ORDER BY t.created_at DESC, t.id DESC LIMIT $${params.length}`,
      params,
    );
    const page = result.rows.slice(0, limit);
    const last = page.at(-1);
    return {
      items: page.map(toEntry),
      nextCursor: result.rows.length > limit && last ? encodeCursor(last.created_at_key, last.id) : null,
    };
  }

  async get(tenantIdParam: string) {
    const tenantId = assertUuid(tenantIdParam, "tenantId");
    if (tenantId === this.db.getConfig().platformTenantId) {
      throw notFound("CONTROL_CENTER_TENANT_NOT_FOUND", "Tenant no encontrado");
    }
    const result = await this.db.query<Row>(`${BASE_SELECT} WHERE t.id = $1`, [tenantId]);
    const row = result.rows[0];
    if (!row) throw notFound("CONTROL_CENTER_TENANT_NOT_FOUND", "Tenant no encontrado");
    return toEntry(row);
  }
}
