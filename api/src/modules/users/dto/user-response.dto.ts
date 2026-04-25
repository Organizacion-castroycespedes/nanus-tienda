export type UserPersonaResponseDto = {
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
};

export type UserBranchResponseDto = {
  id: string | null;
  nombre: string | null;
};

export type UserRoleResponseDto = {
  id: string | null;
  nombre: string | null;
};

export type UserResponseDto = {
  id: string;
  email: string;
  estado: string;
  tenantId: string;
  tenantNombre: string | null;
  persona: UserPersonaResponseDto | null;
  role: UserRoleResponseDto | null;
  branch: UserBranchResponseDto | null;
};
