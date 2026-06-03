import {
  Body,
  Controller,
  Get,
  Inject,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import type { Request } from "express";
import { MENU_KEYS } from "../../../common/constants/menu-keys";
import { RequirePermission } from "../../../common/decorators/require-permission.decorator";
import { Roles } from "../../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../../../common/guards/permissions.guard";
import { RolesGuard } from "../../../common/guards/roles.guard";
import type { CreateElectronicInvoicingSupplierDto } from "./dto/create-electronic-invoicing-supplier.dto";
import type { ListElectronicInvoicingSuppliersDto } from "./dto/list-electronic-invoicing-suppliers.dto";
import type { UpdateElectronicInvoicingSupplierDto } from "./dto/update-electronic-invoicing-supplier.dto";
import type {
  ApplyThirdPartyLookupDto,
  ThirdPartyLookupDto,
} from "../third-party-lookup/dto/third-party-lookup.dto";
import { ElectronicInvoicingSuppliersService } from "./electronic-invoicing-suppliers.service";

type AuthRequest = Request & {
  user?: {
    tenantId?: string;
  };
};

@Controller("electronic-invoicing/suppliers")
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Roles("SUPER_ADMIN", "SUPER_USER", "ADMIN", "USER")
export class ElectronicInvoicingSuppliersController {
  constructor(
    @Inject(ElectronicInvoicingSuppliersService)
    private readonly suppliersService: ElectronicInvoicingSuppliersService
  ) {}

  private getTenantId(request: AuthRequest) {
    const tenantId = request.user?.tenantId;
    if (!tenantId) {
      throw new NotFoundException("tenant not found in request context");
    }
    return tenantId;
  }

  @Get()
  @RequirePermission({ menuKey: MENU_KEYS.ELECTRONIC_INVOICING_SUPPLIERS, level: "READ" })
  list(
    @Query() query: ListElectronicInvoicingSuppliersDto,
    @Req() request: AuthRequest
  ) {
    return this.suppliersService.listSuppliers(this.getTenantId(request), query);
  }

  @Post()
  @RequirePermission({ menuKey: MENU_KEYS.ELECTRONIC_INVOICING_SUPPLIERS, level: "WRITE" })
  create(
    @Body() body: CreateElectronicInvoicingSupplierDto,
    @Req() request: AuthRequest
  ) {
    return this.suppliersService.createSupplier(
      this.getTenantId(request),
      body
    );
  }

  @Post("lookup")
  @RequirePermission({ menuKey: MENU_KEYS.ELECTRONIC_INVOICING_SUPPLIERS, level: "READ" })
  lookup(
    @Body() body: ThirdPartyLookupDto,
    @Req() request: AuthRequest
  ) {
    return this.suppliersService.lookupSupplierFiscalData(
      this.getTenantId(request),
      body
    );
  }

  @Patch(":id")
  @RequirePermission({ menuKey: MENU_KEYS.ELECTRONIC_INVOICING_SUPPLIERS, level: "WRITE" })
  update(
    @Param("id") id: string,
    @Body() body: UpdateElectronicInvoicingSupplierDto,
    @Req() request: AuthRequest
  ) {
    return this.suppliersService.updateSupplier(
      id,
      this.getTenantId(request),
      body
    );
  }

  @Post(":id/apply-lookup")
  @RequirePermission({ menuKey: MENU_KEYS.ELECTRONIC_INVOICING_SUPPLIERS, level: "WRITE" })
  applyLookup(
    @Param("id") id: string,
    @Body() body: ApplyThirdPartyLookupDto,
    @Req() request: AuthRequest
  ) {
    return this.suppliersService.applySupplierLookup(
      id,
      this.getTenantId(request),
      body
    );
  }

  @Get(":id")
  @RequirePermission({ menuKey: MENU_KEYS.ELECTRONIC_INVOICING_SUPPLIERS, level: "READ" })
  getById(@Param("id") id: string, @Req() request: AuthRequest) {
    return this.suppliersService.getSupplier(id, this.getTenantId(request));
  }
}
