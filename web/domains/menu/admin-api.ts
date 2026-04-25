import { apiClient } from "../../lib/http";
import type { MenuItemRecord, RoleMenuPermissionRecord } from "./admin-types";
import type { AccessLevel } from "./types";

export type MenuItemInput = {
  tenantId: string;
  key: string;
  module: string;
  label: string;
  route: string;
  icon?: string | null;
  parentId?: string | null;
  sortOrder?: number;
  visible?: boolean;
  belowMainMenu?: boolean;
  metadata?: Record<string, unknown>;
};

export type MenuItemUpdateInput = {
  key?: string;
  module?: string;
  label?: string;
  route?: string;
  icon?: string | null;
  parentId?: string | null;
  sortOrder?: number;
  visible?: boolean;
  belowMainMenu?: boolean;
  metadata?: Record<string, unknown>;
};

export type RoleMenuPermissionInput = {
  menuItemId: string;
  accessLevel: AccessLevel;
};

export const listMenuItems = (tenantId: string, headers?: HeadersInit) =>
  apiClient<MenuItemRecord[]>(`/admin/menu-items?tenantId=${tenantId}`, {
    headers,
  });

export const createMenuItem = (payload: MenuItemInput, headers?: HeadersInit) =>
  apiClient<MenuItemRecord>("/admin/menu-items", {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

export const updateMenuItem = (
  id: string,
  payload: MenuItemUpdateInput,
  headers?: HeadersInit
) =>
  apiClient<MenuItemRecord>(`/admin/menu-items/${id}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify(payload),
  });

export const updateMenuItemStatus = (
  id: string,
  visible: boolean,
  headers?: HeadersInit
) =>
  apiClient<MenuItemRecord>(`/admin/menu-items/${id}/status`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ visible }),
  });

export const deleteMenuItem = (id: string, headers?: HeadersInit) =>
  apiClient<MenuItemRecord>(`/admin/menu-items/${id}`, {
    method: "DELETE",
    headers,
  });

export const listRoleMenuPermissions = (
  roleId: string,
  tenantId: string,
  headers?: HeadersInit
) =>
  apiClient<RoleMenuPermissionRecord[]>(
    `/admin/roles/${roleId}/menu-permissions?tenantId=${tenantId}`,
    { headers }
  );

export const replaceRoleMenuPermissions = (
  roleId: string,
  payload: { tenantId: string; permissions: RoleMenuPermissionInput[] },
  headers?: HeadersInit
) =>
  apiClient<{ ok: true }>(`/admin/roles/${roleId}/menu-permissions`, {
    method: "PUT",
    headers,
    body: JSON.stringify(payload),
  });
