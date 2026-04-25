import { Controller, Get, Query } from "@nestjs/common";
import { PermissionsService } from "./permissions.service";

@Controller("permissions")
export class PermissionsController {
  constructor(private readonly permissionsService: PermissionsService) {}

  @Get("menu")
  getMenu(@Query("roleId") roleId: string, @Query("tenantId") tenantId: string) {
    return this.permissionsService.getMenuByRole(roleId, tenantId);
  }
}
