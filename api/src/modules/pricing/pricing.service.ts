import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PricingRepository } from "./pricing.repository";
import {
  calculatePercentageTaxAmount,
  resolveLineTaxBase,
} from "./pricing-tax-rounding";
import type {
  CalculateLinePriceInput,
  LinePricePreview,
  PricingProductSnapshot,
  PricingPromotionSnapshot,
  PricingProductTaxSnapshot,
  PricingProductTaxProfileSnapshot,

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

  private normalizeRate(value: number) {
    return Math.round((value + 1e-12) * 1_000_000) / 1_000_000;
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

  private isPercentageTax(tax: PricingProductTaxSnapshot) {
    if (this.isAdValoremTax(tax)) {
      return false;
    }
    return (
      tax.calculationMethodCode === null ||
      tax.calculationMethodCode === "PERCENTAGE"
    );
  }

  private isAlcoholDegreeVolumeTax(tax: PricingProductTaxSnapshot) {
    return tax.calculationMethodCode === "PER_ALCOHOL_DEGREE_VOLUME";
  }

  private isAdValoremTax(tax: PricingProductTaxSnapshot) {
    return (
      tax.taxTypeCode === "AD_VALOREM" ||
      tax.taxBaseTypeCode === "DANE_CERTIFIED_RETAIL_PRICE" ||
      tax.calculationMethodCode === "AD_VALOREM"
    );
  }

  private isFixedAmountTax(tax: PricingProductTaxSnapshot) {
    return tax.calculationMethodCode === "FIXED_AMOUNT";
  }

  private getAssignedTaxes(product: PricingProductSnapshot) {
    return [...(product.taxes ?? [])].sort(
      (left, right) => left.calculationOrder - right.calculationOrder
    );
  }

  private getBridgePercentageTax(product: PricingProductSnapshot) {
    const assigned = this.getAssignedTaxes(product);
    if (product.taxId) {
      const match = assigned.find((tax) => tax.taxId === product.taxId);
      if (match && this.isPercentageTax(match)) {
        return match;
      }
    }
    const vatTax = assigned.find(
      (tax) =>
        this.isPercentageTax(tax) &&
        (tax.taxTypeCode === "VAT" ||
          tax.dianCode === "01" ||
          tax.taxName?.toUpperCase().includes("IVA"))
    );
    if (vatTax) {
      return vatTax;
    }
    return assigned.find((tax) => this.isPercentageTax(tax)) ?? null;
  }

  private getPercentageRate(tax: PricingProductTaxSnapshot | null) {
    if (!tax) {
      return 0;
    }
    return Number(tax.percentageRate ?? tax.rate ?? 0);
  }

  private getCustomerUnitPrice(product: PricingProductSnapshot) {
    return this.roundCurrency(product.priceWithTax ?? product.price);
  }

  private getTaxCalculationUnitPrice(
    product: PricingProductSnapshot,
    customerUnitPrice: number
  ) {
    const configuredCustomerPrice = product.priceWithTax;
    const configuredFiscalPrice = product.priceWithoutTax;
    if (
      configuredCustomerPrice == null ||
      configuredFiscalPrice == null ||
      configuredCustomerPrice <= 0
    ) {
      return this.roundCurrency(product.price);
    }

    const promotionFactor = customerUnitPrice / configuredCustomerPrice;
    return this.roundCurrency(configuredFiscalPrice * promotionFactor);
  }

  private hasSeparateCustomerPrice(product: PricingProductSnapshot) {
    return (
      product.priceWithTax != null &&
      product.priceWithoutTax != null &&
      product.priceWithTax !== product.priceWithoutTax
    );
  }

  private buildPreviewTax(
    tax: PricingProductTaxSnapshot,
    values: {
      taxRate: number;
      taxBase: number;
      taxAmount: number;
    }
  ): LinePricePreview["taxes"][number] {
    return {
      taxId: tax.taxId,
      taxName: tax.taxName,
      dianCode: tax.dianCode,
      taxTypeCode: tax.taxTypeCode,
      calculationMethodCode: tax.calculationMethodCode,
      taxRate: this.normalizeRate(values.taxRate),
      taxBase: this.roundCurrency(values.taxBase),
      taxAmount: this.roundCurrency(values.taxAmount),
      isIncluded: tax.isIncluded,
    };
  }

  private calculatePercentageOnlyBreakdown(input: {
    product: PricingProductSnapshot;
    quantity: number;
    finalUnitPrice: number;
  }) {
    const percentageTax = this.getBridgePercentageTax(input.product);
    const taxRate = this.getPercentageRate(percentageTax);
    const finalUnitPrice = this.roundCurrency(input.finalUnitPrice);
    const taxCalculationUnitPrice = this.getTaxCalculationUnitPrice(
      input.product,
      finalUnitPrice
    );
    const hasSeparateCustomerPrice = this.hasSeparateCustomerPrice(input.product);

    let taxBase = 0;
    let taxAmount = 0;
    let lineSubtotal = 0;
    let lineTotal = 0;

    const isExcludedTax =
      taxRate > 0 && !(percentageTax?.isIncluded ?? input.product.taxIsIncluded);

    if (isExcludedTax && !hasSeparateCustomerPrice) {
      lineSubtotal = this.roundCurrency(input.quantity * taxCalculationUnitPrice);
      taxBase = lineSubtotal;
      taxAmount = calculatePercentageTaxAmount(taxBase, taxRate);
      lineTotal = this.roundCurrency(lineSubtotal + taxAmount);
    } else {
      lineTotal = this.roundCurrency(input.quantity * finalUnitPrice);
      taxBase = resolveLineTaxBase(lineTotal, taxRate);
      taxAmount =
        taxRate > 0 ? calculatePercentageTaxAmount(taxBase, taxRate) : 0;
      lineSubtotal = taxBase;
    }

    const taxes =
      percentageTax && (taxRate > 0 || percentageTax.taxId === input.product.taxId)
        ? [
            this.buildPreviewTax(percentageTax, {
              taxRate,
              taxBase,
              taxAmount,
            }),
          ]
        : [];

    return {
      taxId: percentageTax?.taxId ?? input.product.taxId,
      taxRate: this.normalizeRate(taxRate),
      taxBase,
      taxAmount,
      taxes,
      lineSubtotal,
      lineTotal,
    };
  }

  private calculateAlcoholBreakdown(input: {
    product: PricingProductSnapshot;
    quantity: number;
    finalUnitPrice: number;
  }) {
    const taxes = this.getAssignedTaxes(input.product);
    const percentageTax = this.getBridgePercentageTax(input.product);
    const percentageRate = this.getPercentageRate(percentageTax);
    const lineFinal = this.roundCurrency(input.finalUnitPrice * input.quantity);
    const hasSeparateCustomerPrice = this.hasSeparateCustomerPrice(input.product);
    const profile = input.product.taxProfile;

    const taxLines = new Map<string, LinePricePreview["taxes"][number]>();
    let consumoAmount = 0;
    let fixedChargeAmount = 0;

    for (const tax of taxes) {
      if (this.isAlcoholDegreeVolumeTax(tax)) {
        if (
          profile?.alcoholDegree == null ||
          profile.netVolumeMl == null ||
          tax.fixedAmount == null ||
          tax.baseQuantity == null ||
          tax.baseQuantity <= 0
        ) {
          throw new BadRequestException(
            "assigned PER_ALCOHOL_DEGREE_VOLUME tax requires alcoholDegree, netVolumeMl and baseQuantity"
          );
        }

        const taxableUnits = input.quantity *
          profile.alcoholDegree *
          (profile.netVolumeMl / tax.baseQuantity);
        const taxAmount = this.roundCurrency(tax.fixedAmount * taxableUnits);
        consumoAmount = this.roundCurrency(consumoAmount + taxAmount);
        taxLines.set(
          tax.taxId,
          this.buildPreviewTax(tax, {
            // The ICL fiscal rate is the configured specific tariff (COP per
            // alcohol-degree/volume unit), not a percentage. Preserve it in
            // the billing snapshot so FactuCore can deterministically rebuild
            // the amount from the product tax configuration.
            taxRate: tax.fixedAmount,
            taxBase: taxableUnits,
            taxAmount,
          })
        );
        continue;
      }

      if (this.isAdValoremTax(tax)) {
        if (profile?.daneCertifiedRetailPrice == null) {
          throw new BadRequestException(
            "assigned AD_VALOREM tax requires daneCertifiedRetailPrice"
          );
        }

        const taxRate = this.getPercentageRate(tax);
        const taxBase = this.roundCurrency(
          profile.daneCertifiedRetailPrice * input.quantity
        );
        const taxAmount = this.roundCurrency(taxBase * taxRate);
        consumoAmount = this.roundCurrency(consumoAmount + taxAmount);
        taxLines.set(
          tax.taxId,
          this.buildPreviewTax(tax, {
            taxRate,
            taxBase,
            taxAmount,
          })
        );
        continue;
      }

      if (this.isFixedAmountTax(tax)) {
        const taxAmount = this.roundCurrency((tax.fixedAmount ?? 0) * input.quantity);
        fixedChargeAmount = this.roundCurrency(fixedChargeAmount + taxAmount);
        taxLines.set(
          tax.taxId,
          this.buildPreviewTax(tax, {
            taxRate: 0,
            taxBase: input.quantity,
            taxAmount,
          })
        );
      }
    }

    if (percentageTax) {
      if (percentageTax.isIncluded) {
        if (consumoAmount > lineFinal) {
          throw new BadRequestException(
            "included alcohol taxes exceed visible line amount"
          );
        }

        const taxBase = resolveLineTaxBase(
          lineFinal - consumoAmount,
          percentageRate
        );
        const taxAmount = calculatePercentageTaxAmount(
          taxBase,
          percentageRate
        );
        taxLines.set(
          percentageTax.taxId,
          this.buildPreviewTax(percentageTax, {
            taxRate: percentageRate,
            taxBase,
            taxAmount,
          })
        );

        return {
          taxId: percentageTax.taxId,
          taxRate: this.normalizeRate(percentageRate),
          taxBase,
          taxAmount: this.roundCurrency(
            consumoAmount + taxAmount + fixedChargeAmount
          ),
          taxes: taxes
            .map((tax) => taxLines.get(tax.taxId))
            .filter((item): item is LinePricePreview["taxes"][number] =>
              Boolean(item)
            ),
          lineSubtotal: taxBase,
          lineTotal: this.roundCurrency(lineFinal + fixedChargeAmount),
        };
      }

      // For excluded alcohol taxes, the VAT base is the visible line price.
      // ICL and ADV are added on top of that base; they must not be removed
      // before calculating VAT. The authorized liquor invoice contract uses
      // IVA base = lineFinal and total = lineFinal + ICL + ADV + IVA.
      // With a separate customer price the charged line already contains
      // every tax, so the IVA base is what remains after ICL, ADV and fixed.
      const chargedNetAmount = this.roundCurrency(
        lineFinal - consumoAmount - fixedChargeAmount
      );
      if (hasSeparateCustomerPrice && chargedNetAmount < 0) {
        throw new BadRequestException(
          "alcohol taxes exceed visible line amount"
        );
      }
      const taxBase = hasSeparateCustomerPrice
        ? resolveLineTaxBase(chargedNetAmount, percentageRate)
        : lineFinal;
      const taxAmount = calculatePercentageTaxAmount(
        taxBase,
        percentageRate
      );
      taxLines.set(
        percentageTax.taxId,
        this.buildPreviewTax(percentageTax, {
          taxRate: percentageRate,
          taxBase,
          taxAmount,
        })
      );

      return {
        taxId: percentageTax.taxId,
        taxRate: this.normalizeRate(percentageRate),
        taxBase,
        taxAmount: this.roundCurrency(consumoAmount + taxAmount + fixedChargeAmount),
        taxes: taxes
          .map((tax) => taxLines.get(tax.taxId))
          .filter((item): item is LinePricePreview["taxes"][number] =>
            Boolean(item)
          ),
        lineSubtotal: taxBase,
        lineTotal: hasSeparateCustomerPrice
          ? lineFinal
          : this.roundCurrency(
              lineFinal + consumoAmount + taxAmount + fixedChargeAmount
            ),
      };
    }

    return {
      taxId: null,
      taxRate: 0,
      taxBase: 0,
      taxAmount: this.roundCurrency(consumoAmount + fixedChargeAmount),
      taxes: taxes
        .map((tax) => taxLines.get(tax.taxId))
        .filter((item): item is LinePricePreview["taxes"][number] => Boolean(item)),
      lineSubtotal: this.roundCurrency(lineFinal - consumoAmount),
      lineTotal: this.roundCurrency(lineFinal + fixedChargeAmount),
    };
  }

  private calculatePercentageAndFixedBreakdown(input: {
    product: PricingProductSnapshot;
    quantity: number;
    finalUnitPrice: number;
  }) {
    const taxes = this.getAssignedTaxes(input.product);
    const percentageBase = this.calculatePercentageOnlyBreakdown(input);
    const taxLines = new Map<string, LinePricePreview["taxes"][number]>();

    for (const line of percentageBase.taxes) {
      taxLines.set(line.taxId, line);
    }

    let fixedChargeAmount = 0;
    for (const tax of taxes) {
      if (!this.isFixedAmountTax(tax)) {
        continue;
      }

      const taxAmount = this.roundCurrency((tax.fixedAmount ?? 0) * input.quantity);
      fixedChargeAmount = this.roundCurrency(fixedChargeAmount + taxAmount);
      taxLines.set(
        tax.taxId,
        this.buildPreviewTax(tax, {
          taxRate: 0,
          taxBase: input.quantity,
          taxAmount,
        })
      );
    }

    const lineFinal = this.roundCurrency(input.finalUnitPrice * input.quantity);

    return {
      taxId: percentageBase.taxId,
      taxRate: percentageBase.taxRate,
      taxBase: percentageBase.taxBase,
      taxAmount: this.roundCurrency(percentageBase.taxAmount + fixedChargeAmount),
      taxes: taxes
        .map((tax) => taxLines.get(tax.taxId))
        .filter((item): item is LinePricePreview["taxes"][number] => Boolean(item)),
      lineSubtotal:
        percentageBase.taxId === null && fixedChargeAmount > 0
          ? lineFinal
          : percentageBase.lineSubtotal,
      lineTotal: this.roundCurrency(percentageBase.lineTotal + fixedChargeAmount),
    };
  }

  private calculateLinePreview(input: {
    product: PricingProductSnapshot;
    quantity: number;
    finalUnitPrice: number;
    discountAmount: number;
    discountPercent: number;
    appliedPromotionId: string | null;
    appliedPromotionName: string | null;
    explanation: string;
  }): LinePricePreview {
    const baseUnitPrice = this.getCustomerUnitPrice(input.product);
    const finalUnitPrice = this.roundCurrency(input.finalUnitPrice);
    const taxes = this.getAssignedTaxes(input.product);
    const hasAlcoholTaxes = taxes.some(
      (tax) => this.isAlcoholDegreeVolumeTax(tax) || this.isAdValoremTax(tax)
    );
    const hasFixedAmountTaxes = taxes.some((tax) => this.isFixedAmountTax(tax));
    const onlyPercentageTaxes =
      taxes.length === 0 || taxes.every((tax) => this.isPercentageTax(tax));

    const breakdown = onlyPercentageTaxes
      ? this.calculatePercentageOnlyBreakdown({
          product: input.product,
          quantity: input.quantity,
          finalUnitPrice,
        })
      : hasAlcoholTaxes
        ? this.calculateAlcoholBreakdown({
            product: input.product,
            quantity: input.quantity,
            finalUnitPrice,
          })
        : hasFixedAmountTaxes
          ? this.calculatePercentageAndFixedBreakdown({
              product: input.product,
              quantity: input.quantity,
              finalUnitPrice,
            })
          : this.calculatePercentageOnlyBreakdown({
              product: input.product,
              quantity: input.quantity,
              finalUnitPrice,
            });

    return {
      productId: input.product.id,
      quantity: input.quantity,
      baseUnitPrice,
      finalUnitPrice,
      discountAmount: this.roundCurrency(input.discountAmount),
      discountPercent: this.roundCurrency(input.discountPercent),
      appliedPromotionId: input.appliedPromotionId,
      appliedPromotionName: input.appliedPromotionName,
      taxId: breakdown.taxId,
      taxRate: breakdown.taxRate,
      taxBase: breakdown.taxBase,
      taxAmount: breakdown.taxAmount,
      taxes: breakdown.taxes,
      lineSubtotal: breakdown.lineSubtotal,
      lineTotal: breakdown.lineTotal,
      explanation: input.explanation,
    };
  }

  private async prepareBaseLine(input: CalculateLinePriceInput) {
    this.assertInput(input);
    const pricingDate = this.resolveDate(input.date);

    const product = await this.pricingRepository.findProductSnapshot(
      input.tenantId,
      input.productId,
      pricingDate
    );
    if (!product) {
      throw new NotFoundException("product not found");
    }
    if (!product.isActive) {
      throw new BadRequestException("product is inactive");
    }

    const quantity = this.roundCurrency(input.quantity);
    const basePreview = this.calculateLinePreview({
      product,
      quantity,
      finalUnitPrice: this.getCustomerUnitPrice(product),
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

  async calculateProposedLine(input: {
    product: PricingProductSnapshot;
    quantity: number;
    finalUnitPrice: number;
  }): Promise<LinePricePreview> {
    const baseUnitPrice = this.getCustomerUnitPrice(input.product);
    const quantity = this.roundCurrency(input.quantity);
    const finalUnitPrice = this.roundCurrency(input.finalUnitPrice);

    return this.calculateLinePreview({
      product: input.product,
      quantity,
      finalUnitPrice,
      discountAmount: 0,
      discountPercent: 0,
      appliedPromotionId: null,
      appliedPromotionName: null,
      explanation: "Proposed calculation based on provided product tax configuration.",
    });
  }

  async previewProposedConfiguration(input: {
    tenantId: string;
    finalUnitPrice: number;
    taxes: Array<{ taxId: string; calculationOrder: number; isIncluded: boolean }>;
    taxProfile: PricingProductTaxProfileSnapshot | null;
  }): Promise<LinePricePreview> {
    const pricingDate = new Date();
    const resolvedTaxes = await this.pricingRepository.resolveProposedTaxes(
      input.tenantId,
      input.taxes,
      input.taxProfile?.taxProductCategoryId ?? null,
      pricingDate
    );

    const bridgeTax = resolvedTaxes.find(t => t.calculationMethodCode === "PERCENTAGE" || !t.calculationMethodCode);

    const snapshot: PricingProductSnapshot = {
      id: "preview-id",
      tenantId: input.tenantId,
      price: input.finalUnitPrice,
      priceWithTax: input.finalUnitPrice,
      priceWithoutTax: input.finalUnitPrice,
      taxId: bridgeTax?.taxId ?? null,
      taxRate: bridgeTax?.rate ?? 0,
      taxIsIncluded: bridgeTax?.isIncluded ?? false,
      taxes: resolvedTaxes,
      taxProfile: input.taxProfile,
      isActive: true,
    };

    return this.calculateProposedLine({
      product: snapshot,
      quantity: 1,
      finalUnitPrice: input.finalUnitPrice,
    });
  }
}




