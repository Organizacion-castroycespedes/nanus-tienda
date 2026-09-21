import { Inject, Injectable } from "@nestjs/common";
import type { PoolClient } from "pg";
import { FunctionRunnerService } from "../../database/function-runner.service";
import type {
  CustomerMasterRow,
  CustomerOrdersStatusDataset,
  ReportActorContext,
} from "../types/customers-report.types";

type CustomersListParams = {
  tenantId?: string;
  branchId?: string;
  dateFrom?: string;
  dateTo?: string;
  customerDocument?: string;
  customerName?: string;
};

export type CustomerMasterParams = {
  tenantId?: string;
  customerDocument?: string;
  customerName?: string;
};

@Injectable()
export class CustomersReportAdapter {
  constructor(
    @Inject(FunctionRunnerService)
    private readonly functionRunnerService: FunctionRunnerService,
  ) {}

  private masterParams(actor: ReportActorContext, filters: CustomerMasterParams) {
    return [
      actor.role,
      actor.tenantId,
      actor.branchId,
      filters.tenantId ?? null,
      null,
      filters.customerDocument?.trim() || null,
      filters.customerName?.trim() || null,
    ];
  }

  private masterSql(select: string) {
    return `
      WITH resolved AS (
        SELECT (scope->>'tenantId')::uuid AS tenant_id
        FROM public.report_resolve_pos_scope($1::text, $2::uuid, $3::uuid, $4::uuid, $5::uuid) AS scope
      ), customer_rows AS (
        SELECT
          c.id AS customer_id,
          c.tenant_id,
          c.name,
          c.document_number,
          c.document_type_code,
          c.document_number_normalized,
          c.dian_identification_type,
          c.identification_number,
          c.verification_digit,
          c.legal_name,
          c.trade_name,
          c.phone,
          c.email,
          c.fiscal_email,
          c.invoice_email,
          c.address,
          COALESCE(NULLIF(BTRIM(c.ciudad), ''), m.nombre) AS city,
          COALESCE(NULLIF(BTRIM(c.departamento), ''), d.nombre) AS department,
          p.nombre AS country,
          c.country_code,
          c.department_code,
          c.municipality_code,
          c.person_type,
          c.tax_regime,
          COALESCE(c.tax_responsibilities, '[]'::jsonb) AS tax_responsibilities,
          COALESCE(c.is_dian_validated, FALSE) AS is_dian_validated,
          COALESCE(NULLIF(BTRIM(c.fiscal_data_source), ''), 'MANUAL') AS fiscal_data_source,
          COALESCE(NULLIF(BTRIM(c.fiscal_status), ''), 'PENDING') AS fiscal_status,
          c.dian_last_lookup_at,
          c.dian_last_lookup_status,
          c.is_active,
          c.is_final_consumer,
          c.created_at,
          c.updated_at
        FROM public.customers AS c
        LEFT JOIN public.municipios AS m ON m.id = c.municipio_id
        LEFT JOIN public.departamentos AS d ON d.id = c.departamento_id
        LEFT JOIN public.paises AS p ON p.id = d.pais_id
        CROSS JOIN resolved
        WHERE c.tenant_id = resolved.tenant_id
          AND (
            $6::text IS NULL
            OR COALESCE(
              NULLIF(BTRIM(c.document_number_normalized), ''),
              NULLIF(regexp_replace(UPPER(BTRIM(c.identification_number)), '[^0-9A-Z]', '', 'g'), ''),
              NULLIF(regexp_replace(UPPER(BTRIM(c.document_number)), '[^0-9A-Z]', '', 'g'), '')
            ) ILIKE '%' || $6::text || '%'
          )
          AND ($7::text IS NULL OR c.name ILIKE '%' || $7::text || '%')
      )
      ${select}
    `;
  }

  async getCustomerMasterCount(
    actor: ReportActorContext,
    filters: CustomerMasterParams,
    client: PoolClient,
  ) {
    const result = await client.query<{ count: string }>(
      this.masterSql("SELECT COUNT(*)::text AS count FROM customer_rows"),
      this.masterParams(actor, filters),
    );
    return Number(result.rows[0]?.count ?? 0);
  }

  async getCustomerMasterBatch(
    actor: ReportActorContext,
    filters: CustomerMasterParams,
    client: PoolClient,
    offset: number,
    limit: number,
  ): Promise<CustomerMasterRow[]> {
    const result = await client.query<CustomerMasterRow>(
      this.masterSql(`
        SELECT
          customer_id AS "customerId", tenant_id AS "tenantId", name,
          document_number AS "documentNumber", document_type_code AS "documentTypeCode",
          document_number_normalized AS "documentNumberNormalized",
          dian_identification_type AS "dianIdentificationType",
          identification_number AS "identificationNumber", verification_digit AS "verificationDigit",
          legal_name AS "legalName", trade_name AS "tradeName", phone, email,
          fiscal_email AS "fiscalEmail", invoice_email AS "invoiceEmail", address,
          city, department, country, country_code AS "countryCode",
          department_code AS "departmentCode", municipality_code AS "municipalityCode",
          person_type AS "personType", tax_regime AS "taxRegime",
          tax_responsibilities AS "taxResponsibilities", is_dian_validated AS "isDianValidated",
          fiscal_data_source AS "fiscalDataSource", fiscal_status AS "fiscalStatus",
          dian_last_lookup_at AS "dianLastLookupAt", dian_last_lookup_status AS "dianLastLookupStatus",
          is_active AS "isActive", is_final_consumer AS "isFinalConsumer",
          created_at AS "createdAt", updated_at AS "updatedAt"
        FROM customer_rows
        ORDER BY LOWER(BTRIM(name)) ASC, customer_id ASC
        LIMIT $8::integer OFFSET $9::integer
      `),
      [...this.masterParams(actor, filters), limit, offset],
    );
    return result.rows.map((row) => ({
      ...row,
      taxResponsibilities: Array.isArray(row.taxResponsibilities) ? row.taxResponsibilities : [],
      isDianValidated: Boolean(row.isDianValidated),
      isActive: Boolean(row.isActive),
      isFinalConsumer: Boolean(row.isFinalConsumer),
    }));
  }

  async getCustomerOrdersStatus(
    actor: ReportActorContext,
    filters: CustomersListParams
  ): Promise<CustomerOrdersStatusDataset | null> {
    const hasAdvancedCustomerFilters = Boolean(
      filters.customerDocument ?? filters.customerName
    );

    return this.functionRunnerService.executeFunction<CustomerOrdersStatusDataset | null>(
      "report_customer_orders_status",
      hasAdvancedCustomerFilters
        ? [
            actor.userId,
            actor.role,
            actor.tenantId,
            actor.branchId,
            filters.tenantId ?? null,
            filters.branchId ?? null,
            filters.dateFrom ?? null,
            filters.dateTo ?? null,
            filters.customerDocument ?? null,
            filters.customerName ?? null,
          ]
        : [
            actor.userId,
            actor.role,
            actor.tenantId,
            actor.branchId,
            filters.tenantId ?? null,
            filters.branchId ?? null,
            filters.dateFrom ?? null,
            filters.dateTo ?? null,
          ]
    );
  }
}
