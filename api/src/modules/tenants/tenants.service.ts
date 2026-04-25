import { Injectable, Inject } from "@nestjs/common";
import { DatabaseService } from "../../common/db/database.service";

type TenantBrandingConfig = {
  colors?: {
    primary?: string;
    secondary?: string;
    background?: string;
    text?: string;
  };
  font?: string;
  logo?: string;
  spacing?: {
    sm?: string;
    md?: string;
    lg?: string;
  };
};

export type TenantDetailsInput = {
  razonSocial: string;
  nit: string;
  dv?: string;
  tipoPersona: string;
  tipoSociedad?: string;
  fechaConstitucion?: string | null;
  estado: string;
  responsabilidadesDian?: string;
  regimen?: string;
  actividadEconomica?: string;
  obligadoFacturacionElectronica?: boolean;
  resolucionDian?: string;
  fechaInicioFacturacion?: string | null;
  direccionPrincipal?: string;
  paisId?: string;
  departamentoId?: string;
  municipioId?: string;
  telefono?: string;
  emailCorporativo?: string;
  sitioWeb?: string;
  representanteNombre?: string;
  representanteTipoDocumento?: string;
  representanteNumeroDocumento?: string;
  representanteEmail?: string;
  representanteTelefono?: string;
  cuentaContableDefecto?: string;
  bancoPrincipal?: string;
  numeroCuenta?: string;
  tipoCuenta?: string;
};

export type TenantSummaryInput = {
  slug?: string;
  nombre?: string;
  activo?: boolean;
};

@Injectable()
export class TenantsService {
  constructor(
   @Inject(DatabaseService) private readonly db: DatabaseService
  ) {}

  async listTenants() {
    const result = await this.db.query(
      "SELECT id, slug, nombre, activo, created_at FROM tenants ORDER BY created_at DESC"
    );
    return result.rows ?? [];
  }

  async createTenant(payload: Required<Pick<TenantSummaryInput, "slug">> & TenantSummaryInput) {
    const result = await this.db.query(
      "INSERT INTO tenants (slug, nombre, activo, config) VALUES ($1, $2, $3, '{}'::jsonb) RETURNING id, slug, nombre, activo, config",
      [payload.slug, payload.nombre ?? null, payload.activo ?? true]
    );
    return result.rows[0] ?? null;
  }

  async updateTenant(tenantId: string, payload: TenantSummaryInput) {
    const result = await this.db.query(
      "UPDATE tenants SET slug = COALESCE($2, slug), nombre = COALESCE($3, nombre), activo = COALESCE($4, activo) WHERE id = $1 RETURNING id, slug, nombre, activo, config",
      [tenantId, payload.slug ?? null, payload.nombre ?? null, payload.activo ?? null]
    );
    return result.rows[0] ?? null;
  }

  async getConfig(tenantId: string) {
    const result = await this.db.query(
      "SELECT id, config FROM tenants WHERE id = $1",
      [tenantId]
    );
    return result.rows[0] ?? null;
  }

  async updateConfig(tenantId: string, config: TenantBrandingConfig) {
    const result = await this.db.query(
      "UPDATE tenants SET config = $2 WHERE id = $1 RETURNING id, config",
      [tenantId, config]
    );
    return result.rows[0] ?? null;
  }

  async getDetails(tenantId: string) {
    const result = await this.db.query(
      `SELECT
        td.id,
        td.tenant_id,
        td.razon_social,
        td.nit,
        td.dv,
        td.tipo_persona,
        td.tipo_sociedad,
        td.fecha_constitucion,
        td.estado,
        td.responsabilidades_dian,
        td.regimen,
        td.actividad_economica,
        td.obligado_facturacion_electronica,
        td.resolucion_dian,
        td.fecha_inicio_facturacion,
        td.direccion_principal,
        td.pais_id,
        td.departamento_id,
        td.municipio_id,
        COALESCE(m.nombre, td.ciudad) AS ciudad,
        COALESCE(d.nombre, td.departamento) AS departamento,
        COALESCE(p.nombre, td.pais) AS pais,
        td.telefono,
        td.email_corporativo,
        td.sitio_web,
        td.representante_nombre,
        td.representante_tipo_documento,
        td.representante_numero_documento,
        td.representante_email,
        td.representante_telefono,
        td.cuenta_contable_defecto,
        td.banco_principal,
        td.numero_cuenta,
        td.tipo_cuenta,
        td.created_at,
        td.updated_at
      FROM tenants_detalles td
      LEFT JOIN paises p ON p.id = td.pais_id
      LEFT JOIN departamentos d ON d.id = td.departamento_id
      LEFT JOIN municipios m ON m.id = td.municipio_id
      WHERE td.tenant_id = $1`,
      [tenantId]
    );
    return result.rows[0] ?? null;
  }

