import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

export type PaymentDraft = {
  id: string;
  paymentMethodId: string;
  amount: string;
  reference: string;
};

export type PosCartPricingStatus = "PENDING" | "READY" | "ERROR";

export type PosCartAppliedTax = {
  taxId: string;
  taxName: string;
  dianCode: string | null;
  taxTypeCode: string | null;
  calculationMethodCode: string | null;
  taxRate: number;
  taxBase: number;
  taxAmount: number;
  isIncluded: boolean;
};

export type PosCartItem = {
  productId: string;
  name: string;
  sku: string;
  quantity: number;
  price: number;
  stock: number;
  taxId: string | null;
  priceWithoutTax: number;
  pricingStatus?: PosCartPricingStatus;
  pricingRequestKey?: string | null;
  pricingError?: string | null;
  baseUnitPrice?: number;
  basePriceWithoutTax?: number;
  finalUnitPrice?: number;
  discountAmount?: number;
  discountPercent?: number;
  appliedPromotionId?: string | null;
  appliedPromotionName?: string | null;
  taxRate?: number;
  taxBase?: number;
  taxAmount?: number;
  lineSubtotal?: number;
  lineTotal?: number;
  taxes?: PosCartAppliedTax[];
};

export type PosCartContext = {
  tenantId: string | null;
  branchId: string | null;
  terminalId: string | null;
  userId: string | null;
  posSessionId: string | null;
};

export type PosSaleAttempt = {
  attemptId: string;
  startedAt: string;
};

export type PosSaleStatus = "DRAFT" | "SUBMITTING" | "UNKNOWN" | "CONFIRMED";

export type PosCartState = PosCartContext & {
  contextKey: string | null;
  items: PosCartItem[];
  selectedCustomerId: string | null;
  payments: PaymentDraft[];
  saleStatus: PosSaleStatus;
  saleAttempt: PosSaleAttempt | null;
};

export const POS_CART_STORAGE_PREFIX = "pos-cart:";

export const buildPaymentId = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export const buildDefaultPayments = (): PaymentDraft[] => [
  {
    id: buildPaymentId(),
    paymentMethodId: "",
    amount: "",
    reference: "",
  },
];

const buildEmptySaleState = () => ({
  items: [] as PosCartItem[],
  selectedCustomerId: null as string | null,
  payments: buildDefaultPayments(),
  saleStatus: "DRAFT" as const,
  saleAttempt: null as PosSaleAttempt | null,
});

export const buildPosCartStorageKey = (context: PosCartContext) => {
  if (
    !context.tenantId ||
    !context.branchId ||
    !context.terminalId ||
    !context.userId ||
    !context.posSessionId
  ) {
    return null;
  }

  // Isolate each cart by POS runtime context.
  return `${POS_CART_STORAGE_PREFIX}${context.tenantId}:${context.branchId}:${context.terminalId}:${context.userId}:${context.posSessionId}`;
};

export const initialPosCartState: PosCartState = {
  contextKey: null,
  tenantId: null,
  branchId: null,
  terminalId: null,
  userId: null,
  posSessionId: null,
  ...buildEmptySaleState(),
};

const normalizePersistedPosCartState = (value: unknown) => {
  if (!value || typeof value !== "object") {
    return buildEmptySaleState();
  }

  const candidate = value as Partial<PosCartState>;
  const items = Array.isArray(candidate.items)
    ? candidate.items.filter(
        (item): item is PosCartItem =>
          Boolean(item) &&
          typeof item.productId === "string" &&
          typeof item.name === "string" &&
          typeof item.sku === "string" &&
          typeof item.quantity === "number" &&
          typeof item.price === "number" &&
          typeof item.stock === "number" &&
          (typeof item.taxId === "string" || item.taxId === null) &&
          typeof item.priceWithoutTax === "number"
      )
    : [];
  const payments = Array.isArray(candidate.payments)
    ? candidate.payments.filter(
        (payment): payment is PaymentDraft =>
          Boolean(payment) &&
          typeof payment.id === "string" &&
          typeof payment.paymentMethodId === "string" &&
          typeof payment.amount === "string" &&
          typeof payment.reference === "string"
      )
    : [];
  const persistedAttempt = candidate.saleAttempt;
  const saleAttempt =
    persistedAttempt &&
    typeof persistedAttempt === "object" &&
    typeof persistedAttempt.attemptId === "string" &&
    typeof persistedAttempt.startedAt === "string"
      ? persistedAttempt
      : null;
  const saleStatus: PosSaleStatus =
    candidate.saleStatus === "CONFIRMED"
      ? "CONFIRMED"
      : candidate.saleStatus === "UNKNOWN" || candidate.saleStatus === "SUBMITTING"
        ? "UNKNOWN"
        : "DRAFT";

  return {
    items,
    selectedCustomerId:
      typeof candidate.selectedCustomerId === "string" ? candidate.selectedCustomerId : null,
    payments: payments.length > 0 ? payments : buildDefaultPayments(),
    saleStatus,
    saleAttempt,
  };
};

