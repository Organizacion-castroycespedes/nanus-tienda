export type PersonaPayload = {
  nombres: string;
  apellidos: string;
  documentoTipo: string;
  documentoNumero: string;
  telefono?: string;
  direccion?: string;
  emailPersonal?: string;
  cargoNombre: string;
  cargoDescripcion?: string;
  funcionesDescripcion?: string;
};

export type CreateUserDto = {
  email: string;
  password: string;
  estado?: string;
  tenantId?: string;
  tenantBranchId: string;
  roleId: string;
  persona: PersonaPayload;
};

export type UpdateUserDto = {
  email?: string;
  estado?: string;
  roleId?: string;
  tenantBranchId?: string;
  persona?: Partial<PersonaPayload>;
};

export type UserResponse = {
  id: string;
  email: string;
  estado: string;
  tenantId: string;
  tenantNombre: string | null;
  persona: {
    id: string;
    nombres: string | null;
    apellidos: string | null;
    documentoTipo: string | null;
    documentoNumero: string | null;
    telefono: string | null;
    direccion: string | null;
    emailPersonal: string | null;
    cargoNombre: string | null;
    cargoDescripcion: string | null;
    funcionesDescripcion: string | null;
  } | null;
  role: {
    id: string | null;
    nombre: string | null;
  } | null;
  branch: {
    id: string | null;
    nombre: string | null;
  } | null;
};
