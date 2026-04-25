import type { PermissionAccessLevel } from "../../../common/services/access-control.service";

export type RoleMenuPermissionItemDto = {
  menuItemId: string;
  accessLevel: PermissionAccessLevel;
  actions?: Record<string, boolean>;
};

export type ReplaceRoleMenuPermissionsDto = {
  tenantId: string;
  permissions: RoleMenuPermissionItemDto[];
};

export type PatchRoleMenuPermissionsDto = {
  tenantId: string;
  permissions: RoleMenuPermissionItemDto[];
};
