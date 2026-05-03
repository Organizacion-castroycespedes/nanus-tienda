import {
  Controller,
  Get,
  Inject,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import type { Request } from "express";
import { RequirePermission } from "../../../common/decorators/require-permission.decorator";
import { Roles } from "../../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../../../common/guards/permissions.guard";
import { RolesGuard } from "../../../common/guards/roles.guard";
import { InventoryService } from "../services/inventory.service";

type AuthRequest = Request & {
  user?: {
    id?: string;
    tenantId?: string;
    roles?: string[];
  };
  context?: {
    userId?: string;
    tenantId?: string;
    branchId?: string;
    terminalId?: string;
    posSessionId?: string;
  };
};

@Controller("inventory")
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Roles("SUPER_ADMIN", "SUPER_USER", "ADMIN", "USER")
export class InventoryController {
  constructor(
    @Inject(InventoryService)
    private readonly inventoryService: InventoryService
  ) {}

  private buildActor(request: AuthRequest) {
    return {
      roles: Array.isArray(request.user?.roles) ? request.user.roles : [],
      userId: request.context?.userId ?? request.user?.id,
      tenantId: request.context?.tenantId ?? request.user?.tenantId,
      branchId: request.context?.branchId,
      terminalId: request.context?.terminalId,
      posSessionId: request.context?.posSessionId,
    };
  }

  @Get("products")
  @RequirePermission({ menuKey: "INVENTORY_PRODUCTS", level: "READ" })
  listProducts(
    @Query("tenantId") tenantId: string | undefined,
    @Query("branchId") branchId: string | undefined,
    @Req() request: AuthRequest
  ) {
    return this.inventoryService.listInventoryProducts(
      {
        tenantId,
        branchId,
      },
      this.buildActor(request)
    );
  }

  @Get("dashboard")
  @RequirePermission({ menuKey: "INVENTORY", level: "READ" })
  getDashboard(
    @Query("tenantId") tenantId: string | undefined,
    @Query("branchId") branchId: string | undefined,
    @Query("terminalId") terminalId: string | undefined,
    @Query("cashSessionId") cashSessionId: string | undefined,
    @Query("startDate") startDate: string | undefined,
    @Query("endDate") endDate: string | undefined,
    @Req() request: AuthRequest
  ) {
    return this.inventoryService.getInventoryDashboard(
      {
        tenantId,
        branchId,
        terminalId,
        cashSessionId,
        startDate,
        endDate,
      },
      this.buildActor(request)
    );
  }
}
