import { Inject, Injectable } from "@nestjs/common";
import type { PoolClient } from "pg";
import { DatabaseService } from "../../database/database.service";
import { FunctionRunnerService } from "../../database/function-runner.service";
import type {
  PosSaleCancelTicketDataset,
  PosSaleTicketDataset,
  PosSaleTicketPayment,
  PrintableCompanyHeader,
  PosSalesListDataset,
  PosSalesListRow,
  ReportActorContext,
} from "../types/sales-report.types";
import type { ElectronicInvoiceReadModel } from "../types/electronic-invoice-representation.types";

type SalesListParams = {
  tenantId?: string;
  branchId?: string;
  dateFrom?: string;
  dateTo?: string;
  customerDocument?: string;
};

export type PosExportFilters = {
  tenantId?: string;
  branchId?: string;
  dateFrom?: string;
  dateTo?: string;
  customerDocument?: string;
};

@Injectable()
export class SalesReportAdapter {
  constructor(
    @Inject(FunctionRunnerService)
    private readonly functionRunnerService: FunctionRunnerService,
    @Inject(DatabaseService)
    private readonly databaseService: DatabaseService
  ) {}

  async getSalesList(
    actor: ReportActorContext,
    filters: SalesListParams
  ): Promise<PosSalesListDataset | null> {
    const result = await this.databaseService.query<PosSalesListRow>(
      `${this.posSalesFromSql()} SELECT sale.id AS "saleId", sale.created_at AS date, sale.status,
              COALESCE(NULLIF(BTRIM(sale.customer_name), ''), 'CONSUMIDOR FINAL') AS "customerName",
              sale.total::numeric AS total, COALESCE(sale.total_paid, 0)::numeric AS paid,
              COALESCE(sale.balance_due, sale.balance,
                GREATEST(sale.total - COALESCE(sale.total_paid, 0), 0))::numeric AS balance,
              COALESCE(sale.payment_status, 'PENDING') AS "paymentStatus",
              sale.branch_id AS "branchId", sale.branch_name AS "branchName",
              sale.cash_session_id AS "cashSessionId"
         FROM sale_rows AS sale
        ORDER BY sale.created_at DESC, sale.id DESC`,
      this.scopeParams(actor, filters),
    );
    const rows = result.rows.map((row) => ({
      ...row,
      total: Number(row.total),
      paid: Number(row.paid),
      balance: Number(row.balance),
      billingStatus: "NO_DOCUMENT" as const,
      billingDocumentNumber: null,
      billingCufe: null,
      billingAcceptedAt: null,
    }));
    if (!rows.length) {
      return {
        filters: {
          tenantId: filters.tenantId ?? actor.tenantId,
          branchId: filters.branchId ?? actor.branchId ?? null,
          dateFrom: filters.dateFrom ?? null,
          dateTo: filters.dateTo ?? null,
          customerDocument: filters.customerDocument ?? null,
          actorRole: actor.role,
        },
        summary: { count: 0, total: 0, paid: 0, balance: 0, cancelled: 0, refunded: 0 },
        rows: [],
      };
    }
    const saleIds = rows.map((row) => row.saleId);
    const billing = await this.databaseService.query<{
      saleId: string;
      billingStatus: ElectronicInvoiceReadModel["status"] | "NO_DOCUMENT";
      billingDocumentNumber: string | null;
      billingCufe: string | null;
      billingAcceptedAt: string | null;
      saleStatus: string;
      paymentStatus: string;
      requestExists: boolean;
      documentCount: number;
      tenantConfig: unknown;
    }>(
      `SELECT sale_id AS "saleId", status AS "billingStatus",
              document_number AS "billingDocumentNumber", cufe AS "billingCufe",
              accepted_at AS "billingAcceptedAt", sale_status AS "saleStatus",
              payment_status AS "paymentStatus", request_exists AS "requestExists",
              document_count AS "documentCount"
         FROM (
           SELECT s.id AS sale_id, s.status AS sale_status, s.payment_status,
                  document.status,
                  COALESCE(document.full_number, CONCAT(COALESCE(document.prefix, ''), document.number::TEXT)) AS document_number,
                  document.cufe, document.accepted_at,
                  (SELECT config FROM tenants WHERE id = s.tenant_id) AS "tenantConfig",
                  EXISTS (
                    SELECT 1 FROM integration_outbox_events event
                    WHERE event.tenant_id = s.tenant_id
                      AND event.source_type = 'SALE'
                      AND event.source_id = s.id::TEXT
                  ) AS request_exists,
                  ROW_NUMBER() OVER (PARTITION BY s.id ORDER BY document.created_at DESC) AS row_number,
                  COUNT(document.id) OVER (PARTITION BY s.id) AS document_count
             FROM sales AS s
             LEFT JOIN electronic_documents AS document
               ON document.tenant_id = s.tenant_id
              AND document.source_type = 'SALE'
              AND document.source_id = s.id
            WHERE s.tenant_id = $1 AND s.id = ANY($2::UUID[])
              AND ($3 = 'SUPER_ADMIN' OR $4::UUID IS NULL OR s.branch_id = $4::UUID)
         ) AS documents
        WHERE row_number = 1`,
      [actor.tenantId, saleIds, actor.role, actor.branchId]
    );
    const billingBySale = new Map(billing.rows.map((row) => [row.saleId, row]));
    return {
      filters: {
        tenantId: filters.tenantId ?? actor.tenantId,
        branchId: filters.branchId ?? actor.branchId ?? null,
        dateFrom: filters.dateFrom ?? null,
        dateTo: filters.dateTo ?? null,
        customerDocument: filters.customerDocument ?? null,
        actorRole: actor.role,
      },
      summary: {
        count: rows.length,
        total: rows.reduce((sum, row) => sum + row.total, 0),
        paid: rows.reduce((sum, row) => sum + row.paid, 0),
        balance: rows.reduce((sum, row) => sum + row.balance, 0),
        cancelled: rows.filter((row) => row.status === "CANCELLED").length,
        refunded: rows.filter((row) => row.status === "REFUNDED").length,
      },
      rows: rows.map((row) => {
        const document = billingBySale.get(row.saleId);
        const tenantConfig = document?.tenantConfig && typeof document.tenantConfig === "object"
          ? document.tenantConfig as Record<string, unknown>
          : {};
        const mode = tenantConfig.electronicBillingMode === "ON_DEMAND" ? "ON_DEMAND" : "AUTOMATIC";
        const enabled = tenantConfig.electronicBillingEnabled !== false;
        const isEligibleOnDemand =
          enabled && mode === "ON_DEMAND" &&
          document &&
          document.documentCount === 0 &&
          document.saleStatus === "CONFIRMED" &&
          ["PAID", "OVERPAID"].includes(document.paymentStatus) &&
          !document.requestExists;
        const billingStatus = document?.billingStatus
          ? document.billingStatus
          : document?.requestExists
            ? "REQUESTED"
            : "NO_DOCUMENT";
        return {
          ...row,
          billingStatus: isEligibleOnDemand
            ? "ELIGIBLE_ON_DEMAND"
            : billingStatus,
          billingDocumentNumber: document?.billingDocumentNumber ?? null,
          billingCufe: document?.billingCufe ?? null,
          billingAcceptedAt: document?.billingAcceptedAt ?? null,
        };
      }),
    };
  }

