import { Inject, Injectable } from "@nestjs/common";
import { DatabaseService } from "../../database/database.service";
import { FunctionRunnerService } from "../../database/function-runner.service";
import type {
  PosSaleCancelTicketDataset,
  PosSaleTicketDataset,
  PosSalesListDataset,
  ReportActorContext,
} from "../types/sales-report.types";
import type { ElectronicInvoiceReadModel } from "../types/electronic-invoice-representation.types";

type SalesListParams = {
  tenantId?: string;
  branchId?: string;
  dateFrom?: string;
  dateTo?: string;
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
    const dataset = await this.functionRunnerService.executeFunction<PosSalesListDataset | null>(
      "report_pos_sales",
      [
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
    if (!dataset?.rows?.length) {
      return dataset;
    }
    const saleIds = dataset.rows.map((row) => row.saleId);
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
                  EXISTS (
                    SELECT 1 FROM integration_outbox_events event
                    WHERE event.tenant_id = s.tenant_id
                      AND event.source_type = 'SALE'
                      AND event.source_id = s.id
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
      ...dataset,
      rows: dataset.rows.map((row) => {
        const document = billingBySale.get(row.saleId);
        const mode = process.env.ELECTRONIC_BILLING_MODE?.trim().toUpperCase();
        const isEligibleOnDemand =
          mode === "ON_DEMAND" &&
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

  async getSaleTicket(
    actor: ReportActorContext,
    saleId: string
  ): Promise<PosSaleTicketDataset | null> {
    return this.functionRunnerService.executeFunction<PosSaleTicketDataset | null>(
      "report_pos_sale_ticket",
      [actor.userId, actor.role, actor.tenantId, actor.branchId, saleId]
    );
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
              (document.status = 'ACCEPTED' AND COALESCE(document.full_number, CONCAT(COALESCE(document.prefix, ''), document.number::TEXT)) IS NOT NULL) AS "representationAvailable"
         FROM sales AS s
         INNER JOIN electronic_documents AS document
           ON document.tenant_id = s.tenant_id
          AND document.source_type = 'SALE'
          AND document.source_id = s.id
        WHERE s.id = $1 AND s.tenant_id = $2
          AND ($3 = 'SUPER_ADMIN' OR $4::UUID IS NULL OR s.branch_id = $4::UUID)
        ORDER BY document.created_at DESC
        LIMIT 2`,
      [saleId, actor.tenantId, actor.role, actor.branchId]
    );
    if (result.rows.length > 1) {
      throw new Error("sale has ambiguous electronic documents");
    }
    return result.rows[0] ?? null;
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
