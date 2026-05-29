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
} from "@nestjs/common";
import type { Request } from "express";
import { RequirePermission } from "../../../common/decorators/require-permission.decorator";
import { Roles } from "../../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../../../common/guards/permissions.guard";
import { RolesGuard } from "../../../common/guards/roles.guard";
import type {
  ProductOperationalStatus,
  ProductRotationClass,
} from "../entities/product.entity";
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
  minStock?: number | null;
  maxStock?: number | null;
};

type UpdateProductBody = Partial<
  Omit<CreateProductBody, "unitId"> & {
    unitId?: string;
  }
>;

@Controller("products")
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class ProductController {
  constructor(
    @Inject(ProductService)
    private readonly productService: ProductService
  ) {}

  private getTenantId(request: AuthRequest) {
    const tenantId = request.user?.tenantId;
    if (!tenantId) {
      throw new NotFoundException("tenant not found in request context");
    }
    return tenantId;
  }

  private getBranchId(request: AuthRequest, branchId: string | undefined) {
    const resolvedBranchId = branchId ?? request.context?.branchId;
    if (!resolvedBranchId) {
      throw new BadRequestException("branchId is required");
    }
    return resolvedBranchId;
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
  @RequirePermission({ menuKey: "INVENTORY_PRODUCTS", level: "READ" })
  list(
    @Query("branchId") branchId: string | undefined,
    @Req() request: AuthRequest
  ) {
    return this.productService.listProducts(
      this.getTenantId(request),
      this.getBranchId(request, branchId)
    );
  }

  @Get(":id")
  @Roles("SUPER_ADMIN", "SUPER_USER", "ADMIN", "USER")
  @RequirePermission({ menuKey: "INVENTORY_PRODUCTS", level: "READ" })
  getById(@Param("id") id: string, @Req() request: AuthRequest) {
    return this.productService.getProductById(id, this.getTenantId(request));
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
