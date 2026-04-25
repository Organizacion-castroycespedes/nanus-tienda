import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Inject,
} from "@nestjs/common";
import { DatabaseService } from "../../common/db/database.service";
import { AuditService } from "../../common/services/audit.service";
import { CacheService } from "../../common/services/cache.service";
import type {
  CreateMenuItemDto,
  UpdateMenuItemDto,
} from "./dto/menu-item.dto";
import type {
  PatchRoleMenuPermissionsDto,
  ReplaceRoleMenuPermissionsDto,
  RoleMenuPermissionItemDto,
} from "./dto/role-menu-permissions.dto";
import type { PermissionAccessLevel } from "../../common/services/access-control.service";

export type ActorContext = {
  roles: string[];
  tenantId?: string;
  userId?: string;
  ip?: string;
  userAgent?: string;
};

const ACCESS_LEVELS: PermissionAccessLevel[] = ["READ", "WRITE"];

@Injectable()
export class MenuAdminService {
  constructor(
    @Inject(DatabaseService) private readonly db: DatabaseService,
    @Inject(AuditService) private readonly auditService: AuditService,
    @Inject(CacheService) private readonly cacheService: CacheService
  ) {}

  async listMenuItems(tenantId: string, actor: ActorContext) {
    this.ensureTenantAccess(tenantId, actor);
    const result = await this.db.query(
      `
      SELECT
        id,
        tenant_id,
        key,
        module,
        label,
        route,
        icon,
        parent_id,
        sort_order,
        visible,
        below_main_menu,
        metadata,
        created_at,
        updated_at,
        deleted_at
      FROM menu_items
      WHERE tenant_id = $1
        AND deleted_at IS NULL
      ORDER BY module, sort_order, label
      `,
      [tenantId]
    );
    return result.rows ?? [];
  }

  async getMenuItem(id: string, actor: ActorContext) {
    const result = await this.db.query(
      `
      SELECT
        id,
        tenant_id,
        key,
        module,
        label,
        route,
        icon,
        parent_id,
        sort_order,
        visible,
        below_main_menu,
        metadata,
        created_at,
        updated_at,
        deleted_at
      FROM menu_items
      WHERE id = $1
      `,
      [id]
    );
    const item = result.rows?.[0];
    if (!item) {
      throw new NotFoundException("Menu no encontrado");
    }
    this.ensureTenantAccess(item.tenant_id, actor);
    if (item.deleted_at) {
      throw new NotFoundException("Menu no encontrado");
    }
    return item;
  }

  async createMenuItem(payload: CreateMenuItemDto, actor: ActorContext) {
    this.ensureTenantAccess(payload.tenantId, actor);
    const key = this.normalizeKey(payload.key);
    const module = payload.module?.trim();
    const label = payload.label?.trim();
    const route = payload.route?.trim();

    if (!key || !module || !label || !route) {
      throw new BadRequestException("Campos requeridos");
    }
    if (!route.startsWith("/")) {
      throw new BadRequestException("Ruta inválida");
    }

    const result = await this.db.query(
      `
      INSERT INTO menu_items
        (tenant_id, key, module, label, route, icon, parent_id, sort_order, visible, below_main_menu, metadata)
      VALUES
        ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
      `,
      [
        payload.tenantId,
        key,
        module,
        label,
        route,
        payload.icon ?? null,
        payload.parentId ?? null,
        payload.sortOrder ?? 0,
        payload.visible ?? true,
        payload.belowMainMenu ?? false,
        payload.metadata ?? {},
      ]
    );

    const item = result.rows?.[0];
    this.recordAuditLog(
      "MENU_ITEM_CREATED",
      "menu_items",
      item?.id,
      null,
      item,
      actor,
      payload.tenantId
    );
    this.invalidateMenuCache(payload.tenantId);
    return item;
  }

