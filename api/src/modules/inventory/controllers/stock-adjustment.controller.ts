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
import { JwtAuthGuard } from "../../../common/guards/jwt-auth.guard";
import { StockMovementService } from "../services/stock-movement.service";

type AuthRequest = Request & {
  user?: {
    tenantId?: string;
  };
};

type CreateStockAdjustmentBody = {
  productId: string;
  type: "IN" | "OUT";
  quantity: number;
  reason: string;
};

@Controller("stock-adjustments")
@UseGuards(JwtAuthGuard)
export class StockAdjustmentController {
  constructor(
    @Inject(StockMovementService)
    private readonly stockMovementService: StockMovementService
  ) {}

  private getTenantId(request: AuthRequest) {
    const tenantId = request.user?.tenantId;
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
      createdAt: new Date(),
    });
  }
}
