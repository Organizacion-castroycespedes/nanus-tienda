"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { usePosContext } from "./usePosContext";
import { useAppSelector } from "../../../store/hooks";
import { buildTenantPath, resolveTenantSlug } from "../../auth/tenant-path";

type UseRequirePosSessionOptions = {
  redirect?: boolean;
};

export const useRequirePosSession = (
  options: UseRequirePosSessionOptions = {}
) => {
  const router = useRouter();
  const pathname = usePathname();
  const { branchId, posSessionId, terminalId } = usePosContext();
  const authStatus = useAppSelector((state) => state.auth.authStatus);
  const bootstrapped = useAppSelector((state) => state.auth.bootstrapped);
  const tenantId = useAppSelector((state) => state.auth.tenantId);
  const tenantSlug = useAppSelector((state) => state.auth.tenantSlug);
  const user = useAppSelector((state) => state.auth.user);
  const shouldRedirect = options.redirect ?? true;

  useEffect(() => {
    if (!shouldRedirect) {
      return;
    }
    if (!bootstrapped || authStatus !== "authenticated") {
      return;
    }
    if (posSessionId && branchId && terminalId) {
      return;
    }
    if (pathname?.includes("/pos/select-context")) {
      return;
    }
    const targetTenant = resolveTenantSlug({
      tenantSlug: tenantSlug ?? user?.tenantSlug,
      tenantId: tenantId ?? user?.tenantId,
    });
    router.replace(buildTenantPath(targetTenant, "pos/select-context"));
  }, [
    authStatus,
    bootstrapped,
    branchId,
    pathname,
    posSessionId,
    router,
    shouldRedirect,
    tenantId,
    tenantSlug,
    terminalId,
    user?.tenantId,
    user?.tenantSlug,
  ]);

  return { hasSession: Boolean(posSessionId && branchId && terminalId) };
};
