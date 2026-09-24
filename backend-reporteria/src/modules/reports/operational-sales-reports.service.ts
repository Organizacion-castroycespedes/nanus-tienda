import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import ExcelJS from "exceljs";
import type { ReportUser } from "../auth/report-auth.types";
import { PdfmakeEngine } from "../pdf/pdfmake.engine";
import { buildOperationalSalesReportLayout } from "../pdf/templates/reports/operational-sales-report.template";
import { DocumentExportService } from "./document-export.service";
import { SalesReportAdapter } from "./sql-adapters/sales-report.adapter";
import { OperationalSalesReportAdapter } from "./sql-adapters/operational-sales-report.adapter";
import { OperationalSalesReportScopeService } from "./operational-sales-report-scope.service";
import type { OperationalSalesReportDataset, OperationalSalesReportQuery } from "./types/operational-sales-report.types";

@Injectable()
export class OperationalSalesReportsService {
  constructor(
    @Inject(OperationalSalesReportScopeService)
    private readonly scope: OperationalSalesReportScopeService,
    @Inject(OperationalSalesReportAdapter)
    private readonly adapter: OperationalSalesReportAdapter,
    @Inject(DocumentExportService) private readonly exporter: DocumentExportService,
    @Inject(PdfmakeEngine) private readonly pdf: PdfmakeEngine,
    @Inject(SalesReportAdapter) private readonly branding: SalesReportAdapter,
  ) {}

  private normalize(input: OperationalSalesReportQuery): OperationalSalesReportQuery {
    const result = { ...input };
    for (const key of Object.keys(result) as Array<keyof OperationalSalesReportQuery>) {
      const value = result[key];
      if (typeof value === "string") (result[key] as string) = value.trim() as never;
    }
    if (result.dateFrom && result.dateTo && result.dateTo < result.dateFrom) throw new BadRequestException("dateTo must be greater than or equal to dateFrom");
    result.sortBy = ["createdAt", "total", "status"].includes(result.sortBy ?? "") ? result.sortBy : "createdAt";
    result.sortDirection = result.sortDirection === "ASC" ? "ASC" : "DESC";
    return result;
  }

  private async dataset(query: OperationalSalesReportQuery, user: ReportUser | undefined, posSessionId?: string): Promise<OperationalSalesReportDataset> {
    if (!user) throw new BadRequestException("report actor is required");
    const normalized = this.normalize(query);
    const resolved = await this.scope.resolve(user, normalized, posSessionId);
    const rows = await this.exporter.collect((client) => this.adapter.count(resolved, normalized, client), (client, offset, limit) => this.adapter.batch(resolved, normalized, client, offset, limit));
    const branchId = resolved.branchIds.length === 1 ? resolved.branchIds[0] : null;
    const actor = { userId: user.id, role: user.roles[0] ?? "USER", tenantId: user.tenantId, branchId, email: user.email ?? null };
    return { rows, query: normalized, branding: await this.branding.getPrintableCompany(actor) };
  }

  async getPdf(query: OperationalSalesReportQuery, user?: ReportUser, posSessionId?: string) { return this.pdf.generatePdf(buildOperationalSalesReportLayout(await this.dataset(query, user, posSessionId))); }

  async getExcel(query: OperationalSalesReportQuery, user?: ReportUser, posSessionId?: string) {
    const dataset = await this.dataset(query, user, posSessionId);
    const workbook = new ExcelJS.Workbook();
    const summary = workbook.addWorksheet("Resumen");
    summary.addRows([[dataset.branding.legalName ?? dataset.branding.tenantName ?? ""], [dataset.branding.nit ? `NIT ${dataset.branding.nit}` : ""], ["Reporte", "Ventas operativas"], ["Registros", dataset.rows.length], ["Total", dataset.rows.reduce((sum, row) => sum + row.total, 0)]]);
    const sheet = workbook.addWorksheet("Ventas", { views: [{ state: "frozen", ySplit: 1 }] });
    sheet.columns = [{ header: "Venta", key: "id", width: 38 }, { header: "Fecha", key: "createdAt", width: 22 }, { header: "Cliente", key: "customerName", width: 28 }, { header: "Sucursal", key: "branchName", width: 24 }, { header: "Estado", key: "status", width: 18 }, { header: "Estado pago", key: "paymentStatus", width: 18 }, { header: "Facturación electrónica", key: "electronicBillingStatus", width: 28 }, { header: "Documento", key: "electronicDocumentNumber", width: 24 }, { header: "Total", key: "total", width: 16 }];
    dataset.rows.forEach((row) => sheet.addRow(row));
    sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } }; sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F4E78" } }; sheet.getColumn("total").numFmt = "#,##0.00"; sheet.getColumn("createdAt").numFmt = "yyyy-mm-dd hh:mm";
    return workbook.xlsx.writeBuffer() as unknown as Promise<Buffer>;
  }
}
