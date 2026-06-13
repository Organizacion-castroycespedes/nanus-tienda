"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { usePosContext } from "./usePosContext";
import { useAppSelector } from "../../../store/hooks";

export const useRequirePosSession = () => {
  const router = useRouter();
  const pathname = usePathname();
  const { branchId, posSessionId, terminalId } = usePosContext();
  const authStatus = useAppSelector((state) => state.auth.authStatus);
  const bootstrapped = useAppSelector((state) => state.auth.bootstrapped);
  const tenantId = useAppSelector((state) => state.auth.tenantId);

  useEffect(() => {
    if (!bootstrapped || authStatus !== "authenticated") {
      return;
    }
    if (posSessionId && branchId && terminalId) {
      return;
    }
    if (pathname?.includes("/pos/select-context")) {
      return;
    }
    const targetTenant = tenantId ?? "default";
    router.replace(`/${targetTenant}/pos/select-context`);
  }, [authStatus, bootstrapped, branchId, pathname, posSessionId, router, tenantId, terminalId]);

  return { hasSession: Boolean(posSessionId && branchId && terminalId) };
};
