import jwt from "jsonwebtoken";
import { Injectable, UnauthorizedException, Inject } from "@nestjs/common";
import { DatabaseService } from "../../common/db/database.service";
import { CacheService } from "../../common/services/cache.service";
import { MenuItem, type MenuItemDto } from "./domain/entities/menu-item";
import { Permission, type AccessLevel } from "./domain/entities/permission";
import { Role } from "./domain/entities/role";

type TokenPayload = {
  sub?: string;
  tenant_id?: string;
  roles?: string[];
  session_id?: string;
};

const JWT_SECRET = process.env.JWT_SECRET ?? "changeme";

@Injectable()
export class MenuService {
  private readonly menuCacheTtlMs: number;
  private readonly catalogCacheTtlMs: number;

  constructor(
    @Inject(DatabaseService) private readonly db: DatabaseService,
    @Inject(CacheService) private readonly cacheService: CacheService
  ) {
    this.menuCacheTtlMs = this.resolveTtlMs("MENU_CACHE_TTL_SECONDS", 300000);
    this.catalogCacheTtlMs = this.resolveTtlMs("CATALOG_CACHE_TTL_SECONDS", 900000);
  }

  async getMenuForAccessToken(accessToken: string): Promise<{ items: MenuItemDto[] }> {
    const payload = this.decodeAccessToken(accessToken);
    if (!payload?.sub || !payload?.tenant_id || !payload?.session_id) {
      throw new UnauthorizedException("Token inválido");
    }
    await this.ensureActiveSession(payload.session_id, payload.sub, payload.tenant_id);

    return this.getMenuForUser(payload.sub, payload.tenant_id);
  }

  async getMenuForUser(userId: string, tenantId: string): Promise<{ items: MenuItemDto[] }> {
    const roles = await this.fetchRolesForUser(userId, tenantId);
    if (roles.length === 0) {
      return { items: [] };
    }

    const roleIds = roles.map((role) => role.id).sort();
    const cacheKey = `roles:${roleIds.join("|")}`;
    const items = await this.cacheService.getOrSet(
      tenantId,
      "menu",
      cacheKey,
      async () => {
        const permissions = await this.fetchPermissionsForRoles(roleIds, tenantId);
        const catalog = await this.getMenuCatalog(tenantId);
        return this.sortMenuItems(this.buildMenuItems(permissions, catalog));
      },
      this.menuCacheTtlMs
    );

    return { items };
  }

