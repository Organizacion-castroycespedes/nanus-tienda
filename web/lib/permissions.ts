import { store } from "../store";
import type { AccessLevel } from "../domains/menu/types";
import { getMenuKeyCandidates } from "../domains/menu/constants";

export const hasMenuAccess = (menuKey: string, level: AccessLevel) => {
  const state = store.getState();
  const permissions = state.menu.permissions;

  if (state.auth.user?.role === "SUPER_ADMIN") {
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
