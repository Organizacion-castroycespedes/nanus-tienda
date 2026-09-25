import {
  BadRequestException,
  Controller,
  Get,
  HttpCode,
  Inject,
  NotFoundException,
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
import { PRODUCT_IMPORT_MAX_FILE_BYTES } from "./product-import.columns";
import { ProductImportService } from "./product-import.service";

type AuthRequest = Request & {
  user?: {
    tenantId?: string;
    id?: string;
    roles?: string[];
  };
};

type UploadedSpreadsheetFile = {
  originalname?: string;
  mimetype?: string;
  size?: number;
  buffer?: Buffer;
};

const XLSX_MIME_TYPES = new Set([
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/octet-stream",
  "application/zip",
]);

const XLSX_CONTENT_TYPE =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

const fileInterceptor = FileInterceptor("file", {
  limits: { fileSize: PRODUCT_IMPORT_MAX_FILE_BYTES, files: 1 },
});

@Controller("products/import")
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class ProductImportController {
  constructor(
    @Inject(ProductImportService)
    private readonly productImportService: ProductImportService
  ) {}

  private getTenantId(request: AuthRequest) {
    const tenantId = request.user?.tenantId;
    if (!tenantId) {
      throw new NotFoundException("tenant not found in request context");
    }
    return tenantId;
  }

  private buildActor(request: AuthRequest) {
    return {
      id: request.user?.id,
      tenantId: request.user?.tenantId,
      roles: Array.isArray(request.user?.roles) ? request.user.roles : [],
    };
  }

  private getSpreadsheetBuffer(file: UploadedSpreadsheetFile | undefined) {
    if (!file?.buffer || file.buffer.length === 0) {
      throw new BadRequestException("Adjunte un archivo .xlsx en el campo file.");
    }
    const name = file.originalname?.toLowerCase() ?? "";
    if (!name.endsWith(".xlsx")) {
      throw new BadRequestException("Solo se permiten archivos .xlsx.");
    }
    if (file.mimetype && !XLSX_MIME_TYPES.has(file.mimetype)) {
      throw new BadRequestException("Solo se permiten archivos .xlsx.");
    }
    return file.buffer;
  }

  @Get("template")
  @Roles("SUPER_ADMIN", "SUPER_USER", "ADMIN")
  @RequirePermission({ menuKey: MENU_KEYS.INVENTORY_PRODUCTS, level: "WRITE" })
  async downloadTemplate(@Req() request: AuthRequest, @Res() response: Response) {
    const buffer = await this.productImportService.buildTemplate(
      this.getTenantId(request)
    );
    response.setHeader("Content-Type", XLSX_CONTENT_TYPE);
    response.setHeader(
      "Content-Disposition",
      'attachment; filename="plantilla_carga_productos.xlsx"'
    );
    response.send(buffer);
  }

  @Post("validate")
  @HttpCode(200)
  @Roles("SUPER_ADMIN", "SUPER_USER", "ADMIN")
  @RequirePermission({ menuKey: MENU_KEYS.INVENTORY_PRODUCTS, level: "WRITE" })
  @UseInterceptors(fileInterceptor)
  validate(
    @UploadedFile() file: UploadedSpreadsheetFile | undefined,
    @Req() request: AuthRequest
  ) {
    return this.productImportService.validate(
      this.getTenantId(request),
      this.buildActor(request),
      this.getSpreadsheetBuffer(file)
    );
  }

  @Post("commit")
  @HttpCode(200)
  @Roles("SUPER_ADMIN", "SUPER_USER", "ADMIN")
  @RequirePermission({ menuKey: MENU_KEYS.INVENTORY_PRODUCTS, level: "WRITE" })
  @UseInterceptors(fileInterceptor)
  commit(
    @UploadedFile() file: UploadedSpreadsheetFile | undefined,
    @Req() request: AuthRequest
  ) {
    return this.productImportService.commit(
      this.getTenantId(request),
      this.buildActor(request),
      this.getSpreadsheetBuffer(file)
    );
  }
}
