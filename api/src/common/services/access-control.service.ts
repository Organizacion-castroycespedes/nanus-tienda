import { ForbiddenException, Injectable, Inject, NotFoundException } from "@nestjs/common";
import { DatabaseService } from "../db/database.service";
import { getMenuKeyCandidates } from "../constants/menu-keys";

export type PermissionAccessLevel = "READ" | "WRITE";

export type AccessActor = {
  id?: string;
  tenantId?: string;
  roles?: string[];
};

export type PermissionSummary = {
  key: string;
  module: string;
  route: string;
  accessLevel: PermissionAccessLevel;
  actions: Record<string, boolean>;
};

type PermissionCache = {
  permissions: Map<string, PermissionSummary>;
};

@Injectable()
export class AccessControlService {
  constructor(
    @Inject(DatabaseService) private readonly db: DatabaseService
  ) {}

  async getPermissionsForRequest(
    request: { permissionCache?: PermissionCache },
    userId: string,
    tenantId: string
  ): Promise<Map<string, PermissionSummary>> {
    if (request.permissionCache?.permissions) {
      return request.permissionCache.permissions;
    }
    const permissions = await this.fetchPermissions(userId, tenantId);
    request.permissionCache = { permissions };
    return permissions;
  }

  async fetchPermissions(
    userId: string,
    tenantId: string
  ): Promise<Map<string, PermissionSummary>> {
    const result = await this.db.query(
      `
      SELECT
        mi.key,
        mi.module,
        mi.route,
        rmp.access_level,
        rmp.actions
      FROM role_menu_permissions rmp
      INNER JOIN menu_items mi ON mi.id = rmp.menu_item_id
      WHERE rmp.tenant_id = $1
        AND mi.deleted_at IS NULL
        AND rmp.role_id = ANY(
          SELECT role_id
          FROM user_roles
          WHERE user_id = $2 AND tenant_id = $1
        )
      `,
      [tenantId, userId]
    );
    const map = new Map<string, PermissionSummary>();
    for (const row of result.rows as Array<{
      key: string;
      module: string;
      route: string;
      access_level: PermissionAccessLevel;
      actions: Record<string, boolean> | null;
    }>) {
      const existing = map.get(row.key);
      const actions = row.actions ?? {};
      if (!existing) {
        map.set(row.key, {
          key: row.key,
          module: row.module,
          route: row.route,
          accessLevel: row.access_level,
          actions: { ...actions },
        });
        continue;
      }
      if (row.access_level === "WRITE") {
        existing.accessLevel = "WRITE";
      }
      for (const [action, allowed] of Object.entries(actions)) {
        existing.actions[action] = existing.actions[action] || Boolean(allowed);
      }
    }
    return map;
  }

  findPermission(
    permissions: Map<string, PermissionSummary>,
    menuKey: string
  ): PermissionSummary | undefined {
    const candidates = getMenuKeyCandidates(menuKey);
    let resolved: PermissionSummary | undefined;

    for (const candidate of candidates) {
      const permission = permissions.get(candidate);
      if (!permission) {
        continue;
      }

      if (!resolved) {
        resolved = {
          key: menuKey,
          module: permission.module,
          route: permission.route,
          accessLevel: permission.accessLevel,
          actions: { ...permission.actions },
        };
        continue;
      }

      if (permission.accessLevel === "WRITE") {
        resolved.accessLevel = "WRITE";
      }

      for (const [action, allowed] of Object.entries(permission.actions)) {
        resolved.actions[action] = resolved.actions[action] || Boolean(allowed);
      }
    }

    return resolved;
  }

  isAccessAllowed(
    permission: PermissionSummary | undefined,
    required: PermissionAccessLevel
  ) {
    if (!permission) {
      return false;
    }
    if (required === "READ") {
      return permission.accessLevel === "READ" || permission.accessLevel === "WRITE";
    }
    return permission.accessLevel === "WRITE";
  }

  isActionAllowed(
    permission: PermissionSummary | undefined,
    required: PermissionAccessLevel,
    action: string
  ) {
    if (!this.isAccessAllowed(permission, required)) {
      return false;
    }

    const normalizedAction = action.trim().toLowerCase();
    if (!normalizedAction) {
      return false;
    }

    return Object.entries(permission?.actions ?? {}).some(
      ([key, allowed]) => key.trim().toLowerCase() === normalizedAction && Boolean(allowed)
    );
  }

  isSuperAdmin(actor: AccessActor) {
    return actor.roles?.includes("SUPER_ADMIN") ?? false;
  }

