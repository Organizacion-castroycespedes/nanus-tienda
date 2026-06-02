import { apiClient } from "../../../lib/http";

export type PromotionDiscountType =
  | "PERCENTAGE"
  | "FIXED_AMOUNT"
  | "SPECIAL_PRICE";

export type PromotionType = "PRODUCT_DISCOUNT";

export type PromotionResponse = {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  promotionType: PromotionType;
  discountType: PromotionDiscountType;
  discountValue: number;
  startsAt: string;
  endsAt: string;
  priority: number;
  isStackable: boolean;
  isActive: boolean;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  productIds: string[];
  branchIds: string[];
};

export type ListPromotionsParams = {
  search?: string;
  isActive?: boolean;
  productId?: string;
  branchId?: string;
  startsAt?: string;
  endsAt?: string;
};

export type CreatePromotionPayload = {
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
};

export type UpdatePromotionPayload = Partial<CreatePromotionPayload> & {
  isActive?: boolean;
};

const buildPromotionsQuery = (params: ListPromotionsParams = {}) => {
  const query = new URLSearchParams();

  if (params.search?.trim()) {
    query.set("search", params.search.trim());
  }
  if (params.isActive !== undefined) {
    query.set("isActive", String(params.isActive));
  }
  if (params.productId?.trim()) {
    query.set("productId", params.productId.trim());
  }
  if (params.branchId?.trim()) {
    query.set("branchId", params.branchId.trim());
  }
  if (params.startsAt?.trim()) {
    query.set("startsAt", params.startsAt.trim());
  }
  if (params.endsAt?.trim()) {
    query.set("endsAt", params.endsAt.trim());
  }

  const suffix = query.toString();
  return suffix ? `/pricing/promotions?${suffix}` : "/pricing/promotions";
};

export const listPromotions = (params: ListPromotionsParams = {}) =>
  apiClient<PromotionResponse[]>(buildPromotionsQuery(params));

export const getPromotion = (promotionId: string) =>
  apiClient<PromotionResponse>(`/pricing/promotions/${promotionId}`);

export const createPromotion = (payload: CreatePromotionPayload) =>
  apiClient<PromotionResponse>("/pricing/promotions", {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const updatePromotion = (
  promotionId: string,
  payload: UpdatePromotionPayload
) =>
  apiClient<PromotionResponse>(`/pricing/promotions/${promotionId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });

export const deactivatePromotion = (promotionId: string) =>
  apiClient<PromotionResponse>(`/pricing/promotions/${promotionId}/deactivate`, {
    method: "PATCH",
  });
