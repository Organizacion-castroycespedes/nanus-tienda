"use client";

import { useMemo } from "react";
import { useAppSelector } from "../../../store/hooks";
import { resolveQuotationPermissions } from "../quotation-permissions";

export const useQuotationPermissions = () => {
  const permissions = useAppSelector((state) => state.auth.permissions);
  const permissionsLoaded = useAppSelector((state) => state.auth.permissionsLoaded);
  const role = useAppSelector((state) => state.auth.user?.role ?? state.auth.role ?? null);
  const resolved = useMemo(() => resolveQuotationPermissions(permissions, role), [permissions, role]);
  return { ...resolved, ready: permissionsLoaded || role === "SUPER_ADMIN" };
};
