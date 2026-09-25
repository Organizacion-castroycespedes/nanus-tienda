import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import ExcelJS from "exceljs";
import type { ReportUser } from "../auth/report-auth.types";
import { PdfmakeEngine } from "../pdf/pdfmake.engine";
import { buildCashAuditsReportLayout } from "../pdf/templates/reports/cash-audits-report.template";
import { buildCashClosingsReportLayout } from "../pdf/templates/reports/cash-closings-report.template";
import { buildCashAuditTicketTemplate } from "../pdf/templates/tickets/cash-audit-ticket.template";
import { buildCashClosingTicketTemplate } from "../pdf/templates/tickets/cash-closing-ticket.template";
import { CashReportAdapter } from "./sql-adapters/cash-report.adapter";
import { DocumentExportService } from "./document-export.service";
import type {
  CashAuditListDataset,
  CashAuditListRow,
  CashAuditTicketDataset,
  CashClosingListDataset,
  CashClosingListRow,
  CashClosingTicketDataset,
  ReportActorContext,
} from "./types/cash-report.types";
import type { PrintableCompanyHeader } from "./types/sales-report.types";

type CashListQuery = {
  tenantId?: string;
  branchId?: string;
  dateFrom?: string;
  dateTo?: string;
  format?: string;
};

const ROLE_PRIORITY = ["SUPER_ADMIN", "SUPER_USER", "ADMIN", "USER"];

@Injectable()
export class CashReportsService {
  constructor(
    @Inject(CashReportAdapter)
    private readonly cashReportAdapter: CashReportAdapter,
    @Inject(PdfmakeEngine)
    private readonly pdfEngine: PdfmakeEngine,
    @Inject(DocumentExportService)
    private readonly documentExport: DocumentExportService
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

  private normalizeDate(value: string | undefined, endExclusive = false) {
    if (!value) {
      return undefined;
    }

    const normalized = value.trim();
    if (!normalized) {
      return undefined;
    }

    if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
      const date = new Date(`${normalized}T00:00:00.000Z`);
      if (Number.isNaN(date.getTime())) {
        throw new BadRequestException(`invalid date value: ${value}`);
      }

      if (endExclusive) {
        date.setUTCDate(date.getUTCDate() + 1);
      }

      return date.toISOString();
    }

    const date = new Date(normalized);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException(`invalid date value: ${value}`);
    }