  private scopeParams(actor: ReportActorContext, filters: PosExportFilters) {
    return [
      actor.userId,
      actor.role,
      actor.tenantId,
      actor.branchId,
      filters.tenantId ?? null,
      filters.branchId ?? null,
      filters.dateFrom ?? null,
      filters.dateTo ?? null,
      filters.customerDocument?.trim() || null,
    ];
  }

  private posSalesFromSql() {
    return `
      WITH resolved AS (
        SELECT (scope->>'tenantId')::uuid AS tenant_id,
               NULLIF(scope->>'branchId', '')::uuid AS branch_id,
               COALESCE((scope->>'restrictToUser')::boolean, FALSE) AS restrict_to_user
          FROM public.report_resolve_pos_scope($2::text, $3::uuid, $4::uuid, $5::uuid, $6::uuid) AS scope
      ), sale_rows AS (
        SELECT sale.*, customer.name AS customer_name, branch.nombre AS branch_name,
               payment_context.cash_session_id
          FROM public.sales AS sale
          LEFT JOIN public.customers AS customer
            ON customer.id = sale.customer_id AND customer.tenant_id = sale.tenant_id
          LEFT JOIN public.tenant_branches AS branch
            ON branch.id = sale.branch_id AND branch.tenant_id = sale.tenant_id
          LEFT JOIN LATERAL (
            SELECT payment.cash_session_id
              FROM public.payments AS payment
             WHERE payment.tenant_id = sale.tenant_id
               AND payment.reference_type = 'SALE'
               AND payment.reference_id = sale.id
               AND payment.direction = 'IN'
             ORDER BY payment.created_at ASC, payment.id ASC
             LIMIT 1
          ) AS payment_context ON TRUE
          CROSS JOIN resolved
         WHERE sale.tenant_id = resolved.tenant_id
           AND (resolved.branch_id IS NULL OR sale.branch_id = resolved.branch_id)
           AND ($7::timestamptz IS NULL OR sale.created_at >= $7::timestamptz)
           AND ($8::timestamptz IS NULL OR sale.created_at < $8::timestamptz)
           AND (
             $9::text IS NULL
             OR COALESCE(
               NULLIF(BTRIM(customer.document_number_normalized), ''),
               NULLIF(regexp_replace(UPPER(BTRIM(customer.identification_number)), '[^0-9A-Z]', '', 'g'), ''),
               NULLIF(regexp_replace(UPPER(BTRIM(customer.document_number)), '[^0-9A-Z]', '', 'g'), '')
             ) ILIKE '%' || $9::text || '%'
           )
           AND (
             NOT resolved.restrict_to_user
             OR EXISTS (
               SELECT 1
                 FROM public.pos_user_sessions AS actor_session
                WHERE actor_session.id = sale.pos_session_id
                  AND actor_session.tenant_id = sale.tenant_id
                  AND actor_session.user_id = $1::uuid
                  AND actor_session.is_active = TRUE
             )
           )
      )`;
  }

