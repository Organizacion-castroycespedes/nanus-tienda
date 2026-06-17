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
import { MENU_KEYS } from "../../../common/constants/menu-keys";
import { RequirePermission } from "../../../common/decorators/require-permission.decorator";
import { Roles } from "../../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../../../common/guards/permissions.guard";
import { RolesGuard } from "../../../common/guards/roles.guard";
import { TaxService } from "../services/tax.service";

type AuthRequest = Request & {
  user?: {
    tenantId?: string;
  };
};

type CreateTaxBody = {
  name: string;
  rate: number;
  isIncluded: boolean;
  isActive?: boolean;
};

type UpdateTaxBody = Partial<CreateTaxBody>;

const operationalCatalogReadRoles = ["USER", "ADMIN", "SUPER_USER"];

@Controller("taxes")
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Roles("SUPER_ADMIN", "SUPER_USER", "ADMIN", "USER")
export class TaxController {
  constructor(
    @Inject(TaxService)
    private readonly taxService: TaxService
  ) {}

  private getTenantId(request: AuthRequest) {
    const tenantId = request.user?.tenantId;
    if (!tenantId) {
      throw new NotFoundException("tenant not found in request context");
    }
    return tenantId;
  }

  @Get()
  @RequirePermission({
    menuKey: MENU_KEYS.INVENTORY_TAXES,
    level: "READ",
    operationalRoles: operationalCatalogReadRoles,
  })
  list(@Req() request: AuthRequest) {
    return this.taxService.listTaxes(this.getTenantId(request));
  }

  @Post()
  @Roles("SUPER_ADMIN", "SUPER_USER", "ADMIN")
  @RequirePermission({ menuKey: MENU_KEYS.INVENTORY_TAXES, level: "WRITE" })
  create(@Body() body: CreateTaxBody, @Req() request: AuthRequest) {
    return this.taxService.createTax({
      tenantId: this.getTenantId(request),
      name: body.name,
      rate: Number(body.rate),
      isIncluded: Boolean(body.isIncluded),
      isActive: body.isActive,
    });
  }

  @Put(":id")
  @Roles("SUPER_ADMIN", "SUPER_USER", "ADMIN")
  @RequirePermission({ menuKey: MENU_KEYS.INVENTORY_TAXES, level: "WRITE" })
  update(
    @Param("id") id: string,
    @Body() body: UpdateTaxBody,
    @Req() request: AuthRequest
  ) {
    return this.taxService.updateTax(id, this.getTenantId(request), {
      name: body.name,
      rate: body.rate !== undefined ? Number(body.rate) : undefined,
      isIncluded: body.isIncluded,
      isActive: body.isActive,
    });
  }

  @Delete(":id")
  @Roles("SUPER_ADMIN", "SUPER_USER", "ADMIN")
  @RequirePermission({ menuKey: MENU_KEYS.INVENTORY_TAXES, level: "WRITE" })
  remove(@Param("id") id: string, @Req() request: AuthRequest) {
    return this.taxService.deleteTax(id, this.getTenantId(request));
  }
}
