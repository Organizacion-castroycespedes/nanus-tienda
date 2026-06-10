import {
  BadRequestException,
  Controller,
  Get,
  Inject,
  NotFoundException,
  Param,
  Req,
  UseGuards,
} from "@nestjs/common";
import type { Request } from "express";
import { RequirePermission } from "../../../common/decorators/require-permission.decorator";
import { Roles } from "../../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../../../common/guards/permissions.guard";
import { RolesGuard } from "../../../common/guards/roles.guard";
import { StockMovementLotService } from "../services/stock-movement-lot.service";

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

@Controller("inventory/stock-movement-lots")
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class StockMovementLotController {
  constructor(
    @Inject(StockMovementLotService)
    private readonly stockMovementLotService: StockMovementLotService
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

  @Get("by-movement/:stockMovementId")
  @Roles("SUPER_ADMIN", "SUPER_USER", "ADMIN", "USER")
  @RequirePermission({ menuKey: "INVENTORY", level: "READ" })
  findByMovement(
    @Param("stockMovementId") stockMovementId: string,
    @Req() request: AuthRequest
  ) {
    this.assertUuid(stockMovementId, "stockMovementId");
    return this.stockMovementLotService.findByMovement(
      this.getTenantId(request),
      stockMovementId,
      this.buildActor(request)
    );
  }

  @Get("by-lot/:lotId")
  @Roles("SUPER_ADMIN", "SUPER_USER", "ADMIN", "USER")
  @RequirePermission({ menuKey: "INVENTORY", level: "READ" })
  findByLot(@Param("lotId") lotId: string, @Req() request: AuthRequest) {
    this.assertUuid(lotId, "lotId");
    return this.stockMovementLotService.findByLot(
      this.getTenantId(request),
      lotId,
      this.buildActor(request)
    );
  }
}
