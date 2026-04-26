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
import { SupplierService } from "../services/supplier.service";

type AuthRequest = Request & {
  user?: {
    tenantId?: string;
  };
};

type CreateSupplierBody = {
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

type UpdateSupplierBody = Partial<CreateSupplierBody>;

@Controller("suppliers")
@UseGuards(JwtAuthGuard)
export class SupplierController {
  constructor(
    @Inject(SupplierService)
    private readonly supplierService: SupplierService
  ) {}

  private getTenantId(request: AuthRequest) {
    const tenantId = request.user?.tenantId;
    if (!tenantId) {
      throw new NotFoundException("tenant not found in request context");
    }
    return tenantId;
  }

  @Post()
  create(@Body() body: CreateSupplierBody, @Req() request: AuthRequest) {
    return this.supplierService.createSupplier({
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
    return this.supplierService.listSuppliers(this.getTenantId(request));
  }

  @Get(":id")
  getById(@Param("id") id: string, @Req() request: AuthRequest) {
    return this.supplierService.getSupplierById(id, this.getTenantId(request));
  }

  @Put(":id")
  update(
    @Param("id") id: string,
    @Body() body: UpdateSupplierBody,
    @Req() request: AuthRequest
  ) {
    return this.supplierService.updateSupplier(
      id,
      this.getTenantId(request),
      body
    );
  }

  @Delete(":id")
  remove(@Param("id") id: string, @Req() request: AuthRequest) {
    return this.supplierService.softDeleteSupplier(id, this.getTenantId(request));
  }
}
