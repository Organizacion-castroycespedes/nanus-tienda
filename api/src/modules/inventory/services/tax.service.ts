import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import crypto from "crypto";
import { TaxEntity } from "../entities/tax.entity";
import { TaxRepository } from "../repositories/tax.repository";

type CreateTaxInput = {
  tenantId: string;
  name: string;
  rate: number;
  isIncluded: boolean;
  isActive?: boolean;
  taxTypeId?: string | null;
  calculationMethodId?: string | null;
  taxBaseTypeId?: string | null;
  percentageRate?: number | null;
  fixedAmount?: number | null;
  baseQuantity?: number | null;
  baseUnitCode?: string | null;
  taxProductCategoryId?: string | null;
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
};

type UpdateTaxInput = Partial<
  Pick<
    CreateTaxInput,
    | "name"
    | "rate"
    | "isIncluded"
    | "isActive"
    | "taxTypeId"
    | "calculationMethodId"
    | "taxBaseTypeId"
    | "percentageRate"
    | "fixedAmount"
    | "baseQuantity"
    | "baseUnitCode"
    | "taxProductCategoryId"
    | "effectiveFrom"
    | "effectiveTo"
  >
>;

@Injectable()
export class TaxService {
  constructor(
    @Inject(TaxRepository)
    private readonly taxRepository: TaxRepository
  ) {}

  listTaxes(tenantId: string) {
    return this.taxRepository.findAllByTenant(tenantId);
  }

  listCatalogs() {
    return Promise.all([
      this.taxRepository.listTaxTypes(),
      this.taxRepository.listCalculationMethods(),
      this.taxRepository.listBaseTypes(),
      this.taxRepository.listProductCategories(),
    ]).then(([types, calculationMethods, baseTypes, productCategories]) => ({
      types,
      calculationMethods,
      baseTypes,
      productCategories,
    }));
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

  private async seedCurrentRate(input: {
    tenantId: string;
    taxId: string;
    calculationMethodId: string | null | undefined;
    taxBaseTypeId: string | null | undefined;
    rate: number;
    percentageRate?: number | null;
    fixedAmount?: number | null;
    baseQuantity?: number | null;
    baseUnitCode?: string | null;
    taxProductCategoryId?: string | null;
    effectiveFrom?: string | null;
    effectiveTo?: string | null;
  }) {
    if (!input.calculationMethodId || !input.taxBaseTypeId) {
      return;
    }

    const percentageRate =
      input.percentageRate !== undefined && input.percentageRate !== null
        ? input.percentageRate
        : input.fixedAmount === undefined || input.fixedAmount === null
          ? input.rate
          : null;

    await this.taxRepository.upsertTaxRate({
      tenantId: input.tenantId,
      taxId: input.taxId,
      calculationMethodId: input.calculationMethodId,
      taxBaseTypeId: input.taxBaseTypeId,
      percentageRate,
      fixedAmount: input.fixedAmount ?? null,
      baseQuantity: input.baseQuantity ?? null,
      baseUnitCode: input.baseUnitCode ?? null,
      taxProductCategoryId: input.taxProductCategoryId ?? null,
      effectiveFrom: input.effectiveFrom ?? "2000-01-01",
      effectiveTo: input.effectiveTo ?? null,
    });
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
      taxTypeId: data.taxTypeId ?? null,
      calculationMethodId: data.calculationMethodId ?? null,
      taxBaseTypeId: data.taxBaseTypeId ?? null,
    });

    const created = await this.taxRepository.create({
      id: entity.id,
      tenantId: entity.tenantId,
      name: entity.name,
      rate: entity.rate,
      isIncluded: entity.isIncluded,
      isActive: entity.isActive,
      taxTypeId: entity.taxTypeId,
      calculationMethodId: entity.calculationMethodId,
      taxBaseTypeId: entity.taxBaseTypeId,
    });

    if (!created) {
      throw new BadRequestException("tax could not be created");
    }

    await this.seedCurrentRate({
      tenantId: created.tenantId,
      taxId: created.id,
      calculationMethodId: created.calculationMethodId,
      taxBaseTypeId: created.taxBaseTypeId,
      rate: created.rate,
      percentageRate: data.percentageRate,
      fixedAmount: data.fixedAmount,
      baseQuantity: data.baseQuantity,
      baseUnitCode: data.baseUnitCode,
      taxProductCategoryId: data.taxProductCategoryId,
      effectiveFrom: data.effectiveFrom,
      effectiveTo: data.effectiveTo,
    });

    return created;
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
      taxTypeId: data.taxTypeId,
      calculationMethodId: data.calculationMethodId,
      taxBaseTypeId: data.taxBaseTypeId,
    });

    if (!updated) {
      throw new NotFoundException("tax not found");
    }

    const shouldSeedRate =
      data.percentageRate !== undefined ||
      data.fixedAmount !== undefined ||
      data.baseQuantity !== undefined ||
      data.baseUnitCode !== undefined ||
      data.taxProductCategoryId !== undefined ||
      data.effectiveFrom !== undefined ||
      data.effectiveTo !== undefined ||
      data.rate !== undefined ||
      data.calculationMethodId !== undefined ||
      data.taxBaseTypeId !== undefined;

    if (shouldSeedRate) {
      await this.seedCurrentRate({
        tenantId,
        taxId: updated.id,
        calculationMethodId: updated.calculationMethodId,
        taxBaseTypeId: updated.taxBaseTypeId,
        rate: updated.rate,
        percentageRate: data.percentageRate,
        fixedAmount: data.fixedAmount,
        baseQuantity: data.baseQuantity,
        baseUnitCode: data.baseUnitCode,
        taxProductCategoryId: data.taxProductCategoryId,
        effectiveFrom: data.effectiveFrom,
        effectiveTo: data.effectiveTo,
      });
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
