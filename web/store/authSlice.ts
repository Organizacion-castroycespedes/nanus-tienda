import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { AuthUser } from "../domains/auth/types";
import type { PermissionSummary } from "../domains/menu/types";

export type AuthStatus =
  | "anonymous"
  | "authenticating"
  | "authenticated"
  | "refreshing"
  | "error";

export type AuthState = {
  accessToken: string | null;
  user: AuthUser | null;
  role: string | null;
  permissions: PermissionSummary[];
  permissionsLoaded: boolean;
  tenantId: string | null;
  tenantSlug: string | null;
  authStatus: AuthStatus;
  tokenExpiry: number | null;
  bootstrapped: boolean;
};

const initialState: AuthState = {
  accessToken: null,
  user: null,
  role: null,
  permissions: [],
  permissionsLoaded: false,
  tenantId: null,
  tenantSlug: null,
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
      state.role = action.payload?.role ?? null;
      state.tenantId = action.payload?.tenantId ?? state.tenantId;
      state.tenantSlug = action.payload?.tenantSlug ?? state.tenantSlug;
    },
    setRole(state, action: PayloadAction<string | null>) {
      state.role = action.payload;
    },
    setAuthPermissions(state, action: PayloadAction<PermissionSummary[]>) {
      state.permissions = action.payload;
      state.permissionsLoaded = true;
    },
    setTenantId(state, action: PayloadAction<string | null>) {
      state.tenantId = action.payload;
    },
    setTenantSlug(state, action: PayloadAction<string | null>) {
      state.tenantSlug = action.payload;
    },
    setBootstrapped(state, action: PayloadAction<boolean>) {
      state.bootstrapped = action.payload;
    },
    clearAuth(state) {
      state.accessToken = null;
      state.user = null;
      state.role = null;
      state.permissions = [];
      state.permissionsLoaded = false;
      state.tenantId = null;
      state.tenantSlug = null;
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
  setRole,
  setAuthPermissions,
  setTenantId,
  setTenantSlug,
  setBootstrapped,
  clearAuth,
} = authSlice.actions;

export default authSlice.reducer;
