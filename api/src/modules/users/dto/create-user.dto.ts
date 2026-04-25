export type PersonaPayloadDto = {
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
  persona: PersonaPayloadDto;
};