  async getPosExportCount(
    actor: ReportActorContext,
    filters: PosExportFilters,
    client: PoolClient,
  ): Promise<number> {
    const result = await client.query<{ count: string }>(
      `${this.posSalesFromSql()}
       SELECT COUNT(*)::text AS count
       FROM sale_rows`,
      this.scopeParams(actor, filters),
    );
    return Number(result.rows[0]?.count ?? 0);
  }

  async getPosExportBatch(
    actor: ReportActorContext,
    filters: PosExportFilters,
    client: PoolClient,
    offset: number,
    limit: number,
  ): Promise<PosSalesListRow[]> {
    const result = await client.query<PosSalesListRow & { billingStatus: PosSalesListRow["billingStatus"] }>(
      `${this.posSalesFromSql()}
       SELECT sale.id AS "saleId", sale.created_at AS date, sale.status,
              COALESCE(NULLIF(BTRIM(sale.customer_name), ''), 'CONSUMIDOR FINAL') AS "customerName",
              sale.total::numeric AS total,
              COALESCE(sale.total_paid, 0)::numeric AS paid,
              COALESCE(sale.balance_due, sale.balance,
                GREATEST(sale.total - COALESCE(sale.total_paid, 0), 0))::numeric AS balance,
              COALESCE(sale.payment_status, 'PENDING') AS "paymentStatus",
              sale.branch_id AS "branchId", sale.branch_name AS "branchName",
              sale.cash_session_id AS "cashSessionId",
              COALESCE(document.status,
                CASE WHEN request_context.request_exists THEN 'REQUESTED' ELSE 'NO_DOCUMENT' END
              ) AS "billingStatus"
       FROM sale_rows AS sale
       LEFT JOIN LATERAL (
         SELECT latest.status
           FROM public.electronic_documents AS latest
          WHERE latest.tenant_id = sale.tenant_id
            AND latest.source_type = 'SALE'
            AND latest.source_id = sale.id
          ORDER BY latest.created_at DESC, latest.id DESC
          LIMIT 1
       ) AS document ON TRUE
       LEFT JOIN LATERAL (
         SELECT EXISTS (
           SELECT 1 FROM public.integration_outbox_events AS event
            WHERE event.tenant_id = sale.tenant_id
              AND event.source_type = 'SALE'
              AND event.source_id = sale.id::text
         ) AS request_exists
       ) AS request_context ON TRUE

       ORDER BY sale.created_at DESC, sale.id DESC
       LIMIT $10::integer OFFSET $11::integer`,
      [...this.scopeParams(actor, filters), limit, offset],
    );
    return result.rows.map((row) => ({
      ...row,
      total: Number(row.total),
      paid: Number(row.paid),
      balance: Number(row.balance),
      billingStatus: row.billingStatus,
      billingDocumentNumber: null,
      billingCufe: null,
      billingAcceptedAt: null,
    }));
  }

