import { MENU_KEYS } from "../domains/menu/constants";

export type RoutePermissionRequirement = {
  module: string;
  action: string;
};

const ROUTE_PERMISSION_RULES: Array<{
  pattern: RegExp;
  requirement: RoutePermissionRequirement;
}> = [
  {
    pattern: /^\/[^/]+\/dashboard\/?$/i,
    requirement: { module: MENU_KEYS.DASHBOARD, action: "read" },
  },
  {
    pattern: /^\/[^/]+\/configuracion\/?$/i,
    requirement: { module: MENU_KEYS.CONFIG_GENERAL, action: "read" },
  },
  {
    pattern: /^\/[^/]+\/config\/terminals\/?$/i,
    requirement: { module: MENU_KEYS.CONFIG_GENERAL, action: "read" },
  },
  {
    pattern: /^\/[^/]+\/configuracion\/menu\/?$/i,
    requirement: { module: MENU_KEYS.CONFIG_MENU, action: "read" },
  },
  {
    pattern: /^\/[^/]+\/roles\/?$/i,
    requirement: { module: MENU_KEYS.CONFIG_ROLES, action: "read" },
  },
  {
    pattern: /^\/[^/]+\/usuarios\/?$/i,
    requirement: { module: MENU_KEYS.CONFIG_USUARIOS, action: "read" },
  },
  {
    pattern: /^\/[^/]+\/inventory\/?$/i,
    requirement: { module: "inventory", action: "read" },
  },
  {
    pattern: /^\/[^/]+\/inventory\/products\/?$/i,
    requirement: { module: "inventory", action: "read" },
  },
  {
    pattern: /^\/[^/]+\/inventory\/units\/?$/i,
    requirement: { module: "inventory", action: "read" },
  },
  {
    pattern: /^\/[^/]+\/inventory\/taxes\/?$/i,
    requirement: { module: "inventory", action: "read" },
  },
  {
    pattern: /^\/[^/]+\/inventory\/purchases\/?$/i,
    requirement: { module: "inventory", action: "read" },
  },
  {
    pattern: /^\/[^/]+\/inventory\/suppliers\/?$/i,
    requirement: { module: "inventory", action: "read" },
  },
  {
    pattern: /^\/[^/]+\/pos\/?$/i,
    requirement: { module: "pos", action: "read" },
  },
  {
    pattern: /^\/[^/]+\/suppliers\/?$/i,
    requirement: { module: "inventory", action: "read" },
  },
  {
    pattern: /^\/[^/]+\/customers\/?$/i,
    requirement: { module: "customers", action: "read" },
  },
  {
    pattern: /^\/[^/]+\/orders\/?$/i,
    requirement: { module: "inventory", action: "read" },
  },
  {
    pattern: /^\/[^/]+\/purchases\/?$/i,
    requirement: { module: "inventory", action: "read" },
  },
];

export const getRoutePermissionRequirement = (
  pathname: string
): RoutePermissionRequirement | null => {
  for (const rule of ROUTE_PERMISSION_RULES) {
    if (rule.pattern.test(pathname)) {
      return rule.requirement;
    }
  }

  return null;
};
