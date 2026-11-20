import { MENU_KEYS } from "../../domains/menu/constants";
import type { PermissionSummary } from "../../domains/menu/types";
import { QUOTATION_ACTIONS, type QuotationAction, type QuotationEffectiveStatus } from "./types";

const normalizeRole = (role: string | null | undefined) => (role ?? "").trim().toUpperCase();

export const findQuotationPermission = (permissions: readonly PermissionSummary[]) =>
  permissions.find((permission) => permission.key === MENU_KEYS.QUOTATIONS);

/** Misma regla que el PermissionsGuard de la API: nivel del menu + accion jsonb. */
export const canUseQuotationAction = (
  permission: PermissionSummary | undefined,
  action: QuotationAction,
  role: string | null | undefined
) => {
  if (normalizeRole(role) === "SUPER_ADMIN") {
    return true;
  }
  if (!permission) {
    return false;
  }
  const level = permission.accessLevel;
  if (action === QUOTATION_ACTIONS.VIEW) {
    return (level === "READ" || level === "WRITE") && permission.actions?.[action] !== false;
  }
  return level === "WRITE" && permission.actions?.[action] === true;
};

export type QuotationPermissions = Record<
  "view" | "create" | "update" | "approve" | "convert" | "settings",
  boolean
>;

export const resolveQuotationPermissions = (
  permissions: readonly PermissionSummary[],
  role: string | null | undefined
): QuotationPermissions => {
  const permission = findQuotationPermission(permissions);
  return {
    view: canUseQuotationAction(permission, QUOTATION_ACTIONS.VIEW, role),
    create: canUseQuotationAction(permission, QUOTATION_ACTIONS.CREATE, role),
    update: canUseQuotationAction(permission, QUOTATION_ACTIONS.UPDATE, role),
    approve: canUseQuotationAction(permission, QUOTATION_ACTIONS.APPROVE, role),
    convert: canUseQuotationAction(permission, QUOTATION_ACTIONS.CONVERT, role),
    settings: canUseQuotationAction(permission, QUOTATION_ACTIONS.SETTINGS, role),
  };
};

export type QuotationAvailableActions = {
  edit: boolean;
  send: boolean;
  approve: boolean;
  reject: boolean;
  renew: boolean;
  duplicate: boolean;
  convert: boolean;
};

/** Acciones visibles segun estado efectivo y permisos (la API vuelve a validar todo). */
export const resolveQuotationActions = (
  status: QuotationEffectiveStatus,
  storedStatus: string,
  permissions: QuotationPermissions
): QuotationAvailableActions => {
  const open = status === "DRAFT" || status === "SENT";
  return {
    edit: permissions.update && open,
    send: permissions.update && (open || status === "APPROVED"),
    approve: permissions.approve && open,
    reject:
      permissions.approve &&
      (open || status === "APPROVED" || (status === "EXPIRED" && storedStatus !== "CONVERTED")),
    renew: permissions.update && status === "EXPIRED",
    duplicate: permissions.create,
    convert: permissions.convert && status === "APPROVED",
  };
};
