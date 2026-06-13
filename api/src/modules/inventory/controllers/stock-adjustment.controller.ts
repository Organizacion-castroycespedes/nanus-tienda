import {
  Body,
  Controller,
  Inject,
  NotFoundException,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import type { Request } from "express";
import { RequirePermission } from "../../../common/decorators/require-permission.decorator";
import { Roles } from "../../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../../../common/guards/permissions.guard";
import { RolesGuard } from "../../../common/guards/roles.guard";
import { StockAdjustmentService } from "../services/stock-adjustment.service";

type AuthRequest = Request & {
  user?: {
    tenantId?: string;
    id?: string;
    roles?: string[];
  };
  context?: {
    tenantId?: string;
    branchId?: string;
    terminalId?: string;
    posSessionId?: string;
    userId?: string;
  };
};

type CreateStockAdjustmentBody = {
  productId: string;
  branchId: string;
  type: "IN" | "OUT";
  quantity: number;
  reason: string;
  lotCode?: string | null;
  expirationDate?: string | null;
  locationId?: string | null;
  unitCost?: number;
};

@Controller("stock-adjustments")
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Roles("SUPER_ADMIN", "SUPER_USER")
export class StockAdjustmentController {
  constructor(
    @Inject(StockAdjustmentService)
    private readonly stockAdjustmentService: StockAdjustmentService
  ) {}

  private getTenantId(request: AuthRequest) {
    const tenantId = request.context?.tenantId ?? request.user?.tenantId;
    if (!tenantId) {
      throw new NotFoundException("tenant not found in request context");
    }
    return tenantId;
  }

  @Post()
  @RequirePermission({ menuKey: "INVENTORY", level: "WRITE" })
  create(@Body() body: CreateStockAdjustmentBody, @Req() request: AuthRequest) {
    return this.stockAdjustmentService.create({
      tenantId: this.getTenantId(request),
      productId: body.productId,
      branchId: body.branchId,
      type: body.type,
      quantity: Number(body.quantity),
      reason: body.reason,
      lotCode: body.lotCode,
      expirationDate: body.expirationDate,
      locationId: body.locationId,
      unitCost:
        body.unitCost === undefined ? undefined : Number(body.unitCost),
      context: {
        tenantId: this.getTenantId(request),
        branchId: body.branchId,
        terminalId: request.context?.terminalId ?? null,
        posSessionId: request.context?.posSessionId ?? null,
        userId: request.context?.userId ?? request.user?.id ?? null,
      },
    });
  }
}
