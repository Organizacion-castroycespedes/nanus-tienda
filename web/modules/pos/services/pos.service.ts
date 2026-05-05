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
    body: JSON.stringify(payload),
  });
