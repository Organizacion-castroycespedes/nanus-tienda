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
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import type { Request } from "express";
import { RequirePermission } from "../../../common/decorators/require-permission.decorator";
import { Roles } from "../../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../../../common/guards/permissions.guard";
import { RolesGuard } from "../../../common/guards/roles.guard";
import { CustomerService } from "../services/customer.service";

type AuthRequest = Request & {
  user?: {
    tenantId?: string;
  };
};

type CreateCustomerBody = {
  name: string;
  documentNumber?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  departamentoId?: string | null;
  municipioId?: string | null;
  ciudad?: string | null;
  departamento?: string | null;
  isActive?: boolean;
};

type UpdateCustomerBody = Partial<CreateCustomerBody>;

const customerOperationalRoles = ["USER", "ADMIN", "SUPER_USER"];

@Controller("customers")
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Roles("SUPER_ADMIN", "SUPER_USER", "ADMIN", "USER")
export class CustomerController {
  constructor(
    @Inject(CustomerService)
    private readonly customerService: CustomerService
  ) {}

  private getTenantId(request: AuthRequest) {
    const tenantId = request.user?.tenantId;
    if (!tenantId) {
      throw new NotFoundException("tenant not found in request context");
    }
    return tenantId;
  }

  @Post()
  @RequirePermission({
    menuKey: "CUSTOMERS",
    level: "WRITE",
    operationalRoles: customerOperationalRoles,
  })
  create(@Body() body: CreateCustomerBody, @Req() request: AuthRequest) {
    return this.customerService.createCustomer({
      tenantId: this.getTenantId(request),
      name: body.name,
      documentNumber: body.documentNumber,
      phone: body.phone,
      email: body.email,
      address: body.address,
      departamentoId: body.departamentoId,
      municipioId: body.municipioId,
      ciudad: body.ciudad,
      departamento: body.departamento,
      isActive: body.isActive,
    });
  }

  @Get()
  @RequirePermission({
    menuKey: "CUSTOMERS",
    level: "READ",
    operationalRoles: customerOperationalRoles,
  })
  list(
    @Query("query") query: string | undefined,
    @Query("limit") limit: string | undefined,
    @Req() request: AuthRequest
  ) {
    const parsedLimit = limit ? Number(limit) : NaN;
    return this.customerService.searchCustomers(this.getTenantId(request), {
      query,
      limit: Number.isFinite(parsedLimit) ? parsedLimit : undefined,
    });
  }

  @Get(":id")
  @RequirePermission({
    menuKey: "CUSTOMERS",
    level: "READ",
    operationalRoles: customerOperationalRoles,
  })
  getById(@Param("id") id: string, @Req() request: AuthRequest) {
    return this.customerService.getCustomerById(id, this.getTenantId(request));
  }

  @Put(":id")
  @RequirePermission({
    menuKey: "CUSTOMERS",
    level: "WRITE",
    operationalRoles: customerOperationalRoles,
  })
  update(
    @Param("id") id: string,
    @Body() body: UpdateCustomerBody,
    @Req() request: AuthRequest
  ) {
    return this.customerService.updateCustomer(id, this.getTenantId(request), body);
  }

  @Delete(":id")
  @Roles("SUPER_ADMIN", "SUPER_USER", "ADMIN")
  @RequirePermission({ menuKey: "CUSTOMERS", level: "WRITE" })
  remove(@Param("id") id: string, @Req() request: AuthRequest) {
    return this.customerService.softDeleteCustomer(id, this.getTenantId(request));
  }
}