  async updateMenuItem(id: string, payload: UpdateMenuItemDto, actor: ActorContext) {
    const current = await this.getMenuItem(id, actor);
    const key = payload.key ? this.normalizeKey(payload.key) : undefined;
    const module = payload.module?.trim();
    const label = payload.label?.trim();
    const route = payload.route?.trim();

    if (payload.key !== undefined && !key) {
      throw new BadRequestException("Key inválida");
    }
    if (payload.module !== undefined && !module) {
      throw new BadRequestException("Modulo inválido");
    }
    if (payload.label !== undefined && !label) {
      throw new BadRequestException("Etiqueta inválida");
    }
    if (payload.route !== undefined && (!route || !route.startsWith("/"))) {
      throw new BadRequestException("Ruta inválida");
    }

    const result = await this.db.query(
      `
      UPDATE menu_items
      SET
        key = COALESCE($2, key),
        module = COALESCE($3, module),
        label = COALESCE($4, label),
        route = COALESCE($5, route),
        icon = COALESCE($6, icon),
        parent_id = COALESCE($7, parent_id),
        sort_order = COALESCE($8, sort_order),
        visible = COALESCE($9, visible),
        below_main_menu = COALESCE($10, below_main_menu),
        metadata = COALESCE($11, metadata),
        updated_at = NOW()
      WHERE id = $1
      RETURNING *
      `,
      [
        id,
        key ?? null,
        module ?? null,
        label ?? null,
        route ?? null,
        payload.icon ?? null,
        payload.parentId ?? null,
        payload.sortOrder ?? null,
        payload.visible ?? null,
        payload.belowMainMenu ?? null,
        payload.metadata ?? null,
      ]
    );
    const updated = result.rows?.[0];
    this.recordAuditLog(
      "MENU_ITEM_UPDATED",
      "menu_items",
      id,
      current,
      updated,
      actor,
      current.tenant_id
    );
    this.invalidateMenuCache(current.tenant_id);
    return updated;
  }

  async updateMenuItemStatus(id: string, visible: boolean, actor: ActorContext) {
    const current = await this.getMenuItem(id, actor);
    const result = await this.db.query(
      `
      UPDATE menu_items
      SET visible = $2, updated_at = NOW()
      WHERE id = $1
      RETURNING *
      `,
      [id, visible]
    );
    const updated = result.rows?.[0];
    this.recordAuditLog(
      "MENU_ITEM_STATUS",
      "menu_items",
      id,
      current,
      updated,
      actor,
      current.tenant_id
    );
    this.invalidateMenuCache(current.tenant_id);
    return updated;
  }

  async deleteMenuItem(id: string, actor: ActorContext) {
    const current = await this.getMenuItem(id, actor);
    const result = await this.db.query(
      `
      UPDATE menu_items
      SET deleted_at = NOW(), updated_at = NOW()
      WHERE id = $1
      RETURNING *
      `,
      [id]
    );
    const updated = result.rows?.[0];
    this.recordAuditLog(
      "MENU_ITEM_DELETED",
      "menu_items",
      id,
      current,
      updated,
      actor,
      current.tenant_id
    );
    this.invalidateMenuCache(current.tenant_id);
    return updated;
  }

  async listRolePermissions(roleId: string, tenantId: string, actor: ActorContext) {
    this.ensureTenantAccess(tenantId, actor);
    const result = await this.db.query(
      `
      SELECT
        rmp.menu_item_id,
        rmp.access_level,
        rmp.actions,
        mi.key,
        mi.module,
        mi.label,
        mi.route
      FROM role_menu_permissions rmp
      INNER JOIN menu_items mi ON mi.id = rmp.menu_item_id
      WHERE rmp.role_id = $1
        AND rmp.tenant_id = $2
        AND mi.deleted_at IS NULL
      ORDER BY mi.module, mi.sort_order, mi.label
      `,
      [roleId, tenantId]
    );
    return result.rows ?? [];
  }

