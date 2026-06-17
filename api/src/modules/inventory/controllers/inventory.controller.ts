import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Post,
  Query,
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
import { InventoryService } from "../services/inventory.service";

type AuthRequest = Request & {
  user?: {
    id?: string;
    tenantId?: string;
    roles?: string[];
  };
  context?: {
    userId?: string;
    tenantId?: string;
    branchId?: string;
    terminalId?: string;
    posSessionId?: string;
  };
};

const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value
  );

const operationalCatalogReadRoles = ["USER", "ADMIN", "SUPER_USER"];

@Controller("inventory")
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Roles("SUPER_ADMIN", "SUPER_USER", "ADMIN", "USER")
export class InventoryController {
  constructor(
    @Inject(InventoryService)
    private readonly inventoryService: InventoryService,
    @Inject(ProductImageService)
    private readonly productImageService: ProductImageService
  ) {}

  private buildActor(request: AuthRequest) {
    return {
      roles: Array.isArray(request.user?.roles) ? request.user.roles : [],
      userId: request.context?.userId ?? request.user?.id,
      tenantId: request.context?.tenantId ?? request.user?.tenantId,
      branchId: request.context?.branchId,
      terminalId: request.context?.terminalId,
      posSessionId: request.context?.posSessionId,
    };
  }

  private getTenantId(request: AuthRequest) {
    const tenantId = request.context?.tenantId ?? request.user?.tenantId;
    if (!tenantId) {
      throw new BadRequestException("tenant not found in request context");
    }
    return tenantId;
  }

  private normalizeUuid(value: string, field: string) {
    const normalized = value?.trim() ?? "";
    if (isUuid(normalized)) {
      return normalized;
    }

    const match = normalized.match(
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i
    );
    if (match?.[0] && isUuid(match[0])) {
      return match[0];
    }

    throw new BadRequestException(`${field} must be a valid UUID`);
  }

  private sendImage(
    response: Response,
    image: { buffer: Buffer; mimeType: string }
  ) {
    response.setHeader("Content-Type", image.mimeType);
    response.setHeader("Cache-Control", "private, max-age=300");
    response.send(image.buffer);
  }

  @Post("products/:productId/image")
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

  @Delete("products/:productId/image")
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

  @Get("products/:productId/image")
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

  @Get("products")
  @RequirePermission({ menuKey: "INVENTORY_PRODUCTS", level: "READ" })
  listProducts(
    @Query("tenantId") tenantId: string | undefined,
    @Query("branchId") branchId: string | undefined,
    @Req() request: AuthRequest
  ) {
    return this.inventoryService.listInventoryProducts(
      {
        tenantId,
        branchId,
      },
      this.buildActor(request)
    );
  }

  @Get("dashboard")
  @RequirePermission({ menuKey: "INVENTORY", level: "READ" })
  getDashboard(
    @Query("tenantId") tenantId: string | undefined,
    @Query("branchId") branchId: string | undefined,
    @Query("terminalId") terminalId: string | undefined,
    @Query("cashSessionId") cashSessionId: string | undefined,
    @Query("startDate") startDate: string | undefined,
    @Query("endDate") endDate: string | undefined,
    @Req() request: AuthRequest
  ) {
    return this.inventoryService.getInventoryDashboard(
      {
        tenantId,
        branchId,
        terminalId,
        cashSessionId,
        startDate,
        endDate,
      },
      this.buildActor(request)
    );
  }
}
