import {
  BadRequestException,
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
    id?: string;
    sessionId?: string;
  };
  context?: {
    userId?: string;
    tenantId?: string;
    branchId?: string;
    terminalId?: string;
    posSessionId?: string;
    sessionId?: string;
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
    const tenantId = request.context?.tenantId ?? request.user?.tenantId;
    if (!tenantId) {
      throw new NotFoundException("tenant not found in request context");
    }
    return tenantId;
  }

  private getSaleContext(request: AuthRequest) {
    if (request.context) {
      return request.context;
    }

    const tenantId = request.user?.tenantId;
    const userId = request.user?.id;
    if (!tenantId || !userId) {
      throw new BadRequestException("sale context not found in request");
    }

    return {
      tenantId,
      userId,
      sessionId: request.user?.sessionId,
    };
  }

  @Post()
  create(@Body() body: CreateSaleBody, @Req() request: AuthRequest) {
    return this.saleService.createSale({
      customerId: body.customerId,
      orderId: body.orderId ?? null,
      type: body.type,
      items: body.items ?? [],
      paymentMethods: body.paymentMethods ?? [],
    }, this.getSaleContext(request));
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
