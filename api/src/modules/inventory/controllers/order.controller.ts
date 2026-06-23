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
  UsePipes,
  ValidationPipe,
} from "@nestjs/common";
import type { Request } from "express";
import { MENU_KEYS } from "../../../common/constants/menu-keys";
import { RequirePermission } from "../../../common/decorators/require-permission.decorator";
import { RequireOpenCashSession } from "../../../common/decorators/require-open-cash-session.decorator";
import { RequirePosSession } from "../../../common/decorators/require-pos-session.decorator";
import { Roles } from "../../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../../../common/guards/permissions.guard";
import { RolesGuard } from "../../../common/guards/roles.guard";
import { DELIVERY_PERMISSION_ACTIONS } from "../../deliveries/deliveries.constants";
import { DeliveriesService } from "../../deliveries/deliveries.service";
import { CreateOrderDeliveryDto } from "../../deliveries/dto/create-order-delivery.dto";
import { OrderService } from "../services/order.service";

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

type CreateOrderBody = {
  customerId: string;
  branchId?: string;
  terminalId?: string;
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

type DeliverOrderBody = {
  items: Array<{
    product_id: string;
    quantity: number;
  }>;
};

type InvoiceOrderBody = {
  type: "CASH" | "CREDIT";
  payments?: Array<{
    paymentMethodId: string;
    amount: number;
    cashSessionId?: string | null;
    referenceNumber?: string | null;
    notes?: string | null;
  }>;
};

const orderDeliveryValidationPipe = new ValidationPipe({
  transform: true,
  whitelist: true,
  forbidNonWhitelisted: true,
});

@Controller("orders")
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class OrderController {
  constructor(
    @Inject(OrderService)
    private readonly orderService: OrderService,
    @Inject(DeliveriesService)
    private readonly deliveriesService: DeliveriesService
  ) {}

  private getTenantId(request: AuthRequest) {
    const tenantId = request.context?.tenantId ?? request.user?.tenantId;
    if (!tenantId) {
      throw new NotFoundException("tenant not found in request context");
    }
    return tenantId;
  }

  private getInventoryContext(
    request: AuthRequest,
    fallback?: { branchId?: string | null; terminalId?: string | null }
  ) {
    return {
      tenantId: this.getTenantId(request),
      branchId: request.context?.branchId ?? fallback?.branchId ?? null,
      terminalId: request.context?.terminalId ?? fallback?.terminalId ?? null,
      posSessionId: request.context?.posSessionId ?? null,
      userId: request.context?.userId ?? request.user?.id ?? null,
    };
  }

  private buildActor(request: AuthRequest) {
    return {
      roles: Array.isArray(request.user?.roles) ? request.user.roles : [],
      userId: request.context?.userId ?? request.user?.id,
      tenantId: this.getTenantId(request),
      branchId: request.context?.branchId,
      terminalId: request.context?.terminalId,
      posSessionId: request.context?.posSessionId,
    };
  }

  @Post()
  @RequireOpenCashSession()
  @Roles("SUPER_ADMIN", "SUPER_USER", "ADMIN", "USER")
  @RequirePermission({ menuKey: "ORDERS", level: "WRITE" })
  create(@Body() body: CreateOrderBody, @Req() request: AuthRequest) {
    return this.orderService.createOrder({
      tenantId: this.getTenantId(request),
      customerId: body.customerId,
      branchId: body.branchId,
      type: body.type,
      total: Number(body.total),
      items: body.items ?? [],
      context: this.getInventoryContext(request, {
        branchId: body.branchId ?? null,
        terminalId: body.terminalId ?? null,
      }),
      actor: this.buildActor(request),
    });
  }

  @Get()
  @Roles("SUPER_ADMIN", "SUPER_USER", "ADMIN", "USER")
  @RequirePermission({ menuKey: "ORDERS", level: "READ" })
  list(
    @Query("tenantId") tenantId: string | undefined,
    @Query("branchId") branchId: string | undefined,
    @Query("fromDate") fromDate: string | undefined,
    @Query("toDate") toDate: string | undefined,
    @Query("paymentMethod") paymentMethod: string | undefined,
    @Query("customerId") customerId: string | undefined,
    @Req() request: AuthRequest
  ) {
    return this.orderService.getOrders(
      {
        tenantId,
        branchId,
        fromDate,
        toDate,
        paymentMethod,
        customerId,
      },
      this.buildActor(request)
    );
  }

  @Get(":id/delivery")
  @Roles("SUPER_ADMIN", "SUPER_USER", "ADMIN", "USER")
  @RequirePermission({
    menuKey: MENU_KEYS.DELIVERIES,
    level: "READ",
    action: DELIVERY_PERMISSION_ACTIONS.VIEW,
  })
  getDelivery(@Param("id") id: string, @Req() request: AuthRequest) {
    return this.deliveriesService.getByOrder(id, this.buildActor(request));
  }

  @Post(":id/delivery")
  @Roles("SUPER_ADMIN", "SUPER_USER", "ADMIN", "USER")
  @RequirePermission({
    menuKey: MENU_KEYS.DELIVERIES,
    level: "WRITE",
    action: DELIVERY_PERMISSION_ACTIONS.CREATE,
  })
  @UsePipes(orderDeliveryValidationPipe)
  createDelivery(
    @Param("id") id: string,
    @Body() body: CreateOrderDeliveryDto,
    @Req() request: AuthRequest
  ) {
    return this.deliveriesService.createFromOrder(
      id,
      body,
      this.buildActor(request)
    );
  }

  @Get(":id")
  @Roles("SUPER_ADMIN", "SUPER_USER", "ADMIN", "USER")
  @RequirePermission({ menuKey: "ORDERS", level: "READ" })
  getById(@Param("id") id: string, @Req() request: AuthRequest) {
    return this.orderService.getOrderById(
      id,
      this.getTenantId(request),
      this.buildActor(request)
    );
  }

  @Put(":id")
  @RequireOpenCashSession()
  @Roles("SUPER_ADMIN", "SUPER_USER", "ADMIN", "USER")
  @RequirePermission({ menuKey: "ORDERS", level: "WRITE" })
  update(
    @Param("id") id: string,
    @Body() body: UpdateOrderBody,
    @Req() request: AuthRequest
  ) {
    return this.orderService.updateOrder(
      id,
      this.getTenantId(request),
      {
        customerId: body.customerId,
        branchId: body.branchId,
        type: body.type,
        total: body.total !== undefined ? Number(body.total) : undefined,
        status: body.status,
        items: body.items,
      },
      this.buildActor(request)
    );
  }

  @Post(":id/deliver")
  @RequireOpenCashSession()
  @Roles("SUPER_ADMIN", "SUPER_USER", "ADMIN", "USER")
  @RequirePermission({ menuKey: "ORDERS", level: "WRITE" })
  deliver(
    @Param("id") id: string,
    @Body() body: DeliverOrderBody,
    @Req() request: AuthRequest
  ) {
    return this.orderService.deliverOrder(
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

  @Post(":id/confirm")
  @RequireOpenCashSession()
  @Roles("SUPER_ADMIN", "SUPER_USER", "ADMIN", "USER")
  @RequirePermission({ menuKey: "ORDERS", level: "WRITE" })
  confirm(@Param("id") id: string, @Req() request: AuthRequest) {
    return this.orderService.confirmOrder(
      id,
      this.getTenantId(request),
      this.getInventoryContext(request),
      this.buildActor(request)
    );
  }

  @Post(":id/invoice")
  @RequireOpenCashSession()
  @Roles("SUPER_ADMIN", "SUPER_USER", "ADMIN", "USER")
  @RequirePosSession()
  @RequirePermission({ menuKey: "ORDERS", level: "WRITE" })
  invoice(
    @Param("id") id: string,
    @Body() body: InvoiceOrderBody,
    @Req() request: AuthRequest
  ) {
    return this.orderService.invoiceOrder(
      id,
      this.getTenantId(request),
      {
        type: body.type,
        payments: body.payments ?? [],
      },
      this.getInventoryContext(request),
      this.buildActor(request)
    );
  }

  @Post(":id/cancel")
  @RequireOpenCashSession()
  @Roles("SUPER_ADMIN", "SUPER_USER", "ADMIN", "USER")
  @RequirePermission({ menuKey: "ORDERS", level: "WRITE" })
  cancel(@Param("id") id: string, @Req() request: AuthRequest) {
    return this.orderService.cancelOrder(
      id,
      this.getTenantId(request),
      this.buildActor(request)
    );
  }
}
