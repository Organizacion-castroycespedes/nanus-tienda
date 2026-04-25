"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { bootstrapSession, scheduleTokenRefresh } from "../../domains/auth/session-manager";
import { useAppSelector } from "../../store/hooks";

const AuthSessionManager = () => {
  const pathname = usePathname();
  const router = useRouter();
  const accessToken = useAppSelector((state) => state.auth.accessToken);
  const authStatus = useAppSelector((state) => state.auth.authStatus);
  const tenantId = useAppSelector((state) => state.auth.tenantId);
  const bootstrapped = useRef(false);

  useEffect(() => {
    if (bootstrapped.current) {
      return;
    }
    bootstrapped.current = true;
    void bootstrapSession();
  }, []);

  useEffect(() => {
    scheduleTokenRefresh(accessToken);
  }, [accessToken]);

  useEffect(() => {
    if (authStatus !== "authenticated") {
      return;
    }
    if (pathname === "/login") {
      const targetTenant = tenantId ?? "default";
      router.replace(`/${targetTenant}/dashboard`);
    }
  }, [authStatus, pathname, router, tenantId]);

  return null;
};

export default AuthSessionManager;
