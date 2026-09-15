import { Controller, Get, Inject, Query, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import { RequirePermission } from "../../common/decorators/require-permission.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { OperationalSalesService } from "./operational-sales.service";
import type { OperationalDashboardQueryDto } from "./dto/operational-dashboard-query.dto";

type OperationalRequest = Request & { user?: { id?: string; tenantId?: string; roles?: string[] }; context?: { tenantId?: string; branchId?: string; terminalId?: string; posSessionId?: string; cashSessionId?: string; userId?: string; roles?: string[] } };

@Controller("operations")
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Roles("SUPER_ADMIN", "SUPER_USER", "ADMIN", "USER")
export class OperationalDashboardController {
  constructor(@Inject(OperationalSalesService) private readonly service: OperationalSalesService) {}

  @Get("dashboard")
  @RequirePermission({ menuKey: "POS", level: "READ" })
  dashboard(@Query() query: OperationalDashboardQueryDto, @Req() request: OperationalRequest) {
    const context = request.context;
    const tenantId = context?.tenantId ?? request.user?.tenantId;
    const userId = context?.userId ?? request.user?.id;
    if (!tenantId || !userId) throw new Error("authenticated operational actor required");
    return this.service.dashboard({ id: userId, tenantId, roles: context?.roles ?? request.user?.roles ?? [], branchId: context?.branchId, terminalId: context?.terminalId, posSessionId: context?.posSessionId, cashSessionId: context?.cashSessionId }, query);
  }
}
