import type { BranchStatus } from "./branch-response.dto";

export type UpdateBranchDto = {
  codigo?: string;
  nombre?: string;
  descripcion?: string;
  esPrincipal?: boolean;
  direccion?: string;
  paisId?: string;
  departamentoId?: string;
  municipioId?: string;
  telefono?: string;
  email?: string;
  estado?: BranchStatus;
  metadata?: Record<string, unknown>;
};
