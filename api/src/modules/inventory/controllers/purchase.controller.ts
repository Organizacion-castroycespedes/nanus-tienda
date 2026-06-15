import {
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
import { CancelPurchaseDto } from "../dto/cancel-purchase.dto";
import { SettlePartialPurchaseDto } from "../dto/settle-partial-purchase.dto";
import { PurchaseService } from "../services/purchase.service";

type AuthRequest = Request & {
  user?: {
    tenantId?: string;
    id?: string;
    roles?: string[];
  };
  context?: {
    tenantId?: string;
    branchId?: string;
    terminalId?: string;
    posSessionId?: string;
    userId?: string;
  };
};

type CreatePurchaseBody = {
  supplierId: string;
  branchId?: string;
  type?: "CASH" | "CREDIT";
  total: number;
  balance?: number;
  items: Array<{
    id?: string;
    productId: string;
    quantity: number;
    cost: number;
    subtotal: number;
  }>;
};

type UpdatePurchaseBody = Partial<CreatePurchaseBody> & {
  status?: "DRAFT" | "PENDING";
};

type ReceivePurchaseBody = {
  items: Array<{
    product_id?: string;
    productId?: string;
    purchase_item_id?: string;
    purchaseItemId?: string;
    quantity?: number;
    received_quantity?: number;
    receivedQuantity?: number;
    lot_code?: string | null;
    lotCode?: string | null;
    expiration_date?: string | null;
    expirationDate?: string | null;
    location_id?: string | null;
    locationId?: string | null;
    unit_cost?: number;
    unitCost?: number;
  }>;
};

@Controller("purchases")
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Roles("SUPER_ADMIN", "SUPER_USER", "ADMIN", "USER")
export class PurchaseController {
  constructor(
    @Inject(PurchaseService)
    private readonly purchaseService: PurchaseService
  ) {}

  private getTenantId(request: AuthRequest) {
    const tenantId = request.context?.tenantId ?? request.user?.tenantId;
    if (!tenantId) {
      throw new NotFoundException("tenant not found in request context");
    }
    return tenantId;
  }

  private getInventoryContext(request: AuthRequest) {
    return {
      tenantId: this.getTenantId(request),
      branchId: request.context?.branchId ?? null,
      terminalId: request.context?.terminalId ?? null,
      posSessionId: request.context?.posSessionId ?? null,
      userId: request.context?.userId ?? request.user?.id ?? null,
    };
  }

  private buildActor(request: AuthRequest) {
    return {
      roles: Array.isArray(request.user?.roles) ? request.user.roles : [],
      userId: request.context?.userId ?? request.user?.id,
      tenantId: this.getTenantId(request),
      branchId: request.context?.branchId,
    };
  }

  @Post()
  @Roles("SUPER_ADMIN", "SUPER_USER", "ADMIN")
  @RequirePermission({ menuKey: "INVENTORY_PURCHASES", level: "WRITE" })
  create(@Body() body: CreatePurchaseBody, @Req() request: AuthRequest) {
    return this.purchaseService.createPurchase({
      tenantId: this.getTenantId(request),
      supplierId: body.supplierId,
      branchId: body.branchId,
      type: body.type,
      total: Number(body.total),
      balance: body.balance !== undefined ? Number(body.balance) : undefined,
      items: body.items ?? [],
      context: this.getInventoryContext(request),
      actor: this.buildActor(request),
    });
  }

  @Put(":id")
  @Roles("SUPER_ADMIN", "SUPER_USER", "ADMIN")
  @RequirePermission({ menuKey: "INVENTORY_PURCHASES", level: "WRITE" })
  update(
    @Param("id") id: string,
    @Body() body: UpdatePurchaseBody,
    @Req() request: AuthRequest
  ) {
    return this.purchaseService.updatePurchase(id, this.getTenantId(request), {
      supplierId: body.supplierId,
      type: body.type,
      total: body.total !== undefined ? Number(body.total) : undefined,
      balance: body.balance !== undefined ? Number(body.balance) : undefined,
      status: body.status,
      items: body.items,
    }, this.buildActor(request));
  }

  @Get()
  @RequirePermission({ menuKey: "INVENTORY_PURCHASES", level: "READ" })
  list(
    @Query("tenantId") tenantId: string | undefined,
    @Query("branchId") branchId: string | undefined,
    @Query("fromDate") fromDate: string | undefined,
    @Query("toDate") toDate: string | undefined,
    @Query("paymentMethod") paymentMethod: string | undefined,
    @Req() request: AuthRequest
  ) {
    return this.purchaseService.getPurchases(
      {
        tenantId,
        branchId,
        fromDate,
        toDate,
        paymentMethod,
      },
      this.buildActor(request)
    );
  }

  @Get(":id")
  @RequirePermission({ menuKey: "INVENTORY_PURCHASES", level: "READ" })
  getById(@Param("id") id: string, @Req() request: AuthRequest) {
    return this.purchaseService.getPurchaseById(
      id,
      this.getTenantId(request),
      this.buildActor(request)
    );
  }

  @Post(":id/receive")
  @Roles("SUPER_ADMIN", "SUPER_USER", "ADMIN")
  @RequirePermission({ menuKey: "INVENTORY_PURCHASES", level: "WRITE" })
  receive(
    @Param("id") id: string,
    @Body() body: ReceivePurchaseBody,
    @Req() request: AuthRequest
  ) {
    return this.purchaseService.receivePurchase(
      id,
      this.getTenantId(request),
      (body.items ?? []).map((item) => ({
        productId: item.productId ?? item.product_id,
        purchaseItemId: item.purchaseItemId ?? item.purchase_item_id,
        quantity: Number(
          item.receivedQuantity ?? item.received_quantity ?? item.quantity
        ),
        lotCode: item.lotCode ?? item.lot_code,
        expirationDate: item.expirationDate ?? item.expiration_date,
        locationId: item.locationId ?? item.location_id,
        unitCost:
          item.unitCost !== undefined
            ? Number(item.unitCost)
            : item.unit_cost !== undefined
              ? Number(item.unit_cost)
              : undefined,
      })),
      this.getInventoryContext(request),
      this.buildActor(request)
    );
  }

  @Patch(":id/cancel")
  @Roles("SUPER_ADMIN", "SUPER_USER", "ADMIN")
  @RequirePermission({ menuKey: "INVENTORY_PURCHASES", level: "WRITE", action: "cancel" })
  cancel(
    @Param("id") id: string,
    @Body() body: CancelPurchaseDto,
    @Req() request: AuthRequest
  ) {
    return this.purchaseService.cancelPurchase(
      id,
      this.getTenantId(request),
      {
        motivoCancelacion: body.motivoCancelacion,
        context: this.getInventoryContext(request),
        actor: this.buildActor(request),
      }
    );
  }

  @Patch(":id/settle-partial")
  @Roles("SUPER_ADMIN", "SUPER_USER", "ADMIN")
  @RequirePermission({ menuKey: "INVENTORY_PURCHASES", level: "WRITE", action: "settle_partial" })
  settlePartial(
    @Param("id") id: string,
    @Body() body: SettlePartialPurchaseDto,
    @Req() request: AuthRequest
  ) {
    return this.purchaseService.settlePartialPurchase(
      id,
      this.getTenantId(request),
      request.context?.userId ?? request.user?.id ?? null,
      {
        motivoLiquidacion: body.motivoLiquidacion,
        context: this.getInventoryContext(request),
        actor: this.buildActor(request),
      }
    );
  }
}
