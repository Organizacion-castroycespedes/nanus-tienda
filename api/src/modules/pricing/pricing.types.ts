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
  lineSubtotal: number;
  lineTotal: number;
  explanation: string;
};

export type PricingProductSnapshot = {
  id: string;
  tenantId: string;
  price: number;
  taxId: string | null;
  taxRate: number;
  taxIsIncluded: boolean;
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
