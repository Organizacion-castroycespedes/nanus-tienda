"use client";

import { apiClient } from "../../../lib/http";
import type { ProductResponse } from "../../../domains/products/dtos";
import type { CustomerResponse } from "../../inventory/services/customer.service";
import type { TaxResponse } from "../../inventory/services/tax.service";

export type PosSalePayload = {
  customerId: string;
  orderId?: string | null;
  type: "CASH" | "CREDIT";
  items: Array<{
    productId: string;
    quantity: number;
    price: number;
    orderItemId?: string | null;
    taxes?: Array<{
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
  }>;
  payments?: Array<{
    paymentMethodId: string;
    amount: number;
    cashSessionId?: string | null;
    referenceNumber?: string | null;
    notes?: string | null;
  }>;
};

export type SaleResponse = {
  id: string;
  tenantId: string;
  customerId: string;
  orderId: string | null;
  type: "CASH" | "CREDIT";
  status: "DRAFT" | "CONFIRMED" | "CANCELLED";
  total: number;
  balance: number;
  paymentStatus: "PENDING" | "PARTIAL" | "PAID" | "OVERPAID";
  totalPaid: number;
  balanceDue: number;
  createdAt: string;
};

export type PosLinePricePreviewPayload = {
  branchId: string;
  productId: string;
  quantity: number;
  channel: "POS";
  customerId?: string;
  date?: string;
};

export type PosLinePricePreviewResponse = {
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

export const getPosProducts = (branchId: string, headers?: HeadersInit) =>
  apiClient<ProductResponse[]>(`/products?branchId=${encodeURIComponent(branchId)}`, {
    headers,
  });

export const getPosCustomers = (headers?: HeadersInit) =>
  apiClient<CustomerResponse[]>("/customers", { headers });

export const getPosTaxes = (headers?: HeadersInit) =>
  apiClient<TaxResponse[]>("/taxes", { headers });

export const createSale = (payload: PosSalePayload, headers?: HeadersInit) =>
  apiClient<SaleResponse>("/sales", {
    method: "POST",
    headers,
    includePosSession: true,
    body: JSON.stringify(payload),
  });

export const previewPosLinePrice = (
  payload: PosLinePricePreviewPayload,
  headers?: HeadersInit
) =>
  apiClient<PosLinePricePreviewResponse>("/pricing/preview-line", {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });
