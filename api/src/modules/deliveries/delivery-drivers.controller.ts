import {
  Body,
  Controller,
  Get,
  Inject,
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
import { Roles } from "../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { DELIVERY_PERMISSION_ACTIONS } from "./deliveries.constants";
import { DeliveryDriversService } from "./delivery-drivers.service";
import { CreateDeliveryDriverDto } from "./dto/create-delivery-driver.dto";
import { QueryDeliveryDriversDto } from "./dto/query-delivery-drivers.dto";
import { UpdateDeliveryDriverDto } from "./dto/update-delivery-driver.dto";

type DeliveryDriversRequest = Request & {
  user?: {
    id?: string;
    tenantId?: string;
    roles?: string[];
  };
  context?: {
    tenantId?: string;
    userId?: string;
  };
};

const deliveryDriversValidationPipe = new ValidationPipe({
  transform: true,
  whitelist: true,
  forbidNonWhitelisted: true,
});

@Controller("delivery-drivers")
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@UsePipes(deliveryDriversValidationPipe)
@Roles("SUPER_ADMIN", "SUPER_USER", "ADMIN", "USER")
export class DeliveryDriversController {
  constructor(
    @Inject(DeliveryDriversService)
    private readonly deliveryDriversService: DeliveryDriversService
  ) {}

  private buildActor(request: DeliveryDriversRequest) {
    const tenantId = request.context?.tenantId ?? request.user?.tenantId;
    if (!tenantId) {
      throw new UnauthorizedException("Tenant no encontrado en la sesion");
    }

    return {
      tenantId,
      userId: request.context?.userId ?? request.user?.id,
      roles: Array.isArray(request.user?.roles) ? request.user.roles : [],
    };
  }

  @Get()
  @RequirePermission({
    menuKey: MENU_KEYS.DELIVERIES,
    level: "READ",
    action: DELIVERY_PERMISSION_ACTIONS.VIEW,
  })
  list(
    @Query() query: QueryDeliveryDriversDto,
    @Req() request: DeliveryDriversRequest
  ) {
    return this.deliveryDriversService.list(query, this.buildActor(request));
  }

  @Post()
  @Roles("SUPER_ADMIN", "SUPER_USER", "ADMIN")
  @RequirePermission({
    menuKey: MENU_KEYS.DELIVERIES,
    level: "WRITE",
    action: DELIVERY_PERMISSION_ACTIONS.UPDATE,
  })
  create(
    @Body() payload: CreateDeliveryDriverDto,
    @Req() request: DeliveryDriversRequest
  ) {
    return this.deliveryDriversService.create(payload, this.buildActor(request));
  }

  @Get(":id")
  @RequirePermission({
    menuKey: MENU_KEYS.DELIVERIES,
    level: "READ",
    action: DELIVERY_PERMISSION_ACTIONS.VIEW,
  })
  getById(
    @Param("id", ParseUUIDPipe) id: string,
    @Req() request: DeliveryDriversRequest
  ) {
    return this.deliveryDriversService.getById(id, this.buildActor(request));
  }

  @Patch(":id")
  @Roles("SUPER_ADMIN", "SUPER_USER", "ADMIN")
  @RequirePermission({
    menuKey: MENU_KEYS.DELIVERIES,
    level: "WRITE",
    action: DELIVERY_PERMISSION_ACTIONS.UPDATE,
  })
  update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() payload: UpdateDeliveryDriverDto,
    @Req() request: DeliveryDriversRequest
  ) {
    return this.deliveryDriversService.update(id, payload, this.buildActor(request));
  }

  @Patch(":id/deactivate")
  @Roles("SUPER_ADMIN", "SUPER_USER", "ADMIN")
  @RequirePermission({
    menuKey: MENU_KEYS.DELIVERIES,
    level: "WRITE",
    action: DELIVERY_PERMISSION_ACTIONS.UPDATE,
  })
  deactivate(
    @Param("id", ParseUUIDPipe) id: string,
    @Req() request: DeliveryDriversRequest
  ) {
    return this.deliveryDriversService.deactivate(id, this.buildActor(request));
  }
}
