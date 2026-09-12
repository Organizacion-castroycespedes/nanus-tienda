import { ForbiddenException, Inject, Injectable } from "@nestjs/common";
import { DatabaseService } from "../db/database.service";
import {
  AccessControlService,
  type AccessActor,
} from "./access-control.service";

export const OPERATIONAL_SALE_OPERATIONS = [
  "VIEW",
  "VIEW_DETAIL",
  "FILTER",
  "REFRESH",
  "REPRINT",
  "ELECTRONIC_BILLING_STATUS",
  "RETRY_ALLOWED_TECHNICAL_ERROR",
  "CANCEL",
  "VOID",
  "RETURN",
  "DELETE",
] as const;

export type OperationalSaleOperation =
  (typeof OPERATIONAL_SALE_OPERATIONS)[number];

export type OperationalSaleActor = AccessActor & {
  branchId?: string;
  terminalId?: string;
  posSessionId?: string;
  cashSessionId?: string;
};

export type OperationalSaleScope = {
  tenantId?: string;
  allTenants: boolean;
  branchIds?: string[];
  cashSessionId?: string;
  userId?: string;
  requiresCurrentShift: boolean;
};

export type OperationalSaleScopeFilters = {
  tenantId?: string | null;
  branchId?: string | null;
  cashSessionId?: string | null;
  userId?: string | null;
};

export type OperationalSaleQueryFilters = OperationalSaleScopeFilters & {
  fromDate?: string;
  toDate?: string;
  status?: string;
  paymentMethod?: string;
  customerId?: string;
  electronicBillingStatus?: string;
  documentNumber?: string;
};

export interface OperationalSaleRepository {
  findOperationalSales(
    scope: OperationalSaleScope,
    filters: OperationalSaleQueryFilters
  ): Promise<unknown>;
  findOperationalSaleById(
    scope: OperationalSaleScope,
    saleId: string
  ): Promise<unknown | null>;
}

export type OperationalSaleRecord = {
  tenantId: string;
  branchId: string;
  userId?: string | null;
  cashSessionId?: string | null;
};

type OpenCashSessionRow = {
  id: string;
  tenant_id: string;
  branch_id: string;
  opened_by_user_id: string;
};

@Injectable()
export class OperationalSaleScopeService {
  constructor(
    @Inject(DatabaseService) private readonly db: DatabaseService,
    @Inject(AccessControlService)
    private readonly accessControl: AccessControlService
  ) {}

  async resolveScope(
    actor: OperationalSaleActor,
    requestedTenantId?: string | null,
    requestedBranchId?: string | null
  ): Promise<OperationalSaleScope> {
    const tenantId = this.accessControl.resolveTenantId(
      actor,
      requestedTenantId
    );
    if (this.accessControl.isSuperAdmin(actor) && !tenantId) {
      return { allTenants: true, requiresCurrentShift: false };
    }
    if (!tenantId || !this.accessControl.canAccessTenant(actor, tenantId)) {
      throw new ForbiddenException("No autorizado para este tenant");
    }

    const branchId = requestedBranchId?.trim() || actor.branchId;
    if (actor.roles?.includes("USER")) {
      if (!branchId) {
        throw new ForbiddenException("Sucursal requerida");
      }
      if (!(await this.accessControl.canAccessBranch(actor, tenantId, branchId))) {
        throw new ForbiddenException("No autorizado para esta sucursal");
      }
      const cashSession = await this.resolveCurrentCashSession(
        actor,
        tenantId,
        branchId
      );
      return {
        tenantId,
        allTenants: false,
        branchIds: [branchId],
        cashSessionId: cashSession.id,
        userId: actor.id,
        requiresCurrentShift: true,
      };
    }

    const branchIds = await this.accessControl.getAccessibleBranchIds(
      actor,
      tenantId
    );
    if (branchId) {
      if (!branchIds.includes(branchId)) {
        throw new ForbiddenException("No autorizado para esta sucursal");
      }
      return {
        tenantId,
        allTenants: false,
        branchIds: [branchId],
        requiresCurrentShift: false,
      };
    }
    return {
      tenantId,
      allTenants: false,
      branchIds,
      requiresCurrentShift: false,
    };
  }

  async resolveQueryScope(
    actor: OperationalSaleActor,
    filters: OperationalSaleScopeFilters = {}
  ): Promise<OperationalSaleScope> {
    const scope = await this.resolveScope(
      actor,
      filters.tenantId,
      filters.branchId
    );
    return this.narrowScope(scope, filters);
  }

  narrowScope(
    scope: OperationalSaleScope,
    filters: OperationalSaleScopeFilters
  ): OperationalSaleScope {
    const requestedTenantId = filters.tenantId?.trim();
    if (requestedTenantId && requestedTenantId !== scope.tenantId) {
      return { ...scope, branchIds: [] };
    }

    const requestedBranchId = filters.branchId?.trim();
    if (requestedBranchId && !scope.branchIds?.includes(requestedBranchId)) {
      return { ...scope, branchIds: [] };
    }

    const requestedCashSessionId = filters.cashSessionId?.trim();
    if (
      requestedCashSessionId &&
      scope.cashSessionId &&
      requestedCashSessionId !== scope.cashSessionId
    ) {
      return { ...scope, branchIds: [] };
    }

    const requestedUserId = filters.userId?.trim();
    if (requestedUserId && scope.userId && requestedUserId !== scope.userId) {
      return { ...scope, branchIds: [] };
    }

    return {
      ...scope,
      cashSessionId: requestedCashSessionId || scope.cashSessionId,
      userId: requestedUserId || scope.userId,
    };
  }

  async canAccessSale(
    actor: OperationalSaleActor,
    sale: OperationalSaleRecord,
    operation: OperationalSaleOperation,
    requestedTenantId?: string | null,
    requestedBranchId?: string | null
  ) {
    if (operation === "DELETE") {
      return false;
    }
    const scope = await this.resolveScope(
      actor,
      requestedTenantId,
      requestedBranchId
    );
    if (scope.allTenants) {
      return true;
    }
    if (sale.tenantId !== scope.tenantId) {
      return false;
    }
    if (!scope.branchIds?.includes(sale.branchId)) {
      return false;
    }
    if (scope.requiresCurrentShift && sale.cashSessionId !== scope.cashSessionId) {
      return false;
    }
    return true;
  }

  private async resolveCurrentCashSession(
    actor: OperationalSaleActor,
    tenantId: string,
    branchId: string
  ): Promise<OpenCashSessionRow> {
    if (!actor.id) {
      throw new ForbiddenException("Usuario requerido");
    }
    const result = await this.db.query<OpenCashSessionRow>(
      `
      SELECT session.id, session.tenant_id, session.branch_id,
             session.opened_by_user_id
      FROM cash_sessions AS session
      WHERE session.tenant_id = $1
        AND session.branch_id = $2
        AND session.opened_by_user_id = $3
        AND session.status = 'OPEN'
      ORDER BY session.opened_at DESC
      LIMIT 2
      `,
      [tenantId, branchId, actor.id]
    );
    if (result.rows.length !== 1) {
      throw new ForbiddenException(
        result.rows.length === 0
          ? "No hay un turno actual abierto"
          : "Turnos actuales ambiguos"
      );
    }
    return result.rows[0];
  }
}
