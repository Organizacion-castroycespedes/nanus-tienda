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
    requirement: { module: MENU_KEYS.CONFIG_TERMINALS, action: "read" },
  },
  {
    pattern: /^\/[^/]+\/configuracion\/menu\/?$/i,
    requirement: { module: MENU_KEYS.CONFIG_MENU, action: "read" },
  },
  {
    pattern: /^\/[^/]+\/admin\/peripherals\/?$/i,
    requirement: { module: "peripherals", action: "manage" },
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
    requirement: { module: MENU_KEYS.INVENTORY_PRODUCTS, action: "read" },
  },
  {
    pattern: /^\/[^/]+\/inventory\/promotions\/?$/i,
    requirement: { module: MENU_KEYS.INVENTORY_PROMOTIONS, action: "read" },
  },
  {
    pattern: /^\/[^/]+\/inventory\/units\/?$/i,
    requirement: { module: MENU_KEYS.INVENTORY_UNITS, action: "read" },
  },
  {
    pattern: /^\/[^/]+\/inventory\/locations\/?$/i,
    requirement: { module: MENU_KEYS.INVENTORY_LOCATIONS, action: "read" },
  },
  {
    pattern: /^\/[^/]+\/inventory\/lots\/?$/i,
    requirement: { module: MENU_KEYS.INVENTORY_LOTS, action: "read" },
  },
  {
    pattern: /^\/[^/]+\/inventory\/taxes\/?$/i,
    requirement: { module: MENU_KEYS.INVENTORY_TAXES, action: "read" },
  },
  {
    pattern: /^\/[^/]+\/inventory\/purchases\/?$/i,
    requirement: { module: MENU_KEYS.INVENTORY_PURCHASES, action: "read" },
  },
  {
    pattern: /^\/[^/]+\/inventory\/suppliers\/?$/i,
    requirement: { module: MENU_KEYS.INVENTORY_SUPPLIERS, action: "read" },
  },
  {
    pattern: /^\/[^/]+\/pos\/?$/i,
    requirement: { module: "pos", action: "read" },
  },
  {
    pattern: /^\/[^/]+\/pos\/select-context\/?$/i,
    requirement: { module: "pos", action: "read" },
  },
  {
    pattern: /^\/[^/]+\/suppliers\/?$/i,
    requirement: { module: MENU_KEYS.INVENTORY_SUPPLIERS, action: "read" },
  },
  {
    pattern: /^\/[^/]+\/customers\/?$/i,
    requirement: { module: MENU_KEYS.CUSTOMERS, action: "read" },
  },
  {
    pattern: /^\/[^/]+\/orders\/?$/i,
    requirement: { module: MENU_KEYS.ORDERS, action: "read" },
  },
  {
    pattern: /^\/[^/]+\/purchases\/?$/i,
    requirement: { module: MENU_KEYS.INVENTORY_PURCHASES, action: "read" },
  },
  {
    pattern: /^\/[^/]+\/finance(?:\/.*)?$/i,
    requirement: { module: "finance", action: "read" },
  },
  {
    pattern: /^\/[^/]+\/reporteria(?:\/.*)?$/i,
    requirement: { module: "reporteria", action: "read" },
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