    return date.toISOString();
  }

  private toNumber(value: unknown) {
    return Number(value ?? 0);
  }

  private normalizePaymentBreakdown(
    items: CashClosingTicketDataset["paymentBreakdown"] | null | undefined
  ): CashClosingTicketDataset["paymentBreakdown"] {
    return (items ?? []).map((item) => ({
      ...item,
      count: this.toNumber(item.count),
      total: this.toNumber(item.total),
    }));
  }

  private emptyDeliverySummary(): CashClosingTicketDataset["deliverySummary"] {
    return {
      deliveredCount: 0,
      pendingCount: 0,
      excludedCount: 0,
      deliveredFeeTotal: 0,
      byPaymentMethod: [],
    };
  }

  private normalizeDeliverySummary(
    summary: CashClosingTicketDataset["deliverySummary"] | null | undefined
  ): CashClosingTicketDataset["deliverySummary"] {
    const fallback = this.emptyDeliverySummary();
    return {
      deliveredCount: this.toNumber(summary?.deliveredCount ?? fallback.deliveredCount),
      pendingCount: this.toNumber(summary?.pendingCount ?? fallback.pendingCount),
      excludedCount: this.toNumber(summary?.excludedCount ?? fallback.excludedCount),
      deliveredFeeTotal: this.toNumber(
        summary?.deliveredFeeTotal ?? fallback.deliveredFeeTotal
      ),
      byPaymentMethod: (summary?.byPaymentMethod ?? []).map((item) => ({
        paymentMethodId: item.paymentMethodId ?? null,
        paymentMethodNombre: item.paymentMethodNombre ?? null,
        count: this.toNumber(item.count),
        total: this.toNumber(item.total),
      })),
    };
  }

  private normalizeCashClosingRow(row: CashClosingListRow): CashClosingListRow {
    return {
      ...row,
      openingAmount: this.toNumber(row.openingAmount),
      totalIn: this.toNumber(row.totalIn),
      totalOut: this.toNumber(row.totalOut),
      expectedAmount: this.toNumber(row.expectedAmount),
      closingAmount: this.toNumber(row.closingAmount),
      difference: this.toNumber(row.difference),
    };
  }

  private normalizeCashAuditRow(row: CashAuditListRow): CashAuditListRow {
    return {
      ...row,
      countedAmount: this.toNumber(row.countedAmount),
      expectedAmount: this.toNumber(row.expectedAmount),
      difference: this.toNumber(row.difference),
    };
  }

  private normalizeCashClosingsListDataset(
    payload: CashClosingListDataset | null,
    actor: ReportActorContext,
    query: CashListQuery
  ): CashClosingListDataset {
    const filters = {
      tenantId: payload?.filters?.tenantId ?? query.tenantId ?? actor.tenantId,
      branchId: payload?.filters?.branchId ?? query.branchId ?? actor.branchId ?? null,
      dateFrom: payload?.filters?.dateFrom ?? this.normalizeDate(query.dateFrom) ?? null,
      dateTo: payload?.filters?.dateTo ?? this.normalizeDate(query.dateTo, true) ?? null,
      actorRole: payload?.filters?.actorRole ?? actor.role,
    };

    const rows = Array.isArray(payload?.rows)
      ? payload.rows.map((row) => this.normalizeCashClosingRow(row))
      : [];

    return {
      filters,
      rows,
      summary: {
        count: this.toNumber(payload?.summary?.count ?? rows.length),
        openingAmount: this.toNumber(
          payload?.summary?.openingAmount ?? rows.reduce((sum, row) => sum + row.openingAmount, 0)
        ),
        totalIn: this.toNumber(
          payload?.summary?.totalIn ?? rows.reduce((sum, row) => sum + row.totalIn, 0)
        ),
        totalOut: this.toNumber(
          payload?.summary?.totalOut ?? rows.reduce((sum, row) => sum + row.totalOut, 0)
        ),
        expectedAmount: this.toNumber(
          payload?.summary?.expectedAmount ?? rows.reduce((sum, row) => sum + row.expectedAmount, 0)
        ),
        closingAmount: this.toNumber(
          payload?.summary?.closingAmount ?? rows.reduce((sum, row) => sum + row.closingAmount, 0)
        ),
        difference: this.toNumber(
          payload?.summary?.difference ?? rows.reduce((sum, row) => sum + row.difference, 0)
        ),
      },
    };
  }

  private normalizeCashAuditsListDataset(
    payload: CashAuditListDataset | null,
    actor: ReportActorContext,
    query: CashListQuery
  ): CashAuditListDataset {
    const filters = {
      tenantId: payload?.filters?.tenantId ?? query.tenantId ?? actor.tenantId,
      branchId: payload?.filters?.branchId ?? query.branchId ?? actor.branchId ?? null,
      dateFrom: payload?.filters?.dateFrom ?? this.normalizeDate(query.dateFrom) ?? null,
      dateTo: payload?.filters?.dateTo ?? this.normalizeDate(query.dateTo, true) ?? null,
      actorRole: payload?.filters?.actorRole ?? actor.role,
    };

    const rows = Array.isArray(payload?.rows)
      ? payload.rows.map((row) => this.normalizeCashAuditRow(row))
      : [];
    const scopedRows = actor.role === "USER"
      ? rows.filter((row) => row.countedByUserId === actor.userId)
      : rows;
    const summaryRows = actor.role === "USER" ? scopedRows : rows;

    return {
      filters,
      rows: scopedRows,
      summary: {
        count: actor.role === "USER"
          ? summaryRows.length
          : this.toNumber(payload?.summary?.count ?? rows.length),
        countedAmount: this.toNumber(
          actor.role === "USER"
            ? summaryRows.reduce((sum, row) => sum + row.countedAmount, 0)
            : payload?.summary?.countedAmount ?? rows.reduce((sum, row) => sum + row.countedAmount, 0)
        ),
        expectedAmount: this.toNumber(
          actor.role === "USER"
            ? summaryRows.reduce((sum, row) => sum + row.expectedAmount, 0)
            : payload?.summary?.expectedAmount ?? rows.reduce((sum, row) => sum + row.expectedAmount, 0)
        ),
        difference: this.toNumber(
          actor.role === "USER"
            ? summaryRows.reduce((sum, row) => sum + row.difference, 0)
            : payload?.summary?.difference ?? rows.reduce((sum, row) => sum + row.difference, 0)
        ),
      },
    };
  }

  private normalizeCashClosingTicketDataset(
    payload: CashClosingTicketDataset | null,
    deliverySummaryInput?: CashClosingTicketDataset["deliverySummary"],
    paymentSummaryInput?: Pick<
      CashClosingTicketDataset,
      "cashControl" | "sourceBreakdown" | "paymentMethodDetails" | "auditSummary"
    > | null
  ): CashClosingTicketDataset {
    if (!payload) {
      throw new NotFoundException("cash session not found");
    }

    const deliverySummary = this.normalizeDeliverySummary(
      deliverySummaryInput ?? payload.deliverySummary
    );
    const deliveryFees = this.toNumber(deliverySummary.deliveredFeeTotal);
    const closingAmount = this.toNumber(payload.totals?.closingAmount);
    const fallbackExpected = this.toNumber(payload.totals?.expectedAmount) + deliveryFees;
    const expectedAmount =
      paymentSummaryInput?.cashControl?.expectedCashAmount ?? fallbackExpected;
    const difference = closingAmount - expectedAmount;
    const cashControl = paymentSummaryInput?.cashControl
      ? {
          ...paymentSummaryInput.cashControl,
          countedCashAmount: closingAmount,
          differenceAmount: difference,
        }
      : undefined;

    return {
      ...payload,
      totals: {
        openingAmount: this.toNumber(payload.totals?.openingAmount),
        posSalesPayments: this.toNumber(payload.totals?.posSalesPayments),
        orderSalesPayments: this.toNumber(payload.totals?.orderSalesPayments),
        totalIn: this.toNumber(payload.totals?.totalIn) + deliveryFees,
        paymentsIn: this.toNumber(payload.totals?.paymentsIn),
        paymentsOut: this.toNumber(payload.totals?.paymentsOut),
        refundPayments: this.toNumber(payload.totals?.refundPayments),
        purchasePayments: this.toNumber(payload.totals?.purchasePayments),
        expenses: this.toNumber(payload.totals?.expenses),
        withdrawals: this.toNumber(payload.totals?.withdrawals),
        adjustmentsIn: this.toNumber(payload.totals?.adjustmentsIn),
        adjustmentsOut: this.toNumber(payload.totals?.adjustmentsOut),
        closingRecorded: this.toNumber(payload.totals?.closingRecorded),
        totalOut: this.toNumber(payload.totals?.totalOut),
        expectedAmount,
        closingAmount,
        difference,
      },
      paymentBreakdown: this.normalizePaymentBreakdown(payload.paymentBreakdown),
      paymentMethodDetails: paymentSummaryInput?.paymentMethodDetails?.map((item) => ({
        ...item,
        count: this.toNumber(item.count),
        sales: this.toNumber(item.sales),
        orders: this.toNumber(item.orders),
        purchases: this.toNumber(item.purchases),
        refunds: this.toNumber(item.refunds),
        deliveries: this.toNumber(item.deliveries),
        manualIn: this.toNumber(item.manualIn),
        manualOut: this.toNumber(item.manualOut),
        otherIn: this.toNumber(item.otherIn),
        otherOut: this.toNumber(item.otherOut),
        totalIn: this.toNumber(item.totalIn),
        totalOut: this.toNumber(item.totalOut),
        net: this.toNumber(item.net),
      })),
      sourceBreakdown: paymentSummaryInput?.sourceBreakdown,
      cashControl,
      auditSummary: paymentSummaryInput?.auditSummary,
      deliverySummary,
      movementBreakdown: (payload.movementBreakdown ?? []).map((item) => ({
        ...item,
        count: this.toNumber(item.count),
        total: this.toNumber(item.total),
      })),
      recentMovements: (payload.recentMovements ?? []).map((item) => ({
        ...item,
        amount: this.toNumber(item.amount),
      })),
      lastCount: payload.lastCount
        ? {
            ...payload.lastCount,
            countedCashAmount: this.toNumber(payload.lastCount.countedCashAmount),
            expectedAmount: this.toNumber(payload.lastCount.expectedAmount),
            differenceAmount: this.toNumber(payload.lastCount.differenceAmount),
          }
        : null,
    };
  }

  private normalizeCashAuditTicketDataset(payload: CashAuditTicketDataset | null) {
    if (!payload) {
      throw new NotFoundException("cash count not found");
    }

    return {
      ...payload,
      audit: {
        countedAmount: this.toNumber(payload.audit?.countedAmount),
        expectedAmount: this.toNumber(payload.audit?.expectedAmount),
        difference: this.toNumber(payload.audit?.difference),
        notes: payload.audit?.notes ?? null,
      },
      sessionTotals: {
        openingAmount: this.toNumber(payload.sessionTotals?.openingAmount),
        posSalesPayments: this.toNumber(payload.sessionTotals?.posSalesPayments),
        orderSalesPayments: this.toNumber(payload.sessionTotals?.orderSalesPayments),
        refundPayments: this.toNumber(payload.sessionTotals?.refundPayments),
        expectedAmount: this.toNumber(payload.sessionTotals?.expectedAmount),
      },
    };
  }

  async getCashClosings(query: CashListQuery, user?: ReportUser) {
    const actor = this.resolveActor(user);
    const payload = await this.cashReportAdapter.getCashClosingsList(actor, {
      tenantId: query.tenantId,
      branchId: query.branchId,
      dateFrom: this.normalizeDate(query.dateFrom),
      dateTo: this.normalizeDate(query.dateTo, true),
    });

    return this.normalizeCashClosingsListDataset(payload, actor, query);
  }

  async getCashClosingsPdf(query: CashListQuery, user?: ReportUser) {
    const dataset = await this.createCashClosingsDataset(query, user);
    return this.pdfEngine.generatePdf(buildCashClosingsReportLayout(dataset));
  }

  async getCashClosingsExcel(query: CashListQuery, user?: ReportUser) {
    const dataset = await this.createCashClosingsDataset(query, user);
    return this.buildCashClosingsExcel(dataset);
  }

  async getCashClosingTicket(cashSessionId: string, user?: ReportUser) {
    const actor = this.resolveActor(user);
    const payload = await this.cashReportAdapter.getCashClosingTicket(actor, cashSessionId);
    const deliverySummary = payload
      ? await this.cashReportAdapter.getDeliveryClosingSummary(actor, cashSessionId)
      : this.emptyDeliverySummary();
    const paymentSummary = payload
      ? await this.cashReportAdapter.getPaymentMethodClosingSummary(actor, cashSessionId)
      : null;
    return this.normalizeCashClosingTicketDataset(
      payload,
      deliverySummary,
      paymentSummary
    );
  }

  async getCashClosingTicketPdf(cashSessionId: string, user?: ReportUser) {
    const dataset = await this.getCashClosingTicket(cashSessionId, user);
    return this.pdfEngine.generatePdf(buildCashClosingTicketTemplate(dataset));
  }

  async getCashAudits(query: CashListQuery, user?: ReportUser) {
    const actor = this.resolveActor(user);
    const payload = await this.cashReportAdapter.getCashAuditList(actor, {
      tenantId: query.tenantId,
      branchId: query.branchId,
      dateFrom: this.normalizeDate(query.dateFrom),
      dateTo: this.normalizeDate(query.dateTo, true),
    });

    return this.normalizeCashAuditsListDataset(payload, actor, query);
  }

  async getCashAuditsPdf(query: CashListQuery, user?: ReportUser) {
    const dataset = await this.createCashAuditsDataset(query, user);
    return this.pdfEngine.generatePdf(buildCashAuditsReportLayout(dataset));
  }

  async getCashAuditsExcel(query: CashListQuery, user?: ReportUser) {
    const dataset = await this.createCashAuditsDataset(query, user);
    return this.buildCashAuditsExcel(dataset);
  }

  private async createCashClosingsDataset(query: CashListQuery, user?: ReportUser) {
    const actor = this.resolveActor(user);
    const filters = {
      tenantId: query.tenantId,
      branchId: query.branchId,
      dateFrom: this.normalizeDate(query.dateFrom),
      dateTo: this.normalizeDate(query.dateTo, true),
    };
    const rows = await this.documentExport.collect(
      (client) => this.cashReportAdapter.getCashClosingsExportCount(actor, filters, client),
      (client, offset, limit) => this.cashReportAdapter.getCashClosingsExportBatch(actor, filters, client, offset, limit),
    );
    const branding = await this.cashReportAdapter.getPrintableCompany(actor);
    const dataset: CashClosingListDataset & { branding: PrintableCompanyHeader } = {
      filters: {
        tenantId: filters.tenantId ?? actor.tenantId,
        branchId: filters.branchId ?? actor.branchId ?? null,
        dateFrom: filters.dateFrom ?? null,
        dateTo: filters.dateTo ?? null,
        actorRole: actor.role,
      },
      rows,
      branding,
      summary: {
        count: rows.length,
        openingAmount: rows.reduce((sum, row) => sum + row.openingAmount, 0),
        totalIn: rows.reduce((sum, row) => sum + row.totalIn, 0),
        totalOut: rows.reduce((sum, row) => sum + row.totalOut, 0),
        expectedAmount: rows.reduce((sum, row) => sum + row.expectedAmount, 0),
        closingAmount: rows.reduce((sum, row) => sum + row.closingAmount, 0),
        difference: rows.reduce((sum, row) => sum + row.difference, 0),
      },
    };
    return dataset;
  }

  private async createCashAuditsDataset(query: CashListQuery, user?: ReportUser) {
    const actor = this.resolveActor(user);
    const filters = {
      tenantId: query.tenantId,
      branchId: query.branchId,
      dateFrom: this.normalizeDate(query.dateFrom),
      dateTo: this.normalizeDate(query.dateTo, true),
    };
    const rows = await this.documentExport.collect(
      (client) => this.cashReportAdapter.getCashAuditsExportCount(actor, filters, client),
      (client, offset, limit) => this.cashReportAdapter.getCashAuditsExportBatch(actor, filters, client, offset, limit),
    );
    const branding = await this.cashReportAdapter.getPrintableCompany(actor);
    const dataset: CashAuditListDataset & { branding: PrintableCompanyHeader } = {
      filters: {
        tenantId: filters.tenantId ?? actor.tenantId,
        branchId: filters.branchId ?? actor.branchId ?? null,
        dateFrom: filters.dateFrom ?? null,
        dateTo: filters.dateTo ?? null,
        actorRole: actor.role,
      },
      rows,
      branding,
      summary: {
        count: rows.length,
        countedAmount: rows.reduce((sum, row) => sum + row.countedAmount, 0),
        expectedAmount: rows.reduce((sum, row) => sum + row.expectedAmount, 0),
        difference: rows.reduce((sum, row) => sum + row.difference, 0),
      },
    };
    return dataset;
  }

  private addCompanySummary(sheet: ExcelJS.Worksheet, branding: PrintableCompanyHeader, title: string, dataset: CashClosingListDataset | CashAuditListDataset) {
    sheet.addRows([
      [branding.legalName ?? branding.tenantName ?? ""],
      [branding.nit ? `NIT ${branding.nit}` : ""],
      [branding.address ?? ""],
      [branding.phone ?? "", branding.email ?? ""],
      ["Reporte", title],
      ["Tenant", dataset.branding?.tenantName ?? dataset.filters.tenantId],
      ["Sucursal", dataset.branding?.branchName ?? dataset.filters.branchId ?? "Todas"],
      ["Desde", dataset.filters.dateFrom ? new Date(dataset.filters.dateFrom) : ""],
      ["Hasta", dataset.filters.dateTo ? new Date(dataset.filters.dateTo) : ""],
      ["Registros", dataset.rows.length],
    ]);
    sheet.getColumn(1).width = 24;
    sheet.getColumn(2).width = 36;
  }

  private async buildCashClosingsExcel(dataset: CashClosingListDataset & { branding: PrintableCompanyHeader }) {
    const workbook = new ExcelJS.Workbook();
    const summary = workbook.addWorksheet("Resumen");
    this.addCompanySummary(summary, dataset.branding, "Cierres de caja", dataset);
    summary.addRows([["Ingresos", dataset.summary.totalIn], ["Egresos", dataset.summary.totalOut], ["Esperado", dataset.summary.expectedAmount], ["Diferencia", dataset.summary.difference]]);
    const sheet = workbook.addWorksheet("Cierres", { views: [{ state: "frozen", ySplit: 1 }] });
    sheet.columns = [
      ["Apertura", "openedAt", 22], ["Cierre", "closedAt", 22], ["Sucursal", "branchName", 24],
      ["Caja", "cashRegister", 20], ["Terminal", "terminal", 20], ["Abierto por", "openedBy", 26],
      ["Cerrado por", "closedBy", 26], ["Apertura monto", "openingAmount", 18], ["Ingresos", "totalIn", 16],
      ["Egresos", "totalOut", 16], ["Esperado", "expectedAmount", 16], ["Cierre monto", "closingAmount", 16],
      ["Diferencia", "difference", 16], ["Estado", "status", 16],
    ].map(([header, key, width]) => ({ header: String(header), key: String(key), width: Number(width) }));
    dataset.rows.forEach((row) => sheet.addRow({ ...row, openedAt: new Date(row.openedAt), closedAt: row.closedAt ? new Date(row.closedAt) : null }));
    this.formatCashSheet(sheet, ["openingAmount", "totalIn", "totalOut", "expectedAmount", "closingAmount", "difference"], ["openedAt", "closedAt"]);
    return Buffer.from(await workbook.xlsx.writeBuffer());
  }

  private async buildCashAuditsExcel(dataset: CashAuditListDataset & { branding: PrintableCompanyHeader }) {
    const workbook = new ExcelJS.Workbook();
    const summary = workbook.addWorksheet("Resumen");
    this.addCompanySummary(summary, dataset.branding, "Arqueos de caja", dataset);
    summary.addRows([["Contado", dataset.summary.countedAmount], ["Esperado", dataset.summary.expectedAmount], ["Diferencia", dataset.summary.difference]]);
    const sheet = workbook.addWorksheet("Arqueos", { views: [{ state: "frozen", ySplit: 1 }] });
    sheet.columns = [
      ["Fecha", "countedAt", 22], ["Sucursal", "branchName", 24], ["Caja", "cashRegister", 20],
      ["Terminal", "terminal", 20], ["Usuario", "countedBy", 26], ["Contado", "countedAmount", 16],
      ["Esperado", "expectedAmount", 16], ["Diferencia", "difference", 16], ["Estado sesión", "sessionStatus", 18], ["Notas", "notes", 32],
    ].map(([header, key, width]) => ({ header: String(header), key: String(key), width: Number(width) }));
    dataset.rows.forEach((row) => sheet.addRow({ ...row, countedAt: new Date(row.countedAt) }));
    this.formatCashSheet(sheet, ["countedAmount", "expectedAmount", "difference"], ["countedAt"]);
    return Buffer.from(await workbook.xlsx.writeBuffer());
  }

  private formatCashSheet(sheet: ExcelJS.Worksheet, numericKeys: string[], dateKeys: string[]) {
    sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF334155" } };
    for (const key of numericKeys) {
      sheet.getColumn(key).numFmt = "#,##0.00";
    }
    for (const key of dateKeys) {
      sheet.getColumn(key).numFmt = "yyyy-mm-dd hh:mm";
    }
    sheet.autoFilter = { from: "A1", to: sheet.getRow(1).getCell(sheet.columnCount).address };
  }

  async getCashAuditTicket(cashCountId: string, user?: ReportUser) {
    const actor = this.resolveActor(user);
    const payload = await this.cashReportAdapter.getCashAuditTicket(actor, cashCountId);
    if (actor.role === "USER" && payload?.header.countedByUserId !== actor.userId) {
      throw new ForbiddenException("No autorizado para este arqueo");
    }
    return this.normalizeCashAuditTicketDataset(payload);
  }

  async getCashAuditTicketPdf(cashCountId: string, user?: ReportUser) {
    const dataset = await this.getCashAuditTicket(cashCountId, user);
    return this.pdfEngine.generatePdf(buildCashAuditTicketTemplate(dataset));
  }
}
