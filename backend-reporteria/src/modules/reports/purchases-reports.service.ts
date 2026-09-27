import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import ExcelJS from "exceljs";
import type { ReportUser } from "../auth/report-auth.types";
import { PdfmakeEngine } from "../pdf/pdfmake.engine";
import { buildPurchasesReportLayout } from "../pdf/templates/reports/purchases-report.template";
import { buildPurchaseTicketTemplate } from "../pdf/templates/tickets/purchase-ticket.template";
import { PurchasesReportAdapter } from "./sql-adapters/purchases-report.adapter";
import { SalesReportAdapter } from "./sql-adapters/sales-report.adapter";
import { DocumentExportService } from "./document-export.service";
import type {
  PurchaseReportListRow,
  PurchaseTicketDataset,
  PurchasesReportListDataset,
  ReportActorContext,
} from "./types/purchases-report.types";
import type { PrintableCompanyHeader } from "./types/sales-report.types";
import { formatReportDateTime, REPORT_TIME_ZONE, resolveReportDateRange, type ReportDateRange } from "./report-date-range";

type PurchasesListQuery = {
  tenantId?: string;
  branchId?: string;
  dateFrom?: string;
  dateTo?: string;
  status?: string;
  supplierInvoiceNumber?: string;
  format?: string;
};

const ROLE_PRIORITY = ["SUPER_ADMIN", "SUPER_USER", "ADMIN", "USER"];

@Injectable()
export class PurchasesReportsService {
  constructor(
    @Inject(PurchasesReportAdapter)
    private readonly purchasesReportAdapter: PurchasesReportAdapter,
    @Inject(PdfmakeEngine)
    private readonly pdfEngine: PdfmakeEngine,
    @Inject(DocumentExportService)
    private readonly documentExport: DocumentExportService,
    @Inject(SalesReportAdapter)
    private readonly salesReportAdapter: SalesReportAdapter,
  ) {}

  private pickActorRole(roles: string[]): string {
    for (const role of ROLE_PRIORITY) {
      if (roles.some((item) => item.toUpperCase() === role)) {
        return role;
      }
    }

    return roles[0]?.toUpperCase() ?? "USER";
  }

  private resolveActor(user?: ReportUser): ReportActorContext {
    if (!user?.id || !user.tenantId) {
      throw new BadRequestException("report actor is required");
    }

    return {
      userId: user.id,
      role: this.pickActorRole(user.roles),
      tenantId: user.tenantId,
      branchId: user.branchId ?? null,
      email: user.email ?? null,
    };
  }

  private resolveDates(query: PurchasesListQuery): ReportDateRange {
    return resolveReportDateRange(query);
  }

  private toNumber(value: unknown) {
    return Number(value ?? 0);
  }

  private normalizePurchaseRow(row: PurchaseReportListRow): PurchaseReportListRow {
    return {
      ...row,
      total: this.toNumber(row.total),
      totalPedido: this.toNumber(row.totalPedido ?? row.total),
      totalLiquidado: this.toNumber(row.totalLiquidado ?? row.total),
      diferenciaNoRecibida: this.toNumber(row.diferenciaNoRecibida),
      paid: this.toNumber(row.paid),
      balance: this.toNumber(row.balance),
      branchId: row.branchId ?? null,
      branchName: row.branchName ?? null,
    };
  }

  private normalizePurchasesListDataset(
    payload: PurchasesReportListDataset | null,
    actor: ReportActorContext,
    query: PurchasesListQuery
  ): PurchasesReportListDataset {
    const dates = this.resolveDates(query);
    const filters = {
      tenantId: payload?.filters?.tenantId ?? query.tenantId ?? actor.tenantId,
      branchId: payload?.filters?.branchId ?? query.branchId ?? actor.branchId ?? null,
      dateFrom: payload?.filters?.dateFrom ?? dates.dateFrom,
      dateTo: payload?.filters?.dateTo ?? dates.dateTo,
      status: payload?.filters?.status ?? query.status ?? null,
      supplierInvoiceNumber: payload?.filters?.supplierInvoiceNumber ?? query.supplierInvoiceNumber ?? null,
      actorRole: payload?.filters?.actorRole ?? actor.role,
    };

    const rows = Array.isArray(payload?.rows)
      ? payload.rows.map((row) => this.normalizePurchaseRow(row))
      : [];

    return {
      filters,
      rows,
      summary: {
        count: this.toNumber(payload?.summary?.count ?? rows.length),
        activeCount: this.toNumber(
          payload?.summary?.activeCount ?? rows.filter((row) => row.status !== "CANCELLED").length
        ),
        cancelled: this.toNumber(
          payload?.summary?.cancelled ?? rows.filter((row) => row.status === "CANCELLED").length
        ),
        total: this.toNumber(payload?.summary?.total ?? rows.reduce((sum, row) => sum + row.total, 0)),
        totalNoRecibido: this.toNumber(
          payload?.summary?.totalNoRecibido ??
            rows.reduce((sum, row) => sum + (row.diferenciaNoRecibida ?? 0), 0)
        ),
        paid: this.toNumber(payload?.summary?.paid ?? rows.reduce((sum, row) => sum + row.paid, 0)),
        balance: this.toNumber(
          payload?.summary?.balance ?? rows.reduce((sum, row) => sum + row.balance, 0)
        ),
      },
    };
  }

