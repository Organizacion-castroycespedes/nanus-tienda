import { store } from "../store";
import type { AccessLevel, MenuItem, PermissionSummary } from "../domains/menu/types";
import { MENU_KEYS, getMenuKeyCandidates } from "../domains/menu/constants";

type PermissionIdentifier = string | [module: string, action: string];

const normalizeValue = (value: string) => value.trim().toLowerCase();

const getAuthRole = () => {
  const state = store.getState();
  return (state.auth.role ?? state.auth.user?.role ?? "").trim().toUpperCase();
};

const getAuthPermissions = () => store.getState().auth.permissions;

const isPrivilegedRole = (role: string) => role === "SUPER_ADMIN";

const operationalAdminMenuKeys = new Set(
  [
    MENU_KEYS.INVENTORY_PURCHASES,
    MENU_KEYS.INVENTORY_PRODUCTS,
    MENU_KEYS.INVENTORY_LOCATIONS,
    MENU_KEYS.INVENTORY_LOTS,
    MENU_KEYS.INVENTORY_UNITS,
    MENU_KEYS.INVENTORY_TAXES,
    MENU_KEYS.INVENTORY_SUPPLIERS,
    MENU_KEYS.INVENTORY_PROMOTIONS,
  ].map(normalizeValue)
);

const operationalInventoryActions = new Set([
  "read",
  "write",
  "create",
  "update",
  "delete",
  "cancel",
  "settle_partial",
]);

const isOperationalAdminRole = (role: string) =>
  role === "ADMIN" || role === "SUPER_USER";

const isOperationalAdminModule = (moduleName: string) =>
  operationalAdminMenuKeys.has(moduleName);

const isOperationalInventoryAction = (moduleName: string, actionName: string) =>
  moduleName === "inventory" && operationalInventoryActions.has(actionName);

const hasOperationalAdminFallback = (
  role: string,
  moduleName: string,
  actionName: string
) =>
  isOperationalAdminRole(role) &&
  (isOperationalAdminModule(moduleName) ||
    isOperationalInventoryAction(moduleName, actionName));

const isUserBlockedFromAdminModule = (
  role: string,
  moduleName: string,
  actionName: string
) =>
  role === "USER" &&
  (isOperationalAdminModule(moduleName) ||
    isOperationalInventoryAction(moduleName, actionName));

const isRestrictedForRole = (role: string, moduleName: string) => {
  if (role !== "ADMIN") {
    return false;
  }
  return new Set([
    normalizeValue(MENU_KEYS.CONFIG_GENERAL),
    normalizeValue("CONFIGURACION_TENANT_CONFIGURACION"),
    normalizeValue(MENU_KEYS.CONFIG_TERMINALS),
    normalizeValue(MENU_KEYS.POS_PERIPHERALS),
    normalizeValue("peripherals"),
  ]).has(moduleName);
};

const isScopedSuperUserPermission = (role: string, moduleName: string) =>
  role === "SUPER_USER" &&
  (moduleName === normalizeValue("CONFIG_GENERAL") ||
    moduleName === normalizeValue(MENU_KEYS.CONFIG_TERMINALS) ||
    moduleName === normalizeValue("CONFIG_USUARIOS"));

const resolvePermissionInput = (
  permission: PermissionIdentifier,
  maybeAction?: string
) => {
  if (Array.isArray(permission)) {
    return {
      module: normalizeValue(permission[0]),
      action: normalizeValue(permission[1]),
    };
  }

  if (typeof maybeAction === "string" && maybeAction.trim()) {
    return {
      module: normalizeValue(permission),
      action: normalizeValue(maybeAction),
    };
  }

  const [module, action] = permission.split(".", 2);
  return {
    module: normalizeValue(module ?? ""),
    action: normalizeValue(action ?? ""),
  };
};

const permissionMatches = (
  permission: PermissionSummary,
  moduleName: string,
  actionName: string
) => {
  if (actionName === "read" || actionName === "write") {
    const keyCandidates = getMenuKeyCandidates(moduleName);
    const matchesKey = keyCandidates.includes(permission.key);
    const matchesModule = normalizeValue(permission.module) === moduleName;

    if (!matchesKey && !matchesModule) {
      return false;
    }

    if (actionName === "read") {
      return permission.accessLevel === "READ" || permission.accessLevel === "WRITE";
    }

    return permission.accessLevel === "WRITE";
  }

  if (normalizeValue(permission.module) !== moduleName) {
    return false;
  }

  if (!actionName) {
    return false;
  }

  const actionEntry = Object.entries(permission.actions).find(
    ([key]) => normalizeValue(key) === actionName
  );

  return Boolean(actionEntry?.[1]);
};

export const hasPermission = (
  permission: PermissionIdentifier,
  action?: string
) => {
  const role = getAuthRole();
  const { module, action: resolvedAction } = resolvePermissionInput(
    permission,
    action
  );
  if (!module || !resolvedAction) {
    return false;
  }
  if (isRestrictedForRole(role, module)) {
    return false;
  }
  if (isUserBlockedFromAdminModule(role, module, resolvedAction)) {
    return false;
  }
  if (isPrivilegedRole(role) || isScopedSuperUserPermission(role, module)) {
    return true;
  }
  if (hasOperationalAdminFallback(role, module, resolvedAction)) {
    return true;
  }

  return getAuthPermissions().some((item) =>
    permissionMatches(item, module, resolvedAction)
  );
};

export const isPermissionsReady = () => store.getState().auth.permissionsLoaded;

export const canPerformAction = (
  moduleCode: string,
  action: string
) => hasPermission(moduleCode, action);

export const canAccessModule = (moduleCode: string) =>
  canPerformAction(moduleCode, "read");

const menuItemAllowed = (item: MenuItem) =>
  Boolean(item.inherited) || hasMenuAccess(item.key, "READ");

export const getAllowedMenuItems = (items: MenuItem[]): MenuItem[] =>
  items.reduce<MenuItem[]>((allowed, item) => {
      const children = item.children ? getAllowedMenuItems(item.children) : [];
      if (!menuItemAllowed(item) && children.length === 0) {
      return allowed;
      }
    allowed.push({
        ...item,
        children,
    });
    return allowed;
  }, []);

export const hasMenuAccess = (menuKey: string, level: AccessLevel) => {
  const state = store.getState();
  const permissions = state.auth.permissions;
  const role = getAuthRole();

  if (isPrivilegedRole(role)) {
    return true;
  }

  const candidates = getMenuKeyCandidates(menuKey);
  const normalizedCandidates = candidates.map((candidate) => normalizeValue(candidate));

  if (
    role === "ADMIN" &&
    (normalizedCandidates.includes(normalizeValue(MENU_KEYS.CONFIG_GENERAL)) ||
      normalizedCandidates.includes(normalizeValue("CONFIGURACION_TENANT_CONFIGURACION")) ||
      normalizedCandidates.includes(normalizeValue(MENU_KEYS.CONFIG_TERMINALS)) ||
      normalizedCandidates.includes(normalizeValue(MENU_KEYS.POS_PERIPHERALS)))
  ) {
    return false;
  }

  if (
    role === "USER" &&
    normalizedCandidates.some((candidate) =>
      operationalAdminMenuKeys.has(candidate)
    )
  ) {
    return false;
  }

  return candidates.some((candidate) => {
    const permission = permissions.find((item) => item.key === candidate);
    if (!permission) {
      return false;
    }

    if (level === "READ") {
      return permission.accessLevel === "READ" || permission.accessLevel === "WRITE";
    }

    return permission.accessLevel === "WRITE";
  });
};
