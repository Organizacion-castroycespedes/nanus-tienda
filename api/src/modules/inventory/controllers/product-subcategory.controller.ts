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
import { MENU_KEYS } from "../../../common/constants/menu-keys";
import { RequirePermission } from "../../../common/decorators/require-permission.decorator";
import { Roles } from "../../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../../../common/guards/permissions.guard";
import { RolesGuard } from "../../../common/guards/roles.guard";
import type { ProductImageMimeType } from "../entities/product-category.entity";
import { ProductSubcategoryService } from "../services/product-subcategory.service";

type AuthRequest = Request & {
  user?: {
    tenantId?: string;
    id?: string;
    roles?: string[];
  };
  context?: {
    tenantId?: string;
  };
};

type CreateProductSubcategoryBody = {
  categoryId: string;
  name: string;
  slug?: string;
  description?: string | null;
  defaultImageUrl?: string | null;
  defaultImageStorageKey?: string | null;
  defaultImageAltText?: string | null;
  defaultImageMimeType?: ProductImageMimeType | null;
  defaultImageSizeBytes?: number | null;
  isActive?: boolean;
  sortOrder?: number;
};

type UpdateProductSubcategoryBody = Partial<CreateProductSubcategoryBody>;

const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value
  );

const operationalCatalogReadRoles = ["USER", "ADMIN", "SUPER_USER"];

@Controller("inventory/product-subcategories")
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class ProductSubcategoryController {
  constructor(
    @Inject(ProductSubcategoryService)
    private readonly productSubcategoryService: ProductSubcategoryService
  ) {}

  private getTenantId(request: AuthRequest) {
    const tenantId = request.context?.tenantId ?? request.user?.tenantId;
    if (!tenantId) {
      throw new NotFoundException("tenant not found in request context");
    }
    return tenantId;
  }

  private assertUuid(value: string, field: string) {
    if (!isUuid(value)) {
      throw new BadRequestException(`${field} must be a valid UUID`);
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
  @RequirePermission({
    menuKey: MENU_KEYS.INVENTORY_PRODUCTS,
    level: "READ",
    operationalRoles: operationalCatalogReadRoles,
  })
  list(
    @Query("categoryId") categoryId: string | undefined,
    @Query("isActive") isActive: string | undefined,
    @Query("search") search: string | undefined,
    @Req() request: AuthRequest
  ) {
    if (categoryId) {
      this.assertUuid(categoryId, "categoryId");
    }

    return this.productSubcategoryService.list(this.getTenantId(request), {
      categoryId,
      isActive: this.parseOptionalBoolean(isActive, "isActive"),
      search,
    });
  }

  @Get(":subcategoryId")
  @Roles("SUPER_ADMIN", "SUPER_USER", "ADMIN", "USER")
  @RequirePermission({
    menuKey: MENU_KEYS.INVENTORY_PRODUCTS,
    level: "READ",
    operationalRoles: operationalCatalogReadRoles,
  })
  getById(
    @Param("subcategoryId") subcategoryId: string,
    @Req() request: AuthRequest
  ) {
    this.assertUuid(subcategoryId, "subcategoryId");
    return this.productSubcategoryService.getById(
      this.getTenantId(request),
      subcategoryId
    );
  }

  @Post()
  @Roles("SUPER_ADMIN", "SUPER_USER", "ADMIN")
  @RequirePermission({ menuKey: MENU_KEYS.INVENTORY_PRODUCTS, level: "WRITE" })
  create(
    @Body() body: CreateProductSubcategoryBody,
    @Req() request: AuthRequest
  ) {
    this.assertUuid(body.categoryId, "categoryId");
    return this.productSubcategoryService.create({
      ...body,
      tenantId: this.getTenantId(request),
    });
  }

  @Put(":subcategoryId")
  @Roles("SUPER_ADMIN", "SUPER_USER", "ADMIN")
  @RequirePermission({ menuKey: MENU_KEYS.INVENTORY_PRODUCTS, level: "WRITE" })
  update(
    @Param("subcategoryId") subcategoryId: string,
    @Body() body: UpdateProductSubcategoryBody,
    @Req() request: AuthRequest
  ) {
    this.assertUuid(subcategoryId, "subcategoryId");
    if (body.categoryId !== undefined) {
      this.assertUuid(body.categoryId, "categoryId");
    }

    return this.productSubcategoryService.update({
      ...body,
      tenantId: this.getTenantId(request),
      subcategoryId,
    });
  }

  @Patch(":subcategoryId/activate")
  @Roles("SUPER_ADMIN", "SUPER_USER", "ADMIN")
  @RequirePermission({ menuKey: MENU_KEYS.INVENTORY_PRODUCTS, level: "WRITE" })
  activate(
    @Param("subcategoryId") subcategoryId: string,
    @Req() request: AuthRequest
  ) {
    this.assertUuid(subcategoryId, "subcategoryId");
    return this.productSubcategoryService.activate(
      this.getTenantId(request),
      subcategoryId
    );
  }

  @Patch(":subcategoryId/deactivate")
  @Roles("SUPER_ADMIN", "SUPER_USER", "ADMIN")
  @RequirePermission({ menuKey: MENU_KEYS.INVENTORY_PRODUCTS, level: "WRITE" })
  deactivate(
    @Param("subcategoryId") subcategoryId: string,
    @Req() request: AuthRequest
  ) {
    this.assertUuid(subcategoryId, "subcategoryId");
    return this.productSubcategoryService.deactivate(
      this.getTenantId(request),
      subcategoryId
    );
  }
}