  async getSaleTicket(
    actor: ReportActorContext,
    saleId: string
  ): Promise<PosSaleTicketDataset | null> {
    return this.functionRunnerService.executeFunction<PosSaleTicketDataset | null>(
      "report_pos_sale_ticket",
      [actor.userId, actor.role, actor.tenantId, actor.branchId, saleId]
    );
  }

  async getSalePayments(
    actor: ReportActorContext,
    saleId: string
  ): Promise<PosSaleTicketPayment[]> {
    const result = await this.databaseService.query<PosSaleTicketPayment>(
      `SELECT allocation.id AS "paymentId",
              COALESCE(NULLIF(TRIM(method.nombre), ''),
                       NULLIF(TRIM(method.tipo), ''),
                       method.codigo,
                       'Método de pago') AS method,
              allocation.allocated_amount AS amount,
              payment.status,
              payment.direction,
              allocation.reference_type AS "referenceType",
              payment.reference_number AS "referenceNumber",
              payment.notes
         FROM payment_allocations AS allocation
         INNER JOIN payments AS payment ON payment.id = allocation.payment_id
         INNER JOIN payment_methods AS method ON method.id = payment.payment_method_id
         INNER JOIN sales AS sale ON sale.id = allocation.reference_id
        WHERE allocation.reference_type = 'SALE'
          AND allocation.reference_id = $1::uuid
          AND sale.tenant_id = $2::uuid
          AND payment.tenant_id = $2::uuid
          AND ($3 = 'SUPER_ADMIN' OR $4::uuid IS NULL OR sale.branch_id = $4::uuid)
          AND payment.status IN ('PENDING', 'COMPLETED')
        ORDER BY allocation.created_at, allocation.id`,
      [saleId, actor.tenantId, actor.role, actor.branchId]
    );

    return (result.rows ?? []).map((payment) => ({
      ...payment,
      amount: Number(payment.amount ?? 0),
    }));
  }

