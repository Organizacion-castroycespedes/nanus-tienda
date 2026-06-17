import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  NotFoundException,
  Param,
  Patch,
  Post,
  Put,
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
import type { ProductImageMimeType } from "../entities/product-category.entity";
import type { UploadedInventoryImageFile } from "../services/local-image-storage.service";
import { ProductCategoryService } from "../services/product-category.service";
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

type CreateProductCategoryBody = {
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

type UpdateProductCategoryBody = Partial<CreateProductCategoryBody>;

const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value
  );

const operationalCatalogReadRoles = ["USER", "ADMIN", "SUPER_USER"];

@Controller("inventory/product-categories")
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class ProductCategoryController {
  constructor(
    @Inject(ProductCategoryService)
    private readonly productCategoryService: ProductCategoryService,
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

  private sendImage(
    response: Response,
    image: { buffer: Buffer; mimeType: string }
  ) {
    response.setHeader("Content-Type", image.mimeType);
    response.setHeader("Cache-Control", "private, max-age=300");
    response.send(image.buffer);
  }

  @Get()
  @Roles("SUPER_ADMIN", "SUPER_USER", "ADMIN", "USER")
  @RequirePermission({
    menuKey: MENU_KEYS.INVENTORY_PRODUCTS,
    level: "READ",
    operationalRoles: operationalCatalogReadRoles,
  })
  list(
    @Query("isActive") isActive: string | undefined,
    @Query("search") search: string | undefined,
    @Req() request: AuthRequest
  ) {
    return this.productCategoryService.list(this.getTenantId(request), {
      isActive: this.parseOptionalBoolean(isActive, "isActive"),
      search,
    });
  }

  @Get(":categoryId")
  @Roles("SUPER_ADMIN", "SUPER_USER", "ADMIN", "USER")
  @RequirePermission({
    menuKey: MENU_KEYS.INVENTORY_PRODUCTS,
    level: "READ",
    operationalRoles: operationalCatalogReadRoles,
  })
  getById(
    @Param("categoryId") categoryId: string,
    @Req() request: AuthRequest
  ) {
    this.assertUuid(categoryId, "categoryId");
    return this.productCategoryService.getById(
      this.getTenantId(request),
      categoryId
    );
  }

  @Post()
  @Roles("SUPER_ADMIN", "SUPER_USER", "ADMIN")
  @RequirePermission({ menuKey: MENU_KEYS.INVENTORY_PRODUCTS, level: "WRITE" })
  create(@Body() body: CreateProductCategoryBody, @Req() request: AuthRequest) {
    return this.productCategoryService.create({
      ...body,
      tenantId: this.getTenantId(request),
    });
  }

  @Post(":categoryId/image")
  @Roles("SUPER_ADMIN", "SUPER_USER", "ADMIN")
  @RequirePermission({ menuKey: MENU_KEYS.INVENTORY_PRODUCTS, level: "WRITE" })
  @UseInterceptors(FileInterceptor("file"))
  uploadImage(
    @Param("categoryId") categoryId: string,
    @UploadedFile() file: UploadedInventoryImageFile | undefined,
    @Body("altText") altText: string | undefined,
    @Req() request: AuthRequest
  ) {
    this.assertUuid(categoryId, "categoryId");
    return this.productImageService.uploadCategoryImage(
      this.getTenantId(request),
      categoryId,
      file,
      altText
    );
  }

  @Delete(":categoryId/image")
  @Roles("SUPER_ADMIN", "SUPER_USER", "ADMIN")
  @RequirePermission({ menuKey: MENU_KEYS.INVENTORY_PRODUCTS, level: "WRITE" })
  deleteImage(
    @Param("categoryId") categoryId: string,
    @Req() request: AuthRequest
  ) {
    this.assertUuid(categoryId, "categoryId");
    return this.productImageService.deleteCategoryImage(
      this.getTenantId(request),
      categoryId
    );
  }

  @Get(":categoryId/image")
  @Roles("SUPER_ADMIN", "SUPER_USER", "ADMIN", "USER")
  @RequirePermission({
    menuKey: MENU_KEYS.INVENTORY_PRODUCTS,
    level: "READ",
    operationalRoles: operationalCatalogReadRoles,
  })
  async getImage(
    @Param("categoryId") categoryId: string,
    @Req() request: AuthRequest,
    @Res() response: Response
  ) {
    this.assertUuid(categoryId, "categoryId");
    const image = await this.productImageService.readCategoryImage(
      this.getTenantId(request),
      categoryId
    );
    this.sendImage(response, image);
  }

  @Put(":categoryId")
  @Roles("SUPER_ADMIN", "SUPER_USER", "ADMIN")
  @RequirePermission({ menuKey: MENU_KEYS.INVENTORY_PRODUCTS, level: "WRITE" })
  update(
    @Param("categoryId") categoryId: string,
    @Body() body: UpdateProductCategoryBody,
    @Req() request: AuthRequest
  ) {
    this.assertUuid(categoryId, "categoryId");
    return this.productCategoryService.update({
      ...body,
      tenantId: this.getTenantId(request),
      categoryId,
    });
  }

  @Patch(":categoryId/activate")
  @Roles("SUPER_ADMIN", "SUPER_USER", "ADMIN")
  @RequirePermission({ menuKey: MENU_KEYS.INVENTORY_PRODUCTS, level: "WRITE" })
  activate(
    @Param("categoryId") categoryId: string,
    @Req() request: AuthRequest
  ) {
    this.assertUuid(categoryId, "categoryId");
    return this.productCategoryService.activate(
      this.getTenantId(request),
      categoryId
    );
  }

  @Patch(":categoryId/deactivate")
  @Roles("SUPER_ADMIN", "SUPER_USER", "ADMIN")
  @RequirePermission({ menuKey: MENU_KEYS.INVENTORY_PRODUCTS, level: "WRITE" })
  deactivate(
    @Param("categoryId") categoryId: string,
    @Req() request: AuthRequest
  ) {
    this.assertUuid(categoryId, "categoryId");
    return this.productCategoryService.deactivate(
      this.getTenantId(request),
      categoryId
    );
  }
}