  private normalizePurchaseTicketDataset(payload: PurchaseTicketDataset | null) {
    if (!payload) {
      throw new NotFoundException("purchase not found");
    }

    return {
      ...payload,
      items: (payload.items ?? []).map((item) => ({
        ...item,
        quantity: this.toNumber(item.quantity),
        receivedQuantity: this.toNumber(item.receivedQuantity),
        unreceivedQuantity: this.toNumber(item.unreceivedQuantity),
        unitCost: this.toNumber(item.unitCost),
        subtotal: this.toNumber(item.subtotal),
        receivedSubtotal: this.toNumber(item.receivedSubtotal),
        unreceivedSubtotal: this.toNumber(item.unreceivedSubtotal),
      })),
      totals: {
        total: this.toNumber(payload.totals?.total),
        totalPedido: this.toNumber(payload.totals?.totalPedido),
        totalRecibido: this.toNumber(payload.totals?.totalRecibido),
        totalLiquidado: this.toNumber(payload.totals?.totalLiquidado),
        diferenciaNoRecibida: this.toNumber(payload.totals?.diferenciaNoRecibida),
        paid: this.toNumber(payload.totals?.paid),
        balance: this.toNumber(payload.totals?.balance),
      },
      payments: (payload.payments ?? []).map((payment) => ({
        ...payment,
        amount: this.toNumber(payment.amount),
      })),
    };
  }

  async getPurchases(query: PurchasesListQuery, user?: ReportUser) {
    const actor = this.resolveActor(user);
    const dates = this.resolveDates(query);
    const dateFrom = dates.dateFrom;
    const dateTo = dates.dateTo;
    const payload = await this.purchasesReportAdapter.getPurchasesList(actor, {
      tenantId: query.tenantId,
      branchId: query.branchId,
      dateFrom,
      dateTo,
      status: this.normalizeStatus(query.status),
      supplierInvoiceNumber: query.supplierInvoiceNumber?.trim() || undefined,
    });

    return this.normalizePurchasesListDataset(payload, actor, query);
  }

  async getPurchasesPdf(query: PurchasesListQuery, user?: ReportUser) {
    const dataset = await this.createPurchasesDocumentDataset(query, user);
    return this.pdfEngine.generatePdf(buildPurchasesReportLayout(dataset));
  }

  async getPurchasesExcel(query: PurchasesListQuery, user?: ReportUser) {
    const dataset = await this.createPurchasesDocumentDataset(query, user);
    return this.buildPurchasesExcel(dataset);
  }

  private normalizeStatus(value: string | undefined) {
    const status = value?.trim().toUpperCase() || undefined;
    if (status && !["DRAFT", "PENDING", "PARTIAL", "RECEIVED", "CERRADA_PARCIAL", "CANCELLED"].includes(status)) {
      throw new BadRequestException("invalid purchase status filter");
    }
    return status;
  }

