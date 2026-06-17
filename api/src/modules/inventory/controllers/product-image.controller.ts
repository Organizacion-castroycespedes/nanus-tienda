import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  NotFoundException,
  Param,
  Post,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import type { Request, Response } from "express";
import { MENU_KEYS } from "../../../common/constants/menu-keys";
import { RequirePermission } from "../../../common/decorators/require-permission.decorator";
import { Roles } from "../../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../../../common/guards/permissions.guard";
import { RolesGuard } from "../../../common/guards/roles.guard";
import type { UploadedInventoryImageFile } from "../services/local-image-storage.service";
import { ProductImageService } from "../services/product-image.service";

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

const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value
  );

const operationalCatalogReadRoles = ["USER", "ADMIN", "SUPER_USER"];

@Controller("inventory/products")
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class ProductImageController {
  constructor(
    @Inject(ProductImageService)
    private readonly productImageService: ProductImageService
  ) {}

  private getTenantId(request: AuthRequest) {
    const tenantId = request.context?.tenantId ?? request.user?.tenantId;
    if (!tenantId) {
      throw new NotFoundException("tenant not found in request context");
    }
    return tenantId;
  }

  private normalizeUuid(value: string, field: string) {
    const normalized = value?.trim() ?? "";
    if (isUuid(normalized)) {
      return normalized;
    }

    const match = normalized?.match(
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i
    );
    if (match?.[0] && isUuid(match[0])) {
      return match[0];
    }

    if (!isUuid(normalized)) {
      throw new BadRequestException(`${field} must be a valid UUID`);
    }
    return normalized;
  }

  private sendImage(
    response: Response,
    image: { buffer: Buffer; mimeType: string }
  ) {
    response.setHeader("Content-Type", image.mimeType);
    response.setHeader("Cache-Control", "private, max-age=300");
    response.send(image.buffer);
  }

  @Post(":productId/image")
  @Roles("SUPER_ADMIN", "SUPER_USER", "ADMIN")
  @RequirePermission({ menuKey: MENU_KEYS.INVENTORY_PRODUCTS, level: "WRITE" })
  @UseInterceptors(FileInterceptor("file"))
  uploadProductImage(
    @Param("productId") productId: string,
    @UploadedFile() file: UploadedInventoryImageFile | undefined,
    @Body("altText") altText: string | undefined,
    @Req() request: AuthRequest
  ) {
    const normalizedProductId = this.normalizeUuid(productId, "productId");
    return this.productImageService.uploadProductImage(
      this.getTenantId(request),
      normalizedProductId,
      file,
      altText
    );
  }

  @Delete(":productId/image")
  @Roles("SUPER_ADMIN", "SUPER_USER", "ADMIN")
  @RequirePermission({ menuKey: MENU_KEYS.INVENTORY_PRODUCTS, level: "WRITE" })
  deleteProductImage(
    @Param("productId") productId: string,
    @Req() request: AuthRequest
  ) {
    const normalizedProductId = this.normalizeUuid(productId, "productId");
    return this.productImageService.deleteProductImage(
      this.getTenantId(request),
      normalizedProductId
    );
  }

  @Get(":productId/image")
  @Roles("SUPER_ADMIN", "SUPER_USER", "ADMIN", "USER")
  @RequirePermission({
    menuKey: MENU_KEYS.INVENTORY_PRODUCTS,
    level: "READ",
    operationalRoles: operationalCatalogReadRoles,
  })
  async getProductImage(
    @Param("productId") productId: string,
    @Req() request: AuthRequest,
    @Res() response: Response
  ) {
    const normalizedProductId = this.normalizeUuid(productId, "productId");
    const image = await this.productImageService.readProductImage(
      this.getTenantId(request),
      normalizedProductId
    );
    this.sendImage(response, image);
  }

}
