import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import ExcelJS from "exceljs";
import type { ReportUser } from "../auth/report-auth.types";
import { PdfmakeEngine } from "../pdf/pdfmake.engine";
import { buildOrderSalesReportLayout } from "../pdf/templates/reports/order-sales-report.template";
import { buildOrderSaleTicketTemplate } from "../pdf/templates/tickets/order-sale-ticket.template";
import { OrdersReportAdapter } from "./sql-adapters/orders-report.adapter";
import { DocumentExportService } from "./document-export.service";
import { SalesReportAdapter } from "./sql-adapters/sales-report.adapter";
import { formatReportDateTime, REPORT_TIME_ZONE, resolveReportDateRange, type ReportDateRange } from "./report-date-range";
import type {
  OrderSaleTicketDataset,
  OrderSalesListDataset,
  OrderSalesListRow,
  ReportActorContext,
} from "./types/orders-report.types";

type OrdersListQuery = {
  tenantId?: string;
  branchId?: string;
  dateFrom?: string;
  dateTo?: string;
  customerDocument?: string;
  format?: string;
};

const ROLE_PRIORITY = ["SUPER_ADMIN", "SUPER_USER", "ADMIN", "USER"];

@Injectable()
export class OrdersReportsService {
  constructor(
    @Inject(OrdersReportAdapter)
    private readonly ordersReportAdapter: OrdersReportAdapter,
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

  private resolveDates(query: OrdersListQuery): ReportDateRange {
    return resolveReportDateRange(query);
  }

  private normalizeCustomerDocument(value: string | undefined) {
    const normalized = value?.trim().toUpperCase().replace(/[^0-9A-Z]/g, "");
    return normalized || undefined;
  }

  private toNumber(value: unknown) {
    return Number(value ?? 0);
  }

  private normalizeOrderRow(row: OrderSalesListRow): OrderSalesListRow {
    return {
      ...row,
      total: this.toNumber(row.total),
      paid: this.toNumber(row.paid),
      balance: this.toNumber(row.balance),
      branchId: row.branchId ?? null,
      branchName: row.branchName ?? null,
      generatedSaleId: row.generatedSaleId ?? null,
    };
  }

  private normalizeOrderSalesListDataset(
    payload: OrderSalesListDataset | null,
    actor: ReportActorContext,
    query: OrdersListQuery
  ): OrderSalesListDataset {
    const dates = this.resolveDates(query);
    const filters = {
      tenantId: payload?.filters?.tenantId ?? query.tenantId ?? actor.tenantId,
      branchId: payload?.filters?.branchId ?? query.branchId ?? actor.branchId ?? null,
      dateFrom: payload?.filters?.dateFrom ?? dates.dateFrom,
      dateTo: payload?.filters?.dateTo ?? dates.dateTo,
      customerDocument: payload?.filters?.customerDocument ?? this.normalizeCustomerDocument(query.customerDocument) ?? null,
      actorRole: payload?.filters?.actorRole ?? actor.role,
    };

    const rows = Array.isArray(payload?.rows)
      ? payload.rows.map((row) => this.normalizeOrderRow(row))
      : [];

    return {
      filters,
      rows,
      summary: {
        count: this.toNumber(payload?.summary?.count ?? rows.length),
        total: this.toNumber(payload?.summary?.total ?? rows.reduce((sum, row) => sum + row.total, 0)),
        paid: this.toNumber(payload?.summary?.paid ?? rows.reduce((sum, row) => sum + row.paid, 0)),
        balance: this.toNumber(
          payload?.summary?.balance ?? rows.reduce((sum, row) => sum + row.balance, 0)
        ),
        completed: this.toNumber(
          payload?.summary?.completed ?? rows.filter((row) => row.status === "COMPLETED").length
        ),
        partial: this.toNumber(
          payload?.summary?.partial ??
            rows.filter((row) => row.status === "PARTIAL" || row.paymentStatus === "PARTIAL").length
        ),
        pending: this.toNumber(
          payload?.summary?.pending ??
            rows.filter((row) =>
              ["DRAFT", "CONFIRMED"].includes(row.status) || row.paymentStatus === "PENDING"
            ).length
        ),
      },
    };
  }

  private normalizeOrderSaleTicketDataset(payload: OrderSaleTicketDataset | null) {
    if (!payload) {
      throw new NotFoundException("order not found");
    }

    return {
      ...payload,
      generatedSales: (payload.generatedSales ?? []).map((sale) => ({
        ...sale,
        total: this.toNumber(sale.total),
        paid: this.toNumber(sale.paid),
        balance: this.toNumber(sale.balance),
      })),
      items: (payload.items ?? []).map((item) => ({
        ...item,
        orderedQuantity: this.toNumber(item.orderedQuantity),
        deliveredQuantity: this.toNumber(item.deliveredQuantity),
        billedQuantity: this.toNumber(item.billedQuantity),
        unitPrice: this.toNumber(item.unitPrice),
        subtotal: this.toNumber(item.subtotal),
      })),
      payments: (payload.payments ?? []).map((payment) => ({
        ...payment,
        amount: this.toNumber(payment.amount),
      })),
      totals: {
        total: this.toNumber(payload.totals?.total),
        paid: this.toNumber(payload.totals?.paid),
        balance: this.toNumber(payload.totals?.balance),
      },
    };
  }

  async getOrderSales(query: OrdersListQuery, user?: ReportUser) {
    const actor = this.resolveActor(user);
    const dates = this.resolveDates(query);
    const payload = await this.ordersReportAdapter.getOrderSalesList(actor, {
      tenantId: query.tenantId,
      branchId: query.branchId,
      dateFrom: dates.dateFrom,
      dateTo: dates.dateTo,
      customerDocument: this.normalizeCustomerDocument(query.customerDocument),
    });

    return this.normalizeOrderSalesListDataset(payload, actor, query);
  }

  async getOrderSalesPdf(query: OrdersListQuery, user?: ReportUser) {
    const dataset = await this.createOrderSalesDocumentDataset(query, user);
    return this.pdfEngine.generatePdf(buildOrderSalesReportLayout(dataset));
  }

  async getOrderSalesExcel(query: OrdersListQuery, user?: ReportUser) {
    const dataset = await this.createOrderSalesDocumentDataset(query, user);
    return this.buildOrderSalesExcel(dataset);
  }

  private async createOrderSalesDocumentDataset(query: OrdersListQuery, user?: ReportUser) {
    const actor = this.resolveActor(user);
    const dates = this.resolveDates(query);
    const dateFrom = dates.dateFrom;
    const dateTo = dates.dateTo;
    const filters = { tenantId: query.tenantId, branchId: query.branchId, dateFrom, dateTo, customerDocument: this.normalizeCustomerDocument(query.customerDocument) };
    const rows = await this.documentExport.collect(
      (client) => this.ordersReportAdapter.getOrderSalesExportCount(actor, filters, client),
      (client, offset, limit) => this.ordersReportAdapter.getOrderSalesExportBatch(actor, filters, client, offset, limit),
    );
    return {
      filters: { tenantId: filters.tenantId ?? actor.tenantId, branchId: filters.branchId ?? actor.branchId ?? null, dateFrom: filters.dateFrom ?? null, dateTo: filters.dateTo ?? null, customerDocument: filters.customerDocument ?? null, actorRole: actor.role },
      rows,
      summary: {
        count: rows.length,
        total: rows.reduce((sum, row) => sum + row.total, 0),
        paid: rows.reduce((sum, row) => sum + row.paid, 0),
        balance: rows.reduce((sum, row) => sum + row.balance, 0),
        completed: rows.filter((row) => row.status === "COMPLETED").length,
        partial: rows.filter((row) => row.status === "PARTIAL" || row.paymentStatus === "PARTIAL").length,
        pending: rows.filter((row) => ["DRAFT", "CONFIRMED"].includes(row.status) || row.paymentStatus === "PENDING").length,
      },
      branding: await this.salesReportAdapter.getPrintableCompany(actor),
    };
  }

  private async buildOrderSalesExcel(dataset: Awaited<ReturnType<OrdersReportsService["createOrderSalesDocumentDataset"]>>) {
    const workbook = new ExcelJS.Workbook();
    const info = workbook.addWorksheet("Resumen");
    info.addRows([
      [dataset.branding.legalName ?? dataset.branding.tenantName ?? ""],
      [dataset.branding.nit ? `NIT ${dataset.branding.nit}` : ""],
      [dataset.branding.address ?? ""],
      [dataset.branding.phone ?? "", dataset.branding.email ?? ""],
      ["Reporte", "Pedidos"],
      ["Tenant", dataset.branding.tenantName ?? dataset.filters.tenantId],
      ["Sucursal", dataset.branding.branchName ?? dataset.filters.branchId ?? "Todas"],
      ["Desde", dataset.filters.dateFrom ? formatReportDateTime(dataset.filters.dateFrom) : ""],
      ["Hasta", dataset.filters.dateTo ? formatReportDateTime(dataset.filters.dateTo) : ""],
      ["Zona horaria", REPORT_TIME_ZONE],
      ["Generado", formatReportDateTime(new Date())],
      ["Documento cliente", dataset.filters.customerDocument ?? ""],
      ["Pedidos", dataset.summary.count], ["Completados", dataset.summary.completed], ["Parciales", dataset.summary.partial], ["Pendientes", dataset.summary.pending],
      ["Total", dataset.summary.total], ["Pagado", dataset.summary.paid], ["Saldo", dataset.summary.balance],
    ]);
    info.getColumn(1).width = 24;
    info.getColumn(2).width = 40;
    const sheet = workbook.addWorksheet("Pedidos", { views: [{ state: "frozen", ySplit: 1 }] });
    sheet.columns = [
      { header: "Fecha", key: "date", width: 22 }, { header: "Pedido", key: "orderId", width: 38 }, { header: "Cliente", key: "customerName", width: 28 },
      { header: "Venta generada", key: "generatedSaleId", width: 38 }, { header: "Sucursal", key: "branchName", width: 24 }, { header: "Total", key: "total", width: 16 },
      { header: "Pagado", key: "paid", width: 16 }, { header: "Saldo", key: "balance", width: 16 }, { header: "Estado", key: "status", width: 18 }, { header: "Estado pago", key: "paymentStatus", width: 18 },
    ];
    dataset.rows.forEach((row) => sheet.addRow({ ...row, date: formatReportDateTime(row.date), generatedSaleId: row.generatedSaleId ?? "" }));
    sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F4E78" } };
    ["total", "paid", "balance"].forEach((key) => { sheet.getColumn(key).numFmt = "#,##0.00"; });
    return workbook.xlsx.writeBuffer() as unknown as Promise<Buffer>;
  }

  async getOrderSaleTicket(orderId: string, user?: ReportUser) {
    const actor = this.resolveActor(user);
    const payload = await this.ordersReportAdapter.getOrderSaleTicket(actor, orderId);
    if (!payload && (await this.ordersReportAdapter.orderSaleExists(orderId))) {
      throw new ForbiddenException("order ticket is not authorized");
    }

    return this.normalizeOrderSaleTicketDataset(payload);
  }

  async getOrderSaleTicketPdf(orderId: string, user?: ReportUser) {
    const dataset = await this.getOrderSaleTicket(orderId, user);
    return this.pdfEngine.generatePdf(buildOrderSaleTicketTemplate(dataset));
  }
}
