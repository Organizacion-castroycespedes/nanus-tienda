import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { PosState } from "../domains/pos/types";

export const POS_STORAGE_KEY = "pos-context";
const LEGACY_POS_STORAGE_KEY = "manus:pos-context";

export const initialPosState: PosState = {
  tenantId: null,
  branchId: null,
  terminalId: null,
  cashRegisterId: null,
  posSessionId: null,
  loading: false,
  error: null,
};

type PosContextPayload = {
  tenantId?: string | null;
  branchId?: string | null;
  terminalId?: string | null;
  cashRegisterId?: string | null;
};

type PosSessionPayload = {
  posSessionId: string | null;
  branchId?: string | null;
  terminalId?: string | null;
  cashRegisterId?: string | null;
};

const posSlice = createSlice({
  name: "pos",
  initialState: initialPosState,
  reducers: {
    setContext(state, action: PayloadAction<PosContextPayload>) {
      const nextTenantId =
        action.payload.tenantId === undefined
          ? state.tenantId
          : action.payload.tenantId;
      const tenantChanged = nextTenantId !== state.tenantId;

      if (tenantChanged) {
        state.tenantId = nextTenantId;
        state.branchId = action.payload.branchId ?? null;
        state.terminalId = action.payload.terminalId ?? null;
        state.cashRegisterId = action.payload.cashRegisterId ?? null;
        state.posSessionId = null;
        state.error = null;
        return;
      }

      if (action.payload.branchId !== undefined && action.payload.branchId !== state.branchId) {
        state.branchId = action.payload.branchId;
        state.terminalId = null;
        state.cashRegisterId = null;
        state.posSessionId = null;
      }

      if (action.payload.terminalId !== undefined) {
        if (action.payload.terminalId !== state.terminalId) {
          state.terminalId = action.payload.terminalId;
          state.cashRegisterId = null;
          state.posSessionId = null;
        }
      }

      if (action.payload.tenantId !== undefined) {
        state.tenantId = action.payload.tenantId;
      }
      state.error = null;
    },
    setSession(state, action: PayloadAction<PosSessionPayload>) {
      state.posSessionId = action.payload.posSessionId;
      if (action.payload.branchId !== undefined) {
        state.branchId = action.payload.branchId;
      }
      if (action.payload.terminalId !== undefined) {
        state.terminalId = action.payload.terminalId;
      }
      if (action.payload.cashRegisterId !== undefined) {
        state.cashRegisterId = action.payload.cashRegisterId;
      }
      state.loading = false;
      state.error = null;
    },
    clearContext() {
      return { ...initialPosState };
    },
    setLoading(state, action: PayloadAction<boolean>) {
      state.loading = action.payload;
    },
    setError(state, action: PayloadAction<string | null>) {
      state.error = action.payload;
      if (action.payload) {
        state.loading = false;
      }
    },
    hydratePosState(state, action: PayloadAction<Partial<PosState> | null>) {
      if (!action.payload) {
        return state;
      }
      state.tenantId = action.payload.tenantId ?? null;
      state.branchId = action.payload.branchId ?? null;
      state.terminalId = action.payload.terminalId ?? null;
      state.cashRegisterId = action.payload.cashRegisterId ?? null;
      state.posSessionId = action.payload.posSessionId ?? null;
      state.loading = false;
      state.error = null;
    },
  },
});

export const loadPersistedPosState = (): Partial<PosState> | null => {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const raw =
      window.localStorage.getItem(POS_STORAGE_KEY) ??
      window.localStorage.getItem(LEGACY_POS_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    return JSON.parse(raw) as Partial<PosState>;
  } catch {
    return null;
  }
};

export const persistPosState = (state: PosState) => {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(
      POS_STORAGE_KEY,
      JSON.stringify({
        tenantId: state.tenantId,
        branchId: state.branchId,
        terminalId: state.terminalId,
        cashRegisterId: state.cashRegisterId,
        posSessionId: state.posSessionId,
      })
    );
  } catch {
    // Ignore persistence failures.
  }
};

export const clearPersistedPosState = () => {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.removeItem(POS_STORAGE_KEY);
    window.localStorage.removeItem(LEGACY_POS_STORAGE_KEY);
  } catch {
    // Ignore persistence failures.
  }
};

export const rehydratePosContextFromStorage = (
  dispatch: (action: PayloadAction<any>) => void
) => {
  const persisted = loadPersistedPosState();
  if (!persisted) {
    return;
  }

  dispatch(
    setContext({
      tenantId: persisted.tenantId ?? null,
      branchId: persisted.branchId ?? null,
      terminalId: persisted.terminalId ?? null,
      cashRegisterId: persisted.cashRegisterId ?? null,
    })
  );

  if (persisted.posSessionId) {
    dispatch(
      setSession({
        posSessionId: persisted.posSessionId,
        branchId: persisted.branchId ?? null,
        terminalId: persisted.terminalId ?? null,
        cashRegisterId: persisted.cashRegisterId ?? null,
      })
    );
  }
};

export const {
  setContext,
  setSession,
  clearContext,
  setLoading,
  setError,
  hydratePosState,
} = posSlice.actions;

export default posSlice.reducer;
