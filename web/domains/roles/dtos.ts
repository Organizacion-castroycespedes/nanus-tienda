export type RoleResponse = {
  id: string;
  nombre: string;
  descripcion: string | null;
  created_at: string;
  tenant_ids: string[];
};

export type RoleUserResponse = {
  id: string;
  email: string;
  estado: string;
  createdAt: string;
  tenant: {
    id: string;
    nombre: string | null;
    slug: string;
  };
  persona?: {
    id: string;
    nombres: string;
    apellidos: string;
    documentoTipo: string;
    documentoNumero: string;
    cargoNombre: string;
    telefono?: string | null;
    emailPersonal?: string | null;
  } | null;
  branch?: {
    id: string;
    nombre: string;
  } | null;
};
