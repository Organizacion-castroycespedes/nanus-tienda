"use client";

import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { Provider } from "react-redux";
import { store } from "../store";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import AuthSessionManager from "../components/auth/AuthSessionManager";
import { ConfirmProvider } from "../providers/confirm-provider";
import {
  persistPosState,
  rehydratePosContextFromStorage,
} from "../store/pos";
import {
  clearPersistedPosCartState,
  hydratePosCart,
  loadPersistedPosCartState,
  persistPosCartState,
  setPosCartContext,
} from "../store/posCart";
import { setInventoryScope } from "../store/inventoryScopeSlice";

const BrandingApplier = ({ children }: { children: ReactNode }) => {
  const config = useAppSelector((state) => state.branding.config);

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--color-primary", config.colors.primary);
    root.style.setProperty("--color-secondary", config.colors.secondary);
    root.style.setProperty("--color-bg", config.colors.background);
    root.style.setProperty("--color-text", config.colors.text);
    root.style.setProperty("--brand-primary", config.colors.primary);
    root.style.setProperty("--font-base", config.font);
  }, [config]);

  return <>{children}</>;
};

const PosStateManager = () => {
  const pos = useAppSelector((state) => state.pos);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    rehydratePosContextFromStorage(store.dispatch);
    setHydrated(true);
  }, []);

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

const Providers = ({ children }: { children: ReactNode }) => {
  return (
    <Provider store={store}>
      <BrandingApplier>
        <ConfirmProvider>
          <AuthSessionManager />
          <PosStateManager />
          <PosCartStateManager />
          <InventoryScopeManager />
          {children}
        </ConfirmProvider>
      </BrandingApplier>
    </Provider>
  );
};

export default Providers;
