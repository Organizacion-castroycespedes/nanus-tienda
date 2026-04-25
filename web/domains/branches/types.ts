export type BranchStatus = "ACTIVE" | "INACTIVE";

export type Branch = {
  id: string;
  tenantId: string;
  codigo: string;
  nombre: string;
  descripcion: string;
  esPrincipal: boolean;
  direccion: string;
  paisId: string;
  departamentoId: string;
  municipioId: string;
  ciudad: string;
  departamento: string;
  pais: string;
  telefono: string;
  email: string;
  estado: BranchStatus;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};
