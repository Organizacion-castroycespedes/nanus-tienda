import { ForbiddenException, Inject, Injectable } from "@nestjs/common";
import { DatabaseService } from "../database/database.service";
import type { ReportUser } from "./report-auth.types";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type ReportBranchScope = {
  tenantId: string;
  branchIds: string[];
};

@Injectable()
export class ReportBranchScopeService {
  constructor(@Inject(DatabaseService) private readonly db: DatabaseService) {}

  async resolve(
    user: ReportUser | undefined,
    requestedBranchId?: string | null,
    requestedTenantId?: string | null
  ): Promise<ReportBranchScope> {
    if (!user || !UUID.test(user.id) || !UUID.test(user.tenantId)) {
      throw new ForbiddenException("Report actor is not authorized");
    }

    const roles = user.roles.map((role) => role.toUpperCase());
    const isSuperAdmin = roles.includes("SUPER_ADMIN");
    const isSuperUser = roles.includes("SUPER_USER");
    if (!isSuperAdmin && !isSuperUser && !roles.includes("ADMIN")) {
      throw new ForbiddenException("Report role is not authorized");
    }
    const tenantId = requestedTenantId?.trim() || user.tenantId;
    if (!UUID.test(tenantId) || (!isSuperAdmin && tenantId !== user.tenantId)) {
      throw new ForbiddenException("Tenant scope mismatch");
    }
    if (requestedBranchId && !UUID.test(requestedBranchId)) {
      throw new ForbiddenException("Branch scope mismatch");
    }

    // Mirror AccessControlService.getAccessibleBranchIds in api. The user and
    // tenant checks are repeated here because this service runs in another process.
    const result = isSuperAdmin || isSuperUser
      ? await this.db.query<{ branch_id: string }>(
          `SELECT b.id AS branch_id
           FROM public.users AS u
           INNER JOIN public.tenant_branches AS b
             ON b.tenant_id = $2 AND b.estado = 'ACTIVE'
           INNER JOIN public.tenants AS t
             ON t.id = b.tenant_id AND t.activo = TRUE
           WHERE u.id = $1 AND u.tenant_id = $3 AND u.estado = 'ACTIVE'
           ORDER BY b.nombre, b.id`,
          [user.id, tenantId, user.tenantId]
        )
      : await this.db.query<{ branch_id: string }>(
          `SELECT DISTINCT b.id AS branch_id
           FROM public.users AS u
           INNER JOIN public.personas AS p ON p.id = u.persona_id
           INNER JOIN public.persona_tenant_branches AS ptb
             ON ptb.persona_id = p.id AND ptb.tenant_id = u.tenant_id
           INNER JOIN public.tenant_branches AS b
             ON b.id = ptb.tenant_branch_id AND b.tenant_id = ptb.tenant_id
           INNER JOIN public.tenants AS t
             ON t.id = b.tenant_id AND t.activo = TRUE
           WHERE u.id = $1 AND u.tenant_id = $2
             AND u.estado = 'ACTIVE' AND b.estado = 'ACTIVE'
           ORDER BY b.id`,
          [user.id, tenantId]
        );

    const authorizedIds = [...new Set(result.rows.map((row) => row.branch_id))];
    if (authorizedIds.length === 0) {
      throw new ForbiddenException("No authorized branches");
    }
    if (requestedBranchId && !authorizedIds.includes(requestedBranchId)) {
      throw new ForbiddenException("Branch scope mismatch");
    }
    return {
      tenantId,
      branchIds: requestedBranchId ? [requestedBranchId] : authorizedIds,
    };
  }
}
