export type TenantConfigResponse = {
  id: string;
  config: {
    colors: Record<string, string>;
    font: string;
    logo?: string;
    spacing?: Record<string, string>;
  };
};

export type TenantDetailsResponse = {
  id: string;
  tenant_id: string;
  razon_social: string;
  nit: string;
  dv?: string;
  tipo_persona: string;
  tipo_sociedad?: string;
  fecha_constitucion?: string;
  estado: string;
  responsabilidades_dian?: string;
  regimen?: string;
  actividad_economica?: string;
  obligado_facturacion_electronica?: boolean;
  resolucion_dian?: string;
  fecha_inicio_facturacion?: string;
  direccion_principal?: string;
  pais_id?: string;
  departamento_id?: string;
  municipio_id?: string;
  ciudad?: string;
  departamento?: string;
  pais?: string;
  telefono?: string;
  email_corporativo?: string;
  sitio_web?: string;
  representante_nombre?: string;
  representante_tipo_documento?: string;
  representante_numero_documento?: string;
  representante_email?: string;
  representante_telefono?: string;
  cuenta_contable_defecto?: string;
  banco_principal?: string;
  numero_cuenta?: string;
  tipo_cuenta?: string;
};

export type TenantSummaryResponse = {
  id: string;
  slug: string;
  nombre: string | null;
  activo: boolean;
};
