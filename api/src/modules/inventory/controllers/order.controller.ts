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
import { OrderService } from "../services/order.service";

type AuthRequest = Request & {
  user?: {
    tenantId?: string;
  };
};

type CreateOrderBody = {
  customerId: string;
  type?: "CASH" | "CREDIT";
  total: number;
  items: Array<{
    id?: string;
    productId: string;
    quantity?: number;
    orderedQuantity?: number;
    deliveredQuantity?: number;
    price: number;
    subtotal: number;
  }>;
};

type UpdateOrderBody = Partial<CreateOrderBody> & {
  status?: "DRAFT";
};

@Controller("orders")
@UseGuards(JwtAuthGuard)
export class OrderController {
  constructor(
    @Inject(OrderService)
    private readonly orderService: OrderService
  ) {}

  private getTenantId(request: AuthRequest) {
    const tenantId = request.user?.tenantId;
    if (!tenantId) {
      throw new NotFoundException("tenant not found in request context");
    }
    return tenantId;
  }

  @Post()
  create(@Body() body: CreateOrderBody, @Req() request: AuthRequest) {
    return this.orderService.createOrder({
      tenantId: this.getTenantId(request),
      customerId: body.customerId,
      type: body.type,
      total: Number(body.total),
      items: body.items ?? [],
    });
  }

  @Get()
  list(@Req() request: AuthRequest) {
    return this.orderService.getOrders(this.getTenantId(request));
  }

  @Get(":id")
  getById(@Param("id") id: string, @Req() request: AuthRequest) {
    return this.orderService.getOrderById(id, this.getTenantId(request));
  }

  @Put(":id")
  update(
    @Param("id") id: string,
    @Body() body: UpdateOrderBody,
    @Req() request: AuthRequest
  ) {
    return this.orderService.updateOrder(id, this.getTenantId(request), {
      customerId: body.customerId,
      type: body.type,
      total: body.total !== undefined ? Number(body.total) : undefined,
      status: body.status,
      items: body.items,
    });
  }

  @Post(":id/confirm")
  confirm(@Param("id") id: string, @Req() request: AuthRequest) {
    return this.orderService.confirmOrder(id, this.getTenantId(request));
  }

  @Post(":id/cancel")
  cancel(@Param("id") id: string, @Req() request: AuthRequest) {
    return this.orderService.cancelOrder(id, this.getTenantId(request));
  }
}
