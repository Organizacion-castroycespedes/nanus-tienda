import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import crypto from "crypto";
import { TaxEntity } from "../entities/tax.entity";
import { TaxRepository } from "../repositories/tax.repository";

type CreateTaxInput = {
  tenantId: string;
  name: string;
  rate: number;
  isIncluded: boolean;
  isActive?: boolean;
};

type UpdateTaxInput = Partial<Pick<CreateTaxInput, "name" | "rate" | "isIncluded" | "isActive">>;

@Injectable()
export class TaxService {
  constructor(
    @Inject(TaxRepository)
    private readonly taxRepository: TaxRepository
  ) {}

  listTaxes(tenantId: string) {
    return this.taxRepository.findAllByTenant(tenantId);
  }

  private validateName(name: string | undefined) {
    if (!name?.trim()) {
      throw new BadRequestException("name is required");
    }
  }

  private validateRate(rate: number | undefined) {
    if (rate === undefined || Number.isNaN(rate) || rate < 0) {
      throw new BadRequestException("rate must be a non-negative number");
    }
  }

  async createTax(data: CreateTaxInput) {
    this.validateName(data.name);
    this.validateRate(data.rate);

    const entity = TaxEntity.create({
      id: crypto.randomUUID(),
      tenantId: data.tenantId,
      name: data.name.trim(),
      rate: data.rate,
      isIncluded: data.isIncluded,
      isActive: data.isActive ?? true,
    });

    return this.taxRepository.create({
      id: entity.id,
      tenantId: entity.tenantId,
      name: entity.name,
      rate: entity.rate,
      isIncluded: entity.isIncluded,
      isActive: entity.isActive,
    });
  }

  async updateTax(id: string, tenantId: string, data: UpdateTaxInput) {
    const current = await this.taxRepository.findById(id, tenantId);
    if (!current) {
      throw new NotFoundException("tax not found");
    }

    if (data.name !== undefined) {
      this.validateName(data.name);
    }
    if (data.rate !== undefined) {
      this.validateRate(data.rate);
    }

    const updated = await this.taxRepository.update(id, tenantId, {
      name: data.name?.trim(),
      rate: data.rate,
      isIncluded: data.isIncluded,
      isActive: data.isActive,
    });

    if (!updated) {
      throw new NotFoundException("tax not found");
    }

    return updated;
  }

  async deleteTax(id: string, tenantId: string) {
    const current = await this.taxRepository.findById(id, tenantId);
    if (!current) {
      throw new NotFoundException("tax not found");
    }

    const deleted = await this.taxRepository.softDelete(id, tenantId);
    if (!deleted) {
      throw new NotFoundException("tax not found");
    }

    return deleted;
  }
}
