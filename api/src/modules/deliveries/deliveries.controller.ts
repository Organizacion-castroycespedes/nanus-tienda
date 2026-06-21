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
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { DeliveriesService } from "./deliveries.service";
import { CreateDeliveryDto } from "./dto/create-delivery.dto";
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
@UseGuards(JwtAuthGuard)
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
  list(@Query() query: QueryDeliveriesDto, @Req() request: DeliveriesRequest) {
    return this.deliveriesService.list(query, this.buildActor(request));
  }

  @Post()
  create(@Body() payload: CreateDeliveryDto, @Req() request: DeliveriesRequest) {
    return this.deliveriesService.create(payload, this.buildActor(request));
  }

  @Get(":id")
  getById(
    @Param("id", ParseUUIDPipe) id: string,
    @Req() request: DeliveriesRequest
  ) {
    return this.deliveriesService.getById(id, this.buildActor(request));
  }

  @Patch(":id")
  update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() payload: UpdateDeliveryDto,
    @Req() request: DeliveriesRequest
  ) {
    return this.deliveriesService.update(id, payload, this.buildActor(request));
  }
}
