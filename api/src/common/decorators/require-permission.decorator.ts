import { SetMetadata } from "@nestjs/common";
import type { PermissionAccessLevel } from "../services/access-control.service";

export const PERMISSION_KEY = "permission";

export type RequiredPermission = {
  menuKey: string;
  level: PermissionAccessLevel;
};

export const RequirePermission = (permission: RequiredPermission) =>
  SetMetadata(PERMISSION_KEY, permission);
