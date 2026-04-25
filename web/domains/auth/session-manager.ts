import { store } from "../../store";
import { clearMenu, setActiveTenant, setMenuCache, setMenuItems, setPermissions } from "../../store/menuSlice";
import {
  clearAuth,
  setAccessToken,
  setAuthStatus,
  setBootstrapped,
  setTenantId,
  setUser,
} from "../../store/authSlice";
import { ApiError, requestJson } from "../../lib/request";
import { decodeTokenPayload, getTokenExpiry } from "./jwt";
import { clearRefreshToken, getStoredRefreshToken, persistRefreshToken } from "./session";
import type { AuthProfile, AuthTokens, AuthUser } from "./types";
import type { MenuResponse, PermissionsResponse } from "../menu/types";
import { clearMenuCache, persistMenuCache, readMenuCache } from "./menu-cache";

const REFRESH_BUFFER_MS = 60 * 1000;

let refreshPromise: Promise<string | null> | null = null;
let bootstrapPromise: Promise<void> | null = null;
let refreshTimeoutId: number | null = null;

const getAuthHeader = (accessToken: string) => ({
  Authorization: `Bearer ${accessToken}`,
});

const applyTenantToMenu = (
  items: MenuResponse["items"],
  tenant: string
): MenuResponse["items"] =>
  items.map((item) => ({
    ...item,
    route: item.route.replace("{tenant}", tenant),
    children: item.children ? applyTenantToMenu(item.children, tenant) : undefined,
  }));

const buildUserFromToken = (accessToken: string, fallbackEmail = ""): AuthUser => {
  const tokenPayload = decodeTokenPayload(accessToken);
  const tenantSlug = tokenPayload?.tenant_id ?? "default";
  const role = tokenPayload?.roles?.[0] ?? "";
  return {
    id: tokenPayload?.sub ?? "",
    name: "",
    email: fallbackEmail,
    role,
    tenantId: tenantSlug,
  };
};

const applyProfileToState = (profile: AuthProfile, roleFallback: string) => {
  const fullName = [profile.persona?.nombres, profile.persona?.apellidos]
    .filter(Boolean)
    .join(" ");
  const nextUser: AuthUser = {
    id: profile.id,
    name: fullName || profile.email,
    email: profile.email,
    role: profile.role?.nombre ?? roleFallback,
    tenantId: profile.tenant.id,
    tenantName: profile.tenant.nombre,
    branchId: profile.branch?.id ?? null,
    branchName: profile.branch?.nombre ?? null,
    persona: profile.persona,
  };
  store.dispatch(setUser(nextUser));
  store.dispatch(setTenantId(profile.tenant.id));
};

export const scheduleTokenRefresh = (accessToken: string | null) => {
  if (typeof window === "undefined") {
    return;
  }
  if (refreshTimeoutId) {
    window.clearTimeout(refreshTimeoutId);
    refreshTimeoutId = null;
  }
  if (!accessToken) {
    return;
  }
  const expiry = getTokenExpiry(accessToken);
  if (!expiry) {
    return;
  }
  const refreshIn = Math.max(expiry - Date.now() - REFRESH_BUFFER_MS, 0);
  refreshTimeoutId = window.setTimeout(() => {
    void refreshSession();
  }, refreshIn);
};

export const clearTokenRefreshSchedule = () => {
  if (typeof window === "undefined") {
    return;
  }
  if (refreshTimeoutId) {
    window.clearTimeout(refreshTimeoutId);
    refreshTimeoutId = null;
  }
};

const rehydrateMenuAndPermissions = async (accessToken: string, tenantId: string) => {
  const cachedMenu = await readMenuCache(accessToken, tenantId);
  if (cachedMenu) {
    const resolvedMenu = applyTenantToMenu(cachedMenu, tenantId);
    store.dispatch(
      setMenuCache({
        tenantId,
        cachedAt: Date.now(),
        items: resolvedMenu,
      })
    );
    store.dispatch(setMenuItems(resolvedMenu));
  }

  try {
    const [menu, permissions] = await Promise.all([
      requestJson<MenuResponse>("/me/menu", {
        headers: getAuthHeader(accessToken),
      }),
      requestJson<PermissionsResponse>("/me/permissions", {
        headers: getAuthHeader(accessToken),
      }),
    ]);
    const resolvedMenu = applyTenantToMenu(menu.items, tenantId);
    store.dispatch(
      setMenuCache({
        tenantId,
        cachedAt: Date.now(),
        items: resolvedMenu,
      })
    );
    store.dispatch(setMenuItems(resolvedMenu));
    store.dispatch(setPermissions(permissions.items));
    await persistMenuCache(accessToken, tenantId, menu.items);
  } catch {
    store.dispatch(setPermissions([]));
    store.dispatch(setMenuItems([]));
  }
};

