import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  NotFoundException,
  Param,
  Post,
  UseGuards,
  Put,
  Req,
} from "@nestjs/common";
import type { Request } from "express";
import { Roles } from "../../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../../common/guards/roles.guard";
import { ProductService } from "../services/product.service";

type AuthRequest = Request & {
  user?: {
    tenantId?: string;
    id?: string;
    roles?: string[];
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
};

type UpdateProductBody = Partial<
  Omit<CreateProductBody, "unitId"> & {
    unitId?: string;
  }
>;

@Controller("products")
@UseGuards(JwtAuthGuard, RolesGuard)
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

  @Post()
  @Roles("SUPER_ADMIN", "SUPER_USER", "ADMIN")
  create(@Body() body: CreateProductBody, @Req() request: AuthRequest) {
    const tenantId = this.getTenantId(request);
    return this.productService.createProduct({
      ...body,
      tenantId,
    });
  }

  @Get()
  @Roles("SUPER_ADMIN", "SUPER_USER", "ADMIN", "USER")
  list(@Req() request: AuthRequest) {
    return this.productService.listProducts(this.getTenantId(request));
  }

  @Get(":id")
  @Roles("SUPER_ADMIN", "SUPER_USER", "ADMIN", "USER")
  getById(@Param("id") id: string, @Req() request: AuthRequest) {
    return this.productService.getProductById(id, this.getTenantId(request));
  }

  @Put(":id")
  @Roles("SUPER_ADMIN", "SUPER_USER", "ADMIN")
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
  remove(@Param("id") id: string, @Req() request: AuthRequest) {
    return this.productService.softDeleteProduct(id, this.getTenantId(request));
  }
}
