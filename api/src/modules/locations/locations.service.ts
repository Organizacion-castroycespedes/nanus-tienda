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
}
