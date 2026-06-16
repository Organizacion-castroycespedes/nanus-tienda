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
  Req,
  UseGuards,
} from "@nestjs/common";
import type { Request } from "express";
import { RequirePermission } from "../../../common/decorators/require-permission.decorator";
import { Roles } from "../../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../../../common/guards/permissions.guard";
import { RolesGuard } from "../../../common/guards/roles.guard";
import type { ProductBarcodeType } from "../entities/product-barcode.entity";
import { ProductBarcodeService } from "../services/product-barcode.service";

type AuthRequest = Request & {
  user?: {
    tenantId?: string;
    id?: string;
    roles?: string[];
  };
};

type CreateProductBarcodeBody = {
  barcode: string;
  barcodeType?: ProductBarcodeType;
  isPrimary?: boolean;
};

type UpdateProductBarcodeBody = Partial<CreateProductBarcodeBody>;

const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value
  );

@Controller("products/:productId/barcodes")
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class ProductBarcodeController {
  constructor(
    @Inject(ProductBarcodeService)
    private readonly productBarcodeService: ProductBarcodeService
  ) {}

  private getTenantId(request: AuthRequest) {
    const tenantId = request.user?.tenantId;
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

  @Get()
  @Roles("SUPER_ADMIN", "SUPER_USER", "ADMIN", "USER")
  @RequirePermission({ menuKey: "INVENTORY_PRODUCTS", level: "READ" })
  list(@Param("productId") productId: string, @Req() request: AuthRequest) {
    this.assertUuid(productId, "productId");
    return this.productBarcodeService.findByProduct(
      this.getTenantId(request),
      productId
    );
  }

  @Post()
  @Roles("SUPER_ADMIN", "SUPER_USER", "ADMIN")
  @RequirePermission({ menuKey: "INVENTORY_PRODUCTS", level: "WRITE" })
  create(
    @Param("productId") productId: string,
    @Body() body: CreateProductBarcodeBody,
    @Req() request: AuthRequest
  ) {
    this.assertUuid(productId, "productId");
    return this.productBarcodeService.create({
      ...body,
      tenantId: this.getTenantId(request),
      productId,
    });
  }

  @Put(":barcodeId")
  @Roles("SUPER_ADMIN", "SUPER_USER", "ADMIN")
  @RequirePermission({ menuKey: "INVENTORY_PRODUCTS", level: "WRITE" })
  update(
    @Param("productId") productId: string,
    @Param("barcodeId") barcodeId: string,
    @Body() body: UpdateProductBarcodeBody,
    @Req() request: AuthRequest
  ) {
    this.assertUuid(productId, "productId");
    this.assertUuid(barcodeId, "barcodeId");
    return this.productBarcodeService.update({
      ...body,
      tenantId: this.getTenantId(request),
      productId,
      barcodeId,
    });
  }

  @Patch(":barcodeId/deactivate")
  @Roles("SUPER_ADMIN", "SUPER_USER", "ADMIN")
  @RequirePermission({ menuKey: "INVENTORY_PRODUCTS", level: "WRITE" })
  deactivate(
    @Param("productId") productId: string,
    @Param("barcodeId") barcodeId: string,
    @Req() request: AuthRequest
  ) {
    this.assertUuid(productId, "productId");
    this.assertUuid(barcodeId, "barcodeId");
    return this.productBarcodeService.deactivate(
      this.getTenantId(request),
      productId,
      barcodeId
    );
  }

  @Patch(":barcodeId/set-primary")
  @Roles("SUPER_ADMIN", "SUPER_USER", "ADMIN")
  @RequirePermission({ menuKey: "INVENTORY_PRODUCTS", level: "WRITE" })
  setPrimary(
    @Param("productId") productId: string,
    @Param("barcodeId") barcodeId: string,
    @Req() request: AuthRequest
  ) {
    this.assertUuid(productId, "productId");
    this.assertUuid(barcodeId, "barcodeId");
    return this.productBarcodeService.setPrimary(
      this.getTenantId(request),
      productId,
      barcodeId
    );
  }
}
