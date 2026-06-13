import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Inject,
  NotFoundException,
  Param,
  Patch,
  Post,
  Put,
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
import type { InventoryLotStatus } from "../entities/inventory-lot.entity";
import { InventoryLotService } from "../services/inventory-lot.service";

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

type CreateInventoryLotBody = {
  branchId: string;
  productId: string;
  supplierId?: string | null;
  purchaseId?: string | null;
  purchaseItemId?: string | null;
  lotCode: string;
  expirationDate?: string | null;
  receivedAt?: string;
  unitCost?: number;
  status?: InventoryLotStatus;
  isLegacy?: boolean;
};

type UpdateInventoryLotBody = Partial<
  Omit<CreateInventoryLotBody, "branchId" | "productId"> & {
    branchId?: string;
    productId?: string;
  }
>;

const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value
  );

@Controller("inventory/lots")
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class InventoryLotController {
  constructor(
    @Inject(InventoryLotService)
    private readonly inventoryLotService: InventoryLotService
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

  private assertOptionalUuid(value: string | null | undefined, field: string) {
    if (value !== undefined && value !== null) {
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
    @Query("supplierId") supplierId: string | undefined,
    @Query("status") status: InventoryLotStatus | undefined,
    @Query("isLegacy") isLegacy: string | undefined,
    @Query("expirationFrom") expirationFrom: string | undefined,
    @Query("expirationTo") expirationTo: string | undefined,
    @Query("search") search: string | undefined,
    @Req() request: AuthRequest
  ) {
    this.assertOptionalUuid(branchId, "branchId");
    this.assertOptionalUuid(productId, "productId");
    this.assertOptionalUuid(supplierId, "supplierId");

    return this.inventoryLotService.findMany(
      this.getTenantId(request),
      {
        branchId,
        productId,
        supplierId,
        status,
        isLegacy: this.parseOptionalBoolean(isLegacy, "isLegacy"),
        expirationFrom,
        expirationTo,
        search,
      },
      this.buildActor(request)
    );
  }

  @Get(":lotId")
  @Roles("SUPER_ADMIN", "SUPER_USER", "ADMIN", "USER")
  @RequirePermission({ menuKey: "INVENTORY", level: "READ" })
  getById(@Param("lotId") lotId: string, @Req() request: AuthRequest) {
    this.assertUuid(lotId, "lotId");
    return this.inventoryLotService.findById(
      this.getTenantId(request),
      lotId,
      this.buildActor(request)
    );
  }

  @Post()
  @Roles("SUPER_ADMIN", "SUPER_USER")
  @RequirePermission({ menuKey: "INVENTORY", level: "WRITE" })
  create(@Body() body: CreateInventoryLotBody, @Req() request: AuthRequest) {
    this.assertUuid(body.branchId, "branchId");
    this.assertUuid(body.productId, "productId");
    this.assertOptionalUuid(body.supplierId, "supplierId");
    this.assertOptionalUuid(body.purchaseId, "purchaseId");
    this.assertOptionalUuid(body.purchaseItemId, "purchaseItemId");

    return this.inventoryLotService.create(
      {
        ...body,
        tenantId: this.getTenantId(request),
      },
      this.buildActor(request)
    );
  }

  @Put(":lotId")
  @Roles("SUPER_ADMIN", "SUPER_USER")
  @RequirePermission({ menuKey: "INVENTORY", level: "WRITE" })
  update(
    @Param("lotId") lotId: string,
    @Body() body: UpdateInventoryLotBody,
    @Req() request: AuthRequest
  ) {
    this.assertUuid(lotId, "lotId");
    this.assertOptionalUuid(body.branchId, "branchId");
    this.assertOptionalUuid(body.productId, "productId");
    this.assertOptionalUuid(body.supplierId, "supplierId");
    this.assertOptionalUuid(body.purchaseId, "purchaseId");
    this.assertOptionalUuid(body.purchaseItemId, "purchaseItemId");

    return this.inventoryLotService.update(
      {
        ...body,
        tenantId: this.getTenantId(request),
        lotId,
      },
      this.buildActor(request)
    );
  }

  @Patch(":lotId/block")
  @Roles("SUPER_ADMIN", "SUPER_USER")
  @RequirePermission({ menuKey: "INVENTORY", level: "WRITE" })
  block(@Param("lotId") lotId: string, @Req() request: AuthRequest) {
    this.assertUuid(lotId, "lotId");
    return this.inventoryLotService.block(
      this.getTenantId(request),
      lotId,
      this.buildActor(request)
    );
  }

  @Patch(":lotId/cancel")
  @Roles("SUPER_ADMIN", "SUPER_USER")
  @RequirePermission({ menuKey: "INVENTORY", level: "WRITE" })
  cancel(@Param("lotId") lotId: string, @Req() request: AuthRequest) {
    this.assertUuid(lotId, "lotId");
    return this.inventoryLotService.cancel(
      this.getTenantId(request),
      lotId,
      this.buildActor(request)
    );
  }
}
