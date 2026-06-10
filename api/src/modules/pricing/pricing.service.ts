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

  private calculateLinePreview(input: {
    product: {
      id: string;
      price: number;
      taxId: string | null;
      taxRate: number;
      taxIsIncluded: boolean;
    };
    quantity: number;
    finalUnitPrice: number;
    discountAmount: number;
    discountPercent: number;
    appliedPromotionId: string | null;
    appliedPromotionName: string | null;
    explanation: string;
  }): LinePricePreview {
    const taxRate = this.roundCurrency(input.product.taxRate);
    const baseUnitPrice = this.roundCurrency(input.product.price);
    const finalUnitPrice = this.roundCurrency(input.finalUnitPrice);

    let taxBase = 0;
    let taxAmount = 0;
    let lineSubtotal = 0;
    let lineTotal = 0;

    if (taxRate > 0 && !input.product.taxIsIncluded) {
      lineSubtotal = this.roundCurrency(input.quantity * finalUnitPrice);
      taxBase = lineSubtotal;
      taxAmount = this.roundCurrency(taxBase * taxRate);
      lineTotal = this.roundCurrency(lineSubtotal + taxAmount);
    } else {
      lineTotal = this.roundCurrency(input.quantity * finalUnitPrice);
      const unitPriceWithoutTax =
        taxRate > 0
          ? this.roundCurrency(finalUnitPrice / (1 + taxRate))
          : finalUnitPrice;
      taxBase = this.roundCurrency(unitPriceWithoutTax * input.quantity);
      taxAmount =
        taxRate > 0 ? this.roundCurrency(lineTotal - taxBase) : 0;
      lineSubtotal = taxBase;
    }

    return {
      productId: input.product.id,
      quantity: input.quantity,
      baseUnitPrice,
      finalUnitPrice,
      discountAmount: this.roundCurrency(input.discountAmount),
      discountPercent: this.roundCurrency(input.discountPercent),
      appliedPromotionId: input.appliedPromotionId,
      appliedPromotionName: input.appliedPromotionName,
      taxId: input.product.taxId,
      taxRate,
      taxBase,
      taxAmount,
      lineSubtotal,
      lineTotal,
      explanation: input.explanation,
    };
  }

  private async prepareBaseLine(input: CalculateLinePriceInput) {
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

    const quantity = this.roundCurrency(input.quantity);
    const pricingDate = this.resolveDate(input.date);
    const basePreview = this.calculateLinePreview({
      product,
      quantity,
      finalUnitPrice: product.price,
      discountAmount: 0,
      discountPercent: 0,
      appliedPromotionId: null,
      appliedPromotionName: null,
      explanation:
        "products.price is treated as the visible unit price with tax included; no active promotion applies.",
    });

    return {
      product,
      quantity,
      pricingDate,
      basePreview,
    };
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

  async calculateLineWithoutPromotions(
    input: CalculateLinePriceInput
  ): Promise<LinePricePreview> {
    const { basePreview } = await this.prepareBaseLine(input);
    return basePreview;
  }

  async calculateLinePrice(
    input: CalculateLinePriceInput
  ): Promise<LinePricePreview> {
    const { product, quantity, pricingDate, basePreview } =
      await this.prepareBaseLine(input);
    const baseUnitPrice = basePreview.baseUnitPrice;
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

    if (!appliedPromotion) {
      return basePreview;
    }

    return this.calculateLinePreview({
      product,
      quantity,
      finalUnitPrice: appliedPromotion.finalUnitPrice,
      discountAmount: appliedPromotion.discountAmount,
      discountPercent: appliedPromotion.discountPercent,
      appliedPromotionId: appliedPromotion.promotion.id,
      appliedPromotionName: appliedPromotion.promotion.name,
      explanation:
        "products.price is treated as the visible unit price with tax included; active non-stackable promotion applied by priority, discount and recency.",
    });
  }
}
