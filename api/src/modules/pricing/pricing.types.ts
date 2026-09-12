export type PricingChannel = "POS" | "ORDER";

export type CalculateLinePriceInput = {
  tenantId: string;
  branchId: string;
  productId: string;
  quantity: number;
  channel: PricingChannel;
  customerId?: string;
  date?: string;
};

export type LinePricePreview = {
  productId: string;
  quantity: number;
  baseUnitPrice: number;
  finalUnitPrice: number;
  discountAmount: number;
  discountPercent: number;
  appliedPromotionId: string | null;
  appliedPromotionName: string | null;
  taxId: string | null;
  taxRate: number;
  taxBase: number;
  taxAmount: number;
  taxes: Array<{
    taxId: string;
    taxName: string;
    dianCode: string | null;
    taxTypeCode: string | null;
    calculationMethodCode: string | null;
    taxRate: number;
    taxBase: number;
    taxAmount: number;
    isIncluded: boolean;
  }>;
  lineSubtotal: number;
  lineTotal: number;
  explanation: string;
};

export type PricingProductTaxSnapshot = {
  taxId: string;
  taxName: string;
  dianCode: string | null;
  taxTypeCode: string | null;
  calculationMethodCode: string | null;
  taxBaseTypeCode: string | null;
  calculationOrder: number;
  isIncluded: boolean;
  rate: number;
  percentageRate: number | null;
  fixedAmount: number | null;
  baseQuantity: number | null;
  baseUnitCode: string | null;
};

export type PricingProductTaxProfileSnapshot = {
  taxProductCategoryId: string;
  alcoholDegree: number | null;
  netVolumeMl: number | null;
  daneCertifiedRetailPrice: number | null;
};

export type PricingProductSnapshot = {
  id: string;
  tenantId: string;
  price: number;
  taxId: string | null;
  taxRate: number;
  taxIsIncluded: boolean;
  taxes: PricingProductTaxSnapshot[];
  taxProfile: PricingProductTaxProfileSnapshot | null;
  isActive: boolean;
};

export type PricingPromotionDiscountType =
  | "PERCENTAGE"
  | "FIXED_AMOUNT"
  | "SPECIAL_PRICE";

export type PricingPromotionSnapshot = {
  id: string;
  name: string;
  discountType: PricingPromotionDiscountType;
  discountValue: number;
  priority: number;
  createdAt: Date;
};
