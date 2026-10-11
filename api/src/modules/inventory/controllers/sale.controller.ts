import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Inject,
  Logger,
  NotFoundException,
  Param,
  Post,
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
import { CreateSaleDeliveryDto } from "../../deliveries/dto/create-sale-delivery.dto";
import type { SaleLineRequest } from "../repositories/sale.repository";
import { SaleService } from "../services/sale.service";
import {
  logScaleObservationEvent,
  logWeightCaptureCreationFailure,
} from "../../scale-authorization/scale-observation-telemetry";

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
    cashSessionId?: string;
    sessionId?: string;
    roles?: string[];
  };
};

type CreateSaleBody = {
  customerId: string;
  orderId?: string | null;
  type: "CASH" | "CREDIT";
  items: SaleLineRequest[];
  payments?: Array<{
    paymentMethodId: string;
    amount: number;
    cashSessionId?: string | null;
    financialInstitutionId?: string | null;
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
  private readonly logger = new Logger(SaleController.name);

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
      return {
        roles: Array.isArray(request.user?.roles) ? request.user.roles : [],
        sessionId: request.user?.sessionId,
        ...request.context,
      };
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
      terminalId: context.terminalId,
      posSessionId: context.posSessionId,
      cashSessionId: context.cashSessionId,
    };
  }

  @Post("electronic-billing/batch")
  @RequirePermission({ menuKey: "POS", level: "WRITE" })
  requestElectronicBillingBatch(
    @Body() body: { saleIds?: string[] },
    @Req() request: AuthRequest,
  ) {
    if (!Array.isArray(body.saleIds) || body.saleIds.length === 0) {
      throw new BadRequestException("saleIds must contain at least one sale");
    }
    return this.saleService.requestElectronicBillingForSales(
      body.saleIds,
      this.buildActor(request),
    );
  }

  @Post(":id/electronic-billing")
  @RequirePermission({ menuKey: "POS", level: "WRITE", operationalRoles: ["USER"] })
  requestElectronicBilling(@Param("id") id: string, @Req() request: AuthRequest) {
    return this.saleService.requestElectronicBillingForSale(id, this.buildActor(request));
  }

  @Post(":id/electronic-billing/recover-failed-pre-provider")
  @RequirePermission({ menuKey: "POS", level: "WRITE" })
  recoverFailedPreProviderElectronicBilling(
    @Param("id") id: string,
    @Body() body: { eventId?: string },
    @Req() request: AuthRequest,
  ) {
    if (!body.eventId) {
      throw new BadRequestException("eventId is required");
    }
    return this.saleService.recoverFailedPreProviderElectronicBillingIntent(
      id,
      body.eventId,
      this.buildActor(request),
    );
  }

  @Post()
  @RequireOpenCashSession()
  @RequirePosSession()
  @RequirePermission({ menuKey: "POS", level: "WRITE" })
  create(
    @Body() body: CreateSaleBody,
    @Req() request: AuthRequest,
    @Headers("idempotency-key") idempotencyKey: string | string[] | undefined,
  ) {
    return this.saleService.createSale({
      customerId: body.customerId,
      orderId: body.orderId ?? null,
      type: body.type,
      items: body.items ?? [],
      payments: body.payments ?? [],
    }, this.getSaleContext(request), idempotencyKey);
  }

  @Post("weight-captures")
  @RequireOpenCashSession()
  @RequirePosSession()
  @RequirePermission({ menuKey: "POS", level: "WRITE" })
  async startWeightCapture(@Body() body: { productId?: string }, @Req() request: AuthRequest) {
    logScaleObservationEvent(this.logger, "weight_capture.create.received", undefined, "request_received");
    let stage = "request_validation";
    try {
      if (!body || typeof body.productId !== "string") throw new BadRequestException("productId is required");
      stage = "capture_creation";
      const result = await this.saleService.startWeightCapture(body.productId, this.getSaleContext(request));
      const captureId = typeof result?.captureId === "string"
        && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(result.captureId)
        ? result.captureId : undefined;
      logScaleObservationEvent(this.logger, "weight_capture.create.succeeded", captureId, "capture_created");
      return result;
    } catch (error) {
      logWeightCaptureCreationFailure(this.logger, undefined, stage, error);
      throw error;
    }
  }

  @Get("idempotency/:key")
  @RequirePermission({ menuKey: "POS", level: "READ" })
  getByIdempotencyKey(
    @Param("key") key: string,
    @Req() request: AuthRequest,
  ) {
    return this.saleService.getSaleByIdempotencyKey(key, this.buildActor(request));
  }

  @Get()
  @RequirePermission({ menuKey: "POS", level: "READ" })
  list(
    @Query("customerId") customerId: string | undefined,
    @Query("branchId") branchId: string | undefined,
    @Req() request: AuthRequest
  ) {
    return this.saleService.getSales(this.buildActor(request), {
      customerId,
      branchId,
    });
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
  @RequireOpenCashSession()
  @RequirePermission({ menuKey: "POS", level: "WRITE" })
  cancel(@Param("id") id: string, @Req() request: AuthRequest) {
    return this.saleService.cancelSale(id, this.buildActor(request));
  }
}
