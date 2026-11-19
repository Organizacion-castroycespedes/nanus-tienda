import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
} from "@nestjs/common";
import { DatabaseService } from "../db/database.service";
import { readControlCenterConfig } from "../../modules/control-center/control-center.config";

type RequestUser = { id?: string; tenantId?: string };

const DENIED_MESSAGE = "Acceso denegado";

/**
 * Admite solo al SUPER_ADMIN del tenant plataforma. Revalida en base de datos
 * usuario activo, tenant plataforma activo y rol SUPER_ADMIN vigente, para no
 * confiar en roles obsoletos del JWT ni en un SUPER_ADMIN de otro tenant.
 */
@Injectable()
export class PlatformTenantGuard implements CanActivate {
  constructor(@Inject(DatabaseService) private readonly db: DatabaseService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user as RequestUser | undefined;
    const platformTenantId = readControlCenterConfig().platformTenantId;

    if (!user?.id || !user.tenantId || user.tenantId !== platformTenantId) {
      throw new ForbiddenException(DENIED_MESSAGE);
    }

    const result = await this.db.query<{ allowed: number }>(
      `
      SELECT 1 AS allowed
      FROM users u
      INNER JOIN tenants t ON t.id = u.tenant_id
      INNER JOIN user_roles ur ON ur.user_id = u.id AND ur.tenant_id = u.tenant_id
      INNER JOIN roles r ON r.id = ur.role_id
      WHERE u.id = $1
        AND u.tenant_id = $2
        AND u.estado = 'ACTIVE'
        AND t.activo = TRUE
        AND r.nombre = 'SUPER_ADMIN'
      LIMIT 1
      `,
      [user.id, platformTenantId],
    );

    if (!result.rows?.[0]) {
      throw new ForbiddenException(DENIED_MESSAGE);
    }

    return true;
  }
}
