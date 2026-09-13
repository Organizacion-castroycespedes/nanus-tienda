"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { bootstrapSession, scheduleTokenRefresh } from "../../domains/auth/session-manager";
import { resolveTenantSlug, buildTenantPath } from "../../domains/auth/tenant-path";
import { useAppSelector } from "../../store/hooks";

const AuthSessionManager = () => {
  const pathname = usePathname();
  const router = useRouter();
  const accessToken = useAppSelector((state) => state.auth.accessToken);
  const authStatus = useAppSelector((state) => state.auth.authStatus);
  const tenantId = useAppSelector((state) => state.auth.tenantId);
  const tenantSlug = useAppSelector((state) => state.auth.tenantSlug);
  const user = useAppSelector((state) => state.auth.user);
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
      const targetTenant = resolveTenantSlug({
        tenantSlug: tenantSlug ?? user?.tenantSlug,
        tenantId: tenantId ?? user?.tenantId,
      });
      router.replace(buildTenantPath(targetTenant, "pos/select-context"));
    }
  }, [authStatus, pathname, router, tenantId, tenantSlug, user?.tenantId, user?.tenantSlug]);

  return null;
};

export default AuthSessionManager;
