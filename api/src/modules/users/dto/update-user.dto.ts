import type { PersonaPayloadDto } from "./create-user.dto";

export type UpdateUserDto = {
  email?: string;
  estado?: string;
  roleId?: string;
  tenantBranchId?: string;
  persona?: Partial<PersonaPayloadDto>;
};
