import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
} from "@nestjs/common";
import {
  InventoryRepository,
  type InventoryCashSessionOption,
  type InventoryDashboardScope,
  type InventoryProductRow,
} from "../repositories/inventory.repository";
import {
  normalizeOptionalFilter,
  type BranchScopedActor,
  type BranchScopedFilters,
} from "../utils/access";
import { FinanceAccessRepository } from "../../finance/common/repositories/finance-access.repository";

type InventoryDashboardActor = BranchScopedActor & {
  userId?: string;
  terminalId?: string;
  posSessionId?: string;
};

type InventoryDashboardFilters = {
  tenantId?: string;
  branchId?: string;
  terminalId?: string;
  cashSessionId?: string;
  startDate?: string;
  endDate?: string;
};

@Injectable()
export class InventoryService {
  constructor(
    @Inject(InventoryRepository)
    private readonly repository: InventoryRepository,
    @Inject(FinanceAccessRepository)
    private readonly financeAccessRepository: FinanceAccessRepository
  ) {}

  private mapInventoryRow(row: InventoryProductRow) {
    return {
      id: row.product_id,
      tenantId: row.tenant_id,
      tenantName: row.tenant_name,
      unitId: row.unit_id,
      taxId: row.tax_id,
      description: row.description,
      branchId: row.branch_id,
      branchName: row.branch_name,
      name: row.product_name,
      sku: row.sku,
      price: Number(row.price),
      cost: Number(row.cost),
      priceWithTax: Number(row.price_with_tax),
      priceWithoutTax: Number(row.price_without_tax),
      isActive: row.is_active,
      createdAt: new Date(row.created_at).toISOString(),
      updatedAt: new Date(row.updated_at).toISOString(),
      stock: Number(row.stock),
      terminalName: row.terminal_name,
    };
  }

  private resolveProductFilters(
    actor: BranchScopedActor,
    filters: BranchScopedFilters
  ) {
    const tenantId = normalizeOptionalFilter(filters.tenantId);
    const branchId = normalizeOptionalFilter(filters.branchId);

    if (actor.roles.includes("SUPER_ADMIN")) {
      return { tenantId, branchId };
    }

    if (!actor.tenantId) {
      throw new ForbiddenException("Tenant requerido");
    }
    if (tenantId && tenantId !== actor.tenantId) {
      throw new ForbiddenException("No autorizado para otro tenant");
    }

    return {
      tenantId: actor.tenantId,
      branchId,
    };
  }

  async listInventoryProducts(filters: BranchScopedFilters, actor: BranchScopedActor) {
    const resolvedFilters = this.resolveProductFilters(actor, filters);
    const rows = await this.repository.listInventoryProducts(resolvedFilters);
    return rows.map((row) => this.mapInventoryRow(row));
  }

  private parseDate(value: string | undefined, fallback: Date) {
    const normalized = value?.trim();
    if (!normalized) {
      return fallback.toISOString().slice(0, 10);
    }

    const parsed = new Date(`${normalized}T00:00:00.000Z`);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException("Rango de fechas invalido");
    }

