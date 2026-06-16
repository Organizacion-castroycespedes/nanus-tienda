import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { ReportUser } from "../auth/report-auth.types";
import { PdfmakeEngine } from "../pdf/pdfmake.engine";
import { buildPosSalesReportLayout } from "../pdf/templates/reports/pos-sales-report.template";
import { buildPosSaleTicketTemplate } from "../pdf/templates/tickets/pos-sale-ticket.template";
import { buildSaleCancelTicketTemplate } from "../pdf/templates/tickets/sale-cancel-ticket.template";
import { SalesReportAdapter } from "./sql-adapters/sales-report.adapter";
import type {
  PosSaleCancelTicketDataset,
  PosSaleTicketDataset,
  PosSalesListDataset,
  PosSalesListRow,
  ReportActorContext,
} from "./types/sales-report.types";

type SalesListQuery = {
  tenantId?: string;
  branchId?: string;
  dateFrom?: string;
  dateTo?: string;
  format?: string;
};

const ROLE_PRIORITY = ["SUPER_ADMIN", "SUPER_USER", "ADMIN", "USER"];

@Injectable()
export class SalesReportsService {
  constructor(
    @Inject(SalesReportAdapter)
    private readonly salesReportAdapter: SalesReportAdapter,
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

  private normalizeListRow(row: PosSalesListRow): PosSalesListRow {
    return {
      ...row,
      total: Number(row.total ?? 0),
      paid: Number(row.paid ?? 0),
      balance: Number(row.balance ?? 0),
      cashSessionId: row.cashSessionId ?? null,
    };
  }

  private normalizeSalesListDataset(
    payload: PosSalesListDataset | null,
    actor: ReportActorContext,
    query: SalesListQuery
  ): PosSalesListDataset {
    const filters = {
      tenantId: payload?.filters?.tenantId ?? query.tenantId ?? actor.tenantId,
      branchId: payload?.filters?.branchId ?? query.branchId ?? actor.branchId ?? null,
      dateFrom: payload?.filters?.dateFrom ?? this.normalizeDate(query.dateFrom) ?? null,
      dateTo: payload?.filters?.dateTo ?? this.normalizeDate(query.dateTo, true) ?? null,
      actorRole: payload?.filters?.actorRole ?? actor.role,
    };

    const rows = Array.isArray(payload?.rows)
      ? payload.rows.map((row) => this.normalizeListRow(row))
      : [];

    return {
      filters,
      rows,
      summary: {
        count: Number(payload?.summary?.count ?? rows.length),
        total: Number(payload?.summary?.total ?? rows.reduce((sum, row) => sum + row.total, 0)),
        paid: Number(payload?.summary?.paid ?? rows.reduce((sum, row) => sum + row.paid, 0)),
        balance: Number(
          payload?.summary?.balance ?? rows.reduce((sum, row) => sum + row.balance, 0)
        ),
        cancelled: Number(
          payload?.summary?.cancelled ?? rows.filter((row) => row.status === "CANCELLED").length
        ),
        refunded: Number(
          payload?.summary?.refunded ?? rows.filter((row) => row.status === "REFUNDED").length
        ),
      },
    };
  }

  private normalizeSaleTicketDataset(payload: PosSaleTicketDataset | null) {
    if (!payload) {
      throw new NotFoundException("sale not found");
    }

    return {
      ...payload,
      items: (payload.items ?? []).map((item) => ({
        ...item,
        quantity: Number(item.quantity ?? 0),
        unitPrice: Number(item.unitPrice ?? 0),
        subtotal: Number(item.subtotal ?? 0),
      })),
      payments: (payload.payments ?? []).map((payment) => ({
        ...payment,
        amount: Number(payment.amount ?? 0),
      })),
      paymentBreakdown: (payload.paymentBreakdown ?? []).map((payment) => ({
        ...payment,
        amount: Number(payment.amount ?? 0),
      })),
      totals: {
        subtotal: Number(payload.totals?.subtotal ?? 0),
        taxes: Number(payload.totals?.taxes ?? 0),
        total: Number(payload.totals?.total ?? 0),
        paid: Number(payload.totals?.paid ?? 0),
        change: Number(payload.totals?.change ?? 0),
        balance: Number(payload.totals?.balance ?? 0),
      },
      cashContext: payload.cashContext ?? null,
    };
  }

  private normalizeCancelTicketDataset(payload: PosSaleCancelTicketDataset | null) {
    if (!payload) {
      throw new NotFoundException("sale not found");
    }

    return {
      ...payload,
      paymentsReverted: (payload.paymentsReverted ?? []).map((payment) => ({
        ...payment,
        amount: Number(payment.amount ?? 0),
      })),
      cashMovements: (payload.cashMovements ?? []).map((movement) => ({
        ...movement,
        amount: Number(movement.amount ?? 0),
      })),
      totals: {
        saleTotal: Number(payload.totals?.saleTotal ?? 0),
        paid: Number(payload.totals?.paid ?? 0),
        balance: Number(payload.totals?.balance ?? 0),
        refunded: Number(payload.totals?.refunded ?? 0),
      },
    };
  }

  async getSalesList(query: SalesListQuery, user?: ReportUser) {
    const actor = this.resolveActor(user);
    const payload = await this.salesReportAdapter.getSalesList(actor, {
      tenantId: query.tenantId,
      branchId: query.branchId,
      dateFrom: this.normalizeDate(query.dateFrom),
      dateTo: this.normalizeDate(query.dateTo, true),
    });

    return this.normalizeSalesListDataset(payload, actor, query);
  }

  async getSalesListPdf(query: SalesListQuery, user?: ReportUser) {
    const dataset = await this.getSalesList(query, user);
    return this.pdfEngine.generatePdf(buildPosSalesReportLayout(dataset));
  }

  async getSaleTicket(saleId: string, user?: ReportUser) {
    const actor = this.resolveActor(user);
    const payload = await this.salesReportAdapter.getSaleTicket(actor, saleId);
    if (!payload && (await this.salesReportAdapter.saleExists(saleId))) {
      throw new ForbiddenException("sale ticket is not authorized");
    }
    const dataset = this.normalizeSaleTicketDataset(payload);

    if (["CANCELLED", "REFUNDED"].includes(dataset.header.status)) {
      throw new BadRequestException(
        "sale is cancelled; use cancel-ticket for this document"
      );
    }

    return dataset;
  }

  async getSaleTicketPdf(saleId: string, user?: ReportUser) {
    const dataset = await this.getSaleTicket(saleId, user);
    return this.pdfEngine.generatePdf(buildPosSaleTicketTemplate(dataset));
  }

  async getSaleCancelTicket(saleId: string, user?: ReportUser) {
    const actor = this.resolveActor(user);
    const payload = await this.salesReportAdapter.getSaleCancelTicket(actor, saleId);
    const dataset = this.normalizeCancelTicketDataset(payload);

    if (!["CANCELLED", "REFUNDED"].includes(dataset.header.status)) {
      throw new BadRequestException("sale is not cancelled");
    }

    return dataset;
  }

  async getSaleCancelTicketPdf(saleId: string, user?: ReportUser) {
    const dataset = await this.getSaleCancelTicket(saleId, user);
    return this.pdfEngine.generatePdf(buildSaleCancelTicketTemplate(dataset));
  }
}
