import {
  Body,
  Controller,
  Get,
  Inject,
  NotFoundException,
  Param,
  Post,
  Put,
  Req,
  UseGuards,
} from "@nestjs/common";
import type { Request } from "express";
import { JwtAuthGuard } from "../../../common/guards/jwt-auth.guard";
import { PurchaseService } from "../services/purchase.service";

type AuthRequest = Request & {
  user?: {
    tenantId?: string;
  };
};

type CreatePurchaseBody = {
  supplierId: string;
  type?: "CASH" | "CREDIT";
  total: number;
  balance?: number;
  items: Array<{
    id?: string;
    productId: string;
    quantity: number;
    cost: number;
    subtotal: number;
  }>;
};

type UpdatePurchaseBody = Partial<CreatePurchaseBody> & {
  status?: "DRAFT" | "PENDING";
};

type ReceivePurchaseBody = {
  items: Array<{
    product_id: string;
    quantity: number;
  }>;
};

@Controller("purchases")
@UseGuards(JwtAuthGuard)
export class PurchaseController {
  constructor(
    @Inject(PurchaseService)
    private readonly purchaseService: PurchaseService
  ) {}

  private getTenantId(request: AuthRequest) {
    const tenantId = request.user?.tenantId;
    if (!tenantId) {
      throw new NotFoundException("tenant not found in request context");
    }
    return tenantId;
  }

  @Post()
  create(@Body() body: CreatePurchaseBody, @Req() request: AuthRequest) {
    return this.purchaseService.createPurchase({
      tenantId: this.getTenantId(request),
      supplierId: body.supplierId,
      type: body.type,
      total: Number(body.total),
      balance: body.balance !== undefined ? Number(body.balance) : undefined,
      items: body.items ?? [],
    });
  }

  @Put(":id")
  update(
    @Param("id") id: string,
    @Body() body: UpdatePurchaseBody,
    @Req() request: AuthRequest
  ) {
    return this.purchaseService.updatePurchase(id, this.getTenantId(request), {
      supplierId: body.supplierId,
      type: body.type,
      total: body.total !== undefined ? Number(body.total) : undefined,
      balance: body.balance !== undefined ? Number(body.balance) : undefined,
      status: body.status,
      items: body.items,
    });
  }

  @Get()
  list(@Req() request: AuthRequest) {
    return this.purchaseService.getPurchases(this.getTenantId(request));
  }

  @Get(":id")
  getById(@Param("id") id: string, @Req() request: AuthRequest) {
    return this.purchaseService.getPurchaseById(id, this.getTenantId(request));
  }

  @Post(":id/receive")
  receive(
    @Param("id") id: string,
    @Body() body: ReceivePurchaseBody,
    @Req() request: AuthRequest
  ) {
    return this.purchaseService.receivePurchase(
      id,
      this.getTenantId(request),
      (body.items ?? []).map((item) => ({
        productId: item.product_id,
        quantity: Number(item.quantity),
      }))
    );
  }
}
