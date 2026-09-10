"use client";

import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { Provider } from "react-redux";
import { store } from "../store";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import AuthSessionManager from "../components/auth/AuthSessionManager";
import { ConfirmProvider } from "../providers/confirm-provider";
import { useTenantTheme } from "../hooks/useTenantTheme";
import {
  clearPersistedPosState,
  clearContext as clearPosContext,
  loadPersistedPosState,
  persistPosState,
  setContext as setPosContext,
  setSession as setPosSession,
} from "../store/pos";
import {
  clearPersistedPosCartState,
  hydratePosCart,
  loadPersistedPosCartState,
  persistPosCartState,
  setPosCartContext,
} from "../store/posCart";
import { setInventoryScope } from "../store/inventoryScopeSlice";
import { syncLocalPeripheralAssignments } from "../domains/peripherals/local-config-sync";
import { getAuthContext, getCurrentPosSession } from "../domains/pos/api";
import { resolvePosSessionContext } from "../domains/pos/utils/pos-session-context";

const BrandingApplier = ({ children }: { children: ReactNode }) => {
  const config = useAppSelector((state) => state.branding.config);
  const theme = useTenantTheme();

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--color-primary", theme.primary);
    root.style.setProperty("--color-secondary", theme.secondary);
    root.style.setProperty("--color-bg", theme.surface.page);
    root.style.setProperty("--color-text", theme.surface.text);
    root.style.setProperty("--brand-primary", theme.primary);
    root.style.setProperty("--brand-primary-text", theme.primaryText);
    root.style.setProperty("--brand-primary-soft", theme.primarySoftBg);
    root.style.setProperty("--brand-primary-border", theme.primaryBorder);
    root.style.setProperty("--brand-primary-hover", theme.header.actionHover);
    root.style.setProperty("--brand-secondary", theme.secondary);
    root.style.setProperty("--brand-secondary-text", theme.secondaryText);
    root.style.setProperty("--brand-secondary-soft", theme.secondarySoftBg);
    root.style.setProperty("--brand-secondary-border", theme.secondaryBorder);
    root.style.setProperty("--brand-background", theme.surface.page);
    root.style.setProperty("--brand-text", theme.surface.text);
    root.style.setProperty("--font-base", config.font);
    root.style.setProperty("--brand-sidebar-bg", theme.sidebar.background);
    root.style.setProperty("--brand-sidebar-text", theme.sidebar.text);
    root.style.setProperty("--brand-sidebar-muted", theme.sidebar.mutedText);
    root.style.setProperty("--brand-sidebar-active", theme.sidebar.activeBackground);
    root.style.setProperty("--brand-sidebar-active-text", theme.sidebar.activeText);
    root.style.setProperty("--brand-sidebar-open", theme.sidebar.openBackground);
    root.style.setProperty("--brand-sidebar-open-text", theme.sidebar.openText);
    root.style.setProperty(
      "--brand-sidebar-open-indicator",
      theme.sidebar.openIndicator
    );
    root.style.setProperty(
      "--brand-sidebar-sub-active",
      theme.sidebar.subItemActiveBackground
    );
    root.style.setProperty(
      "--brand-sidebar-sub-active-text",
      theme.sidebar.subItemActiveText
    );
    root.style.setProperty(
      "--brand-sidebar-sub-indicator",
      theme.sidebar.subItemActiveIndicator
    );
    root.style.setProperty("--brand-sidebar-hover", theme.sidebar.itemHoverBackground);
    root.style.setProperty("--brand-sidebar-border", theme.sidebar.border);
    root.style.setProperty("--brand-sidebar-accent", theme.sidebar.activeIndicator);
    root.style.setProperty("--brand-sidebar-focus", theme.sidebar.focusRing);
    root.style.setProperty(
      "--brand-sidebar-focus-offset",
      theme.sidebar.focusRingOffset
    );
    root.style.setProperty("--brand-header-bg", theme.header.background);
    root.style.setProperty("--brand-header-text", theme.header.text);
    root.style.setProperty("--brand-header-muted", theme.header.mutedText);
    root.style.setProperty("--brand-header-border", theme.header.border);
    root.style.setProperty("--brand-header-icon-bg", theme.header.iconButtonBackground);
    root.style.setProperty("--brand-header-icon-border", theme.header.iconButtonBorder);
    root.style.setProperty("--brand-header-icon-text", theme.header.iconButtonText);
    root.style.setProperty("--brand-surface-card", theme.surface.card);
    root.style.setProperty("--brand-surface-muted", theme.surface.mutedText);
    root.style.setProperty("--brand-surface-border", theme.surface.border);
  }, [config, theme]);

  return <>{children}</>;
};

