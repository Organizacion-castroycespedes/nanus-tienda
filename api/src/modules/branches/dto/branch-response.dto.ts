export type BranchStatus = "ACTIVE" | "INACTIVE";

export type BranchResponseDto = {
  id: string;
  tenant_id: string;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  es_principal: boolean;
  direccion: string | null;
  pais_id: string | null;
  departamento_id: string | null;
  municipio_id: string | null;
  ciudad: string | null;
  departamento: string | null;
  pais: string | null;
  telefono: string | null;
  email: string | null;
  estado: BranchStatus;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};
