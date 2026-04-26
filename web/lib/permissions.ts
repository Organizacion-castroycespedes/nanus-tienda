import { store } from "../store";
import type { AccessLevel, PermissionSummary } from "../domains/menu/types";
import { getMenuKeyCandidates } from "../domains/menu/constants";

type PermissionIdentifier = string | [module: string, action: string];

const normalizeValue = (value: string) => value.trim().toLowerCase();

const getAuthRole = () => {
  const state = store.getState();
  return state.auth.role ?? state.auth.user?.role ?? "";
};

const getAuthPermissions = () => store.getState().auth.permissions;

const isPrivilegedRole = (role: string) =>
  role === "SUPER_ADMIN" || role === "ADMIN";

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
  if (isPrivilegedRole(role)) {
    return true;
  }

  const { module, action: resolvedAction } = resolvePermissionInput(
    permission,
    action
  );
  if (!module || !resolvedAction) {
    return false;
  }

  return getAuthPermissions().some((item) =>
    permissionMatches(item, module, resolvedAction)
  );
};

export const isPermissionsReady = () => store.getState().auth.permissionsLoaded;

export const hasMenuAccess = (menuKey: string, level: AccessLevel) => {
  const state = store.getState();
  const permissions = state.auth.permissions;

  if (isPrivilegedRole(getAuthRole())) {
    return true;
  }

  const candidates = getMenuKeyCandidates(menuKey);

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
