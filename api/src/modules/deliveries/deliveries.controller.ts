import {
  Body,
  Controller,
  Get,
  Inject,
  NotImplementedException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from "@nestjs/common";
import type { Request } from "express";
import { MENU_KEYS } from "../../common/constants/menu-keys";
import { RequirePermission } from "../../common/decorators/require-permission.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import { DELIVERY_PERMISSION_ACTIONS } from "./deliveries.constants";
import { DeliveriesService } from "./deliveries.service";
import { AssignDeliveryDto } from "./dto/assign-delivery.dto";
import { AssignDeliveryDriverDto } from "./dto/assign-delivery-driver.dto";
import { CancelDeliveryDto } from "./dto/cancel-delivery.dto";
import { CreateDeliveryDto } from "./dto/create-delivery.dto";
import { DispatchDeliveryDto } from "./dto/dispatch-delivery.dto";
import { MarkDeliveredDeliveryDto } from "./dto/mark-delivered-delivery.dto";
import { MarkNotDeliveredDeliveryDto } from "./dto/mark-not-delivered-delivery.dto";
import { QueryDeliveriesDto } from "./dto/query-deliveries.dto";
import { UpdateDeliveryDto } from "./dto/update-delivery.dto";

type DeliveriesRequest = Request & {
  user?: {
    id?: string;
    tenantId?: string;
    roles?: string[];
  };
  context?: {
    tenantId?: string;
    branchId?: string;
    userId?: string;
  };
};

const deliveriesValidationPipe = new ValidationPipe({
  transform: true,
  whitelist: true,
  forbidNonWhitelisted: true,
});

@Controller("deliveries")
@UseGuards(JwtAuthGuard, PermissionsGuard)
@UsePipes(deliveriesValidationPipe)
export class DeliveriesController {
  constructor(
    @Inject(DeliveriesService)
    private readonly deliveriesService: DeliveriesService
  ) {}

  private buildActor(request: DeliveriesRequest) {
    const tenantId = request.context?.tenantId ?? request.user?.tenantId;
    if (!tenantId) {
      throw new UnauthorizedException("Tenant no encontrado en la sesion");
    }

    return {
      tenantId,
      userId: request.context?.userId ?? request.user?.id,
      roles: Array.isArray(request.user?.roles) ? request.user.roles : [],
      branchId: request.context?.branchId,
    };
  }

  @Get()
  @RequirePermission({
    menuKey: MENU_KEYS.DELIVERIES,
    level: "READ",
    action: DELIVERY_PERMISSION_ACTIONS.VIEW,
  })
  list(@Query() query: QueryDeliveriesDto, @Req() request: DeliveriesRequest) {
    return this.deliveriesService.list(query, this.buildActor(request));
  }

  @Post()
  @RequirePermission({
    menuKey: MENU_KEYS.DELIVERIES,
    level: "WRITE",
    action: DELIVERY_PERMISSION_ACTIONS.CREATE,
  })
  create(@Body() payload: CreateDeliveryDto, @Req() request: DeliveriesRequest) {
    return this.deliveriesService.create(payload, this.buildActor(request));
  }

  @Get("reports/summary")
  @RequirePermission({
    menuKey: MENU_KEYS.DELIVERIES,
    level: "READ",
    action: DELIVERY_PERMISSION_ACTIONS.REPORTS,
  })
  getSummaryReport() {
    throw new NotImplementedException("Reporte de domicilios pendiente");
  }

  @Get(":id")
  @RequirePermission({
    menuKey: MENU_KEYS.DELIVERIES,
    level: "READ",
    action: DELIVERY_PERMISSION_ACTIONS.VIEW,
  })
  getById(
    @Param("id", ParseUUIDPipe) id: string,
    @Req() request: DeliveriesRequest
  ) {
    return this.deliveriesService.getById(id, this.buildActor(request));
  }

  @Patch(":id")
  @RequirePermission({
    menuKey: MENU_KEYS.DELIVERIES,
    level: "WRITE",
    action: DELIVERY_PERMISSION_ACTIONS.UPDATE,
  })
  update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() payload: UpdateDeliveryDto,
    @Req() request: DeliveriesRequest
  ) {
    return this.deliveriesService.update(id, payload, this.buildActor(request));
  }

  @Post(":id/assign")
  @RequirePermission({
    menuKey: MENU_KEYS.DELIVERIES,
    level: "WRITE",
    action: DELIVERY_PERMISSION_ACTIONS.ASSIGN,
  })
  assign(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() payload: AssignDeliveryDto,
    @Req() request: DeliveriesRequest
  ) {
    return this.deliveriesService.assign(id, payload, this.buildActor(request));
  }

  @Post(":id/prepare")
  @RequirePermission({
    menuKey: MENU_KEYS.DELIVERIES,
    level: "WRITE",
    action: DELIVERY_PERMISSION_ACTIONS.ASSIGN,
  })
  prepare(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() payload: AssignDeliveryDto,
    @Req() request: DeliveriesRequest
  ) {
    return this.deliveriesService.prepare(id, payload, this.buildActor(request));
  }

  @Post(":id/assign-driver")
  @RequirePermission({
    menuKey: MENU_KEYS.DELIVERIES,
    level: "WRITE",
    action: DELIVERY_PERMISSION_ACTIONS.ASSIGN,
  })
  assignDriver(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() payload: AssignDeliveryDriverDto,
    @Req() request: DeliveriesRequest
  ) {
    return this.deliveriesService.assignDriver(
      id,
      payload,
      this.buildActor(request)
    );
  }

  @Post(":id/dispatch")
  @RequirePermission({
    menuKey: MENU_KEYS.DELIVERIES,
    level: "WRITE",
    action: DELIVERY_PERMISSION_ACTIONS.DISPATCH,
  })
  dispatch(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() payload: DispatchDeliveryDto,
    @Req() request: DeliveriesRequest
  ) {
    return this.deliveriesService.dispatch(id, payload, this.buildActor(request));
  }

  @Post(":id/mark-delivered")
  @RequirePermission({
    menuKey: MENU_KEYS.DELIVERIES,
    level: "WRITE",
    action: DELIVERY_PERMISSION_ACTIONS.MARK_DELIVERED,
  })
  markDelivered(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() payload: MarkDeliveredDeliveryDto,
    @Req() request: DeliveriesRequest
  ) {
    return this.deliveriesService.markDelivered(
      id,
      payload,
      this.buildActor(request)
    );
  }

  @Post(":id/mark-not-delivered")
  @RequirePermission({
    menuKey: MENU_KEYS.DELIVERIES,
    level: "WRITE",
    action: DELIVERY_PERMISSION_ACTIONS.MARK_NOT_DELIVERED,
  })
  markNotDelivered(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() payload: MarkNotDeliveredDeliveryDto,
    @Req() request: DeliveriesRequest
  ) {
    return this.deliveriesService.markNotDelivered(
      id,
      payload,
      this.buildActor(request)
    );
  }

  @Post(":id/cancel")
  @RequirePermission({
    menuKey: MENU_KEYS.DELIVERIES,
    level: "WRITE",
    action: DELIVERY_PERMISSION_ACTIONS.CANCEL,
  })
  cancel(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() payload: CancelDeliveryDto,
    @Req() request: DeliveriesRequest
  ) {
    return this.deliveriesService.cancel(id, payload, this.buildActor(request));
  }
}
