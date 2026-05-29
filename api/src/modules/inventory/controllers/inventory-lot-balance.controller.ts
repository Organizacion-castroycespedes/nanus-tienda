import {
  BadRequestException,
  Controller,
  Get,
  Inject,
  NotFoundException,
  Param,
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
import { InventoryLotBalanceService } from "../services/inventory-lot-balance.service";

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
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value
  );

@Controller("inventory/lot-balances")
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class InventoryLotBalanceController {
  constructor(
    @Inject(InventoryLotBalanceService)
    private readonly inventoryLotBalanceService: InventoryLotBalanceService
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

  private assertUuid(value: string, field: string) {
    if (!isUuid(value)) {
      throw new BadRequestException(`${field} must be a valid UUID`);
    }
  }

  private assertOptionalUuid(value: string | undefined, field: string) {
    if (value !== undefined) {
      this.assertUuid(value, field);
    }
  }

  private parseOptionalBoolean(value: string | undefined, field: string) {
    if (value === undefined) {
      return undefined;
    }
    if (value === "true") {
      return true;
    }
    if (value === "false") {
      return false;
    }

    throw new BadRequestException(`${field} must be true or false`);
  }

  @Get()
  @Roles("SUPER_ADMIN", "SUPER_USER", "ADMIN", "USER")
  @RequirePermission({ menuKey: "INVENTORY", level: "READ" })
  list(
    @Query("branchId") branchId: string | undefined,
    @Query("productId") productId: string | undefined,
    @Query("lotId") lotId: string | undefined,
    @Query("locationId") locationId: string | undefined,
    @Query("onlyAvailable") onlyAvailable: string | undefined,
    @Query("onlyActiveLots") onlyActiveLots: string | undefined,
    @Query("expirationFrom") expirationFrom: string | undefined,
    @Query("expirationTo") expirationTo: string | undefined,
    @Req() request: AuthRequest
  ) {
    this.assertOptionalUuid(branchId, "branchId");
    this.assertOptionalUuid(productId, "productId");
    this.assertOptionalUuid(lotId, "lotId");
    this.assertOptionalUuid(locationId, "locationId");

    return this.inventoryLotBalanceService.findMany(
      this.getTenantId(request),
      {
        branchId,
        productId,
        lotId,
        locationId,
        onlyAvailable: this.parseOptionalBoolean(
          onlyAvailable,
          "onlyAvailable"
        ),
        onlyActiveLots: this.parseOptionalBoolean(
          onlyActiveLots,
          "onlyActiveLots"
        ),
        expirationFrom,
        expirationTo,
      },
      this.buildActor(request)
    );
  }

  @Get(":balanceId")
  @Roles("SUPER_ADMIN", "SUPER_USER", "ADMIN", "USER")
  @RequirePermission({ menuKey: "INVENTORY", level: "READ" })
  getById(
    @Param("balanceId") balanceId: string,
    @Req() request: AuthRequest
  ) {
    this.assertUuid(balanceId, "balanceId");
    return this.inventoryLotBalanceService.findById(
      this.getTenantId(request),
      balanceId,
      this.buildActor(request)
    );
  }
}
