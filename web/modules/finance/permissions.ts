import type { FinanceRole } from "./types";

const SUPER_ROLES = new Set(["SUPER_ADMIN", "SUPER_USER"]);
const CASH_ADMIN_ROLES = new Set(["SUPER_ADMIN", "SUPER_USER", "ADMIN"]);
const CASH_OPERATOR_ROLES = new Set(["SUPER_ADMIN", "SUPER_USER", "ADMIN", "USER"]);

export const getFinancePermissions = (role?: FinanceRole | null) => {
  const normalizedRole = role ?? "";
  const isSuperRole = SUPER_ROLES.has(normalizedRole);
  const canManagePaymentMethods = isSuperRole;
  const canManageCashRegisters = isSuperRole;
  const canManageCashSessions = CASH_ADMIN_ROLES.has(normalizedRole);
  const canOperateCashSessions = CASH_OPERATOR_ROLES.has(normalizedRole);
  const canCreateCashMovements = CASH_OPERATOR_ROLES.has(normalizedRole);
  const canViewFinance = CASH_OPERATOR_ROLES.has(normalizedRole);

  return {
    isSuperRole,
    canManagePaymentMethods,
    canManageCashRegisters,
    canManageCashSessions,
    canOperateCashSessions,
    canCreateCashMovements,
    canViewFinance,
  };
};
