"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { usePosContext } from "./usePosContext";
import { useAppSelector } from "../../../store/hooks";

export const useRequirePosSession = () => {
  const router = useRouter();
  const pathname = usePathname();
  const { posSessionId } = usePosContext();
  const authStatus = useAppSelector((state) => state.auth.authStatus);
  const bootstrapped = useAppSelector((state) => state.auth.bootstrapped);
  const tenantId = useAppSelector((state) => state.auth.tenantId);

  useEffect(() => {
    if (!bootstrapped || authStatus !== "authenticated") {
      return;
    }
    if (posSessionId) {
      return;
    }
    if (pathname?.includes("/pos/select-context")) {
      return;
    }
    const targetTenant = tenantId ?? "default";
    router.replace(`/${targetTenant}/pos/select-context`);
  }, [authStatus, bootstrapped, pathname, posSessionId, router, tenantId]);

  return { hasSession: Boolean(posSessionId) };
};