  private decodeAccessToken(token: string): TokenPayload {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      if (typeof decoded === "string") {
        return {};
      }
      return decoded as TokenPayload;
    } catch {
      throw new UnauthorizedException("Token inválido");
    }
  }

  private async ensureActiveSession(
    sessionId: string,
    userId: string,
    tenantId: string
  ) {
    const session = await this.db.query(
      `
      SELECT id
      FROM auth_sessions
      WHERE id = $1 AND user_id = $2 AND tenant_id = $3 AND is_active = TRUE
      `,
      [sessionId, userId, tenantId]
    );
    if (!session.rows?.[0]) {
      throw new UnauthorizedException("Sesión inválida");
    }
  }

  private async fetchRolesForUser(userId: string, tenantId: string): Promise<Role[]> {
    const result = await this.db.query(
      `
      SELECT roles.id, roles.nombre
      FROM roles
      INNER JOIN user_roles ON user_roles.role_id = roles.id
      WHERE user_roles.user_id = $1 AND user_roles.tenant_id = $2
      `,
      [userId, tenantId]
    );
    const rows = result.rows as Array<{ id: string; nombre: string }>;
    return rows.map((row) => new Role(row.id, row.nombre));
  }

  private async fetchPermissionsForRoles(
    roleIds: string[],
    tenantId: string
  ): Promise<Permission[]> {
    const result = await this.db.query(
      `
      SELECT
        mi.id,
        mi.key,
        mi.module,
        mi.route,
        mi.label,
        mi.icon,
        mi.parent_id,
        mi.sort_order,
        mi.visible,
        mi.metadata,
        rmp.access_level,
        rmp.actions
      FROM role_menu_permissions rmp
      INNER JOIN menu_items mi ON mi.id = rmp.menu_item_id
      WHERE rmp.role_id = ANY($1::uuid[])
        AND rmp.tenant_id = $2
        AND mi.deleted_at IS NULL
      ORDER BY mi.module, mi.sort_order, mi.label
      `,
      [roleIds, tenantId]
    );
    const rows = result.rows as Array<{
      id: string;
      key: string;
      module: string;
      route: string;
      label: string;
      icon: string | null;
      parent_id: string | null;
      sort_order: number;
      visible: boolean;
      metadata: Record<string, unknown>;
      access_level: AccessLevel;
      actions: Record<string, boolean>;
    }>;

    return rows.map(
      (row) =>
        new Permission(
          row.id,
          row.key,
          row.module,
          row.route,
          row.label,
          row.icon,
          row.parent_id,
          row.sort_order,
          row.visible,
          row.metadata ?? {},
          row.access_level,
          row.actions ?? {}
        )
    );
  }

  private async getMenuCatalog(tenantId: string) {
    return this.cacheService.getOrSet(
      tenantId,
      "catalog",
      "menu-items",
      () => this.fetchMenuCatalog(tenantId),
      this.catalogCacheTtlMs
    );
  }

  private async fetchMenuCatalog(tenantId: string) {
    const result = await this.db.query(
      `
      SELECT
        id,
        key,
        module,
        route,
        label,
        icon,
        parent_id,
        sort_order,
        visible,
        below_main_menu,
        metadata
      FROM menu_items
      WHERE tenant_id = $1
        AND deleted_at IS NULL
      ORDER BY module, sort_order, label
      `,
      [tenantId]
    );
    return result.rows as Array<{
      id: string;
      key: string;
      module: string;
      route: string;
      label: string;
      icon: string | null;
      parent_id: string | null;
      sort_order: number;
      visible: boolean;
      below_main_menu: boolean;
      metadata: Record<string, unknown>;
    }>;
  }

  private buildMenuItems(
    permissions: Permission[],
    catalog: Array<{
      id: string;
      key: string;
      module: string;
      route: string;
      label: string;
      icon: string | null;
      parent_id: string | null;
      sort_order: number;
      visible: boolean;
      below_main_menu: boolean;
      metadata: Record<string, unknown>;
    }>
  ): MenuItemDto[] {
    const permissionById = new Map<
      string,
      { accessLevel: AccessLevel; actions: Record<string, boolean> }
    >();
    for (const permission of permissions) {
      const existing = permissionById.get(permission.menuItemId);
      if (!existing) {
        permissionById.set(permission.menuItemId, {
          accessLevel: permission.accessLevel,
          actions: { ...permission.actions },
        });
        continue;
      }
      if (permission.accessLevel === "WRITE") {
        existing.accessLevel = "WRITE";
      }
      for (const [action, allowed] of Object.entries(permission.actions)) {
        existing.actions[action] = existing.actions[action] || Boolean(allowed);
      }
    }

    const catalogMap = new Map<string, (typeof catalog)[number]>();
    const parentMap = new Map<string, string | null>();
    catalog.forEach((item) => {
      catalogMap.set(item.id, item);
      parentMap.set(item.id, item.parent_id);
    });

    const allowedIds = new Set(permissionById.keys());
    for (const id of permissionById.keys()) {
      let parentId = parentMap.get(id) ?? null;
      while (parentId) {
        if (!allowedIds.has(parentId)) {
          allowedIds.add(parentId);
        }
        parentId = parentMap.get(parentId) ?? null;
      }
    }

    const nodes = new Map<string, MenuItemDto>();
    for (const id of allowedIds) {
      const item = catalogMap.get(id);
      if (!item || !item.visible) {
        continue;
      }
      const permission = permissionById.get(id);
      const accessLevel = permission?.accessLevel ?? "READ";
      nodes.set(
        id,
        new MenuItem(
          item.id,
          item.key,
          item.module,
          item.route,
          item.label,
          item.icon,
          item.parent_id,
          item.sort_order,
          item.visible,
          item.below_main_menu,
          item.metadata ?? {},
          accessLevel,
          !permission
        ).toDto()
      );
    }

    const roots: MenuItemDto[] = [];
    nodes.forEach((node) => {
      if (node.parentId && nodes.has(node.parentId)) {
        const parent = nodes.get(node.parentId);
        if (parent) {
          parent.children = parent.children ?? [];
          parent.children.push(node);
        }
      } else {
        roots.push(node);
      }
    });

    const sortTree = (items: MenuItemDto[]) => {
      items.sort((a, b) => {
        if (a.sortOrder !== b.sortOrder) {
          return a.sortOrder - b.sortOrder;
        }
        return a.label.localeCompare(b.label, "es");
      });
      items.forEach((item) => {
        if (item.children) {
          sortTree(item.children);
        }
      });
    };
    sortTree(roots);
    return roots;
  }

  private sortMenuItems(items: MenuItemDto[]): MenuItemDto[] {
    return [...items].sort((a, b) => {
      const aIsDashboard = a.key === "DASHBOARD";
      const bIsDashboard = b.key === "DASHBOARD";
      if (aIsDashboard && !bIsDashboard) {
        return -1;
      }
      if (!aIsDashboard && bIsDashboard) {
        return 1;
      }
      const moduleCompare = a.module.localeCompare(b.module, "es");
      if (moduleCompare !== 0) {
        return moduleCompare;
      }
      return a.label.localeCompare(b.label, "es");
    });
  }

  private resolveTtlMs(envKey: string, defaultMs: number) {
    const value = Number(process.env[envKey] ?? "");
    return Number.isFinite(value) && value > 0 ? value * 1000 : defaultMs;
  }
}
