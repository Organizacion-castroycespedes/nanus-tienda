import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Inject,
  NotFoundException,
  Param,
  Post,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import type { Request } from "express";
import { RequirePermission } from "../../../common/decorators/require-permission.decorator";
import { Roles } from "../../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../../../common/guards/permissions.guard";
import { RolesGuard } from "../../../common/guards/roles.guard";
import { ProductSerialService, type SerialFile } from "./product-serial.service";

type AuthRequest = Request & {
  user?: { tenantId?: string; id?: string; roles?: string[] };
  context?: { tenantId?: string; userId?: string; branchId?: string };
};

type ValidateSerialsBody = {
  productId?: string;
  branchId?: string;
  serialNumbers?: unknown;
};

const SERIAL_FILE_MAX_BYTES = 2 * 1024 * 1024;

const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

/** Lectura y prevalidación de series (V117). Las escrituras viven en compras, ventas, pedidos y ajustes. */
@Controller("inventory/serials")
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class ProductSerialController {
  constructor(
    @Inject(ProductSerialService)
    private readonly service: ProductSerialService
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
      roles: Array.isArray(request.user?.roles) ? request.user.roles : [],
      userId: request.context?.userId ?? request.user?.id,
      tenantId: request.context?.tenantId ?? request.user?.tenantId,
      branchId: request.context?.branchId,
    };
  }

  private requireUuid(value: string | undefined, field: string) {
    if (!value || !isUuid(value)) {
      throw new BadRequestException(`${field} must be a valid UUID`);
    }
    return value;
  }

  private optionalUuid(value: string | undefined, field: string) {
    if (value === undefined || value === "") {
      return undefined;
    }
    return this.requireUuid(value, field);
  }

  private optionalInt(value: string | undefined, field: string) {
    if (value === undefined || value === "") {
      return undefined;
    }
    const parsed = Number(value);
    if (!Number.isInteger(parsed)) {
      throw new BadRequestException(`${field} must be an integer`);
    }
    return parsed;
  }

  @Post("validate")
  @Roles("SUPER_ADMIN", "SUPER_USER", "ADMIN")
  @RequirePermission({ menuKey: ["INVENTORY_PURCHASES", "INVENTORY_SERIALS", "INVENTORY"], level: "READ" })
  validate(@Body() body: ValidateSerialsBody, @Req() request: AuthRequest) {
    return this.service.prevalidate(
      this.getTenantId(request),
      {
        productId: this.requireUuid(body?.productId, "productId"),
        branchId: this.requireUuid(body?.branchId, "branchId"),
        serialNumbers: body?.serialNumbers,
      },
      this.buildActor(request)
    );
  }

  @Post("parse")
  @Roles("SUPER_ADMIN", "SUPER_USER", "ADMIN")
  @RequirePermission({ menuKey: ["INVENTORY_PURCHASES", "INVENTORY_SERIALS", "INVENTORY"], level: "READ" })
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: SERIAL_FILE_MAX_BYTES, files: 1 } }))
  parse(@UploadedFile() file: SerialFile | undefined) {
    return this.service.parseFile(file);
  }

  @Get("available")
  @Roles("SUPER_ADMIN", "SUPER_USER", "ADMIN", "USER")
  @RequirePermission({ menuKey: ["POS", "ORDERS", "INVENTORY_SERIALS", "INVENTORY"], level: "READ" })
  available(
    @Query("productId") productId: string | undefined,
    @Query("branchId") branchId: string | undefined,
    @Query("status") status: string | undefined,
    @Query("search") search: string | undefined,
    @Query("limit") limit: string | undefined,
    @Query("offset") offset: string | undefined,
    @Req() request: AuthRequest
  ) {
    return this.service.listByProduct(
      this.getTenantId(request),
      {
        productId: this.requireUuid(productId, "productId"),
        branchId: this.requireUuid(branchId, "branchId"),
        status,
        search,
        limit: this.optionalInt(limit, "limit"),
        offset: this.optionalInt(offset, "offset"),
      },
      this.buildActor(request)
    );
  }

  @Get("lookup")
  @Roles("SUPER_ADMIN", "SUPER_USER", "ADMIN", "USER")
  @RequirePermission({ menuKey: ["POS", "ORDERS", "INVENTORY_SERIALS", "INVENTORY"], level: "READ" })
  lookup(
    @Query("serial") serial: string | undefined,
    @Query("branchId") branchId: string | undefined,
    @Query("productId") productId: string | undefined,
    @Req() request: AuthRequest
  ) {
    return this.service.lookup(
      this.getTenantId(request),
      {
        serialNumber: serial,
        branchId: this.optionalUuid(branchId, "branchId"),
        productId: this.optionalUuid(productId, "productId"),
      },
      this.buildActor(request)
    );
  }

  @Get()
  @Roles("SUPER_ADMIN", "SUPER_USER", "ADMIN", "USER")
  @RequirePermission({ menuKey: ["INVENTORY_SERIALS", "INVENTORY"], level: "READ" })
  search(
    @Query("search") search: string | undefined,
    @Query("productId") productId: string | undefined,
    @Query("branchId") branchId: string | undefined,
    @Query("status") status: string | undefined,
    @Query("limit") limit: string | undefined,
    @Query("offset") offset: string | undefined,
    @Req() request: AuthRequest
  ) {
    return this.service.search(
      this.getTenantId(request),
      {
        search,
        productId: this.optionalUuid(productId, "productId"),
        branchId: this.optionalUuid(branchId, "branchId"),
        status,
        limit: this.optionalInt(limit, "limit"),
        offset: this.optionalInt(offset, "offset"),
      },
      this.buildActor(request)
    );
  }

  @Get(":serialId/history")
  @Roles("SUPER_ADMIN", "SUPER_USER", "ADMIN", "USER")
  @RequirePermission({ menuKey: ["INVENTORY_SERIALS", "INVENTORY"], level: "READ" })
  history(@Param("serialId") serialId: string, @Req() request: AuthRequest) {
    return this.service.getHistory(
      this.getTenantId(request),
      this.requireUuid(serialId, "serialId"),
      this.buildActor(request)
    );
  }
}