const PosStateManager = () => {
  const authStatus = useAppSelector((state) => state.auth.authStatus);
  const bootstrapped = useAppSelector((state) => state.auth.bootstrapped);
  const authTenantId = useAppSelector((state) => state.auth.tenantId);
  const authUserId = useAppSelector((state) => state.auth.user?.id ?? null);
  const pos = useAppSelector((state) => state.pos);
  const [hydrated, setHydrated] = useState(false);
  const bootstrapKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!bootstrapped) {
      return;
    }

    if (authStatus !== "authenticated") {
      bootstrapKeyRef.current = null;
      setHydrated(true);
      return;
    }

    const bootstrapKey = `${authTenantId ?? "default"}:${authUserId ?? "anonymous"}`;
    if (bootstrapKeyRef.current === bootstrapKey) {
      setHydrated(true);
      return;
    }

    bootstrapKeyRef.current = bootstrapKey;
    let active = true;

    const syncPosContext = async () => {
      const tenantId = authTenantId ?? null;
      if (!tenantId) {
        store.dispatch(clearPosContext());
        clearPersistedPosState();
        if (active) {
          setHydrated(true);
        }
        return;
      }

      const [currentSession, authContext] = await Promise.all([
        getCurrentPosSession().catch(() => null),
        getAuthContext().catch(() => null),
      ]);

      if (!active) {
        return;
      }

      const resolved = resolvePosSessionContext(authContext, currentSession, tenantId);
      if (resolved) {
        store.dispatch(
          setPosContext({
            tenantId: resolved.tenantId,
            branchId: resolved.branchId,
            branchName: resolved.branchName,
            terminalId: resolved.terminalId,
            terminalName: resolved.terminalName,
            cashRegisterId: null,
          })
        );
        store.dispatch(
          setPosSession({
            posSessionId: resolved.posSessionId,
            branchId: resolved.branchId,
            branchName: resolved.branchName,
            terminalId: resolved.terminalId,
            terminalName: resolved.terminalName,
            cashRegisterId: null,
          })
        );
        setHydrated(true);
        return;
      }

      const persisted = loadPersistedPosState();
      if (
        persisted &&
        persisted.tenantId === tenantId &&
        persisted.branchId &&
        persisted.terminalId &&
        persisted.posSessionId
      ) {
        store.dispatch(
          setPosContext({
            tenantId: persisted.tenantId,
            branchId: persisted.branchId,
            branchName: persisted.branchName ?? null,
            terminalId: persisted.terminalId,
            terminalName: persisted.terminalName ?? null,
            cashRegisterId: persisted.cashRegisterId ?? null,
          })
        );
        store.dispatch(
          setPosSession({
            posSessionId: persisted.posSessionId,
            branchId: persisted.branchId,
            branchName: persisted.branchName ?? null,
            terminalId: persisted.terminalId,
            terminalName: persisted.terminalName ?? null,
            cashRegisterId: persisted.cashRegisterId ?? null,
          })
        );
        setHydrated(true);
        return;
      }

      store.dispatch(clearPosContext());
      clearPersistedPosState();
      setHydrated(true);
    };

    void syncPosContext();

    return () => {
      active = false;
    };
  }, [authStatus, authTenantId, authUserId, bootstrapped]);

  useEffect(() => {
    if (!hydrated) {
      return;
    }
    persistPosState(pos);
  }, [hydrated, pos]);

  return null;
};

