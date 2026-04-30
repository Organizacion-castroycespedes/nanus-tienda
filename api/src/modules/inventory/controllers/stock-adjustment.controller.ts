import {
  Body,
  Controller,
  Inject,
  NotFoundException,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import crypto from "crypto";
import type { Request } from "express";
import { Roles } from "../../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../../common/guards/roles.guard";
import { StockMovementService } from "../services/stock-movement.service";

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
};

@Controller("stock-adjustments")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("SUPER_ADMIN", "SUPER_USER")
export class StockAdjustmentController {
  constructor(
    @Inject(StockMovementService)
    private readonly stockMovementService: StockMovementService
  ) {}

  private getTenantId(request: AuthRequest) {
    const tenantId = request.context?.tenantId ?? request.user?.tenantId;
    if (!tenantId) {
      throw new NotFoundException("tenant not found in request context");
    }
    return tenantId;
  }

  @Post()
  create(@Body() body: CreateStockAdjustmentBody, @Req() request: AuthRequest) {
    return this.stockMovementService.createMovement({
      id: crypto.randomUUID(),
      tenantId: this.getTenantId(request),
      productId: body.productId,
      type: body.type,
      quantity: Number(body.quantity),
      referenceType: "ADJUSTMENT",
      referenceId: crypto.randomUUID(),
      branchId: body.branchId,
      terminalId: request.context?.terminalId ?? null,
      posSessionCode: request.context?.posSessionId ?? null,
      userId: request.context?.userId ?? request.user?.id ?? null,
      referenceTable: "stock_adjustments",
      createdAt: new Date(),
    });
  }
}
