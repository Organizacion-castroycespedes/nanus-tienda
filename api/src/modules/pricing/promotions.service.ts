import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import crypto from "crypto";
import { DatabaseService } from "../../common/db/database.service";
import { PromotionsRepository } from "./promotions.repository";
import {
  PROMOTION_DISCOUNT_TYPES,
  type CreatePromotionInput,
  type PromotionDiscountType,
  type PromotionEntity,
  type PromotionListFilters,
  type UpdatePromotionInput,
} from "./promotions.types";

@Injectable()
export class PromotionsService {
  constructor(
    @Inject(PromotionsRepository)
    private readonly promotionsRepository: PromotionsRepository,
    @Inject(DatabaseService)
    private readonly db: DatabaseService
  ) {}

  listPromotions(tenantId: string, filters: PromotionListFilters = {}) {
    return this.promotionsRepository.list(tenantId, filters);
  }

  async getPromotion(tenantId: string, promotionId: string) {
    const promotion = await this.promotionsRepository.findById(
      tenantId,
      promotionId
    );
    if (!promotion) {
      throw new NotFoundException("promotion not found");
    }
    return promotion;
  }

  private uniqueIds(ids: string[] | undefined) {
    return Array.from(new Set((ids ?? []).map((id) => id?.trim()).filter(Boolean)));
  }

  private parseDate(value: string | undefined, field: string) {
    if (!value?.trim()) {
      throw new BadRequestException(`${field} is required`);
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException(`${field} is invalid`);
    }
    return date;
  }

  private validateDiscount(
    discountType: PromotionDiscountType | undefined,
    discountValue: number | undefined
  ) {
    if (!discountType || !PROMOTION_DISCOUNT_TYPES.includes(discountType)) {
      throw new BadRequestException("discountType is invalid");
    }
    if (!Number.isFinite(discountValue) || discountValue === undefined) {
      throw new BadRequestException("discountValue is required");
    }
    if (discountType === "PERCENTAGE" && (discountValue <= 0 || discountValue > 100)) {
      throw new BadRequestException("percentage discountValue must be greater than 0 and less than or equal to 100");
    }
    if (discountType === "FIXED_AMOUNT" && discountValue <= 0) {
      throw new BadRequestException("fixed amount discountValue must be greater than 0");
    }
    if (discountType === "SPECIAL_PRICE" && discountValue < 0) {
      throw new BadRequestException("special price discountValue must be greater than or equal to 0");
    }
  }

  private validateCore(data: {
    name: string;
    discountType: PromotionDiscountType;
    discountValue: number;
    startsAt: Date;
    endsAt: Date;
    priority: number;
  }) {
    if (!data.name?.trim()) {
      throw new BadRequestException("name is required");
    }
    this.validateDiscount(data.discountType, data.discountValue);
    if (data.endsAt <= data.startsAt) {
      throw new BadRequestException("endsAt must be greater than startsAt");
    }
    if (!Number.isInteger(data.priority) || data.priority < 0) {
      throw new BadRequestException("priority must be a non-negative integer");
    }
  }

  private async validateTargets(
    tenantId: string,
    productIds: string[],
    branchIds: string[]
  ) {
    if (productIds.length === 0) {
      throw new BadRequestException("productIds must contain at least one product");
    }

    const productCount = await this.promotionsRepository.countProductsByTenant(
      tenantId,
      productIds
    );
    if (productCount !== productIds.length) {
      throw new BadRequestException("all products must belong to tenant");
    }

    if (branchIds.length > 0) {
      const branchCount = await this.promotionsRepository.countBranchesByTenant(
        tenantId,
        branchIds
      );
      if (branchCount !== branchIds.length) {
        throw new BadRequestException("all branches must belong to tenant");
      }
    }
  }

