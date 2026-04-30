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
    if (
      user.roles?.includes("SUPER_USER") &&
      (requiredPermission.menuKey === MENU_KEYS.CONFIG_GENERAL ||
        requiredPermission.menuKey === MENU_KEYS.CONFIG_USUARIOS)
    ) {
      return true;
    }

    const permissions = await this.accessControlService.getPermissionsForRequest(
      request,
      user.id,
      user.tenantId
    );
    const permission = this.accessControlService.findPermission(
      permissions,
      requiredPermission.menuKey
    );
    if (!this.accessControlService.isAccessAllowed(permission, requiredPermission.level)) {
      throw new ForbiddenException("Permisos insuficientes");
    }

    return true;
  }
}
