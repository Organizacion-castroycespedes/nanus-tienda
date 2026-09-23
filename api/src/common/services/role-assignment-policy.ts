import { ForbiddenException } from "@nestjs/common";

export const SUPER_ADMIN_ROLE = "SUPER_ADMIN";

export const canAssignRole = (actorRoles: string[], roleName: string) =>
  actorRoles.includes(SUPER_ADMIN_ROLE) || roleName !== SUPER_ADMIN_ROLE;

export const assertCanAssignRole = (actorRoles: string[], roleName: string) => {
  if (!canAssignRole(actorRoles, roleName)) {
    throw new ForbiddenException("No autorizado para asignar este rol");
  }
};
