import {
  Body,
  Controller,
  Delete,
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
import { UnitService } from "../services/unit.service";

type AuthRequest = Request & {
  user?: {
    tenantId?: string;
  };
};

type CreateUnitBody = {
  name: string;
  abbreviation: string;
  isActive?: boolean;
};

type UpdateUnitBody = Partial<CreateUnitBody>;

@Controller("units")
@UseGuards(JwtAuthGuard)
export class UnitController {
  constructor(
    @Inject(UnitService)
    private readonly unitService: UnitService
  ) {}

  private getTenantId(request: AuthRequest) {
    const tenantId = request.user?.tenantId;
    if (!tenantId) {
      throw new NotFoundException("tenant not found in request context");
    }
    return tenantId;
  }

  @Get()
  list(@Req() request: AuthRequest) {
    return this.unitService.listUnits(this.getTenantId(request));
  }

  @Post()
  create(@Body() body: CreateUnitBody, @Req() request: AuthRequest) {
    return this.unitService.createUnit({
      tenantId: this.getTenantId(request),
      name: body.name,
      abbreviation: body.abbreviation,
      isActive: body.isActive,
    });
  }

  @Put(":id")
  update(
    @Param("id") id: string,
    @Body() body: UpdateUnitBody,
    @Req() request: AuthRequest
  ) {
    return this.unitService.updateUnit(id, this.getTenantId(request), body);
  }

  @Delete(":id")
  remove(@Param("id") id: string, @Req() request: AuthRequest) {
    return this.unitService.deleteUnit(id, this.getTenantId(request));
  }
}
