export const PROMOTION_DISCOUNT_TYPES = [
  "PERCENTAGE",
  "FIXED_AMOUNT",
  "SPECIAL_PRICE",
] as const;

export const PROMOTION_TYPES = ["PRODUCT_DISCOUNT"] as const;

export type PromotionDiscountType = (typeof PROMOTION_DISCOUNT_TYPES)[number];
export type PromotionType = (typeof PROMOTION_TYPES)[number];

export type PromotionEntity = {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  promotionType: PromotionType;
  discountType: PromotionDiscountType;
  discountValue: number;
  startsAt: Date;
  endsAt: Date;
  priority: number;
  isStackable: boolean;
  isActive: boolean;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
  productIds: string[];
  branchIds: string[];
};

export type PromotionListFilters = {
  search?: string;
  isActive?: boolean;
  productId?: string;
  branchId?: string;
  startsAt?: string;
  endsAt?: string;
};

export type CreatePromotionInput = {
  tenantId: string;
  name: string;
  description?: string | null;
  discountType: PromotionDiscountType;
  discountValue: number;
  startsAt: string;
  endsAt: string;
  priority?: number;
  isStackable?: boolean;
  productIds: string[];
  branchIds?: string[];
  createdBy?: string | null;
};

export type UpdatePromotionInput = Partial<
  Omit<CreatePromotionInput, "tenantId" | "createdBy">
> & {
  isActive?: boolean;
};

export type PromotionRecordInput = {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  promotionType: PromotionType;
  discountType: PromotionDiscountType;
  discountValue: number;
  startsAt: Date;
  endsAt: Date;
  priority: number;
  isStackable: boolean;
  isActive: boolean;
  createdBy: string | null;
};
