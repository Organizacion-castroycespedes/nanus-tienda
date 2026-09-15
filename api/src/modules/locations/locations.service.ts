import { BadRequestException, Injectable, Inject } from "@nestjs/common";
import { DatabaseService } from "../../common/db/database.service";

@Injectable()
export class LocationsService {
  constructor(
    @Inject(DatabaseService) private readonly db: DatabaseService
  ) {}

  async listCountries() {
    const result = await this.db.query(
      `SELECT
        id,
        codigo_iso2,
        codigo_iso3,
        nombre,
        moneda,
        simbolo_moneda
      FROM paises
      WHERE activo = TRUE
      ORDER BY nombre ASC`
    );
    return result.rows ?? [];
  }

  async listDepartments(paisId?: string) {
    if (!paisId) {
      throw new BadRequestException("paisId requerido");
    }
    const result = await this.db.query(
      `SELECT
        id,
        pais_id,
        codigo_dane,
        nombre
      FROM departamentos
      WHERE activo = TRUE AND pais_id = $1
      ORDER BY nombre ASC`,
      [paisId]
    );
    return result.rows ?? [];
  }

  async listMunicipalities(departamentoId?: string) {
    if (!departamentoId) {
      throw new BadRequestException("departamentoId requerido");
    }
    const result = await this.db.query(
      `SELECT
        id,
        departamento_id,
        codigo_dane,
        nombre,
        es_capital
      FROM municipios
      WHERE activo = TRUE AND departamento_id = $1
      ORDER BY nombre ASC`,
      [departamentoId]
    );
    return result.rows ?? [];
  }

  async validateFiscalHierarchy(
    countryCode?: string | null,
    departmentCode?: string | null,
    municipalityCode?: string | null
  ) {
    const country = countryCode?.trim().toUpperCase() || null;
    const department = departmentCode?.trim() || null;
    const municipality = municipalityCode?.trim() || null;

    if (!country && !department && !municipality) {
      return;
    }
    if (!country || (country === "CO" && (!department || !municipality))) {
      throw new BadRequestException("fiscal location is incomplete");
    }
    if (!department && !municipality) {
      return;
    }
    if (!department || !municipality) {
      throw new BadRequestException("fiscal location hierarchy is incomplete");
    }

    const result = await this.db.query(
      `SELECT 1
       FROM municipios m
       JOIN departamentos d ON d.id = m.departamento_id
       JOIN paises p ON p.id = d.pais_id
       WHERE p.activo = TRUE
         AND d.activo = TRUE
         AND m.activo = TRUE
         AND p.codigo_iso2 = $1
         AND d.codigo_dane = $2
         AND m.codigo_dane = $3
       LIMIT 1`,
      [country, department, municipality]
    );
    if ((result.rows ?? []).length === 0) {
      throw new BadRequestException("fiscal location hierarchy is invalid");
    }
  }

  async resolveCanonicalLocation(input: {
    countryId?: string | null;
    departmentId?: string | null;
    municipalityId?: string | null;
  }) {
    const countryId = input.countryId?.trim() || null;
    const departmentId = input.departmentId?.trim() || null;
    const municipalityId = input.municipalityId?.trim() || null;
    if (!departmentId || !municipalityId) {
      throw new BadRequestException(
        "departamentoId and municipioId are required"
      );
    }

    const result = await this.db.query(
      `SELECT
        p.id AS country_id,
        p.codigo_iso2 AS country_code,
        p.nombre AS country_name,
        d.id AS department_id,
        d.codigo_dane AS department_code,
        d.nombre AS department_name,
        m.id AS municipality_id,
        m.codigo_dane AS municipality_code,
        m.nombre AS municipality_name
       FROM paises p
       JOIN departamentos d ON d.pais_id = p.id
       JOIN municipios m ON m.departamento_id = d.id
       WHERE ($1::uuid IS NULL OR p.id = $1::uuid)
         AND d.id = $2 AND m.id = $3
         AND p.activo = TRUE AND d.activo = TRUE AND m.activo = TRUE
       LIMIT 1`,
      [countryId, departmentId, municipalityId]
    );
    if (!result.rows[0]) {
      throw new BadRequestException("fiscal location hierarchy is invalid");
    }
    return result.rows[0];
  }
}
