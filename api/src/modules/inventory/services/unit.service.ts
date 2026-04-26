import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import crypto from "crypto";
import { UnitEntity } from "../entities/unit.entity";
import { UnitRepository } from "../repositories/unit.repository";

type CreateUnitInput = {
  tenantId: string;
  name: string;
  abbreviation: string;
  isActive?: boolean;
};

type UpdateUnitInput = Partial<Pick<CreateUnitInput, "name" | "abbreviation" | "isActive">>;

@Injectable()
export class UnitService {
  constructor(
    @Inject(UnitRepository)
    private readonly unitRepository: UnitRepository
  ) {}

  listUnits(tenantId: string) {
    return this.unitRepository.findAllByTenant(tenantId);
  }

  private validateName(name: string | undefined) {
    if (!name?.trim()) {
      throw new BadRequestException("name is required");
    }
  }

  private validateAbbreviation(abbreviation: string | undefined) {
    if (!abbreviation?.trim()) {
      throw new BadRequestException("abbreviation is required");
    }
  }

  async createUnit(data: CreateUnitInput) {
    this.validateName(data.name);
    this.validateAbbreviation(data.abbreviation);

    const entity = UnitEntity.create({
      id: crypto.randomUUID(),
      tenantId: data.tenantId,
      name: data.name.trim(),
      abbreviation: data.abbreviation.trim().toUpperCase(),
      isActive: data.isActive ?? true,
    });

    return this.unitRepository.create({
      id: entity.id,
      tenantId: entity.tenantId,
      name: entity.name,
      abbreviation: entity.abbreviation,
      isActive: entity.isActive,
    });
  }

  async updateUnit(id: string, tenantId: string, data: UpdateUnitInput) {
    const current = await this.unitRepository.findById(id, tenantId);
    if (!current) {
      throw new NotFoundException("unit not found");
    }

    if (data.name !== undefined) {
      this.validateName(data.name);
    }
    if (data.abbreviation !== undefined) {
      this.validateAbbreviation(data.abbreviation);
    }

    const updated = await this.unitRepository.update(id, tenantId, {
      name: data.name?.trim(),
      abbreviation: data.abbreviation?.trim().toUpperCase(),
      isActive: data.isActive,
    });

    if (!updated) {
      throw new NotFoundException("unit not found");
    }

    return updated;
  }

  async deleteUnit(id: string, tenantId: string) {
    const current = await this.unitRepository.findById(id, tenantId);
    if (!current) {
      throw new NotFoundException("unit not found");
    }

    const deleted = await this.unitRepository.softDelete(id, tenantId);
    if (!deleted) {
      throw new NotFoundException("unit not found");
    }

    return deleted;
  }
}
