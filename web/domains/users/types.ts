export type UserSummary = {
  id: string;
  email: string;
  estado: string;
  tenantId: string;
  tenantNombre: string | null;
  roleNombre: string | null;
  branchNombre: string | null;
  fullName: string;
  documento: string | null;
};
