import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import type { Request } from "express";
import { RequirePermission } from "../../common/decorators/require-permission.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { PromotionsService } from "./promotions.service";
import type {
  CreatePromotionInput,
  PromotionDiscountType,
  PromotionListFilters,
  UpdatePromotionInput,
} from "./promotions.types";

type AuthRequest = Request & {
  user?: {
    id?: string;
    tenantId?: string;
    roles?: string[];
  };
};

type CreatePromotionBody = Omit<CreatePromotionInput, "tenantId" | "createdBy">;
type UpdatePromotionBody = UpdatePromotionInput;

@Controller("pricing/promotions")
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class PromotionsController {
  constructor(
    @Inject(PromotionsService)
    private readonly promotionsService: PromotionsService
  ) {}

  private getTenantId(request: AuthRequest) {
    const tenantId = request.user?.tenantId;
    if (!tenantId) {
      throw new BadRequestException("tenantId is required");
    }
    return tenantId;
  }

  private parseIsActive(value: string | undefined) {
    if (value === undefined) {
      return undefined;
    }
    if (value === "true") {
      return true;
    }
    if (value === "false") {
      return false;
    }
    throw new BadRequestException("isActive must be true or false");
  }

  @Get()
  @Roles("SUPER_ADMIN", "SUPER_USER", "ADMIN", "USER")
  @RequirePermission({ menuKey: "INVENTORY_PRODUCTS", level: "READ" })
  list(
    @Req() request: AuthRequest,
    @Query("search") search?: string,
    @Query("isActive") isActive?: string,
    @Query("productId") productId?: string,
    @Query("branchId") branchId?: string,
    @Query("startsAt") startsAt?: string,
    @Query("endsAt") endsAt?: string
  ) {
    const filters: PromotionListFilters = {
      search,
      isActive: this.parseIsActive(isActive),
      productId,
      branchId,
      startsAt,
      endsAt,
    };
    return this.promotionsService.listPromotions(
      this.getTenantId(request),
      filters
    );
  }

  @Get(":id")
  @Roles("SUPER_ADMIN", "SUPER_USER", "ADMIN", "USER")
  @RequirePermission({ menuKey: "INVENTORY_PRODUCTS", level: "READ" })
  getById(@Param("id") id: string, @Req() request: AuthRequest) {
    return this.promotionsService.getPromotion(this.getTenantId(request), id);
  }

  @Post()
  @Roles("SUPER_ADMIN", "SUPER_USER", "ADMIN")
  @RequirePermission({ menuKey: "INVENTORY_PRODUCTS", level: "WRITE" })
  create(@Body() body: CreatePromotionBody, @Req() request: AuthRequest) {
    return this.promotionsService.createPromotion({
      ...body,
      discountType: body.discountType as PromotionDiscountType,
      tenantId: this.getTenantId(request),
      createdBy: request.user?.id ?? null,
    });
  }

  @Patch(":id")
  @Roles("SUPER_ADMIN", "SUPER_USER", "ADMIN")
  @RequirePermission({ menuKey: "INVENTORY_PRODUCTS", level: "WRITE" })
  update(
    @Param("id") id: string,
    @Body() body: UpdatePromotionBody,
    @Req() request: AuthRequest
  ) {
    return this.promotionsService.updatePromotion(
      this.getTenantId(request),
      id,
      {
        ...body,
        discountType: body.discountType as PromotionDiscountType | undefined,
      }
    );
  }

  @Patch(":id/deactivate")
  @Roles("SUPER_ADMIN", "SUPER_USER", "ADMIN")
  @RequirePermission({ menuKey: "INVENTORY_PRODUCTS", level: "WRITE" })
  deactivate(@Param("id") id: string, @Req() request: AuthRequest) {
    return this.promotionsService.deactivatePromotion(
      this.getTenantId(request),
      id
    );
  }
}
