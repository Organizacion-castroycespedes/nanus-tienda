import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { AuthUser } from "../domains/auth/types";

export type AuthStatus =
  | "anonymous"
  | "authenticating"
  | "authenticated"
  | "refreshing"
  | "error";

export type AuthState = {
  accessToken: string | null;
  user: AuthUser | null;
  tenantId: string | null;
  authStatus: AuthStatus;
  tokenExpiry: number | null;
  bootstrapped: boolean;
};

const initialState: AuthState = {
  accessToken: null,
  user: null,
  tenantId: null,
  authStatus: "anonymous",
  tokenExpiry: null,
  bootstrapped: false,
};

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    setAuthStatus(state, action: PayloadAction<AuthStatus>) {
      state.authStatus = action.payload;
    },
    setAccessToken(
      state,
      action: PayloadAction<{ accessToken: string | null; tokenExpiry: number | null }>
    ) {
      state.accessToken = action.payload.accessToken;
      state.tokenExpiry = action.payload.tokenExpiry;
    },
    setUser(state, action: PayloadAction<AuthUser | null>) {
      state.user = action.payload;
      state.tenantId = action.payload?.tenantId ?? state.tenantId;
    },
    setTenantId(state, action: PayloadAction<string | null>) {
      state.tenantId = action.payload;
    },
    setBootstrapped(state, action: PayloadAction<boolean>) {
      state.bootstrapped = action.payload;
    },
    clearAuth(state) {
      state.accessToken = null;
      state.user = null;
      state.tenantId = null;
      state.authStatus = "anonymous";
      state.tokenExpiry = null;
      state.bootstrapped = true;
    },
  },
});

export const {
  setAuthStatus,
  setAccessToken,
  setUser,
  setTenantId,
  setBootstrapped,
  clearAuth,
} = authSlice.actions;

export default authSlice.reducer;
