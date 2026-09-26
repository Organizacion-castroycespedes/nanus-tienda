import {
  BadRequestException,
  Controller,
  Get,
  HttpCode,
  Inject,
  NotFoundException,
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
import { RequirePermission } from "../../../common/decorators/require-permission.decorator";
import { Roles } from "../../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../../../common/guards/permissions.guard";
import { RolesGuard } from "../../../common/guards/roles.guard";
import { STOCK_IMPORT_MAX_FILE_BYTES } from "./stock-import.columns";
import { StockImportService } from "./stock-import.service";

type AuthRequest = Request & {
  user?: {
    tenantId?: string;
    id?: string;
    roles?: string[];
  };
  context?: {
    tenantId?: string;
    userId?: string;
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
  limits: { fileSize: STOCK_IMPORT_MAX_FILE_BYTES, files: 1 },
});

@Controller("stock-import")
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Roles("SUPER_ADMIN", "SUPER_USER", "ADMIN")
export class StockImportController {
  constructor(
    @Inject(StockImportService)
    private readonly stockImportService: StockImportService
  ) {}

  private getTenantId(request: AuthRequest) {
    const tenantId = request.context?.tenantId ?? request.user?.tenantId;
    if (!tenantId) {
      throw new NotFoundException("tenant not found in request context");
    }
    return tenantId;
  }

  private buildActor(request: AuthRequest) {
    return {
      id: request.context?.userId ?? request.user?.id,
      tenantId: this.getTenantId(request),
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
  @RequirePermission({ menuKey: "INVENTORY", level: "WRITE" })
  async downloadTemplate(
    @Req() request: AuthRequest,
    @Res() response: Response,
    @Query("branchId") branchId?: string,
    @Query("prefill") prefill?: string
  ) {
    const buffer = await this.stockImportService.buildTemplate(
      this.getTenantId(request),
      this.buildActor(request),
      {
        branchId: branchId?.trim() || undefined,
        prefill: prefill === "true" || prefill === "1",
      }
    );
    response.setHeader("Content-Type", XLSX_CONTENT_TYPE);
    response.setHeader(
      "Content-Disposition",
      'attachment; filename="plantilla_carga_inicial_inventario.xlsx"'
    );
    response.send(buffer);
  }

  @Post("validate")
  @HttpCode(200)
  @RequirePermission({ menuKey: "INVENTORY", level: "WRITE" })
  @UseInterceptors(fileInterceptor)
  validate(
    @UploadedFile() file: UploadedSpreadsheetFile | undefined,
    @Req() request: AuthRequest
  ) {
    return this.stockImportService.validate(
      this.getTenantId(request),
      this.buildActor(request),
      this.getSpreadsheetBuffer(file)
    );
  }

  @Post("commit")
  @HttpCode(200)
  @RequirePermission({ menuKey: "INVENTORY", level: "WRITE" })
  @UseInterceptors(fileInterceptor)
  commit(
    @UploadedFile() file: UploadedSpreadsheetFile | undefined,
    @Req() request: AuthRequest
  ) {
    return this.stockImportService.commit(
      this.getTenantId(request),
      this.buildActor(request),
      this.getSpreadsheetBuffer(file)
    );
  }
}
