"use client";

import type { ReactNode } from "react";
import { useEffect } from "react";
import { Provider } from "react-redux";
import { store } from "../store";
import { useAppSelector } from "../store/hooks";
import AuthSessionManager from "../components/auth/AuthSessionManager";
import { ConfirmProvider } from "../providers/confirm-provider";

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

const Providers = ({ children }: { children: ReactNode }) => {
  return (
    <Provider store={store}>
      <BrandingApplier>
        <ConfirmProvider>
          <AuthSessionManager />
          {children}
        </ConfirmProvider>
      </BrandingApplier>
    </Provider>
  );
};

export default Providers;