  async getPrintableCompany(actor: ReportActorContext): Promise<PrintableCompanyHeader> {
    const result = await this.databaseService.query<{
      tenantName: string | null;
      config: unknown;
      legalName: string | null;
      nit: string | null;
      dv: string | null;
      taxResponsibilities: string | null;
      regime: string | null;
      vatResponsibility: string | null;
      address: string | null;
      city: string | null;
      department: string | null;
      country: string | null;
      phone: string | null;
      email: string | null;
      website: string | null;
      branchName: string | null;
      branchAddress: string | null;
      branchCity: string | null;
      branchDepartment: string | null;
      branchCountry: string | null;
      branchPhone: string | null;
      branchEmail: string | null;
    }>(
      `SELECT t.nombre AS "tenantName", t.config,
              td.razon_social AS "legalName", td.nit, td.dv,
              td.responsabilidades_dian AS "taxResponsibilities", td.regimen,
              td.vat_responsibility AS "vatResponsibility",
              td.direccion_principal AS address, td.ciudad AS city,
              td.departamento AS department, td.pais AS country,
              td.telefono AS phone, td.email_corporativo AS email,
              td.sitio_web AS website,
              tb.nombre AS "branchName", tb.direccion AS "branchAddress",
              tb.ciudad AS "branchCity", tb.departamento AS "branchDepartment",
              tb.pais AS "branchCountry", tb.telefono AS "branchPhone",
              tb.email AS "branchEmail"
         FROM tenants t
         LEFT JOIN tenants_detalles td ON td.tenant_id = t.id
         LEFT JOIN tenant_branches tb
           ON tb.tenant_id = t.id
          AND ($2::uuid IS NOT NULL AND tb.id = $2::uuid OR
               $2::uuid IS NULL AND tb.es_principal = TRUE)
        WHERE t.id = $1::uuid AND t.activo = TRUE
        LIMIT 1`,
      [actor.tenantId, actor.branchId]
    );
    const row = result.rows[0];
    const config = row?.config && typeof row.config === "object"
      ? row.config as Record<string, unknown>
      : {};
    const logo = typeof config.logo === "string"
      ? config.logo
      : typeof config.logoUrl === "string" ? config.logoUrl : null;
    return {
      tenantName: row?.tenantName ?? null,
      legalName: row?.legalName ?? row?.tenantName ?? null,
      nit: row?.nit ?? null,
      dv: row?.dv ?? null,
      taxResponsibilities: row?.taxResponsibilities ?? null,
      regime: row?.regime ?? null,
      vatResponsibility: row?.vatResponsibility ?? null,
      address: row?.address ?? null,
      city: row?.city ?? null,
      department: row?.department ?? null,
      country: row?.country ?? null,
      phone: row?.phone ?? null,
      email: row?.email ?? null,
      website: row?.website ?? null,
      logo,
      branchName: row?.branchName ?? null,
      branchAddress: row?.branchAddress ?? null,
      branchCity: row?.branchCity ?? null,
      branchDepartment: row?.branchDepartment ?? null,
      branchCountry: row?.branchCountry ?? null,
      branchPhone: row?.branchPhone ?? null,
      branchEmail: row?.branchEmail ?? null,
    };
  }

  async saleExists(saleId: string): Promise<boolean> {
    const result = await this.databaseService.query<{ exists: boolean }>(
      "SELECT EXISTS (SELECT 1 FROM sales WHERE id = $1) AS exists",
      [saleId]
    );
    return result.rows[0]?.exists === true;
  }

