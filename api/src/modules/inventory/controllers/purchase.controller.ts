import {
  Body,
  Controller,
    Get,
    Inject,
    NotFoundException,
    Param,
    Post,
    Put,
    Query,
    Req,
    UseGuards,
  } from "@nestjs/common";
import type { Request } from "express";
import { JwtAuthGuard } from "../../../common/guards/jwt-auth.guard";
import { PurchaseService } from "../services/purchase.service";

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

type CreatePurchaseBody = {
  supplierId: string;
  branchId?: string;
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
    const tenantId = request.context?.tenantId ?? request.user?.tenantId;
    if (!tenantId) {
      throw new NotFoundException("tenant not found in request context");
    }
    return tenantId;
  }

  private getInventoryContext(request: AuthRequest) {
    return {
      tenantId: this.getTenantId(request),
      branchId: request.context?.branchId ?? null,
      terminalId: request.context?.terminalId ?? null,
      posSessionId: request.context?.posSessionId ?? null,
      userId: request.context?.userId ?? request.user?.id ?? null,
    };
  }

  private buildActor(request: AuthRequest) {
    return {
      roles: Array.isArray(request.user?.roles) ? request.user.roles : [],
      tenantId: this.getTenantId(request),
      branchId: request.context?.branchId,
    };
  }

  @Post()
  create(@Body() body: CreatePurchaseBody, @Req() request: AuthRequest) {
    return this.purchaseService.createPurchase({
      tenantId: this.getTenantId(request),
      supplierId: body.supplierId,
      branchId: body.branchId,
      type: body.type,
      total: Number(body.total),
      balance: body.balance !== undefined ? Number(body.balance) : undefined,
      items: body.items ?? [],
      context: this.getInventoryContext(request),
      actor: this.buildActor(request),
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
  list(
    @Query("tenantId") tenantId: string | undefined,
    @Query("branchId") branchId: string | undefined,
    @Req() request: AuthRequest
  ) {
    return this.purchaseService.getPurchases(
      {
        tenantId,
        branchId,
      },
      this.buildActor(request)
    );
  }

  @Get(":id")
  getById(@Param("id") id: string, @Req() request: AuthRequest) {
    return this.purchaseService.getPurchaseById(
      id,
      this.getTenantId(request),
      this.buildActor(request)
    );
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
      })),
      this.getInventoryContext(request),
      this.buildActor(request)
    );
  }
}
