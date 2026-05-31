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
import type { CreateElectronicInvoicingCustomerDto } from "./dto/create-electronic-invoicing-customer.dto";
import type { ListElectronicInvoicingCustomersDto } from "./dto/list-electronic-invoicing-customers.dto";
import type { UpdateElectronicInvoicingCustomerDto } from "./dto/update-electronic-invoicing-customer.dto";
import { ElectronicInvoicingCustomersService } from "./electronic-invoicing-customers.service";

type AuthRequest = Request & {
  user?: {
    tenantId?: string;
  };
};

@Controller("electronic-invoicing/customers")
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Roles("SUPER_ADMIN", "SUPER_USER", "ADMIN", "USER")
export class ElectronicInvoicingCustomersController {
  constructor(
    @Inject(ElectronicInvoicingCustomersService)
    private readonly customersService: ElectronicInvoicingCustomersService
  ) {}

  private getTenantId(request: AuthRequest) {
    const tenantId = request.user?.tenantId;
    if (!tenantId) {
      throw new NotFoundException("tenant not found in request context");
    }
    return tenantId;
  }

  @Get()
  @RequirePermission({ menuKey: MENU_KEYS.ELECTRONIC_INVOICING_CUSTOMERS, level: "READ" })
  list(
    @Query() query: ListElectronicInvoicingCustomersDto,
    @Req() request: AuthRequest
  ) {
    return this.customersService.listCustomers(this.getTenantId(request), query);
  }

  @Post()
  @RequirePermission({ menuKey: MENU_KEYS.ELECTRONIC_INVOICING_CUSTOMERS, level: "WRITE" })
  create(
    @Body() body: CreateElectronicInvoicingCustomerDto,
    @Req() request: AuthRequest
  ) {
    return this.customersService.createCustomer(
      this.getTenantId(request),
      body
    );
  }

  @Patch(":id")
  @RequirePermission({ menuKey: MENU_KEYS.ELECTRONIC_INVOICING_CUSTOMERS, level: "WRITE" })
  update(
    @Param("id") id: string,
    @Body() body: UpdateElectronicInvoicingCustomerDto,
    @Req() request: AuthRequest
  ) {
    return this.customersService.updateCustomer(
      id,
      this.getTenantId(request),
      body
    );
  }

  @Get("default")
  @RequirePermission({ menuKey: MENU_KEYS.ELECTRONIC_INVOICING_CUSTOMERS, level: "READ" })
  getDefault(@Req() request: AuthRequest) {
    return this.customersService.getDefaultFinalConsumer(
      this.getTenantId(request)
    );
  }

  @Post("default/ensure")
  @RequirePermission({ menuKey: MENU_KEYS.ELECTRONIC_INVOICING_CUSTOMERS, level: "WRITE" })
  ensureDefault(@Req() request: AuthRequest) {
    return this.customersService.ensureDefaultFinalConsumer(
      this.getTenantId(request)
    );
  }
}
