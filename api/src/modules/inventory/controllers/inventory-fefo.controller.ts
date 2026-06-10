import {
  BadRequestException,
  Controller,
  Get,
  Inject,
  NotFoundException,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import type { Request } from "express";
import { RequirePermission } from "../../../common/decorators/require-permission.decorator";
import { Roles } from "../../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../../../common/guards/permissions.guard";
import { RolesGuard } from "../../../common/guards/roles.guard";
import { InventoryFefoService } from "../services/inventory-fefo.service";

type AuthRequest = Request & {
  user?: {
    tenantId?: string;
    id?: string;
    roles?: string[];
  };
  context?: {
    tenantId?: string;
    userId?: string;
    branchId?: string;
  };
};

const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value
  );

@Controller("inventory/fefo")
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class InventoryFefoController {
  constructor(
    @Inject(InventoryFefoService)
    private readonly inventoryFefoService: InventoryFefoService
  ) {}

  private getTenantId(request: AuthRequest) {
    const tenantId = request.context?.tenantId ?? request.user?.tenantId;
    if (!tenantId) {
      throw new NotFoundException("tenant not found in request context");
    }
    return tenantId;
  }

  private buildActor(request: AuthRequest) {
    return {
      roles: Array.isArray(request.user?.roles) ? request.user.roles : [],
      userId: request.context?.userId ?? request.user?.id,
      tenantId: request.context?.tenantId ?? request.user?.tenantId,
      branchId: request.context?.branchId,
    };
  }

  private assertUuid(value: string | undefined, field: string) {
    if (!value || !isUuid(value)) {
      throw new BadRequestException(`${field} must be a valid UUID`);
    }
  }

  private assertOptionalUuid(value: string | undefined, field: string) {
    if (value !== undefined) {
      this.assertUuid(value, field);
    }
  }

  @Get("preview")
  @Roles("SUPER_ADMIN", "SUPER_USER", "ADMIN", "USER")
  @RequirePermission({ menuKey: "INVENTORY", level: "READ" })
  preview(
    @Query("branchId") branchId: string | undefined,
    @Query("productId") productId: string | undefined,
    @Query("quantity") quantity: string | undefined,
    @Query("locationId") locationId: string | undefined,
    @Req() request: AuthRequest
  ) {
    this.assertUuid(branchId, "branchId");
    this.assertUuid(productId, "productId");
    this.assertOptionalUuid(locationId, "locationId");

    return this.inventoryFefoService.selectLotsForConsumption(
      {
        tenantId: this.getTenantId(request),
        branchId: branchId as string,
        productId: productId as string,
        quantity: Number(quantity),
        locationId,
      },
      this.buildActor(request)
    );
  }
}
