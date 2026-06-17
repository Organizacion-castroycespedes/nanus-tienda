import {
  BadRequestException,
  Body,
  Controller,
  Inject,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import type { Request } from "express";
import { MENU_KEYS } from "../../common/constants/menu-keys";
import { RequirePermission } from "../../common/decorators/require-permission.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { PricingService } from "./pricing.service";
import type { CalculateLinePriceInput, PricingChannel } from "./pricing.types";

type AuthRequest = Request & {
  user?: {
    tenantId?: string;
    roles?: string[];
  };
};

type PreviewLineBody = Omit<CalculateLinePriceInput, "tenantId"> & {
  tenantId?: string;
  channel: PricingChannel;
};

const pricingPreviewOperationalRoles = ["USER", "ADMIN", "SUPER_USER"];

@Controller("pricing")
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class PricingController {
  constructor(
    @Inject(PricingService)
    private readonly pricingService: PricingService
  ) {}

  private getTenantId(request: AuthRequest) {
    const tenantId = request.user?.tenantId;
    if (!tenantId) {
      throw new BadRequestException("tenantId is required");
    }
    return tenantId;
  }

  @Post("preview-line")
  @Roles("SUPER_ADMIN", "SUPER_USER", "ADMIN", "USER")
  @RequirePermission({
    menuKey: MENU_KEYS.INVENTORY_PRODUCTS,
    level: "READ",
    operationalRoles: pricingPreviewOperationalRoles,
  })
  previewLine(@Body() body: PreviewLineBody, @Req() request: AuthRequest) {
    return this.pricingService.calculateLinePrice({
      ...body,
      tenantId: this.getTenantId(request),
    });
  }
}
