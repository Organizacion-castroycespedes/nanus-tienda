import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { Roles } from "../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { PermissionsService } from "./permissions.service";

@Controller("permissions")
@UseGuards(JwtAuthGuard, RolesGuard)
export class PermissionsController {
  constructor(private readonly permissionsService: PermissionsService) {}

  @Get("menu")
  @Roles("SUPER_ADMIN")
  getMenu(@Query("roleId") roleId: string, @Query("tenantId") tenantId: string) {
    return this.permissionsService.getMenuByRole(roleId, tenantId);
  }
}
