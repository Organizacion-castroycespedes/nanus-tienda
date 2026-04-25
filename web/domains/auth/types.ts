export type AuthTokens = {
  accessToken: string;
  refreshToken?: string;
};

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  tenantId: string;
  tenantName?: string | null;
  branchId?: string | null;
  branchName?: string | null;
  persona?: {
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
};

export type AuthProfile = {
  id: string;
  email: string;
  tenant: {
    id: string;
    nombre: string;
    slug: string;
  };
  role: {
    id: string | null;
    nombre: string | null;
  } | null;
  branch: {
    id: string | null;
    nombre: string | null;
  } | null;
  persona: {
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
};
