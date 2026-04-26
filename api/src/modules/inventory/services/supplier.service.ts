import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import crypto from "crypto";
import { SupplierEntity, type SupplierProps } from "../entities/supplier.entity";
import { SupplierRepository } from "../repositories/supplier.repository";

type CreateSupplierInput = {
  tenantId: string;
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

type UpdateSupplierInput = Partial<
  Pick<
    SupplierProps,
    | "name"
    | "documentNumber"
    | "phone"
    | "email"
    | "address"
    | "departamentoId"
    | "municipioId"
    | "ciudad"
    | "departamento"
    | "isActive"
  >
>;

@Injectable()
export class SupplierService {
  constructor(
    @Inject(SupplierRepository)
    private readonly supplierRepository: SupplierRepository
  ) {}

  private validateName(name: string | undefined) {
    if (!name?.trim()) {
      throw new BadRequestException("name is required");
    }
  }

  async createSupplier(data: CreateSupplierInput) {
    this.validateName(data.name);

    const now = new Date();
    const entity = SupplierEntity.create({
      id: crypto.randomUUID(),
      tenantId: data.tenantId,
      name: data.name.trim(),
      documentNumber: data.documentNumber ?? null,
      phone: data.phone ?? null,
      email: data.email ?? null,
      address: data.address ?? null,
      departamentoId: data.departamentoId ?? null,
      municipioId: data.municipioId ?? null,
      ciudad: data.ciudad ?? null,
      departamento: data.departamento ?? null,
      isActive: data.isActive ?? true,
      createdAt: now,
      updatedAt: now,
    });

    return this.supplierRepository.create({
      id: entity.id,
      tenantId: entity.tenantId,
      name: entity.name,
      documentNumber: entity.documentNumber,
      phone: entity.phone,
      email: entity.email,
      address: entity.address,
      departamentoId: entity.departamentoId,
      municipioId: entity.municipioId,
      ciudad: entity.ciudad,
      departamento: entity.departamento,
      isActive: entity.isActive,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    });
  }

  listSuppliers(tenantId: string) {
    return this.supplierRepository.findAllByTenant(tenantId);
  }

  async getSupplierById(id: string, tenantId: string) {
    const supplier = await this.supplierRepository.findById(id, tenantId);
    if (!supplier) {
      throw new NotFoundException("supplier not found");
    }
    return supplier;
  }

  async updateSupplier(
    id: string,
    tenantId: string,
    data: UpdateSupplierInput
  ) {
    const current = await this.supplierRepository.findById(id, tenantId);
    if (!current) {
      throw new NotFoundException("supplier not found");
    }

    if (data.name !== undefined) {
      this.validateName(data.name);
    }

    const updated = await this.supplierRepository.update(id, tenantId, {
      name: data.name?.trim(),
      documentNumber: data.documentNumber,
      phone: data.phone,
      email: data.email,
      address: data.address,
      departamentoId: data.departamentoId,
      municipioId: data.municipioId,
      ciudad: data.ciudad,
      departamento: data.departamento,
      isActive: data.isActive,
    });

    if (!updated) {
      throw new NotFoundException("supplier not found");
    }

    return updated;
  }

  async softDeleteSupplier(id: string, tenantId: string) {
    const current = await this.supplierRepository.findById(id, tenantId);
    if (!current) {
      throw new NotFoundException("supplier not found");
    }

    const deleted = await this.supplierRepository.softDelete(id, tenantId);
    if (!deleted) {
      throw new NotFoundException("supplier not found");
    }

    return deleted;
  }
}
