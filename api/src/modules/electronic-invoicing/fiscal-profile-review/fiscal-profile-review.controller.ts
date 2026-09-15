import { Controller, Get, Inject, Query, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import { MENU_KEYS } from "../../../common/constants/menu-keys";
import { RequirePermission } from "../../../common/decorators/require-permission.decorator";
import { JwtAuthGuard } from "../../../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../../../common/guards/permissions.guard";
import { Roles } from "../../../common/decorators/roles.decorator";
import { RolesGuard } from "../../../common/guards/roles.guard";
import { FiscalProfileReviewService, type FiscalReviewFilters } from "./fiscal-profile-review.service";

type AuthRequest = Request & { user?: { tenantId?: string } };

@Controller("electronic-invoicing/fiscal-review")
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Roles("SUPER_ADMIN", "SUPER_USER", "ADMIN", "USER")
export class FiscalProfileReviewController {
  constructor(@Inject(FiscalProfileReviewService) private readonly service: FiscalProfileReviewService) {}

  private tenant(request: AuthRequest) {
    if (!request.user?.tenantId) throw new Error("tenant not found in request context");
    return request.user.tenantId;
  }

  @Get("customers")
  @RequirePermission({ menuKey: MENU_KEYS.ELECTRONIC_INVOICING_CUSTOMERS, level: "READ" })
  customers(@Req() request: AuthRequest, @Query() query: FiscalReviewFilters) {
    return this.service.list(this.tenant(request), "customer", query);
  }

  @Get("suppliers")
  @RequirePermission({ menuKey: MENU_KEYS.ELECTRONIC_INVOICING_SUPPLIERS, level: "READ" })
  suppliers(@Req() request: AuthRequest, @Query() query: FiscalReviewFilters) {
    return this.service.list(this.tenant(request), "supplier", query);
  }
}
