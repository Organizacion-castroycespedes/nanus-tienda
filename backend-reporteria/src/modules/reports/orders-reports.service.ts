import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { ReportUser } from "../auth/report-auth.types";
import { PdfmakeEngine } from "../pdf/pdfmake.engine";
import { buildOrderSalesReportLayout } from "../pdf/templates/reports/order-sales-report.template";
import { buildOrderSaleTicketTemplate } from "../pdf/templates/tickets/order-sale-ticket.template";
import { OrdersReportAdapter } from "./sql-adapters/orders-report.adapter";
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
  format?: string;
};

const ROLE_PRIORITY = ["SUPER_ADMIN", "SUPER_USER", "ADMIN", "USER"];

@Injectable()
export class OrdersReportsService {
  constructor(
    @Inject(OrdersReportAdapter)
    private readonly ordersReportAdapter: OrdersReportAdapter,
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
    const filters = {
      tenantId: payload?.filters?.tenantId ?? query.tenantId ?? actor.tenantId,
      branchId: payload?.filters?.branchId ?? query.branchId ?? actor.branchId ?? null,
      dateFrom: payload?.filters?.dateFrom ?? this.normalizeDate(query.dateFrom) ?? null,
      dateTo: payload?.filters?.dateTo ?? this.normalizeDate(query.dateTo, true) ?? null,
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
    const payload = await this.ordersReportAdapter.getOrderSalesList(actor, {
      tenantId: query.tenantId,
      branchId: query.branchId,
      dateFrom: this.normalizeDate(query.dateFrom),
      dateTo: this.normalizeDate(query.dateTo, true),
    });

    return this.normalizeOrderSalesListDataset(payload, actor, query);
  }

  async getOrderSalesPdf(query: OrdersListQuery, user?: ReportUser) {
    const dataset = await this.getOrderSales(query, user);
    return this.pdfEngine.generatePdf(buildOrderSalesReportLayout(dataset));
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