export const rehydrateSession = async (accessToken: string, fallbackEmail?: string) => {
  const tokenPayload = decodeTokenPayload(accessToken);
  const role = tokenPayload?.roles?.[0] ?? "";
  const tenantId = tokenPayload?.tenant_id ?? "default";
  store.dispatch(setActiveTenant(tenantId));
  store.dispatch(setTenantId(tenantId));

  const baseUser = buildUserFromToken(accessToken, fallbackEmail);
  store.dispatch(setUser(baseUser));

  try {
    const profile = await requestJson<AuthProfile>("/auth/me", {
      headers: getAuthHeader(accessToken),
    });
    applyProfileToState(profile, role);
  } catch {
    // keep base user if profile fetch fails
  }

  await rehydrateMenuAndPermissions(accessToken, tenantId);
};

export const refreshSession = async (): Promise<string | null> => {
  if (refreshPromise) {
    return refreshPromise;
  }
  refreshPromise = (async () => {
    store.dispatch(setAuthStatus("refreshing"));
    const refreshToken = getStoredRefreshToken();
    if (!refreshToken) {
      store.dispatch(setAuthStatus("anonymous"));
      clearTokenRefreshSchedule();
      return null;
    }
    const headers = new Headers({ "Content-Type": "application/json" });
    const body = JSON.stringify({ refreshToken });
    const tokens = await requestJson<AuthTokens>("/auth/refresh", {
      method: "POST",
      credentials: "include",
      headers,
      body,
    });
    if (!tokens?.accessToken) {
      throw new Error("Missing access token");
    }
    if (tokens.refreshToken) {
      persistRefreshToken(tokens.refreshToken);
    }
    const tokenExpiry = getTokenExpiry(tokens.accessToken);
    store.dispatch(setAccessToken({ accessToken: tokens.accessToken, tokenExpiry }));
    store.dispatch(setAuthStatus("authenticated"));
    await rehydrateSession(tokens.accessToken);
    return tokens.accessToken;
  })()
    .catch((error) => {
      if (error instanceof ApiError && error.status === 401) {
        clearSession({ reason: "session-ended" });
      } else {
        clearSession();
      }
      return null;
    })
    .finally(() => {
      refreshPromise = null;
    });
  return refreshPromise;
};

export const bootstrapSession = async () => {
  if (bootstrapPromise) {
    return bootstrapPromise;
  }
  bootstrapPromise = (async () => {
    const { authStatus } = store.getState().auth;
    if (authStatus !== "anonymous") {
      return;
    }
    store.dispatch(setAuthStatus("refreshing"));
    try {
      await refreshSession();
    } catch {
      store.dispatch(setAuthStatus("anonymous"));
    }
  })()
    .finally(() => {
      store.dispatch(setBootstrapped(true));
    })
    .finally(() => {
      bootstrapPromise = null;
    });
  return bootstrapPromise;
};

export const startSessionFromLogin = async (
  tokens: AuthTokens,
  options?: { fallbackEmail?: string; persistRefresh?: boolean }
) => {
  const persistRefresh = options?.persistRefresh ?? true;
  if (tokens.refreshToken) {
    persistRefreshToken(tokens.refreshToken, { persist: persistRefresh });
  }
  const tokenExpiry = getTokenExpiry(tokens.accessToken);
  store.dispatch(setAccessToken({ accessToken: tokens.accessToken, tokenExpiry }));
  store.dispatch(setAuthStatus("authenticated"));
  await rehydrateSession(tokens.accessToken, options?.fallbackEmail);
};

export const clearSession = (options?: { reason?: string }) => {
  store.dispatch(clearAuth());
  store.dispatch(clearMenu());
  clearRefreshToken();
  clearMenuCache();
  clearTokenRefreshSchedule();
  if (typeof window !== "undefined") {
    if (window.location.pathname !== "/login") {
      const reasonParam = options?.reason
        ? `?reason=${encodeURIComponent(options.reason)}`
        : "";
      window.location.assign(`/login${reasonParam}`);
    }
  }
};
