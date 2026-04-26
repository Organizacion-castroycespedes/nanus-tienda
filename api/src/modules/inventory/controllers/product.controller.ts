import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  NotFoundException,
  Param,
  Post,
  Put,
  Req,
  UseGuards,
} from "@nestjs/common";
import type { Request } from "express";
import { JwtAuthGuard } from "../../../common/guards/jwt-auth.guard";
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
@UseGuards(JwtAuthGuard)
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
  create(@Body() body: CreateProductBody, @Req() request: AuthRequest) {
    const tenantId = this.getTenantId(request);
    return this.productService.createProduct({
      ...body,
      tenantId,
    });
  }

  @Get()
  list(@Req() request: AuthRequest) {
    return this.productService.listProducts(this.getTenantId(request));
  }

  @Get(":id")
  getById(@Param("id") id: string, @Req() request: AuthRequest) {
    return this.productService.getProductById(id, this.getTenantId(request));
  }

  @Put(":id")
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
  remove(@Param("id") id: string, @Req() request: AuthRequest) {
    return this.productService.softDeleteProduct(id, this.getTenantId(request));
  }
}
