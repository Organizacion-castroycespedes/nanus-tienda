import type { ReportingRole } from "./types";

const ALLOWED_ROLES = new Set(["SUPER_ADMIN", "SUPER_USER", "ADMIN", "USER"]);

export const getReportingPermissions = (role?: ReportingRole | null) => {
  const normalizedRole = role ?? "";
  const canViewReports = ALLOWED_ROLES.has(normalizedRole);
  const showTenantSelector = normalizedRole === "SUPER_ADMIN";
  const showBranchSelector =
    normalizedRole === "SUPER_ADMIN" || normalizedRole === "SUPER_USER";

  return {
    canViewReports,
    showTenantSelector,
    showBranchSelector,
    isSuperAdmin: normalizedRole === "SUPER_ADMIN",
    isSuperUser: normalizedRole === "SUPER_USER",
    isAdmin: normalizedRole === "ADMIN",
    isUser: normalizedRole === "USER",
  };
};
