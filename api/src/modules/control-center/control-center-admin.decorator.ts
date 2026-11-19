import { applyDecorators, UseGuards } from "@nestjs/common";
import { Roles } from "../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { PlatformTenantGuard } from "../../common/guards/platform-tenant.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { ControlCenterEnabledGuard } from "./control-center-enabled.guard";

/** Cadena de autorización obligatoria de todo controller del Control Center. */
export const ControlCenterAdmin = () =>
  applyDecorators(
    UseGuards(JwtAuthGuard, RolesGuard, PlatformTenantGuard, ControlCenterEnabledGuard),
    Roles("SUPER_ADMIN"),
  );
