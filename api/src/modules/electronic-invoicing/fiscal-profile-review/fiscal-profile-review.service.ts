import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { DatabaseService } from "../../../common/db/database.service";

export type FiscalReviewEntity = "customer" | "supplier";
export type FiscalReviewFilters = {
  completeness?: "complete" | "incomplete" | "all";
  fiscalStatus?: string;
  missingField?: "personType" | "taxRegime" | "taxResponsibilities" | "location";
};

type ReviewRow = {
  id: string;
  entity_type: FiscalReviewEntity;
  name: string;
  document_type: string | null;
  document_number: string | null;
  person_type: string | null;
  tax_regime: string | null;
  tax_responsibilities: string[] | null;
  fiscal_status: string | null;
  fiscal_data_source: string | null;
  is_final_consumer: boolean;
  is_dian_validated: boolean;
  country_code: string | null;
  department_code: string | null;
  municipality_code: string | null;
  country_name: string | null;
  department_name: string | null;
  municipality_name: string | null;
};

const missingFieldsFor = (row: ReviewRow) => {
  const missing: string[] = [];
  if (!row.person_type || row.person_type === "UNKNOWN") missing.push("personType");
  if (!row.tax_regime?.trim()) missing.push("taxRegime");
  if (!row.tax_responsibilities?.length) missing.push("taxResponsibilities");
  if (!row.country_code || !row.department_code || !row.municipality_code) {
    missing.push("location");
  }
  return missing;
};

const maskDocument = (value: string | null) => {
  if (!value) return null;
  if (value.length <= 4) return "****";
  return `${"*".repeat(Math.max(0, value.length - 4))}${value.slice(-4)}`;
};

@Injectable()
export class FiscalProfileReviewService {
  constructor(@Inject(DatabaseService) private readonly db: DatabaseService) {}

  async list(tenantId: string, entity: FiscalReviewEntity, filters: FiscalReviewFilters = {}) {
    if (entity !== "customer" && entity !== "supplier") {
      throw new BadRequestException("entity is invalid");
    }
    const table = entity === "customer" ? "customers" : "suppliers";
    const finalConsumer = entity === "customer" ? "COALESCE(x.is_final_consumer, FALSE)" : "FALSE";
    const result = await this.db.query<ReviewRow>(
      `SELECT x.id,
              $2::text AS entity_type,
              x.name,
              COALESCE(x.dian_identification_type, x.document_type_code) AS document_type,
              COALESCE(x.identification_number, x.document_number) AS document_number,
              x.person_type,
              x.tax_regime,
              x.tax_responsibilities,
              x.fiscal_status,
              x.fiscal_data_source,
              ${finalConsumer} AS is_final_consumer,
              COALESCE(x.is_dian_validated, FALSE) AS is_dian_validated,
              x.country_code,
              x.department_code,
              x.municipality_code,
              p.nombre AS country_name,
              d.nombre AS department_name,
              m.nombre AS municipality_name
       FROM ${table} x
       LEFT JOIN departamentos d ON d.id = x.departamento_id
       LEFT JOIN paises p ON p.id = d.pais_id
       LEFT JOIN municipios m ON m.id = x.municipio_id
       WHERE x.tenant_id = $1
       ORDER BY x.name ASC, x.id ASC`,
      [tenantId, entity]
    );

    return (result.rows ?? [])
      .map((row) => {
        const missingFields = missingFieldsFor(row);
        const finalConsumer = row.is_final_consumer;
        const fiscalStatus = finalConsumer
          ? "NOT_REQUIRED"
          : missingFields.length > 0
            ? "REQUIRES_HUMAN_FISCAL_REVIEW"
            : row.fiscal_status ?? "PENDING";
        return {
          entityType: row.entity_type,
          id: row.id,
          name: row.name,
          documentType: row.document_type,
          maskedDocument: maskDocument(row.document_number),
          personType: row.person_type,
          taxRegime: row.tax_regime,
          taxResponsibilities: Array.isArray(row.tax_responsibilities) ? row.tax_responsibilities : [],
          fiscalStatus,
          fiscalDataSource: row.fiscal_data_source,
          isDianValidated: row.is_dian_validated,
          location: {
            countryCode: row.country_code,
            countryName: row.country_name,
            departmentCode: row.department_code,
            departmentName: row.department_name,
            municipalityCode: row.municipality_code,
            municipalityName: row.municipality_name,
          },
          missingFields: finalConsumer ? [] : missingFields,
          reviewReason: finalConsumer
            ? "Consumidor final: perfil fiscal no requerido"
            : missingFields.length > 0
              ? `Faltan: ${missingFields.join(", ")}`
              : null,
          classification: finalConsumer
            ? "FINAL_CONSUMER_EXCEPTION"
            : missingFields.length > 0
              ? "REQUIRES_HUMAN_FISCAL_REVIEW"
              : "FISCAL_PROFILE_COMPLETE",
        };
      })
      .filter((row) => {
        if (filters.completeness === "complete" && row.classification !== "FISCAL_PROFILE_COMPLETE") return false;
        if (filters.completeness === "incomplete" && row.classification === "FISCAL_PROFILE_COMPLETE") return false;
        if (filters.fiscalStatus && row.fiscalStatus !== filters.fiscalStatus) return false;
        if (filters.missingField && !row.missingFields.includes(filters.missingField)) return false;
        return true;
      });
  }
}
