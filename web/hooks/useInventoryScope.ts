import { useMemo } from "react";
import { useAppSelector } from "../store/hooks";

type ScopeParams = {
  tenantId?: string;
  branchId?: string;
};

const SUPER_ROLES = new Set(["SUPER_ADMIN", "SUPER_USER"]);

export const useInventoryScope = () => {
  const role = useAppSelector((state) => state.auth.user?.role ?? state.auth.role ?? null);
  const { currentTenant, currentBranch } = useAppSelector((state) => state.inventoryScope);

  const isSuperRole = SUPER_ROLES.has(role ?? "");

  const scopedFilters = useMemo<ScopeParams>(
    () =>
      isSuperRole
        ? {}
        : {
            tenantId: currentTenant ?? undefined,
            branchId: currentBranch ?? undefined,
          },
    [currentBranch, currentTenant, isSuperRole]
  );

  const resolveInventoryFilters = (filters?: ScopeParams): ScopeParams => {
    if (!isSuperRole) {
      return scopedFilters;
    }

    return {
      tenantId: filters?.tenantId || undefined,
      branchId: filters?.branchId || undefined,
    };
  };

  return {
    currentTenant,
    currentBranch,
    isSuperRole,
    showRoleFilters: isSuperRole,
    scopedFilters,
    resolveInventoryFilters,
  };
};
