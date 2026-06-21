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
  UsePipes,
  ValidationPipe,
} from "@nestjs/common";
import type { Request } from "express";
import { MENU_KEYS } from "../../../common/constants/menu-keys";
import { RequirePermission } from "../../../common/decorators/require-permission.decorator";
import { RequirePosSession } from "../../../common/decorators/require-pos-session.decorator";
import { Roles } from "../../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../../../common/guards/permissions.guard";
import { RolesGuard } from "../../../common/guards/roles.guard";
import { DELIVERY_PERMISSION_ACTIONS } from "../../deliveries/deliveries.constants";
import { DeliveriesService } from "../../deliveries/deliveries.service";
import { CreateSaleDeliveryDto } from "../../deliveries/dto/create-sale-delivery.dto";
import { SaleService } from "../services/sale.service";

type AuthRequest = Request & {
  user?: {
    tenantId?: string;
    id?: string;
    sessionId?: string;
    roles?: string[];
  };
  context?: {
    userId?: string;
    tenantId?: string;
    branchId?: string;
    terminalId?: string;
    posSessionId?: string;
    sessionId?: string;
    roles?: string[];
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
  payments?: Array<{
    paymentMethodId: string;
    amount: number;
    cashSessionId?: string | null;
    referenceNumber?: string | null;
    notes?: string | null;
  }>;
};

const saleDeliveryValidationPipe = new ValidationPipe({
  transform: true,
  whitelist: true,
  forbidNonWhitelisted: true,
});

@Controller("sales")
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Roles("SUPER_ADMIN", "SUPER_USER", "ADMIN", "USER")
export class SaleController {
  constructor(
    @Inject(SaleService)
    private readonly saleService: SaleService,
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
      roles: Array.isArray(request.user?.roles) ? request.user.roles : [],
    };
  }

  private buildActor(request: AuthRequest) {
    const context = this.getSaleContext(request);
    return {
      roles: Array.isArray(context.roles) ? context.roles : [],
      userId: context.userId,
      tenantId: context.tenantId,
      branchId: context.branchId,
    };
  }

  @Post()
  @RequirePosSession()
  @RequirePermission({ menuKey: "POS", level: "WRITE" })
  create(@Body() body: CreateSaleBody, @Req() request: AuthRequest) {
    return this.saleService.createSale({
      customerId: body.customerId,
      orderId: body.orderId ?? null,
      type: body.type,
      items: body.items ?? [],
      payments: body.payments ?? [],
    }, this.getSaleContext(request));
  }

  @Get()
  @RequirePermission({ menuKey: "POS", level: "READ" })
  list(@Req() request: AuthRequest) {
    return this.saleService.getSales(this.buildActor(request));
  }

  @Get(":id")
  @RequirePermission({ menuKey: "POS", level: "READ" })
  getById(@Param("id") id: string, @Req() request: AuthRequest) {
    return this.saleService.getSaleById(id, this.buildActor(request));
  }

  @Get(":id/delivery")
  @RequirePermission({
    menuKey: MENU_KEYS.DELIVERIES,
    level: "READ",
    action: DELIVERY_PERMISSION_ACTIONS.VIEW,
  })
  getDelivery(@Param("id") id: string, @Req() request: AuthRequest) {
    return this.deliveriesService.getBySale(id, this.buildActor(request));
  }

  @Post(":id/delivery")
  @RequirePermission({
    menuKey: MENU_KEYS.DELIVERIES,
    level: "WRITE",
    action: DELIVERY_PERMISSION_ACTIONS.CREATE,
  })
  @UsePipes(saleDeliveryValidationPipe)
  createDelivery(
    @Param("id") id: string,
    @Body() body: CreateSaleDeliveryDto,
    @Req() request: AuthRequest
  ) {
    return this.deliveriesService.createFromSale(
      id,
      body,
      this.buildActor(request)
    );
  }

  @Post(":id/cancel")
  @RequirePermission({ menuKey: "POS", level: "WRITE" })
  cancel(@Param("id") id: string, @Req() request: AuthRequest) {
    return this.saleService.cancelSale(id, this.buildActor(request));
  }
}
