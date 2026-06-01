import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PricingRepository } from "./pricing.repository";
import type {
  CalculateLinePriceInput,
  LinePricePreview,
  PricingPromotionSnapshot,
} from "./pricing.types";

const CHANNELS = new Set(["POS", "ORDER"]);

@Injectable()
export class PricingService {
  constructor(
    @Inject(PricingRepository)
    private readonly pricingRepository: PricingRepository
  ) {}

  private roundCurrency(value: number) {
    return Math.round((value + 1e-9) * 100) / 100;
  }

  private assertInput(input: CalculateLinePriceInput) {
    if (!input.tenantId?.trim()) {
      throw new BadRequestException("tenantId is required");
    }
    if (!input.branchId?.trim()) {
      throw new BadRequestException("branchId is required");
    }
    if (!input.productId?.trim()) {
      throw new BadRequestException("productId is required");
    }
    if (!Number.isFinite(input.quantity) || input.quantity <= 0) {
      throw new BadRequestException("quantity must be greater than 0");
    }
    if (!CHANNELS.has(input.channel)) {
      throw new BadRequestException("channel must be POS or ORDER");
    }
    if (input.date !== undefined && Number.isNaN(Date.parse(input.date))) {
      throw new BadRequestException("date is invalid");
    }
  }

  private resolveDate(date: string | undefined) {
    return date ? new Date(date) : new Date();
  }

  private calculatePromotionCandidate(
    promotion: PricingPromotionSnapshot,
    baseUnitPrice: number
  ) {
    let finalUnitPrice = baseUnitPrice;
    let discountAmount = 0;

    if (promotion.discountType === "PERCENTAGE") {
      discountAmount = this.roundCurrency(
        (baseUnitPrice * promotion.discountValue) / 100
      );
      finalUnitPrice = this.roundCurrency(baseUnitPrice - discountAmount);
    }

    if (promotion.discountType === "FIXED_AMOUNT") {
      discountAmount = this.roundCurrency(
        Math.min(promotion.discountValue, baseUnitPrice)
      );
      finalUnitPrice = this.roundCurrency(baseUnitPrice - discountAmount);
    }

    if (promotion.discountType === "SPECIAL_PRICE") {
      const specialPrice = this.roundCurrency(promotion.discountValue);
      if (specialPrice >= baseUnitPrice) {
        return null;
      }
      finalUnitPrice = Math.max(0, specialPrice);
      discountAmount = this.roundCurrency(baseUnitPrice - finalUnitPrice);
    }

    discountAmount = this.roundCurrency(
      Math.min(Math.max(discountAmount, 0), baseUnitPrice)
    );
    finalUnitPrice = this.roundCurrency(
      Math.max(0, baseUnitPrice - discountAmount)
    );

    if (discountAmount <= 0) {
      return null;
    }

    return {
      promotion,
      finalUnitPrice,
      discountAmount,
      discountPercent:
        baseUnitPrice > 0
          ? this.roundCurrency((discountAmount / baseUnitPrice) * 100)
          : 0,
    };
  }

  private selectBestPromotion(
    promotions: PricingPromotionSnapshot[],
    baseUnitPrice: number
  ) {
    return promotions
      .map((promotion) =>
        this.calculatePromotionCandidate(promotion, baseUnitPrice)
      )
      .filter((candidate): candidate is NonNullable<typeof candidate> =>
        Boolean(candidate)
      )
      .sort((left, right) => {
        if (left.promotion.priority !== right.promotion.priority) {
          return left.promotion.priority - right.promotion.priority;
        }
        if (left.discountAmount !== right.discountAmount) {
          return right.discountAmount - left.discountAmount;
        }
        const createdDiff =
          right.promotion.createdAt.getTime() -
          left.promotion.createdAt.getTime();
        if (createdDiff !== 0) {
          return createdDiff;
        }
        return left.promotion.id.localeCompare(right.promotion.id);
      })[0] ?? null;
  }

  async calculateLinePrice(
    input: CalculateLinePriceInput
  ): Promise<LinePricePreview> {
    this.assertInput(input);

    const product = await this.pricingRepository.findProductSnapshot(
      input.tenantId,
      input.productId
    );
    if (!product) {
      throw new NotFoundException("product not found");
    }
    if (!product.isActive) {
      throw new BadRequestException("product is inactive");
    }

    const pricingDate = this.resolveDate(input.date);
    const quantity = this.roundCurrency(input.quantity);
    const baseUnitPrice = this.roundCurrency(product.price);
    const promotions = await this.pricingRepository.findApplicablePromotions({
      tenantId: input.tenantId,
      branchId: input.branchId,
      productId: input.productId,
      date: pricingDate,
    });
    const appliedPromotion = this.selectBestPromotion(
      promotions,
      baseUnitPrice
    );
    const finalUnitPrice = appliedPromotion?.finalUnitPrice ?? baseUnitPrice;
    const lineTotal = this.roundCurrency(quantity * finalUnitPrice);
    const taxRate = this.roundCurrency(product.taxRate);
    const unitPriceWithoutTax =
      taxRate > 0
        ? this.roundCurrency(finalUnitPrice / (1 + taxRate))
        : finalUnitPrice;
    const taxBase = this.roundCurrency(unitPriceWithoutTax * quantity);
    const taxAmount =
      taxRate > 0 ? this.roundCurrency(lineTotal - taxBase) : 0;
    const lineSubtotal = taxBase;

    return {
      productId: product.id,
      quantity,
      baseUnitPrice,
      finalUnitPrice,
      discountAmount: appliedPromotion?.discountAmount ?? 0,
      discountPercent: appliedPromotion?.discountPercent ?? 0,
      appliedPromotionId: appliedPromotion?.promotion.id ?? null,
      appliedPromotionName: appliedPromotion?.promotion.name ?? null,
      taxId: product.taxId,
      taxRate,
      taxBase,
      taxAmount,
      lineSubtotal,
      lineTotal,
      explanation: appliedPromotion
        ? "products.price is treated as the visible unit price with tax included; active non-stackable promotion applied by priority, discount and recency."
        : "products.price is treated as the visible unit price with tax included; no active promotion applies.",
    };
  }
}
