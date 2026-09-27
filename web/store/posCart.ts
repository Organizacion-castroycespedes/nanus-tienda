import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

export type PaymentDraft = {
  id: string;
  paymentMethodId: string;
  amount: string;
  reference: string;
  financialInstitutionId?: string | null;
};

export const POS_CART_PRICING_STATUSES = {
  PENDING: "PENDING",
  READY: "READY",
  ERROR: "ERROR",
} as const;

export type PosCartPricingStatus =
  (typeof POS_CART_PRICING_STATUSES)[keyof typeof POS_CART_PRICING_STATUSES];

export const POS_SALE_STATUSES = {
  DRAFT: "DRAFT",
  SUBMITTING: "SUBMITTING",
  UNKNOWN: "UNKNOWN",
  CONFIRMED: "CONFIRMED",
} as const;

export type PosSaleStatus =
  (typeof POS_SALE_STATUSES)[keyof typeof POS_SALE_STATUSES];

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

export type PosCartAccount = {
  id: string;
  name: string;
  items: PosCartItem[];
  selectedCustomerId: string | null;
  payments: PaymentDraft[];
  saleStatus: PosSaleStatus;
  saleAttempt: PosSaleAttempt | null;
  createdAt: number;
};

export type PosCartState = PosCartContext & {
  contextKey: string | null;
  accounts: PosCartAccount[];
  activeAccountId: string;
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

export const buildDefaultAccount = (
  id = "cuenta-1",
  name = "Cuenta 1"
): PosCartAccount => ({
  id,
  name,
  items: [],
  selectedCustomerId: null,
  payments: buildDefaultPayments(),
  saleStatus: POS_SALE_STATUSES.DRAFT,
  saleAttempt: null,
  createdAt: Date.now(),
});

const buildEmptySaleState = () => {
  const defaultAccount = buildDefaultAccount();
  return {
    accounts: [defaultAccount],
    activeAccountId: defaultAccount.id,
    items: defaultAccount.items,
    selectedCustomerId: defaultAccount.selectedCustomerId,
    payments: defaultAccount.payments,
    saleStatus: defaultAccount.saleStatus,
    saleAttempt: defaultAccount.saleAttempt,
  };
};

const syncActiveAccount = (state: PosCartState) => {
  const activeAccount = state.accounts.find(
    (acc) => acc.id === state.activeAccountId
  );
  if (activeAccount) {
    activeAccount.items = state.items;
    activeAccount.selectedCustomerId = state.selectedCustomerId;
    activeAccount.payments = state.payments;
    activeAccount.saleStatus = state.saleStatus;
    activeAccount.saleAttempt = state.saleAttempt;
  }
};

const loadAccountIntoState = (
  state: PosCartState,
  account: PosCartAccount
) => {
  state.activeAccountId = account.id;
  state.items = account.items;
  state.selectedCustomerId = account.selectedCustomerId;
  state.payments =
    account.payments.length > 0 ? account.payments : buildDefaultPayments();
  state.saleStatus = account.saleStatus;
  state.saleAttempt = account.saleAttempt;
};

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

const isValidCartItem = (item: unknown): item is PosCartItem =>
  Boolean(item) &&
  typeof (item as PosCartItem).productId === "string" &&
  typeof (item as PosCartItem).name === "string" &&
  typeof (item as PosCartItem).sku === "string" &&
  typeof (item as PosCartItem).quantity === "number" &&
  typeof (item as PosCartItem).price === "number" &&
  typeof (item as PosCartItem).stock === "number" &&
  (typeof (item as PosCartItem).taxId === "string" ||
    (item as PosCartItem).taxId === null) &&
  typeof (item as PosCartItem).priceWithoutTax === "number";

const isValidPayment = (payment: unknown): payment is PaymentDraft =>
  Boolean(payment) &&
  typeof (payment as PaymentDraft).id === "string" &&
  typeof (payment as PaymentDraft).paymentMethodId === "string" &&
  typeof (payment as PaymentDraft).amount === "string" &&
  typeof (payment as PaymentDraft).reference === "string";

const normalizePersistedPosCartState = (value: unknown) => {
  if (!value || typeof value !== "object") {
    return buildEmptySaleState();
  }

  const candidate = value as Record<string, unknown>;

  // Multi-account payload
  if (Array.isArray(candidate.accounts) && candidate.accounts.length > 0) {
    const normalizedAccounts: PosCartAccount[] = candidate.accounts.map(
      (rawAcc, index) => {
        const acc = (rawAcc && typeof rawAcc === "object"
          ? rawAcc
          : {}) as Partial<PosCartAccount>;
        const items = Array.isArray(acc.items)
          ? acc.items.filter(isValidCartItem)
          : [];
        const payments = Array.isArray(acc.payments)
          ? acc.payments.filter(isValidPayment)
          : [];
        const persistedAttempt = acc.saleAttempt as Record<string, unknown> | null | undefined;
        const rawSaleAttempt =
          persistedAttempt &&
          typeof persistedAttempt === "object" &&
          typeof persistedAttempt.attemptId === "string" &&
          typeof persistedAttempt.startedAt === "string"
            ? (persistedAttempt as unknown as PosSaleAttempt)
            : null;
        const saleStatus: PosSaleStatus =
          items.length === 0
            ? POS_SALE_STATUSES.DRAFT
            : acc.saleStatus === POS_SALE_STATUSES.CONFIRMED
              ? POS_SALE_STATUSES.CONFIRMED
              : acc.saleStatus === POS_SALE_STATUSES.UNKNOWN || acc.saleStatus === POS_SALE_STATUSES.SUBMITTING
                ? POS_SALE_STATUSES.UNKNOWN
                : POS_SALE_STATUSES.DRAFT;
        const saleAttempt = items.length === 0 ? null : rawSaleAttempt;

        return {
          id:
            typeof acc.id === "string" && acc.id
              ? acc.id
              : `cuenta-${index + 1}`,
          name:
            typeof acc.name === "string" && acc.name.trim()
              ? acc.name.trim()
              : `Cuenta ${index + 1}`,
          items,
          selectedCustomerId:
            typeof acc.selectedCustomerId === "string"
              ? acc.selectedCustomerId
              : null,
          payments: payments.length > 0 ? payments : buildDefaultPayments(),
          saleStatus,
          saleAttempt,
          createdAt:
            typeof acc.createdAt === "number" ? acc.createdAt : Date.now(),
        };
      }
    );

    const activeAccountId =
      typeof candidate.activeAccountId === "string" &&
      normalizedAccounts.some((acc) => acc.id === candidate.activeAccountId)
        ? candidate.activeAccountId
        : normalizedAccounts[0].id;

    const activeAccount =
      normalizedAccounts.find((acc) => acc.id === activeAccountId) ??
      normalizedAccounts[0];

    return {
      accounts: normalizedAccounts,
      activeAccountId: activeAccount.id,
      items: activeAccount.items,
      selectedCustomerId: activeAccount.selectedCustomerId,
      payments: activeAccount.payments,
      saleStatus: activeAccount.saleStatus,
      saleAttempt: activeAccount.saleAttempt,
    };
  }

  // Legacy single-cart payload
  const items = Array.isArray(candidate.items)
    ? candidate.items.filter(isValidCartItem)
    : [];
  const payments = Array.isArray(candidate.payments)
    ? candidate.payments.filter(isValidPayment)
    : [];
  const persistedAttempt = candidate.saleAttempt as Record<string, unknown> | null | undefined;
  const rawSaleAttempt =
    persistedAttempt &&
    typeof persistedAttempt === "object" &&
    typeof persistedAttempt.attemptId === "string" &&
    typeof persistedAttempt.startedAt === "string"
      ? (persistedAttempt as unknown as PosSaleAttempt)
      : null;
  const saleStatus: PosSaleStatus =
    items.length === 0
      ? POS_SALE_STATUSES.DRAFT
      : candidate.saleStatus === POS_SALE_STATUSES.CONFIRMED
        ? POS_SALE_STATUSES.CONFIRMED
        : candidate.saleStatus === POS_SALE_STATUSES.UNKNOWN || candidate.saleStatus === POS_SALE_STATUSES.SUBMITTING
          ? POS_SALE_STATUSES.UNKNOWN
          : POS_SALE_STATUSES.DRAFT;
  const saleAttempt = items.length === 0 ? null : rawSaleAttempt;

  const singleAccount: PosCartAccount = {
    id: "cuenta-1",
    name: "Cuenta 1",
    items,
    selectedCustomerId:
      typeof candidate.selectedCustomerId === "string"
        ? candidate.selectedCustomerId
        : null,
    payments: payments.length > 0 ? payments : buildDefaultPayments(),
    saleStatus,
    saleAttempt,
    createdAt: Date.now(),
  };

  return {
    accounts: [singleAccount],
    activeAccountId: singleAccount.id,
    items: singleAccount.items,
    selectedCustomerId: singleAccount.selectedCustomerId,
    payments: singleAccount.payments,
    saleStatus: singleAccount.saleStatus,
    saleAttempt: singleAccount.saleAttempt,
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

      Object.assign(
        state,
        normalizePersistedPosCartState(action.payload.snapshot)
      );
    },
    setCartItems(state, action: PayloadAction<PosCartItem[]>) {
      if (
        state.saleStatus === POS_SALE_STATUSES.SUBMITTING ||
        state.saleStatus === POS_SALE_STATUSES.UNKNOWN
      ) {
        return;
      }
      state.items = action.payload;
      syncActiveAccount(state);
    },
    setSelectedCustomerId(state, action: PayloadAction<string | null>) {
      if (
        state.saleStatus === POS_SALE_STATUSES.SUBMITTING ||
        state.saleStatus === POS_SALE_STATUSES.UNKNOWN
      ) {
        return;
      }
      state.selectedCustomerId = action.payload;
      syncActiveAccount(state);
    },
    setPayments(state, action: PayloadAction<PaymentDraft[]>) {
      if (
        state.saleStatus === POS_SALE_STATUSES.SUBMITTING ||
        state.saleStatus === POS_SALE_STATUSES.UNKNOWN
      ) {
        return;
      }
      state.payments =
        action.payload.length > 0 ? action.payload : buildDefaultPayments();
      syncActiveAccount(state);
    },
    setSaleStatus(state, action: PayloadAction<PosSaleStatus>) {
      if (
        state.saleStatus === POS_SALE_STATUSES.UNKNOWN &&
        action.payload === POS_SALE_STATUSES.DRAFT &&
        state.items.length > 0
      ) {
        return;
      }
      state.saleStatus = action.payload;
      if (action.payload === POS_SALE_STATUSES.DRAFT) {
        state.saleAttempt = null;
      }
      syncActiveAccount(state);
    },
    beginSaleSubmission(state, action: PayloadAction<PosSaleAttempt>) {
      state.saleStatus = POS_SALE_STATUSES.SUBMITTING;
      state.saleAttempt = action.payload;
      syncActiveAccount(state);
    },
    markSaleSubmissionUnknown(state) {
      if (state.saleAttempt) {
        state.saleStatus = POS_SALE_STATUSES.UNKNOWN;
        syncActiveAccount(state);
      }
    },
    allowSaleSubmissionRetry(state) {
      state.saleStatus = POS_SALE_STATUSES.DRAFT;
      state.saleAttempt = null;
      syncActiveAccount(state);
    },
    allowUnknownSaleRetry(state) {
      if (
        state.saleStatus === POS_SALE_STATUSES.UNKNOWN &&
        state.saleAttempt
      ) {
        state.saleStatus = POS_SALE_STATUSES.DRAFT;
        syncActiveAccount(state);
      }
    },
    resetPosCartSale(state) {
      state.items = [];
      state.selectedCustomerId = null;
      state.payments = buildDefaultPayments();
      state.saleStatus = POS_SALE_STATUSES.DRAFT;
      state.saleAttempt = null;
      syncActiveAccount(state);
    },
    addAccount: {
      reducer(
        state,
        action: PayloadAction<{ name?: string } | undefined>
      ) {
        syncActiveAccount(state);
        const nextNum = state.accounts.length + 1;
        const name = action.payload?.name?.trim() || `Cuenta ${nextNum}`;
        const newAccount: PosCartAccount = {
          id: `cuenta-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
          name,
          items: [],
          selectedCustomerId: null,
          payments: buildDefaultPayments(),
          saleStatus: POS_SALE_STATUSES.DRAFT,
          saleAttempt: null,
          createdAt: Date.now(),
        };
        state.accounts.push(newAccount);
        loadAccountIntoState(state, newAccount);
      },
      prepare(options?: { name?: string }) {
        return { payload: options };
      },
    },
    switchAccount(state, action: PayloadAction<string>) {
      const targetId = action.payload;
      if (targetId === state.activeAccountId) {
        return;
      }
      syncActiveAccount(state);
      const targetAccount = state.accounts.find((acc) => acc.id === targetId);
      if (targetAccount) {
        loadAccountIntoState(state, targetAccount);
      }
    },
    renameAccount(
      state,
      action: PayloadAction<{ id: string; name: string }>
    ) {
      const { id, name } = action.payload;
      const cleanName = name.trim();
      if (!cleanName) {
        return;
      }
      const target = state.accounts.find((acc) => acc.id === id);
      if (target) {
        target.name = cleanName;
      }
    },
    removeAccount(state, action: PayloadAction<string>) {
      const targetId = action.payload;
      if (state.accounts.length <= 1) {
        state.items = [];
        state.selectedCustomerId = null;
        state.payments = buildDefaultPayments();
        state.saleStatus = POS_SALE_STATUSES.DRAFT;
        state.saleAttempt = null;
        if (state.accounts[0]) {
          state.accounts[0].name = "Cuenta 1";
          state.accounts[0].items = [];
          state.accounts[0].selectedCustomerId = null;
          state.accounts[0].payments = buildDefaultPayments();
          state.accounts[0].saleStatus = POS_SALE_STATUSES.DRAFT;
          state.accounts[0].saleAttempt = null;
        }
        return;
      }

      const index = state.accounts.findIndex((acc) => acc.id === targetId);
      if (index >= 0) {
        state.accounts.splice(index, 1);
        if (state.activeAccountId === targetId) {
          const nextActive =
            state.accounts[Math.max(0, index - 1)] ?? state.accounts[0];
          loadAccountIntoState(state, nextActive);
        }
      }
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
    const totalItems = state.accounts.reduce(
      (sum, acc) => sum + acc.items.length,
      0
    );
    if (totalItems === 0 && state.accounts.length <= 1) {
      window.localStorage.removeItem(state.contextKey);
      return;
    }

    const accountsToPersist = state.accounts.map((acc) => {
      if (acc.id === state.activeAccountId) {
        return {
          ...acc,
          items: state.items,
          selectedCustomerId: state.selectedCustomerId,
          payments: state.payments,
          saleStatus: state.saleStatus,
          saleAttempt: state.saleAttempt,
        };
      }
      return acc;
    });

    window.localStorage.setItem(
      state.contextKey,
      JSON.stringify({
        accounts: accountsToPersist,
        activeAccountId: state.activeAccountId,
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
  addAccount,
  switchAccount,
  renameAccount,
  removeAccount,
  clearPosCartState,
} = posCartSlice.actions;

export default posCartSlice.reducer;

