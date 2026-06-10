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
import { MENU_KEYS } from "../constants/menu-keys";

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
    if (
      user.roles?.includes("SUPER_USER") &&
      requiredMenuKeys.some(
        (menuKey) =>
          menuKey === MENU_KEYS.CONFIG_GENERAL ||
          menuKey === MENU_KEYS.CONFIG_USUARIOS ||
          menuKey === MENU_KEYS.CONFIG_ROLES
      )
    ) {
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
