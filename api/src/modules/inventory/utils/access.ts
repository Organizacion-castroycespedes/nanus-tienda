import { ForbiddenException } from "@nestjs/common";

export type BranchScopedActor = {
  roles: string[];
  userId?: string;
  tenantId?: string;
  branchId?: string;
  terminalId?: string;
  cashSessionId?: string;
};

export type BranchScopedFilters = {
  tenantId?: string;
  branchId?: string;
  fromDate?: string;
  toDate?: string;
  paymentMethod?: string;
  customerId?: string;
  cashScope?: "current" | "all";
  cashSessionId?: string;
};

export const canViewAllBranches = (actor: BranchScopedActor) =>
  actor.roles.includes("SUPER_ADMIN") || actor.roles.includes("SUPER_USER");

export const hasBranchScopedRole = (actor: BranchScopedActor) =>
  actor.roles.includes("ADMIN") || actor.roles.includes("USER");

export const normalizeOptionalFilter = (value: string | undefined) => {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
};

export const resolveBranchScopedFilters = (
  actor: BranchScopedActor,
  filters: BranchScopedFilters
) => {
  const tenantId = normalizeOptionalFilter(filters.tenantId);
  const branchId = normalizeOptionalFilter(filters.branchId);

  if (canViewAllBranches(actor)) {
    return { tenantId, branchId };
  }

  if (!actor.tenantId) {
    throw new ForbiddenException("Tenant requerido");
  }
  if (!actor.branchId) {
    throw new ForbiddenException("Sucursal requerida");
  }
  if (tenantId && tenantId !== actor.tenantId) {
    throw new ForbiddenException("No autorizado para otro tenant");
  }
  if (branchId && branchId !== actor.branchId) {
    throw new ForbiddenException("No autorizado para otra sucursal");
  }

  return {
    tenantId: actor.tenantId,
    branchId: actor.branchId,
  };
};
