import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { ReportUser } from "../auth/report-auth.types";
import { PdfmakeEngine } from "../pdf/pdfmake.engine";
import { buildCashAuditsReportLayout } from "../pdf/templates/reports/cash-audits-report.template";
import { buildCashClosingsReportLayout } from "../pdf/templates/reports/cash-closings-report.template";
import { buildCashAuditTicketTemplate } from "../pdf/templates/tickets/cash-audit-ticket.template";
import { buildCashClosingTicketTemplate } from "../pdf/templates/tickets/cash-closing-ticket.template";
import { CashReportAdapter } from "./sql-adapters/cash-report.adapter";
import type {
  CashAuditListDataset,
  CashAuditListRow,
  CashAuditTicketDataset,
  CashClosingListDataset,
  CashClosingListRow,
  CashClosingTicketDataset,
  ReportActorContext,
} from "./types/cash-report.types";

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
    private readonly pdfEngine: PdfmakeEngine
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

    return {
      filters,
      rows,
      summary: {
        count: this.toNumber(payload?.summary?.count ?? rows.length),
        countedAmount: this.toNumber(
          payload?.summary?.countedAmount ?? rows.reduce((sum, row) => sum + row.countedAmount, 0)
        ),
        expectedAmount: this.toNumber(
          payload?.summary?.expectedAmount ?? rows.reduce((sum, row) => sum + row.expectedAmount, 0)
        ),
        difference: this.toNumber(
          payload?.summary?.difference ?? rows.reduce((sum, row) => sum + row.difference, 0)
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
    const dataset = await this.getCashClosings(query, user);
    return this.pdfEngine.generatePdf(buildCashClosingsReportLayout(dataset));
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
    const dataset = await this.getCashAudits(query, user);
    return this.pdfEngine.generatePdf(buildCashAuditsReportLayout(dataset));
  }

  async getCashAuditTicket(cashCountId: string, user?: ReportUser) {
    const actor = this.resolveActor(user);
    const payload = await this.cashReportAdapter.getCashAuditTicket(actor, cashCountId);
    return this.normalizeCashAuditTicketDataset(payload);
  }

  async getCashAuditTicketPdf(cashCountId: string, user?: ReportUser) {
    const dataset = await this.getCashAuditTicket(cashCountId, user);
    return this.pdfEngine.generatePdf(buildCashAuditTicketTemplate(dataset));
  }
}
