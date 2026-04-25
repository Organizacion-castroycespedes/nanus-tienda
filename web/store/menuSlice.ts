import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { MenuItem, PermissionSummary } from "../domains/menu/types";

export type MenuCacheEntry = {
  tenantId: string;
  cachedAt: number;
  items: MenuItem[];
};

export type MenuState = {
  menuByTenant: Record<string, MenuCacheEntry>;
  activeTenantId: string | null;
  menuItems: MenuItem[];
  permissions: PermissionSummary[];
};

const initialState: MenuState = {
  menuByTenant: {},
  activeTenantId: null,
  menuItems: [],
  permissions: [],
};

const menuSlice = createSlice({
  name: "menu",
  initialState,
  reducers: {
    setMenuCache(state, action: PayloadAction<MenuCacheEntry>) {
      state.menuByTenant[action.payload.tenantId] = action.payload;
      if (state.activeTenantId === action.payload.tenantId) {
        state.menuItems = action.payload.items;
      }
    },
    setActiveTenant(state, action: PayloadAction<string | null>) {
      state.activeTenantId = action.payload;
      if (action.payload && state.menuByTenant[action.payload]) {
        state.menuItems = state.menuByTenant[action.payload].items;
      } else {
        state.menuItems = [];
      }
    },
    setMenuItems(state, action: PayloadAction<MenuItem[]>) {
      state.menuItems = action.payload;
      if (state.activeTenantId) {
        state.menuByTenant[state.activeTenantId] = {
          tenantId: state.activeTenantId,
          cachedAt: Date.now(),
          items: action.payload,
        };
      }
    },
    setPermissions(state, action: PayloadAction<PermissionSummary[]>) {
      state.permissions = action.payload;
    },
    clearMenu(state) {
      state.menuByTenant = {};
      state.activeTenantId = null;
      state.menuItems = [];
      state.permissions = [];
    },
  },
});

export const {
  setMenuCache,
  setActiveTenant,
  setMenuItems,
  setPermissions,
  clearMenu,
} = menuSlice.actions;

export default menuSlice.reducer;