  private async createPurchasesDocumentDataset(query: PurchasesListQuery, user?: ReportUser) {
    const actor = this.resolveActor(user);
    const dates = this.resolveDates(query);
    const filters = {
      tenantId: query.tenantId,
      branchId: query.branchId,
      dateFrom: dates.dateFrom,
      dateTo: dates.dateTo,
      status: this.normalizeStatus(query.status),
      supplierInvoiceNumber: query.supplierInvoiceNumber?.trim() || undefined,
    };
    const rows = await this.documentExport.collect(
      (client) => this.purchasesReportAdapter.getPurchasesExportCount(actor, filters, client),
      (client, offset, limit) => this.purchasesReportAdapter.getPurchasesExportBatch(actor, filters, client, offset, limit),
    );
    const active = rows.filter((row) => row.status !== "CANCELLED");
    return {
      filters: { tenantId: filters.tenantId ?? actor.tenantId, branchId: filters.branchId ?? actor.branchId ?? null, dateFrom: filters.dateFrom ?? null, dateTo: filters.dateTo ?? null, status: filters.status ?? null, supplierInvoiceNumber: filters.supplierInvoiceNumber ?? null, actorRole: actor.role },
      rows,
      summary: {
        count: rows.length,
        activeCount: active.length,
        cancelled: rows.length - active.length,
        total: active.reduce((sum, row) => sum + row.total, 0),
        totalNoRecibido: active.reduce((sum, row) => sum + (row.diferenciaNoRecibida ?? 0), 0),
        paid: active.reduce((sum, row) => sum + row.paid, 0),
        balance: active.reduce((sum, row) => sum + row.balance, 0),
      },
      branding: await this.salesReportAdapter.getPrintableCompany(actor),
    };
  }

  private async buildPurchasesExcel(dataset: Awaited<ReturnType<PurchasesReportsService["createPurchasesDocumentDataset"]>>) {
    const workbook = new ExcelJS.Workbook();
    const info = workbook.addWorksheet("Resumen");
    info.addRows([
      [dataset.branding.legalName ?? dataset.branding.tenantName ?? ""],
      [dataset.branding.nit ? `NIT ${dataset.branding.nit}` : ""],
      [dataset.branding.address ?? ""],
      [dataset.branding.phone ?? "", dataset.branding.email ?? ""],
      ["Reporte", "Compras"],
      ["Tenant", dataset.branding.tenantName ?? dataset.filters.tenantId],
      ["Sucursal", dataset.branding.branchName ?? dataset.filters.branchId ?? "Todas"],
      ["Desde", dataset.filters.dateFrom ? formatReportDateTime(dataset.filters.dateFrom) : ""],
      ["Hasta", dataset.filters.dateTo ? formatReportDateTime(dataset.filters.dateTo) : ""],
      ["Zona horaria", REPORT_TIME_ZONE],
      ["Generado", formatReportDateTime(new Date())],
      ["Estado", dataset.filters.status ?? "Todos"],
      ["Compras", dataset.summary.count],
      ["Total", dataset.summary.total],
      ["Pagado", dataset.summary.paid],
      ["Saldo", dataset.summary.balance],
    ]);
    info.getColumn(1).width = 24;
    info.getColumn(2).width = 40;
    const sheet = workbook.addWorksheet("Compras", { views: [{ state: "frozen", ySplit: 1 }] });
    sheet.columns = [
      { header: "Fecha", key: "date", width: 22 }, { header: "Compra", key: "purchaseId", width: 38 },
      { header: "Proveedor", key: "supplierName", width: 28 }, { header: "Factura proveedor", key: "supplierInvoiceNumber", width: 24 },
      { header: "Fecha factura", key: "supplierInvoiceDate", width: 18 }, { header: "Sucursal", key: "branchName", width: 24 },
      { header: "Total", key: "total", width: 16 }, { header: "Total pedido", key: "totalPedido", width: 16 },
      { header: "Total liquidado", key: "totalLiquidado", width: 17 }, { header: "No recibido", key: "diferenciaNoRecibida", width: 16 },
      { header: "Pagado", key: "paid", width: 16 }, { header: "Saldo", key: "balance", width: 16 },
      { header: "Estado", key: "status", width: 18 }, { header: "Estado pago", key: "paymentStatus", width: 18 },
    ];
    dataset.rows.forEach((row) => sheet.addRow({ ...row, date: formatReportDateTime(row.date), supplierInvoiceDate: row.supplierInvoiceDate ?? null }));
    sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F4E78" } };
    ["total", "totalPedido", "totalLiquidado", "diferenciaNoRecibida", "paid", "balance"].forEach((key) => {
      sheet.getColumn(key).numFmt = "#,##0.00";
    });
    return workbook.xlsx.writeBuffer() as unknown as Promise<Buffer>;
  }

  async getPurchaseTicket(purchaseId: string, user?: ReportUser) {
    const actor = this.resolveActor(user);
    const payload = await this.purchasesReportAdapter.getPurchaseTicket(actor, purchaseId);
    return this.normalizePurchaseTicketDataset(payload);
  }

  async getPurchaseTicketPdf(purchaseId: string, user?: ReportUser) {
    const dataset = await this.getPurchaseTicket(purchaseId, user);
    return this.pdfEngine.generatePdf(buildPurchaseTicketTemplate(dataset));
  }
}
