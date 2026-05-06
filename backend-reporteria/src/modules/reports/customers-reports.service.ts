import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import type { ReportUser } from "../auth/report-auth.types";
import { PdfmakeEngine } from "../pdf/pdfmake.engine";
import { buildCustomerOrdersStatusReportLayout } from "../pdf/templates/reports/customer-orders-status-report.template";
import { CustomersReportAdapter } from "./sql-adapters/customers-report.adapter";
import type {
  CustomerOrdersStatusDataset,
  CustomerOrdersStatusRow,
  ReportActorContext,
} from "./types/customers-report.types";

type CustomersListQuery = {
  tenantId?: string;
  branchId?: string;
  dateFrom?: string;
  dateTo?: string;
  customerDocument?: string;
  customerName?: string;
  format?: string;
};

const ROLE_PRIORITY = ["SUPER_ADMIN", "SUPER_USER", "ADMIN", "USER"];

@Injectable()
export class CustomersReportsService {
  constructor(
    @Inject(CustomersReportAdapter)
    private readonly customersReportAdapter: CustomersReportAdapter,
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

  private normalizeOptionalText(value: string | undefined) {
    const normalized = value?.trim();
    return normalized ? normalized : undefined;
  }

  private normalizeCustomerRow(row: CustomerOrdersStatusRow): CustomerOrdersStatusRow {
    return {
      ...row,
      totalOrders: this.toNumber(row.totalOrders),
      pendingOrders: this.toNumber(row.pendingOrders),
      partialOrders: this.toNumber(row.partialOrders),
      completedOrders: this.toNumber(row.completedOrders),
      totalAmount: this.toNumber(row.totalAmount),
      totalPending: this.toNumber(row.totalPending),
    };
  }

  private normalizeCustomerOrdersStatusDataset(
    payload: CustomerOrdersStatusDataset | null,
    actor: ReportActorContext,
    query: CustomersListQuery
  ): CustomerOrdersStatusDataset {
    const filters = {
      tenantId: payload?.filters?.tenantId ?? query.tenantId ?? actor.tenantId,
      branchId: payload?.filters?.branchId ?? query.branchId ?? actor.branchId ?? null,
      dateFrom: payload?.filters?.dateFrom ?? this.normalizeDate(query.dateFrom) ?? null,
      dateTo: payload?.filters?.dateTo ?? this.normalizeDate(query.dateTo, true) ?? null,
      customerDocument:
        payload?.filters?.customerDocument ??
        this.normalizeOptionalText(query.customerDocument) ??
        null,
      customerName:
        payload?.filters?.customerName ?? this.normalizeOptionalText(query.customerName) ?? null,
      actorRole: payload?.filters?.actorRole ?? actor.role,
    };

    const rows = Array.isArray(payload?.rows)
      ? payload.rows.map((row) => this.normalizeCustomerRow(row))
      : [];

    return {
      filters,
      rows,
      summary: {
        count: this.toNumber(payload?.summary?.count ?? rows.length),
        totalOrders: this.toNumber(
          payload?.summary?.totalOrders ?? rows.reduce((sum, row) => sum + row.totalOrders, 0)
        ),
        pendingOrders: this.toNumber(
          payload?.summary?.pendingOrders ?? rows.reduce((sum, row) => sum + row.pendingOrders, 0)
        ),
        partialOrders: this.toNumber(
          payload?.summary?.partialOrders ?? rows.reduce((sum, row) => sum + row.partialOrders, 0)
        ),
        completedOrders: this.toNumber(
          payload?.summary?.completedOrders ??
            rows.reduce((sum, row) => sum + row.completedOrders, 0)
        ),
        totalAmount: this.toNumber(
          payload?.summary?.totalAmount ?? rows.reduce((sum, row) => sum + row.totalAmount, 0)
        ),
        totalPending: this.toNumber(
          payload?.summary?.totalPending ?? rows.reduce((sum, row) => sum + row.totalPending, 0)
        ),
      },
    };
  }

  async getCustomerOrdersStatus(query: CustomersListQuery, user?: ReportUser) {
    const actor = this.resolveActor(user);
    const payload = await this.customersReportAdapter.getCustomerOrdersStatus(actor, {
      tenantId: query.tenantId,
      branchId: query.branchId,
      dateFrom: this.normalizeDate(query.dateFrom),
      dateTo: this.normalizeDate(query.dateTo, true),
      customerDocument: this.normalizeOptionalText(query.customerDocument),
      customerName: this.normalizeOptionalText(query.customerName),
    });

    return this.normalizeCustomerOrdersStatusDataset(payload, actor, query);
  }

  async getCustomerOrdersStatusPdf(query: CustomersListQuery, user?: ReportUser) {
    const dataset = await this.getCustomerOrdersStatus(query, user);
    return this.pdfEngine.generatePdf(buildCustomerOrdersStatusReportLayout(dataset));
  }
}