  async getElectronicInvoice(actor: ReportActorContext, saleId: string) {
    const result = await this.databaseService.query<ElectronicInvoiceReadModel>(
      `SELECT s.id AS "saleId", document.id AS "electronicDocumentId",
              document.status,
              COALESCE(document.full_number, CONCAT(COALESCE(document.prefix, ''), document.number::TEXT)) AS "documentNumber",
              document.cufe, document.accepted_at AS "acceptedAt",
              document.metadata #>> '{providerResponse,code}' AS "providerStatusCode",
              document.metadata #>> '{providerResponse,message}' AS "providerStatusMessage",
              document.metadata #>> '{providerResponse,trackingId}' AS "trackingId",
              CASE WHEN document.metadata #> '{electronicBilling,customer}' IS NOT NULL THEN jsonb_build_object(
                'name', COALESCE(document.metadata #>> '{electronicBilling,customer,legalName}', NULLIF(CONCAT_WS(' ', document.metadata #>> '{electronicBilling,customer,firstName}', document.metadata #>> '{electronicBilling,customer,lastName}'), '')),
                'identificationType', document.metadata #>> '{electronicBilling,customer,identification,typeCode}',
                'identificationNumber', document.metadata #>> '{electronicBilling,customer,identification,number}',
                'address', document.metadata #>> '{electronicBilling,customer,address}',
                'country', document.metadata #>> '{electronicBilling,customer,metadata,countryName}',
                'department', document.metadata #>> '{electronicBilling,customer,metadata,departmentName}',
                'municipality', COALESCE(document.metadata #>> '{electronicBilling,customer,metadata,cityName}', document.metadata #>> '{electronicBilling,customer,municipalityCode}'),
                'phone', document.metadata #>> '{electronicBilling,customer,phone}',
                'email', document.metadata #>> '{electronicBilling,customer,email}',
                'taxRegime', document.metadata #>> '{electronicBilling,customer,taxProfile,taxScheme}',
                'fiscalResponsibilityCodes', COALESCE(document.metadata #> '{electronicBilling,customer,taxProfile,fiscalResponsibilityCodes}', '[]'::jsonb)
              ) ELSE NULL END AS "customerFiscalSnapshot",
              CASE WHEN document.metadata #> '{electronicBilling,fiscalIssuerSnapshot}' IS NOT NULL THEN
                document.metadata #> '{electronicBilling,fiscalIssuerSnapshot}'
              ELSE NULL END AS "fiscalIssuerSnapshot",
              COALESCE((SELECT jsonb_agg(jsonb_build_object('type', tax.tax_type, 'code', tax.tax_code, 'rate', tax.rate, 'taxableBase', tax.taxable_base, 'amount', tax.tax_amount) ORDER BY tax.created_at, tax.id) FROM electronic_document_taxes tax WHERE tax.electronic_document_id = document.id), '[]'::jsonb) AS "taxLines",
              COALESCE(
                document.metadata #>> '{electronicBilling,qrPayload}',
                document.metadata #>> '{electronicBillingProcessing,qrPayload}',
                document.metadata #>> '{providerResponse,qrPayload}'
              ) AS "qrPayload",
              (document.status = 'ACCEPTED'
               AND COALESCE(document.full_number, CONCAT(COALESCE(document.prefix, ''), document.number::TEXT)) IS NOT NULL
               AND document.metadata #> '{electronicBilling,fiscalIssuerSnapshot}' IS NOT NULL) AS "representationAvailable"
         FROM sales AS s
         INNER JOIN electronic_documents AS document
           ON document.tenant_id = s.tenant_id
          AND document.source_type = 'SALE'
          AND document.source_id = s.id::TEXT
        WHERE s.id = $1 AND s.tenant_id = $2
          AND ($3 = 'SUPER_ADMIN' OR $4::UUID IS NULL OR s.branch_id = $4::UUID)
        ORDER BY document.created_at DESC
        LIMIT 2`,
      [saleId, actor.tenantId, actor.role, actor.branchId]
    );
    if (result.rows.length > 1) {
      throw new Error("sale has ambiguous electronic documents");
    }
    const document = result.rows[0];
    if (!document) return null;
    return {
      ...document,
      customerFiscalSnapshot: document.customerFiscalSnapshot
        ? {
            ...document.customerFiscalSnapshot,
            fiscalResponsibilityCodes: Array.isArray(document.customerFiscalSnapshot.fiscalResponsibilityCodes)
              ? document.customerFiscalSnapshot.fiscalResponsibilityCodes.filter((code): code is string => typeof code === "string")
              : [],
          }
        : null,
      fiscalIssuerSnapshot: document.fiscalIssuerSnapshot
        ? {
            name: String(document.fiscalIssuerSnapshot.name ?? ""),
            identificationType: document.fiscalIssuerSnapshot.identificationType ?? null,
            identificationNumber: document.fiscalIssuerSnapshot.identificationNumber ?? null,
            verificationDigit: document.fiscalIssuerSnapshot.verificationDigit ?? null,
            address: document.fiscalIssuerSnapshot.address ?? null,
            country: document.fiscalIssuerSnapshot.country ?? null,
            department: document.fiscalIssuerSnapshot.department ?? null,
            municipality: document.fiscalIssuerSnapshot.municipality ?? null,
            phone: document.fiscalIssuerSnapshot.phone ?? null,
            email: document.fiscalIssuerSnapshot.email ?? null,
          }
        : null,
      taxLines: Array.isArray(document.taxLines)
        ? document.taxLines.map((tax) => ({
            type: String(tax.type ?? "TAX"),
            code: tax.code == null ? null : String(tax.code),
            rate: Number(tax.rate ?? 0),
            taxableBase: Number(tax.taxableBase ?? 0),
            amount: Number(tax.amount ?? 0),
          }))
        : [],
      qrPayload: document.qrPayload ?? null,
    };
  }

  async getSaleCancelTicket(
    actor: ReportActorContext,
    saleId: string
  ): Promise<PosSaleCancelTicketDataset | null> {
    return this.functionRunnerService.executeFunction<PosSaleCancelTicketDataset | null>(
      "report_pos_sale_cancel_ticket",
      [actor.userId, actor.role, actor.tenantId, actor.branchId, saleId]
    );
  }
}
