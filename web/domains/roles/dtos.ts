export type RoleResponse = {
  id: string;
  nombre: string;
  descripcion: string | null;
  created_at: string;
  tenant_ids: string[];
};
