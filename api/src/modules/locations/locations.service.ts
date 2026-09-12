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
}
