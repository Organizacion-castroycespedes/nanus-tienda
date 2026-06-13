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
import { RequirePermission } from "../../../common/decorators/require-permission.decorator";
import { Roles } from "../../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../../../common/guards/permissions.guard";
import { RolesGuard } from "../../../common/guards/roles.guard";
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
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Roles("SUPER_ADMIN", "SUPER_USER", "ADMIN", "USER")
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
  @RequirePermission({ menuKey: "INVENTORY", level: "READ" })
  list(@Req() request: AuthRequest) {
    return this.unitService.listUnits(this.getTenantId(request));
  }

  @Post()
  @Roles("SUPER_ADMIN", "SUPER_USER")
  @RequirePermission({ menuKey: "INVENTORY", level: "WRITE" })
  create(@Body() body: CreateUnitBody, @Req() request: AuthRequest) {
    return this.unitService.createUnit({
      tenantId: this.getTenantId(request),
      name: body.name,
      abbreviation: body.abbreviation,
      isActive: body.isActive,
    });
  }

  @Put(":id")
  @Roles("SUPER_ADMIN", "SUPER_USER")
  @RequirePermission({ menuKey: "INVENTORY", level: "WRITE" })
  update(
    @Param("id") id: string,
    @Body() body: UpdateUnitBody,
    @Req() request: AuthRequest
  ) {
    return this.unitService.updateUnit(id, this.getTenantId(request), body);
  }

  @Delete(":id")
  @Roles("SUPER_ADMIN", "SUPER_USER")
  @RequirePermission({ menuKey: "INVENTORY", level: "WRITE" })
  remove(@Param("id") id: string, @Req() request: AuthRequest) {
    return this.unitService.deleteUnit(id, this.getTenantId(request));
  }
}
