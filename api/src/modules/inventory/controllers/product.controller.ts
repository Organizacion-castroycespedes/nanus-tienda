import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  NotFoundException,
  Param,
  Post,
  Query,
  UseGuards,
  Put,
  Req,
  BadRequestException,
  ForbiddenException,
  ValidationPipe,
} from "@nestjs/common";
import type { Request } from "express";
import { RequirePermission } from "../../../common/decorators/require-permission.decorator";
import { Roles } from "../../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../../../common/guards/permissions.guard";
import { RolesGuard } from "../../../common/guards/roles.guard";
import { AccessControlService } from "../../../common/services/access-control.service";
import { ChangeProductPriceDto } from "../dto/change-product-price.dto";
import type {
  ProductMeasurementUnit,
  ProductOperationalStatus,
  ProductRotationClass,
  ProductSaleType,
} from "../entities/product.entity";
import type { ProductImageMimeType } from "../entities/product-category.entity";
import { ProductService } from "../services/product.service";

type AuthRequest = Request & {
  user?: {
    tenantId?: string;
    id?: string;
    roles?: string[];
  };
  context?: {
    branchId?: string;
  };
};

type CreateProductBody = {
  unitId: string;
  taxId?: string | null;
  name: string;
  description?: string | null;
  sku: string;
  price: number;
  cost: number;
  priceWithTax?: number;
  priceWithoutTax?: number;
  isActive?: boolean;
  isPerishable?: boolean;
  requiresLot?: boolean;
  requiresExpiration?: boolean;
  operationalStatus?: ProductOperationalStatus;
  rotationClass?: ProductRotationClass;
  saleType?: ProductSaleType;
  measurementUnit?: ProductMeasurementUnit;
  minStock?: number | null;
  maxStock?: number | null;
  categoryId?: string | null;
  subcategoryId?: string | null;
  imageUrl?: string | null;
  imageStorageKey?: string | null;
  imageAltText?: string | null;
  imageMimeType?: ProductImageMimeType | null;
  imageSizeBytes?: number | null;
  imageUpdatedAt?: Date | null;
};

type UpdateProductBody = Partial<
  Omit<CreateProductBody, "unitId"> & {
    unitId?: string;
  }
>;

const changeProductPriceValidationPipe = new ValidationPipe({
  transform: true,
  whitelist: true,
  forbidNonWhitelisted: true,
});

const operationalCatalogReadRoles = ["USER", "ADMIN", "SUPER_USER"];

@Controller("products")
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class ProductController {
  constructor(
    @Inject(ProductService)
    private readonly productService: ProductService,
    @Inject(AccessControlService)
    private readonly accessControl: AccessControlService
  ) {}

  private getTenantId(request: AuthRequest) {
    const tenantId = request.user?.tenantId;
    if (!tenantId) {
      throw new NotFoundException("tenant not found in request context");
    }
    return tenantId;
  }

  private getUserId(request: AuthRequest) {
    const userId = request.user?.id;
    if (!userId) {
      throw new BadRequestException("userId is required");
    }
    return userId;
  }

  private getBranchId(request: AuthRequest, branchId: string | undefined) {
    const resolvedBranchId = branchId ?? request.context?.branchId;
    if (!resolvedBranchId) {
      throw new BadRequestException("branchId is required");
    }
    return resolvedBranchId;
  }

  private buildActor(request: AuthRequest) {
    return {
      id: request.user?.id,
      tenantId: request.user?.tenantId,
      roles: Array.isArray(request.user?.roles) ? request.user.roles : [],
    };
  }

  private async ensureBranchScope(
    request: AuthRequest,
    tenantId: string,
    branchId: string
  ) {
    const allowed = await this.accessControl.canAccessBranch(
      this.buildActor(request),
      tenantId,
      branchId
    );
    if (!allowed) {
      throw new ForbiddenException("Sucursal no autorizada");
    }
  }

  @Post()
  @Roles("SUPER_ADMIN", "SUPER_USER", "ADMIN")
  @RequirePermission({ menuKey: "INVENTORY_PRODUCTS", level: "WRITE" })
  create(@Body() body: CreateProductBody, @Req() request: AuthRequest) {
    const tenantId = this.getTenantId(request);
    return this.productService.createProduct({
      ...body,
      tenantId,
    });
  }

  @Get()
  @Roles("SUPER_ADMIN", "SUPER_USER", "ADMIN", "USER")
  @RequirePermission({
    menuKey: "INVENTORY_PRODUCTS",
    level: "READ",
    operationalRoles: operationalCatalogReadRoles,
  })
  async list(
    @Query("branchId") branchId: string | undefined,
    @Req() request: AuthRequest
  ) {
    const tenantId = this.getTenantId(request);
    const resolvedBranchId = this.getBranchId(request, branchId);
    await this.ensureBranchScope(request, tenantId, resolvedBranchId);
    return this.productService.listProducts(
      tenantId,
      resolvedBranchId
    );
  }

  @Get(":id")
  @Roles("SUPER_ADMIN", "SUPER_USER", "ADMIN", "USER")
  @RequirePermission({
    menuKey: "INVENTORY_PRODUCTS",
    level: "READ",
    operationalRoles: operationalCatalogReadRoles,
  })
  getById(@Param("id") id: string, @Req() request: AuthRequest) {
    return this.productService.getProductById(id, this.getTenantId(request));
  }

  @Get(":id/price-history")
  @Roles("SUPER_ADMIN", "SUPER_USER", "ADMIN", "USER")
  @RequirePermission({
    menuKey: "INVENTORY_PRODUCTS",
    level: "READ",
    operationalRoles: operationalCatalogReadRoles,
  })
  getPriceHistory(@Param("id") id: string, @Req() request: AuthRequest) {
    return this.productService.getPriceHistory(id, this.getTenantId(request));
  }

  @Post(":id/change-price")
  @Roles("SUPER_ADMIN", "SUPER_USER", "ADMIN")
  @RequirePermission({ menuKey: "INVENTORY_PRODUCTS", level: "WRITE" })
  changePrice(
    @Param("id") id: string,
    @Body(changeProductPriceValidationPipe) body: ChangeProductPriceDto,
    @Req() request: AuthRequest
  ) {
    return this.productService.changePrice(
      id,
      this.getTenantId(request),
      this.getUserId(request),
      body
    );
  }

  @Put(":id")
  @Roles("SUPER_ADMIN", "SUPER_USER", "ADMIN")
  @RequirePermission({ menuKey: "INVENTORY_PRODUCTS", level: "WRITE" })
  update(
    @Param("id") id: string,
    @Body() body: UpdateProductBody,
    @Req() request: AuthRequest
  ) {
    return this.productService.updateProduct(
      id,
      this.getTenantId(request),
      body
    );
  }

  @Delete(":id")
  @Roles("SUPER_ADMIN", "SUPER_USER", "ADMIN")
  @RequirePermission({ menuKey: "INVENTORY_PRODUCTS", level: "WRITE" })
  remove(@Param("id") id: string, @Req() request: AuthRequest) {
    return this.productService.softDeleteProduct(id, this.getTenantId(request));
  }
}
