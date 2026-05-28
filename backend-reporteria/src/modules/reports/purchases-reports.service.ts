import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { ReportUser } from "../auth/report-auth.types";
import { PdfmakeEngine } from "../pdf/pdfmake.engine";
import { buildPurchasesReportLayout } from "../pdf/templates/reports/purchases-report.template";
import { buildPurchaseTicketTemplate } from "../pdf/templates/tickets/purchase-ticket.template";
import { PurchasesReportAdapter } from "./sql-adapters/purchases-report.adapter";
import type {
  PurchaseReportListRow,
  PurchaseTicketDataset,
  PurchasesReportListDataset,
  ReportActorContext,
} from "./types/purchases-report.types";

type PurchasesListQuery = {
  tenantId?: string;
  branchId?: string;
  dateFrom?: string;
  dateTo?: string;
  status?: string;
  format?: string;
};

const ROLE_PRIORITY = ["SUPER_ADMIN", "SUPER_USER", "ADMIN", "USER"];

@Injectable()
export class PurchasesReportsService {
  constructor(
    @Inject(PurchasesReportAdapter)
    private readonly purchasesReportAdapter: PurchasesReportAdapter,
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
    const filters = {
      tenantId: payload?.filters?.tenantId ?? query.tenantId ?? actor.tenantId,
      branchId: payload?.filters?.branchId ?? query.branchId ?? actor.branchId ?? null,
      dateFrom: payload?.filters?.dateFrom ?? this.normalizeDate(query.dateFrom) ?? null,
      dateTo: payload?.filters?.dateTo ?? this.normalizeDate(query.dateTo, true) ?? null,
      status: payload?.filters?.status ?? query.status ?? null,
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
    const payload = await this.purchasesReportAdapter.getPurchasesList(actor, {
      tenantId: query.tenantId,
      branchId: query.branchId,
      dateFrom: this.normalizeDate(query.dateFrom),
      dateTo: this.normalizeDate(query.dateTo, true),
      status: query.status,
    });

    return this.normalizePurchasesListDataset(payload, actor, query);
  }

  async getPurchasesPdf(query: PurchasesListQuery, user?: ReportUser) {
    const dataset = await this.getPurchases(query, user);
    return this.pdfEngine.generatePdf(buildPurchasesReportLayout(dataset));
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
