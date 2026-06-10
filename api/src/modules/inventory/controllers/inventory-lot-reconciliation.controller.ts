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
import type { InventoryLotDiscrepancyType } from "../repositories/inventory-lot-reconciliation.repository";
import { InventoryLotReconciliationService } from "../services/inventory-lot-reconciliation.service";

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

type ReconciliationQuery = {
  branchId?: string;
  productId?: string;
  lotId?: string;
  from?: string;
  to?: string;
  onlyDiscrepancies?: string;
  discrepancyType?: InventoryLotDiscrepancyType;
};

const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value
  );

@Controller("inventory/lot-reconciliation")
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class InventoryLotReconciliationController {
  constructor(
    @Inject(InventoryLotReconciliationService)
    private readonly reconciliationService: InventoryLotReconciliationService
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

  private parseQuery(query: ReconciliationQuery) {
    this.assertOptionalUuid(query.branchId, "branchId");
    this.assertOptionalUuid(query.productId, "productId");
    this.assertOptionalUuid(query.lotId, "lotId");

    return {
      branchId: query.branchId,
      productId: query.productId,
      lotId: query.lotId,
      from: query.from,
      to: query.to,
      onlyDiscrepancies: this.parseOptionalBoolean(
        query.onlyDiscrepancies,
        "onlyDiscrepancies"
      ),
      discrepancyType: query.discrepancyType,
    };
  }

  @Get("summary")
  @Roles("SUPER_ADMIN", "SUPER_USER", "ADMIN", "USER")
  @RequirePermission({ menuKey: "INVENTORY", level: "READ" })
  getSummary(@Query() query: ReconciliationQuery, @Req() request: AuthRequest) {
    return this.reconciliationService.getSummary(
      this.getTenantId(request),
      this.parseQuery(query),
      this.buildActor(request)
    );
  }

  @Get("discrepancies")
  @Roles("SUPER_ADMIN", "SUPER_USER", "ADMIN", "USER")
  @RequirePermission({ menuKey: "INVENTORY", level: "READ" })
  findDiscrepancies(
    @Query() query: ReconciliationQuery,
    @Req() request: AuthRequest
  ) {
    return this.reconciliationService.findDiscrepancies(
      this.getTenantId(request),
      this.parseQuery(query),
      this.buildActor(request)
    );
  }

  @Get("product/:productId")
  @Roles("SUPER_ADMIN", "SUPER_USER", "ADMIN", "USER")
  @RequirePermission({ menuKey: "INVENTORY", level: "READ" })
  getProduct(
    @Param("productId") productId: string,
    @Query() query: ReconciliationQuery,
    @Req() request: AuthRequest
  ) {
    this.assertUuid(productId, "productId");
    return this.reconciliationService.getProductReconciliation(
      this.getTenantId(request),
      productId,
      this.parseQuery(query),
      this.buildActor(request)
    );
  }

  @Get("lot/:lotId")
  @Roles("SUPER_ADMIN", "SUPER_USER", "ADMIN", "USER")
  @RequirePermission({ menuKey: "INVENTORY", level: "READ" })
  getLot(
    @Param("lotId") lotId: string,
    @Query() query: ReconciliationQuery,
    @Req() request: AuthRequest
  ) {
    this.assertUuid(lotId, "lotId");
    return this.reconciliationService.getLotReconciliation(
      this.getTenantId(request),
      lotId,
      this.parseQuery(query),
      this.buildActor(request)
    );
  }
}
