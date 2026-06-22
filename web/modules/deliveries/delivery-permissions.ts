import { MENU_KEYS } from "../../domains/menu/constants";
import type { PermissionSummary } from "../../domains/menu/types";
import {
  DELIVERY_PERMISSION_ACTIONS,
  type DeliveryActionKey,
  type DeliveryActionPermissionMap,
} from "./types";

const actionPermissionByKey: Record<DeliveryActionKey, string> = {
  prepare: DELIVERY_PERMISSION_ACTIONS.ASSIGN,
  dispatch: DELIVERY_PERMISSION_ACTIONS.DISPATCH,
  "mark-delivered": DELIVERY_PERMISSION_ACTIONS.MARK_DELIVERED,
  "mark-not-delivered": DELIVERY_PERMISSION_ACTIONS.MARK_NOT_DELIVERED,
  cancel: DELIVERY_PERMISSION_ACTIONS.CANCEL,
};

const normalizeRole = (role: string) => role.trim().toUpperCase();
const deliveryDriverManagerRoles = new Set(["SUPER_ADMIN", "SUPER_USER", "ADMIN"]);

export const findDeliveryPermission = (permissions: PermissionSummary[]) =>
  permissions.find((permission) => permission.key === MENU_KEYS.DELIVERIES);

export const canReadDeliveries = (
  permission: PermissionSummary | undefined,
  role: string
) => {
  const normalizedRole = normalizeRole(role);
  return (
    normalizedRole === "SUPER_ADMIN" ||
    permission?.accessLevel === "READ" ||
    permission?.accessLevel === "WRITE"
  );
};

export const canUseDeliveryAction = (
  permission: PermissionSummary | undefined,
  action: string,
  role: string
) => {
  const normalizedRole = normalizeRole(role);
  if (normalizedRole === "SUPER_ADMIN") {
    return true;
  }

  if (permission?.accessLevel !== "WRITE") {
    return false;
  }

  const normalizedAction = action.trim().toLowerCase();
  return Object.entries(permission.actions ?? {}).some(
    ([key, allowed]) => key.trim().toLowerCase() === normalizedAction && allowed
  );
};

export const canCreateDelivery = (
  permission: PermissionSummary | undefined,
  role: string
) => canUseDeliveryAction(permission, DELIVERY_PERMISSION_ACTIONS.CREATE, role);

export const canManageDeliveryDrivers = (
  permission: PermissionSummary | undefined,
  role: string
) =>
  deliveryDriverManagerRoles.has(normalizeRole(role)) &&
  canUseDeliveryAction(permission, DELIVERY_PERMISSION_ACTIONS.UPDATE, role);

export const buildDeliveryActionPermissionMap = (
  permission: PermissionSummary | undefined,
  role: string
): DeliveryActionPermissionMap => ({
  prepare: canUseDeliveryAction(permission, actionPermissionByKey.prepare, role),
  dispatch: canUseDeliveryAction(permission, actionPermissionByKey.dispatch, role),
  "mark-delivered": canUseDeliveryAction(
    permission,
    actionPermissionByKey["mark-delivered"],
    role
  ),
  "mark-not-delivered": canUseDeliveryAction(
    permission,
    actionPermissionByKey["mark-not-delivered"],
    role
  ),
  cancel: canUseDeliveryAction(permission, actionPermissionByKey.cancel, role),
});
