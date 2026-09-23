import { ForbiddenException, Inject, Injectable } from "@nestjs/common";
import { DatabaseService } from "../database/database.service";
import type { ReportUser } from "../auth/report-auth.types";
import type { OperationalSalesReportQuery, OperationalSalesScope } from "./types/operational-sales-report.types";

@Injectable()
export class OperationalSalesReportScopeService {
  constructor(@Inject(DatabaseService) private readonly db: DatabaseService) {}

  async resolve(user: ReportUser, query: OperationalSalesReportQuery, posSessionId?: string): Promise<OperationalSalesScope> {
    if (!user.id || !user.tenantId || !user.sessionId) throw new ForbiddenException("Operational report actor is incomplete");
    const permission = await this.db.query(
      `SELECT 1 FROM user_roles ur JOIN role_menu_permissions rmp ON rmp.role_id = ur.role_id JOIN menu_items mi ON mi.id = rmp.menu_item_id
       WHERE ur.user_id = $1 AND ur.tenant_id = $2 AND mi.key = 'POS' AND rmp.access_level IN ('READ', 'WRITE') LIMIT 1`,
      [user.id, user.tenantId],
    );
    if (!permission.rowCount) throw new ForbiddenException("POS read permission is required");
    const roles = new Set(user.roles.map((role) => role.toUpperCase()));
    if (roles.has("USER")) {
      if (!posSessionId) throw new ForbiddenException("POS session is required");
      const pos = await this.db.query<{ branch_id: string }>(
        `SELECT session.branch_id FROM pos_user_sessions session JOIN terminals terminal ON terminal.id = session.terminal_id AND terminal.tenant_id = session.tenant_id AND terminal.branch_id = session.branch_id AND terminal.is_active = TRUE
         JOIN tenant_branches branch ON branch.id = session.branch_id AND branch.tenant_id = session.tenant_id AND branch.estado = 'ACTIVE'
         WHERE session.id = $1 AND session.user_id = $2 AND session.tenant_id = $3 AND session.is_active = TRUE LIMIT 1`,
        [posSessionId, user.id, user.tenantId],
      );
      const branchId = pos.rows[0]?.branch_id;
      if (!branchId) throw new ForbiddenException("Active POS session is required");
      if (query.branchId && query.branchId !== branchId) return { tenantId: user.tenantId, branchIds: [], requiresCurrentShift: true };
      if (query.userId && query.userId !== user.id) return { tenantId: user.tenantId, branchIds: [], requiresCurrentShift: true };
      const cash = await this.db.query<{ id: string }>(
        `SELECT id FROM cash_sessions WHERE tenant_id = $1 AND branch_id = $2 AND opened_by_user_id = $3 AND status = 'OPEN' ORDER BY opened_at DESC LIMIT 2`,
        [user.tenantId, branchId, user.id],
      );
      if (cash.rows.length !== 1) throw new ForbiddenException("Exactly one current open cash session is required");
      if (query.cashSessionId && query.cashSessionId !== cash.rows[0].id) return { tenantId: user.tenantId, branchIds: [], requiresCurrentShift: true };
      return { tenantId: user.tenantId, branchIds: [branchId], userId: user.id, cashSessionId: cash.rows[0].id, requiresCurrentShift: true };
    }
    const branches = await this.db.query<{ id: string }>(
      `SELECT tb.id FROM tenant_branches tb WHERE tb.tenant_id = $1 AND tb.estado = 'ACTIVE' AND EXISTS (
        SELECT 1 FROM users u JOIN personas p ON p.id = u.persona_id JOIN persona_tenant_branches ptb ON ptb.persona_id = p.id
        WHERE u.id = $2 AND u.tenant_id = tb.tenant_id AND ptb.tenant_branch_id = tb.id)`,
      [user.tenantId, user.id],
    );
    const ids = branches.rows.map((row) => row.id);
    if (roles.has("SUPER_ADMIN") || roles.has("SUPER_USER")) {
      const all = await this.db.query<{ id: string }>(`SELECT id FROM tenant_branches WHERE tenant_id = $1 AND estado = 'ACTIVE'`, [user.tenantId]);
      ids.splice(0, ids.length, ...all.rows.map((row) => row.id));
    }
    if (query.branchId && !ids.includes(query.branchId)) return { tenantId: user.tenantId, branchIds: [], requiresCurrentShift: false };
    return { tenantId: user.tenantId, branchIds: query.branchId ? [query.branchId] : ids, requiresCurrentShift: false };
  }
}
