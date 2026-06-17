import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { PERMISSION_KEY, type RequiredPermission } from "../decorators/require-permission.decorator";
import { AccessControlService } from "../services/access-control.service";
import { MENU_KEYS, getMenuKeyCandidates } from "../constants/menu-keys";

const OPERATIONAL_ADMIN_MENU_KEYS = new Set<string>([
  "INVENTORY",
  MENU_KEYS.INVENTORY_PURCHASES,
  MENU_KEYS.INVENTORY_PRODUCTS,
  MENU_KEYS.INVENTORY_LOCATIONS,
  MENU_KEYS.INVENTORY_LOTS,
  MENU_KEYS.INVENTORY_UNITS,
  MENU_KEYS.INVENTORY_TAXES,
  MENU_KEYS.INVENTORY_SUPPLIERS,
  MENU_KEYS.INVENTORY_PROMOTIONS,
]);

const hasOperationalAdminRole = (roles: string[] | undefined) =>
  roles?.some((role) => role === "ADMIN" || role === "SUPER_USER") ?? false;

const hasOperationalRoleOverride = (
  roles: string[] | undefined,
  requiredPermission: RequiredPermission
) =>
  requiredPermission.operationalRoles?.some((role) => roles?.includes(role)) ??
  false;

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(AccessControlService)
    private readonly accessControlService: AccessControlService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermission = this.reflector.getAllAndOverride<RequiredPermission>(
      PERMISSION_KEY,
      [context.getHandler(), context.getClass()]
    );

    if (!requiredPermission) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user as {
      id?: string;
      tenantId?: string;
      roles?: string[];
    } | undefined;

    if (!user?.id || !user?.tenantId) {
      throw new ForbiddenException("Permisos insuficientes");
    }
    if (user.roles?.includes("SUPER_ADMIN")) {
      return true;
    }
    const requiredMenuKeys = Array.isArray(requiredPermission.menuKey)
      ? requiredPermission.menuKey
      : [requiredPermission.menuKey];
    const expandedRequiredMenuKeys = new Set(
      requiredMenuKeys.flatMap((menuKey) => getMenuKeyCandidates(menuKey))
    );
    if (expandedRequiredMenuKeys.has(MENU_KEYS.CONFIG_ROLES)) {
      throw new ForbiddenException("Permisos insuficientes");
    }
    if (
      user.roles?.includes("SUPER_USER") &&
      Array.from(expandedRequiredMenuKeys).some(
        (menuKey) =>
          menuKey === MENU_KEYS.CONFIG_GENERAL ||
          menuKey === MENU_KEYS.CONFIG_TERMINALS ||
          menuKey === MENU_KEYS.CONFIG_USUARIOS
      )
    ) {
      return true;
    }
    if (
      hasOperationalAdminRole(user.roles) &&
      Array.from(expandedRequiredMenuKeys).some((menuKey) =>
        OPERATIONAL_ADMIN_MENU_KEYS.has(menuKey)
      )
    ) {
      return true;
    }
    if (hasOperationalRoleOverride(user.roles, requiredPermission)) {
      return true;
    }

    const permissions = await this.accessControlService.getPermissionsForRequest(
      request,
      user.id,
      user.tenantId
    );
    const allowed = requiredMenuKeys.some((menuKey) => {
      const permission = this.accessControlService.findPermission(
        permissions,
        menuKey
      );
      return requiredPermission.action
        ? this.accessControlService.isActionAllowed(
            permission,
            requiredPermission.level,
            requiredPermission.action
          )
        : this.accessControlService.isAccessAllowed(permission, requiredPermission.level);
    });

    if (!allowed) {
      throw new ForbiddenException("Permisos insuficientes");
    }

    return true;
  }
}