  async upsertDetails(tenantId: string, payload: TenantDetailsInput) {
    const result = await this.db.query(
      `
      INSERT INTO tenants_detalles (
        tenant_id,
        razon_social,
        nit,
        dv,
        tipo_persona,
        tipo_sociedad,
        fecha_constitucion,
        estado,
        responsabilidades_dian,
        regimen,
        actividad_economica,
        obligado_facturacion_electronica,
        resolucion_dian,
        fecha_inicio_facturacion,
        direccion_principal,
        pais_id,
        departamento_id,
        municipio_id,
        ciudad,
        departamento,
        pais,
        telefono,
        email_corporativo,
        sitio_web,
        representante_nombre,
        representante_tipo_documento,
        representante_numero_documento,
        representante_email,
        representante_telefono,
        cuenta_contable_defecto,
        banco_principal,
        numero_cuenta,
        tipo_cuenta,
        updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15, $16, $17, $18,
        (SELECT nombre FROM municipios WHERE id = $18),
        (SELECT nombre FROM departamentos WHERE id = $17),
        (SELECT nombre FROM paises WHERE id = $16),
        $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, NOW()
      )
      ON CONFLICT (tenant_id) DO UPDATE SET
        razon_social = EXCLUDED.razon_social,
        nit = EXCLUDED.nit,
        dv = EXCLUDED.dv,
        tipo_persona = EXCLUDED.tipo_persona,
        tipo_sociedad = EXCLUDED.tipo_sociedad,
        fecha_constitucion = EXCLUDED.fecha_constitucion,
        estado = EXCLUDED.estado,
        responsabilidades_dian = EXCLUDED.responsabilidades_dian,
        regimen = EXCLUDED.regimen,
        actividad_economica = EXCLUDED.actividad_economica,
        obligado_facturacion_electronica = EXCLUDED.obligado_facturacion_electronica,
        resolucion_dian = EXCLUDED.resolucion_dian,
        fecha_inicio_facturacion = EXCLUDED.fecha_inicio_facturacion,
        direccion_principal = EXCLUDED.direccion_principal,
        pais_id = EXCLUDED.pais_id,
        departamento_id = EXCLUDED.departamento_id,
        municipio_id = EXCLUDED.municipio_id,
        ciudad = COALESCE(
          (SELECT nombre FROM municipios WHERE id = EXCLUDED.municipio_id),
          EXCLUDED.ciudad
        ),
        departamento = COALESCE(
          (SELECT nombre FROM departamentos WHERE id = EXCLUDED.departamento_id),
          EXCLUDED.departamento
        ),
        pais = COALESCE(
          (SELECT nombre FROM paises WHERE id = EXCLUDED.pais_id),
          EXCLUDED.pais
        ),
        telefono = EXCLUDED.telefono,
        email_corporativo = EXCLUDED.email_corporativo,
        sitio_web = EXCLUDED.sitio_web,
        representante_nombre = EXCLUDED.representante_nombre,
        representante_tipo_documento = EXCLUDED.representante_tipo_documento,
        representante_numero_documento = EXCLUDED.representante_numero_documento,
        representante_email = EXCLUDED.representante_email,
        representante_telefono = EXCLUDED.representante_telefono,
        cuenta_contable_defecto = EXCLUDED.cuenta_contable_defecto,
        banco_principal = EXCLUDED.banco_principal,
        numero_cuenta = EXCLUDED.numero_cuenta,
        tipo_cuenta = EXCLUDED.tipo_cuenta,
        updated_at = NOW()
      RETURNING *
      `,
      [
        tenantId, 
        payload.razonSocial,
        payload.nit,
        payload.dv ?? null,
        payload.tipoPersona,
        payload.tipoSociedad ?? null,
        payload.fechaConstitucion ?? null,
        payload.estado,
        payload.responsabilidadesDian ?? null,
        payload.regimen ?? null,
        payload.actividadEconomica ?? null,
        payload.obligadoFacturacionElectronica ?? false,
        payload.resolucionDian ?? null,
        payload.fechaInicioFacturacion ?? null,
        payload.direccionPrincipal ?? null,
        payload.paisId ?? null,
        payload.departamentoId ?? null,
        payload.municipioId ?? null,
        payload.telefono ?? null,
        payload.emailCorporativo ?? null,
        payload.sitioWeb ?? null,
        payload.representanteNombre ?? null,
        payload.representanteTipoDocumento ?? null,
        payload.representanteNumeroDocumento ?? null,
        payload.representanteEmail ?? null,
        payload.representanteTelefono ?? null,
        payload.cuentaContableDefecto ?? null,
        payload.bancoPrincipal ?? null,
        payload.numeroCuenta ?? null,
        payload.tipoCuenta ?? null,
      ]
    );
    return result.rows[0] ?? null;
  }

  async deleteDetails(tenantId: string) {
    await this.db.query("DELETE FROM tenants_detalles WHERE tenant_id = $1", [
      tenantId,
    ]);
    return { ok: true };
  }
}
