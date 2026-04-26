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
  Req,
  UseGuards,
} from "@nestjs/common";
import type { Request } from "express";
import { JwtAuthGuard } from "../../../common/guards/jwt-auth.guard";
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

@Controller("customers")
@UseGuards(JwtAuthGuard)
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
  list(@Req() request: AuthRequest) {
    return this.customerService.listCustomers(this.getTenantId(request));
  }

  @Get(":id")
  getById(@Param("id") id: string, @Req() request: AuthRequest) {
    return this.customerService.getCustomerById(id, this.getTenantId(request));
  }

  @Put(":id")
  update(
    @Param("id") id: string,
    @Body() body: UpdateCustomerBody,
    @Req() request: AuthRequest
  ) {
    return this.customerService.updateCustomer(id, this.getTenantId(request), body);
  }

  @Delete(":id")
  remove(@Param("id") id: string, @Req() request: AuthRequest) {
    return this.customerService.softDeleteCustomer(id, this.getTenantId(request));
  }
}