const PosCartStateManager = () => {
  const dispatch = useAppDispatch();
  const pos = useAppSelector((state) => state.pos);
  const userId = useAppSelector((state) => state.auth.user?.id ?? null);
  const posCart = useAppSelector((state) => state.posCart);
  const hydratedContextKeyRef = useRef<string | null>(null);
  const previousContextKeyRef = useRef<string | null>(null);

  useEffect(() => {
    dispatch(
      setPosCartContext({
        tenantId: pos.tenantId,
        branchId: pos.branchId,
        terminalId: pos.terminalId,
        userId,
        posSessionId: pos.posSessionId,
      })
    );
  }, [dispatch, pos.branchId, pos.posSessionId, pos.tenantId, pos.terminalId, userId]);

  useEffect(() => {
    const previousContextKey = previousContextKeyRef.current;
    if (previousContextKey && previousContextKey !== posCart.contextKey) {
      clearPersistedPosCartState(previousContextKey);
    }

    previousContextKeyRef.current = posCart.contextKey;
    hydratedContextKeyRef.current = null;

    if (!posCart.contextKey) {
      return;
    }

    const snapshot = loadPersistedPosCartState(posCart.contextKey);
    dispatch(hydratePosCart({ contextKey: posCart.contextKey, snapshot }));
    hydratedContextKeyRef.current = posCart.contextKey;
  }, [dispatch, posCart.contextKey]);

  useEffect(() => {
    if (!posCart.contextKey || hydratedContextKeyRef.current !== posCart.contextKey) {
      return;
    }

    persistPosCartState(posCart);
  }, [posCart]);

  return null;
};

const InventoryScopeManager = () => {
  const dispatch = useAppDispatch();
  const auth = useAppSelector((state) => state.auth);
  const pos = useAppSelector((state) => state.pos);

  useEffect(() => {
    dispatch(
      setInventoryScope({
        currentTenant: pos.tenantId ?? auth.user?.tenantId ?? auth.tenantId ?? null,
        currentBranch: pos.branchId ?? auth.user?.branchId ?? null,
      })
    );
  }, [auth.tenantId, auth.user?.branchId, auth.user?.tenantId, dispatch, pos.branchId, pos.tenantId]);

  return null;
};

const LocalPeripheralSyncManager = () => {
  const auth = useAppSelector((state) => state.auth);
  const pos = useAppSelector((state) => state.pos);
  const lastSyncKey = useRef<string | null>(null);

  useEffect(() => {
    const tenantId = pos.tenantId ?? auth.user?.tenantId ?? auth.tenantId ?? null;
    const branchId = pos.branchId ?? auth.user?.branchId ?? null;
    const terminalId = pos.terminalId ?? null;
    const key = [auth.user?.id ?? "", tenantId ?? "", branchId ?? "", terminalId ?? ""].join(":");
    if (!auth.user || !tenantId || !branchId || !terminalId || terminalId === "local-terminal" || lastSyncKey.current === key) {
      return;
    }
    void syncLocalPeripheralAssignments({
      authenticated: true,
      tenantId,
      branchId,
      terminalId,
    }).then((result) => {
      if (result.status === "SYNCED" || result.status === "NOOP") {
        lastSyncKey.current = key;
      }
    });
  }, [auth.tenantId, auth.user, pos.branchId, pos.terminalId, pos.tenantId]);

  return null;
};

const Providers = ({ children }: { children: ReactNode }) => {
  return (
    <Provider store={store}>
      <BrandingApplier>
        <ConfirmProvider>
          <AuthSessionManager />
          <PosStateManager />
          <PosCartStateManager />
          <InventoryScopeManager />
          <LocalPeripheralSyncManager />
          {children}
        </ConfirmProvider>
      </BrandingApplier>
    </Provider>
  );
};

export default Providers;
