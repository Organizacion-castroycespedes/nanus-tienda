import {
  Body,
  Controller,
  Get,
  Inject,
  NotFoundException,
  Param,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import type { Request } from "express";
import { JwtAuthGuard } from "../../../common/guards/jwt-auth.guard";
import { SaleService } from "../services/sale.service";

type AuthRequest = Request & {
  user?: {
    tenantId?: string;
  };
};

type CreateSaleBody = {
  customerId: string;
  orderId?: string | null;
  type: "CASH" | "CREDIT";
  items: Array<{
    productId: string;
    quantity: number;
    price: number;
    orderItemId?: string | null;
  }>;
  paymentMethods?: Array<{
    paymentMethod: "CASH" | "CARD" | "TRANSFER" | "OTHER";
    amount: number;
    reference?: string | null;
  }>;
};

@Controller("sales")
@UseGuards(JwtAuthGuard)
export class SaleController {
  constructor(
    @Inject(SaleService)
    private readonly saleService: SaleService
  ) {}

  private getTenantId(request: AuthRequest) {
    const tenantId = request.user?.tenantId;
    if (!tenantId) {
      throw new NotFoundException("tenant not found in request context");
    }
    return tenantId;
  }

  @Post()
  create(@Body() body: CreateSaleBody, @Req() request: AuthRequest) {
    return this.saleService.createSale({
      tenantId: this.getTenantId(request),
      customerId: body.customerId,
      orderId: body.orderId ?? null,
      type: body.type,
      items: body.items ?? [],
      paymentMethods: body.paymentMethods ?? [],
    });
  }

  @Get()
  list(@Req() request: AuthRequest) {
    return this.saleService.getSales(this.getTenantId(request));
  }

  @Get(":id")
  getById(@Param("id") id: string, @Req() request: AuthRequest) {
    return this.saleService.getSaleById(id, this.getTenantId(request));
  }

  @Post(":id/cancel")
  cancel(@Param("id") id: string, @Req() request: AuthRequest) {
    return this.saleService.cancelSale(id, this.getTenantId(request));
  }
}