    return normalized;
  }

  private hasRole(actor: InventoryDashboardActor, role: string) {
    return actor.roles.includes(role);
  }

  private async resolveAllowedBranchIds(actor: InventoryDashboardActor, tenantId: string) {
    if (this.hasRole(actor, "SUPER_ADMIN") || this.hasRole(actor, "SUPER_USER")) {
      return undefined;
    }

    if (!actor.userId) {
      throw new ForbiddenException("Usuario requerido");
    }

    const branchIds = await this.financeAccessRepository.findAccessibleBranchIds(
      actor.userId,
      tenantId
    );

    if (branchIds.length > 0) {
      return branchIds;
    }

    if (actor.branchId) {
      return [actor.branchId];
    }

    throw new ForbiddenException("Sucursal requerida");
  }

  private async resolveDashboardScope(
    filters: InventoryDashboardFilters,
    actor: InventoryDashboardActor
  ) {
    const today = new Date();
    const startDate = this.parseDate(filters.startDate, today);
    const endDate = this.parseDate(filters.endDate, today);

    if (startDate > endDate) {
      throw new BadRequestException("La fecha inicial no puede ser mayor a la final");
    }

    const requestedTenantId = normalizeOptionalFilter(filters.tenantId);
    const requestedBranchId = normalizeOptionalFilter(filters.branchId);
    const requestedTerminalId = normalizeOptionalFilter(filters.terminalId);
    const requestedCashSessionId = normalizeOptionalFilter(filters.cashSessionId);

    let tenantId = requestedTenantId;
    if (this.hasRole(actor, "SUPER_ADMIN")) {
      tenantId = requestedTenantId ?? actor.tenantId;
    } else {
      if (!actor.tenantId) {
        throw new ForbiddenException("Tenant requerido");
      }
      if (requestedTenantId && requestedTenantId !== actor.tenantId) {
        throw new ForbiddenException("No autorizado para otro tenant");
      }
      tenantId = actor.tenantId;
    }

    if (!tenantId) {
      throw new BadRequestException("Tenant requerido");
    }

    const allowedBranchIds = await this.resolveAllowedBranchIds(actor, tenantId);
    const branchSet = new Set(allowedBranchIds ?? []);

    let branchId = requestedBranchId;
    if (this.hasRole(actor, "USER")) {
      const userBranchId = actor.branchId ?? allowedBranchIds?.[0];
      if (!userBranchId) {
        throw new ForbiddenException("Sucursal requerida");
      }
      if (requestedBranchId && requestedBranchId !== userBranchId) {
        throw new ForbiddenException("No autorizado para otra sucursal");
      }
      branchId = userBranchId;
    } else if (this.hasRole(actor, "ADMIN")) {
      const adminBranchId = requestedBranchId ?? actor.branchId ?? allowedBranchIds?.[0];
      if (!adminBranchId) {
        throw new ForbiddenException("Sucursal requerida");
      }
      if ((allowedBranchIds?.length ?? 0) > 0 && !branchSet.has(adminBranchId)) {
        throw new ForbiddenException("No autorizado para otra sucursal");
      }
      branchId = adminBranchId;
    } else if (branchId && (allowedBranchIds?.length ?? 0) > 0 && !branchSet.has(branchId)) {
      throw new ForbiddenException("No autorizado para otra sucursal");
    }

    let terminalId = requestedTerminalId;
    if (this.hasRole(actor, "USER") && actor.terminalId) {
      if (requestedTerminalId && requestedTerminalId !== actor.terminalId) {
        throw new ForbiddenException("No autorizado para otra terminal");
      }
      terminalId = actor.terminalId;
    }

    return {
      tenantId,
      branchId,
      terminalId,
      cashSessionId: requestedCashSessionId,
      startDate,
      endDate,
      allowedBranchIds,
    };
  }

  private mapCashSessionOption(option: InventoryCashSessionOption) {
    return {
      id: option.id,
      name: option.name,
      branchId: option.branchId,
      branchName: option.branchName,
      cashRegisterId: option.cashRegisterId,
      cashRegisterName: option.cashRegisterName,
      terminalId: option.terminalId,
      terminalName: option.terminalName,
      openedAt: option.openedAt,
      status: option.status,
      openedByUserId: option.openedByUserId,
    };
  }

  private normalizeDashboardData(snapshot: Record<string, any>) {
    const summary = snapshot.summary ?? {};
    const charts = snapshot.charts ?? {};
    const tables = snapshot.tables ?? {};

    return {
      summary: {
        stockTotal: Number(summary.stockTotal ?? 0),
        productsLow: Number(summary.productsLow ?? 0),
        productsOut: Number(summary.productsOut ?? 0),
        pendingPurchases: Number(summary.pendingPurchases ?? 0),
        pendingOrders: Number(summary.pendingOrders ?? 0),
        salesDay: Number(summary.salesDay ?? 0),
        recentMovements: Number(summary.recentMovements ?? 0),
      },
      header: snapshot.header ?? {},
      charts: {
        movementSeries: Array.isArray(charts.movementSeries) ? charts.movementSeries : [],
        salesSeries: Array.isArray(charts.salesSeries) ? charts.salesSeries : [],
        purchaseSeries: Array.isArray(charts.purchaseSeries) ? charts.purchaseSeries : [],
        topProducts: Array.isArray(charts.topProducts) ? charts.topProducts : [],
      },
      tables: {
        recentMovements: Array.isArray(tables.recentMovements) ? tables.recentMovements : [],
        recentPurchases: Array.isArray(tables.recentPurchases) ? tables.recentPurchases : [],
        criticalProducts: Array.isArray(tables.criticalProducts) ? tables.criticalProducts : [],
        pendingOrders: Array.isArray(tables.pendingOrders) ? tables.pendingOrders : [],
      },
    };
  }

  async getInventoryDashboard(
    filters: InventoryDashboardFilters,
    actor: InventoryDashboardActor
  ) {
    const scope = await this.resolveDashboardScope(filters, actor);
    const snapshot = await this.repository.getDashboardSnapshot({
      tenantId: scope.tenantId,
      branchId: scope.branchId,
      terminalId: scope.terminalId,
      cashSessionId: scope.cashSessionId,
      startDate: scope.startDate,
      endDate: scope.endDate,
    } satisfies InventoryDashboardScope);

    const cashSessions = await this.repository.listActiveCashSessionOptions({
      tenantId: scope.tenantId,
      branchIds: scope.allowedBranchIds,
      branchId: scope.branchId,
      terminalId: scope.terminalId,
      openedByUserId: this.hasRole(actor, "USER") ? actor.userId : undefined,
    });

    if (
      scope.cashSessionId &&
      !cashSessions.some((cashSession) => cashSession.id === scope.cashSessionId)
    ) {
      throw new ForbiddenException("No autorizado para esta caja");
    }

    const defaultCashSessionId =
      scope.cashSessionId ??
      (this.hasRole(actor, "USER") || this.hasRole(actor, "ADMIN")
        ? cashSessions[0]?.id
        : undefined);

    const effectiveSnapshot =
      defaultCashSessionId && defaultCashSessionId !== scope.cashSessionId
        ? await this.repository.getDashboardSnapshot({
            tenantId: scope.tenantId,
            branchId: scope.branchId,
            terminalId: scope.terminalId,
            cashSessionId: defaultCashSessionId,
            startDate: scope.startDate,
            endDate: scope.endDate,
          })
        : snapshot;

    return {
      ...this.normalizeDashboardData(effectiveSnapshot as Record<string, any>),
      scope: {
        tenantId: scope.tenantId,
        branchId: scope.branchId ?? null,
        terminalId: scope.terminalId ?? null,
        cashSessionId: defaultCashSessionId ?? null,
        startDate: scope.startDate,
        endDate: scope.endDate,
      },
      filters: {
        tenants: this.hasRole(actor, "SUPER_ADMIN")
          ? await this.repository.listTenantOptions()
          : [],
        branches:
          this.hasRole(actor, "ADMIN") || this.hasRole(actor, "USER")
            ? []
            : await this.repository.listBranchOptions({
                tenantId: scope.tenantId,
                branchIds: scope.allowedBranchIds,
              }),
        terminals:
          this.hasRole(actor, "USER")
            ? []
            : await this.repository.listTerminalOptions({
                tenantId: scope.tenantId,
                branchIds: scope.allowedBranchIds,
                branchId: scope.branchId,
              }),
        cashSessions: cashSessions.map((item) => this.mapCashSessionOption(item)),
      },
    };
  }
}