  async createPromotion(input: CreatePromotionInput) {
    const productIds = this.uniqueIds(input.productIds);
    const branchIds = this.uniqueIds(input.branchIds);
    const startsAt = this.parseDate(input.startsAt, "startsAt");
    const endsAt = this.parseDate(input.endsAt, "endsAt");
    const priority = input.priority ?? 100;

    this.validateCore({
      name: input.name,
      discountType: input.discountType,
      discountValue: input.discountValue,
      startsAt,
      endsAt,
      priority,
    });
    await this.validateTargets(input.tenantId, productIds, branchIds);

    const client = await this.db.getClient();
    try {
      await client.query("BEGIN");
      const promotion = await this.promotionsRepository.create(
        {
          id: crypto.randomUUID(),
          tenantId: input.tenantId,
          name: input.name.trim(),
          description: input.description?.trim() || null,
          promotionType: "PRODUCT_DISCOUNT",
          discountType: input.discountType,
          discountValue: input.discountValue,
          startsAt,
          endsAt,
          priority,
          isStackable: input.isStackable ?? false,
          isActive: true,
          createdBy: input.createdBy ?? null,
        },
        productIds,
        branchIds,
        client
      );
      await client.query("COMMIT");
      return promotion;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async updatePromotion(
    tenantId: string,
    promotionId: string,
    input: UpdatePromotionInput
  ) {
    const current = await this.getPromotion(tenantId, promotionId);
    const productIds =
      input.productIds === undefined
        ? current.productIds
        : this.uniqueIds(input.productIds);
    const branchIds =
      input.branchIds === undefined
        ? current.branchIds
        : this.uniqueIds(input.branchIds);
    const startsAt =
      input.startsAt === undefined
        ? current.startsAt
        : this.parseDate(input.startsAt, "startsAt");
    const endsAt =
      input.endsAt === undefined
        ? current.endsAt
        : this.parseDate(input.endsAt, "endsAt");
    const discountType = input.discountType ?? current.discountType;
    const discountValue = input.discountValue ?? current.discountValue;
    const priority = input.priority ?? current.priority;
    const name = input.name ?? current.name;
    const isPureDeactivation =
      input.isActive === false &&
      input.name === undefined &&
      input.description === undefined &&
      input.discountType === undefined &&
      input.discountValue === undefined &&
      input.startsAt === undefined &&
      input.endsAt === undefined &&
      input.priority === undefined &&
      input.isStackable === undefined &&
      input.productIds === undefined &&
      input.branchIds === undefined;

    if (!isPureDeactivation) {
      this.validateCore({
        name,
        discountType,
        discountValue,
        startsAt,
        endsAt,
        priority,
      });
      await this.validateTargets(tenantId, productIds, branchIds);
    }

    const client = await this.db.getClient();
    try {
      await client.query("BEGIN");
      const promotion = await this.promotionsRepository.update(
        tenantId,
        promotionId,
        {
          name: input.name?.trim(),
          description:
            input.description === undefined
              ? undefined
              : input.description?.trim() || null,
          promotionType: "PRODUCT_DISCOUNT",
          discountType,
          discountValue,
          startsAt,
          endsAt,
          priority,
          isStackable: input.isStackable,
          isActive: input.isActive,
        },
        client
      );
      if (!promotion) {
        throw new NotFoundException("promotion not found");
      }
      if (input.productIds !== undefined) {
        await this.promotionsRepository.replaceProducts(
          tenantId,
          promotionId,
          productIds,
          client
        );
      }
      if (input.branchIds !== undefined) {
        await this.promotionsRepository.replaceBranches(
          tenantId,
          promotionId,
          branchIds,
          client
        );
      }
      const updated = (await this.promotionsRepository.findById(
        tenantId,
        promotionId,
        client
      )) as PromotionEntity;
      await client.query("COMMIT");
      return updated;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  deactivatePromotion(tenantId: string, promotionId: string) {
    return this.updatePromotion(tenantId, promotionId, {
      isActive: false,
    });
  }
}
