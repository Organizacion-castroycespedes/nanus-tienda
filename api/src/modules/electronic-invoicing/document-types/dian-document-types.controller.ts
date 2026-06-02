import { Controller, Get, UseGuards } from "@nestjs/common";
import { Roles } from "../../../common/decorators/roles.decorator";
import { RequirePermission } from "../../../common/decorators/require-permission.decorator";
import { MENU_KEYS } from "../../../common/constants/menu-keys";
import { JwtAuthGuard } from "../../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../../common/guards/roles.guard";
import { PermissionsGuard } from "../../../common/guards/permissions.guard";
import { DianDocumentTypesService } from "./dian-document-types.service";

@Controller("electronic-invoicing/document-types")
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Roles("SUPER_ADMIN", "SUPER_USER", "ADMIN", "USER")
export class DianDocumentTypesController {
  constructor(private readonly documentTypesService: DianDocumentTypesService) {}

  @Get()
  @RequirePermission({ menuKey: MENU_KEYS.ELECTRONIC_INVOICING_CUSTOMERS, level: "READ" })
  listActive() {
    return this.documentTypesService.listActive();
  }
}
