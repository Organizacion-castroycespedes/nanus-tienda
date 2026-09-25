import { CanActivate, ExecutionContext, ForbiddenException, Inject, Injectable } from "@nestjs/common";
import type { Request } from "express";
import { DatabaseService } from "../database/database.service";
import type { ReportUser } from "./report-auth.types";

type AuthenticatedRequest = Request & { user?: ReportUser };

@Injectable()
export class InventoryReadReportGuard implements CanActivate {
  constructor(@Inject(DatabaseService) private readonly database: DatabaseService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;
    if (!user?.id || !user.tenantId) {
      throw new ForbiddenException("Inventory permission is required");
    }

    const roles = user.roles.map((role) => role.toUpperCase());
    if (roles.includes("SUPER_ADMIN") || roles.includes("SUPER_USER") || roles.includes("ADMIN")) {
      return true;
    }

    const result = await this.database.query<{ access_level: string }>(
      `SELECT rmp.access_level
       FROM role_menu_permissions AS rmp
       INNER JOIN menu_items AS mi ON mi.id = rmp.menu_item_id
       WHERE rmp.tenant_id = $1
         AND mi.key = 'INVENTORY'
         AND mi.deleted_at IS NULL
         AND rmp.role_id = ANY(
           SELECT role_id FROM user_roles WHERE user_id = $2 AND tenant_id = $1
         )
       LIMIT 1`,
      [user.tenantId, user.id],
    );
    if (!result.rows.some((row) => ["READ", "WRITE"].includes(row.access_level.toUpperCase()))) {
      throw new ForbiddenException("Inventory permission is required");
    }
    return true;
  }
}