  async replaceRolePermissions(
    roleId: string,
    payload: ReplaceRoleMenuPermissionsDto,
    actor: ActorContext
  ) {
    this.ensureTenantAccess(payload.tenantId, actor);
    this.validatePermissions(payload.permissions);

    const client = await this.db.getClient();
    try {
      await client.query("BEGIN");
      const before = await client.query(
        `
        SELECT menu_item_id, access_level, actions
        FROM role_menu_permissions
        WHERE role_id = $1 AND tenant_id = $2
        `,
        [roleId, payload.tenantId]
      );

      await client.query(
        `
        DELETE FROM role_menu_permissions
        WHERE role_id = $1 AND tenant_id = $2
        `,
        [roleId, payload.tenantId]
      );

      for (const permission of payload.permissions) {
        await this.ensureMenuItemBelongs(permission.menuItemId, payload.tenantId, client);
        await client.query(
          `
          INSERT INTO role_menu_permissions
            (tenant_id, role_id, menu_item_id, access_level, actions)
          VALUES
            ($1, $2, $3, $4, $5)
          `,
          [
            payload.tenantId,
            roleId,
            permission.menuItemId,
            permission.accessLevel,
            permission.actions ?? {},
          ]
        );
      }

      await client.query("COMMIT");
      this.recordAuditLog(
        "ROLE_MENU_PERMISSIONS_REPLACED",
        "role_menu_permissions",
        roleId,
        before.rows ?? [],
        payload.permissions,
        actor,
        payload.tenantId
      );
      this.cacheService.invalidateTenantNamespace(payload.tenantId, "menu");
      return { ok: true };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async patchRolePermissions(
    roleId: string,
    payload: PatchRoleMenuPermissionsDto,
    actor: ActorContext
  ) {
    this.ensureTenantAccess(payload.tenantId, actor);
    this.validatePermissions(payload.permissions);

    const client = await this.db.getClient();
    try {
      await client.query("BEGIN");
      const before = await client.query(
        `
        SELECT menu_item_id, access_level, actions
        FROM role_menu_permissions
        WHERE role_id = $1 AND tenant_id = $2
        `,
        [roleId, payload.tenantId]
      );

      for (const permission of payload.permissions) {
        await this.ensureMenuItemBelongs(permission.menuItemId, payload.tenantId, client);
        await client.query(
          `
          INSERT INTO role_menu_permissions
            (tenant_id, role_id, menu_item_id, access_level, actions)
          VALUES
            ($1, $2, $3, $4, $5)
          ON CONFLICT (tenant_id, role_id, menu_item_id)
          DO UPDATE SET
            access_level = EXCLUDED.access_level,
            actions = EXCLUDED.actions
          `,
          [
            payload.tenantId,
            roleId,
            permission.menuItemId,
            permission.accessLevel,
            permission.actions ?? {},
          ]
        );
      }

      const after = await client.query(
        `
        SELECT menu_item_id, access_level, actions
        FROM role_menu_permissions
        WHERE role_id = $1 AND tenant_id = $2
        `,
        [roleId, payload.tenantId]
      );
      await client.query("COMMIT");
      this.recordAuditLog(
        "ROLE_MENU_PERMISSIONS_PATCHED",
        "role_menu_permissions",
        roleId,
        before.rows ?? [],
        after.rows ?? [],
        actor,
        payload.tenantId
      );
      this.cacheService.invalidateTenantNamespace(payload.tenantId, "menu");
      return { ok: true };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  private ensureTenantAccess(tenantId: string, actor: ActorContext) {
    if (!tenantId) {
      throw new BadRequestException("Tenant requerido");
    }
    if (!actor.roles?.includes("SUPER_ADMIN")) {
      throw new ForbiddenException("No autorizado");
    }
    if (actor.tenantId && actor.tenantId !== tenantId) {
      throw new ForbiddenException("Tenant inválido");
    }
  }

  private normalizeKey(key: string) {
    const normalized = key.trim().toUpperCase().replace(/[^A-Z0-9_]+/g, "_");
    return normalized.replace(/^_+|_+$/g, "");
  }

  private validatePermissions(permissions: RoleMenuPermissionItemDto[]) {
    if (!Array.isArray(permissions)) {
      throw new BadRequestException("Permisos inválidos");
    }
    permissions.forEach((permission) => {
      if (!permission.menuItemId) {
        throw new BadRequestException("Menu requerido");
      }
      if (!ACCESS_LEVELS.includes(permission.accessLevel)) {
        throw new BadRequestException("Nivel de acceso inválido");
      }
    });
  }

  private async ensureMenuItemBelongs(
    menuItemId: string,
    tenantId: string,
    client: { query: Function }
  ) {
    const check = await client.query(
      `
      SELECT id
      FROM menu_items
      WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL
      `,
      [menuItemId, tenantId]
    );
    if (!check.rows?.[0]) {
      throw new BadRequestException("Menu inválido");
    }
  }

  private recordAuditLog(
    action: string,
    entity: string,
    entityId: string | null,
    before: unknown,
    after: unknown,
    actor: ActorContext,
    tenantId?: string
  ) {
    const resolvedTenantId = tenantId ?? actor.tenantId;
    if (!resolvedTenantId) {
      return;
    }
    this.auditService.logEvent({
      tenantId: resolvedTenantId,
      userId: actor.userId ?? null,
      module: "menu",
      entity,
      entityId: entityId ?? "n/a",
      action,
      before,
      after,
      ip: actor.ip ?? null,
      userAgent: actor.userAgent ?? null,
    });
  }

  private invalidateMenuCache(tenantId: string) {
    this.cacheService.invalidateTenantNamespace(tenantId, "catalog", "menu-items");
    this.cacheService.invalidateTenantNamespace(tenantId, "menu");
  }
}
