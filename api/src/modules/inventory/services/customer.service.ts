import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import crypto from "crypto";
import { CustomerEntity, type CustomerProps } from "../entities/customer.entity";
import { CustomerRepository } from "../repositories/customer.repository";

type CreateCustomerInput = {
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

type UpdateCustomerInput = Partial<
  Pick<
    CustomerProps,
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
export class CustomerService {
  constructor(
    @Inject(CustomerRepository)
    private readonly customerRepository: CustomerRepository
  ) {}

  private validateName(name: string | undefined) {
    if (!name?.trim()) {
      throw new BadRequestException("name is required");
    }
  }

  async createCustomer(data: CreateCustomerInput) {
    this.validateName(data.name);

    const now = new Date();
    const entity = CustomerEntity.create({
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

    return this.customerRepository.create({
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

  listCustomers(tenantId: string) {
    return this.customerRepository.findAllByTenant(tenantId);
  }

  searchCustomers(
    tenantId: string,
    options: { query?: string; limit?: number } = {}
  ) {
    return this.customerRepository.findAllByTenant(tenantId, {
      query: options.query,
      limit: options.limit,
    });
  }

  async getCustomerById(id: string, tenantId: string) {
    const customer = await this.customerRepository.findById(id, tenantId);
    if (!customer) {
      throw new NotFoundException("customer not found");
    }
    return customer;
  }

  async updateCustomer(id: string, tenantId: string, data: UpdateCustomerInput) {
    const current = await this.customerRepository.findById(id, tenantId);
    if (!current) {
      throw new NotFoundException("customer not found");
    }

    if (data.name !== undefined) {
      this.validateName(data.name);
    }

    if (current.isFinalConsumer && data.isActive === false) {
      throw new BadRequestException("final consumer cannot be deleted");
    }

    const updated = await this.customerRepository.update(id, tenantId, {
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
      throw new NotFoundException("customer not found");
    }

    return updated;
  }

  async softDeleteCustomer(id: string, tenantId: string) {
    const current = await this.customerRepository.findById(id, tenantId);
    if (!current) {
      throw new NotFoundException("customer not found");
    }
    if (current.isFinalConsumer) {
      throw new BadRequestException("final consumer cannot be deleted");
    }

    const deleted = await this.customerRepository.softDelete(id, tenantId);
    if (!deleted) {
      throw new NotFoundException("customer not found");
    }

    return deleted;
  }
}