  isSuperUser(actor: AccessActor) {
    return actor.roles?.includes("SUPER_USER") ?? false;
  }

  isTenantScoped(actor: AccessActor) {
    return !this.isSuperAdmin(actor);
  }

  canAccessTenant(actor: AccessActor, tenantId?: string | null) {
    if (this.isSuperAdmin(actor)) {
      return true;
    }
    return Boolean(actor.tenantId && tenantId && actor.tenantId === tenantId);
  }

  resolveTenantId(actor: AccessActor, requestedTenantId?: string | null) {
    const requested = requestedTenantId?.trim();
    if (this.isSuperAdmin(actor)) {
      return requested || actor.tenantId || null;
    }
    return actor.tenantId ?? null;
  }

  async resolveTenantIdFromSlug(
    actor: AccessActor,
    requestedTenant: string,
  ): Promise<string> {
    const slug = requestedTenant.trim();
    const result = await this.db.query<{ id: string; slug: string }>(
      `SELECT id, slug FROM tenants WHERE slug = $1 AND activo = TRUE LIMIT 1`,
      [slug],
    );
    const tenant = result.rows[0];
    if (!tenant) {
      throw new NotFoundException("Tenant no encontrado");
    }
    if (!this.isSuperAdmin(actor) && actor.tenantId !== tenant.id) {
      throw new ForbiddenException("Tenant scope mismatch");
    }
    return tenant.id;
  }

  async resolveTenantIdFromRoute(
    actor: AccessActor,
    requestedTenant: string,
  ): Promise<string> {
    const value = requestedTenant.trim();
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
      if (!this.isSuperAdmin(actor) && actor.tenantId !== value) {
        throw new ForbiddenException("Tenant scope mismatch");
      }
      return value;
    }

    return this.resolveTenantIdFromSlug(actor, value);
  }

  async getAccessibleBranchIds(
    actor: AccessActor,
    tenantId: string
  ): Promise<string[]> {
    if (!actor.id) {
      return [];
    }
    if (this.isSuperAdmin(actor) || this.isSuperUser(actor)) {
      const result = await this.db.query<{ id: string }>(
        `SELECT id
        FROM tenant_branches
        WHERE tenant_id = $1 AND estado = 'ACTIVE'
        ORDER BY nombre`,
        [tenantId]
      );
      return result.rows.map((row) => row.id);
    }

    const result = await this.db.query<{ branch_id: string }>(
      `SELECT DISTINCT tb.id AS branch_id
      FROM users AS u
      INNER JOIN personas AS p
        ON p.id = u.persona_id
      INNER JOIN persona_tenant_branches AS ptb
        ON ptb.persona_id = p.id
       AND ptb.tenant_id = u.tenant_id
      INNER JOIN tenant_branches AS tb
        ON tb.id = ptb.tenant_branch_id
       AND tb.tenant_id = ptb.tenant_id
      WHERE u.id = $1
        AND u.tenant_id = $2
        AND u.estado = 'ACTIVE'
        AND tb.estado = 'ACTIVE'`,
      [actor.id, tenantId]
    );
    return result.rows.map((row) => row.branch_id);
  }

  async canAccessBranch(
    actor: AccessActor,
    tenantId: string,
    branchId?: string | null
  ) {
    if (!branchId) {
      return true;
    }
    if (!this.canAccessTenant(actor, tenantId)) {
      return false;
    }
    if (this.isSuperAdmin(actor) || this.isSuperUser(actor)) {
      const result = await this.db.query(
        `SELECT 1
        FROM tenant_branches
        WHERE id = $1 AND tenant_id = $2 AND estado = 'ACTIVE'
        LIMIT 1`,
        [branchId, tenantId]
      );
      return (result.rows?.length ?? 0) > 0;
    }
    if (!actor.id) {
      return false;
    }
    const result = await this.db.query(
      `SELECT 1
      FROM users AS u
      INNER JOIN personas AS p
        ON p.id = u.persona_id
      INNER JOIN persona_tenant_branches AS ptb
        ON ptb.persona_id = p.id
       AND ptb.tenant_id = u.tenant_id
      WHERE u.id = $1
        AND u.tenant_id = $2
        AND u.estado = 'ACTIVE'
        AND ptb.tenant_branch_id = $3
      LIMIT 1`,
      [actor.id, tenantId, branchId]
    );
    return (result.rows?.length ?? 0) > 0;
  }
}