const posCartSlice = createSlice({
  name: "posCart",
  initialState: initialPosCartState,
  reducers: {
    setPosCartContext(state, action: PayloadAction<PosCartContext>) {
      const nextContextKey = buildPosCartStorageKey(action.payload);
      const contextChanged = state.contextKey !== nextContextKey;

      state.contextKey = nextContextKey;
      state.tenantId = action.payload.tenantId;
      state.branchId = action.payload.branchId;
      state.terminalId = action.payload.terminalId;
      state.userId = action.payload.userId;
      state.posSessionId = action.payload.posSessionId;

      if (contextChanged) {
        Object.assign(state, buildEmptySaleState());
      }
    },
    hydratePosCart(
      state,
      action: PayloadAction<{ contextKey: string; snapshot: unknown | null }>
    ) {
      if (state.contextKey !== action.payload.contextKey) {
        return;
      }

      Object.assign(state, normalizePersistedPosCartState(action.payload.snapshot));
    },
    setCartItems(state, action: PayloadAction<PosCartItem[]>) {
      if (state.saleStatus === "SUBMITTING" || state.saleStatus === "UNKNOWN") {
        return;
      }
      state.items = action.payload;
    },
    setSelectedCustomerId(state, action: PayloadAction<string | null>) {
      if (state.saleStatus === "SUBMITTING" || state.saleStatus === "UNKNOWN") {
        return;
      }
      state.selectedCustomerId = action.payload;
    },
    setPayments(state, action: PayloadAction<PaymentDraft[]>) {
      if (state.saleStatus === "SUBMITTING" || state.saleStatus === "UNKNOWN") {
        return;
      }
      state.payments = action.payload.length > 0 ? action.payload : buildDefaultPayments();
    },
    setSaleStatus(state, action: PayloadAction<PosSaleStatus>) {
      if (state.saleStatus === "UNKNOWN" && action.payload === "DRAFT") {
        return;
      }
      state.saleStatus = action.payload;
      if (action.payload === "DRAFT") {
        state.saleAttempt = null;
      }
    },
    beginSaleSubmission(state, action: PayloadAction<PosSaleAttempt>) {
      state.saleStatus = "SUBMITTING";
      state.saleAttempt = action.payload;
    },
    markSaleSubmissionUnknown(state) {
      if (state.saleAttempt) {
        state.saleStatus = "UNKNOWN";
      }
    },
    allowSaleSubmissionRetry(state) {
      state.saleStatus = "DRAFT";
      state.saleAttempt = null;
    },
    allowUnknownSaleRetry(state) {
      if (state.saleStatus === "UNKNOWN" && state.saleAttempt) {
        state.saleStatus = "DRAFT";
      }
    },
    resetPosCartSale(state) {
      Object.assign(state, buildEmptySaleState());
    },
    clearPosCartState() {
      return {
        contextKey: null,
        tenantId: null,
        branchId: null,
        terminalId: null,
        userId: null,
        posSessionId: null,
        ...buildEmptySaleState(),
      };
    },
  },
});

export const loadPersistedPosCartState = (contextKey: string) => {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(contextKey);
    if (!raw) {
      return null;
    }
    return JSON.parse(raw);
  } catch {
    // Ignore corrupt JSON and restart the cart for this context.
    try {
      window.localStorage.removeItem(contextKey);
    } catch {
      // Ignore cleanup failures.
    }
    return null;
  }
};

export const persistPosCartState = (state: PosCartState) => {
  if (typeof window === "undefined" || !state.contextKey) {
    return;
  }

  try {
    if (state.items.length === 0) {
      window.localStorage.removeItem(state.contextKey);
      return;
    }

    window.localStorage.setItem(
      state.contextKey,
      JSON.stringify({
        items: state.items,
        selectedCustomerId: state.selectedCustomerId,
        payments: state.payments,
        saleStatus: state.saleStatus,
        saleAttempt: state.saleAttempt,
      })
    );
  } catch {
    // Ignore persistence failures.
  }
};

export const clearPersistedPosCartState = (contextKey?: string | null) => {
  if (typeof window === "undefined") {
    return;
  }

  try {
    if (contextKey) {
      window.localStorage.removeItem(contextKey);
      return;
    }

    for (let index = window.localStorage.length - 1; index >= 0; index -= 1) {
      const key = window.localStorage.key(index);
      if (key?.startsWith(POS_CART_STORAGE_PREFIX)) {
        window.localStorage.removeItem(key);
      }
    }
  } catch {
    // Ignore cleanup failures.
  }
};

export const {
  setPosCartContext,
  hydratePosCart,
  setCartItems,
  setSelectedCustomerId,
  setPayments,
  setSaleStatus,
  beginSaleSubmission,
  markSaleSubmissionUnknown,
  allowSaleSubmissionRetry,
  allowUnknownSaleRetry,
  resetPosCartSale,
  clearPosCartState,
} = posCartSlice.actions;

export default posCartSlice.reducer;

