export type RoleUserResponseDto = {
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
