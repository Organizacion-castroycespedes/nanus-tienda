import { Injectable, Inject } from "@nestjs/common";
import { DatabaseService } from "../db/database.service";
import { getMenuKeyCandidates } from "../constants/menu-keys";

export type PermissionAccessLevel = "READ" | "WRITE";

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
}
