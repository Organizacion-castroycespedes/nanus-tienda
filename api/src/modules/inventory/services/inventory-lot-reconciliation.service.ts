import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { FinanceAccessRepository } from "../../finance/common/repositories/finance-access.repository";
import {
  INVENTORY_LOT_DISCREPANCY_TYPES,
  InventoryLotReconciliationRepository,
  type InventoryLotDiscrepancyRecord,
  type InventoryLotDiscrepancyType,
  type InventoryLotReconciliationFilters,
} from "../repositories/inventory-lot-reconciliation.repository";
import { canViewAllBranches } from "../utils/access";

export const INVENTORY_LOT_DISCREPANCY_SEVERITIES = [
  "CRITICAL",
  "HIGH",
  "WARNING",
  "INFO",
] as const;

export type InventoryLotDiscrepancySeverity =
  (typeof INVENTORY_LOT_DISCREPANCY_SEVERITIES)[number];

export type InventoryLotReconciliationActor = {
  roles: string[];
  userId?: string;
  tenantId?: string;
  branchId?: string;
};

export type InventoryLotReconciliationQuery = {
  branchId?: string;
  productId?: string;
  lotId?: string;
  from?: string | Date;
  to?: string | Date;
  onlyDiscrepancies?: boolean;
  discrepancyType?: InventoryLotDiscrepancyType;
};

type EnrichedDiscrepancy = InventoryLotDiscrepancyRecord & {
  severity: InventoryLotDiscrepancySeverity;
};

@Injectable()
export class InventoryLotReconciliationService {
  constructor(
    @Inject(InventoryLotReconciliationRepository)
    private readonly repository: InventoryLotReconciliationRepository,
    @Inject(FinanceAccessRepository)
    private readonly financeAccessRepository: FinanceAccessRepository
  ) {}

  private normalizeOptional(value: string | undefined) {
    const normalized = value?.trim();
    return normalized ? normalized : undefined;
  }

  private parseDate(value: string | Date | undefined, field: string) {
    if (value === undefined) {
      return undefined;
    }
    if (value instanceof Date) {
      if (Number.isNaN(value.getTime())) {
        throw new BadRequestException(`${field} is invalid`);
      }
      return value;
    }

    const normalized = value.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
      throw new BadRequestException(`${field} must use YYYY-MM-DD`);
    }

    const parsed = new Date(`${normalized}T00:00:00.000Z`);
    if (
      Number.isNaN(parsed.getTime()) ||
      parsed.toISOString().slice(0, 10) !== normalized
    ) {
      throw new BadRequestException(`${field} is invalid`);
    }
    return parsed;
  }

  private normalizeDiscrepancyType(
    value: InventoryLotDiscrepancyType | undefined
  ) {
    if (value === undefined) {
      return undefined;
    }
    if (!INVENTORY_LOT_DISCREPANCY_TYPES.includes(value)) {
      throw new BadRequestException("discrepancyType is invalid");
    }
    return value;
  }

  private severityFor(
    type: InventoryLotDiscrepancyType
  ): InventoryLotDiscrepancySeverity {
    switch (type) {
      case "LOT_LINK_TENANT_MISMATCH":
      case "LOT_BALANCE_NEGATIVE_OR_RESERVED_INVALID":
      case "LOT_BALANCE_DIFFERS_FROM_MOVEMENT_LINKS":
        return "CRITICAL";
      case "LOT_REQUIRED_MOVEMENT_WITHOUT_LOT_LINK":
      case "LOT_REQUIRED_PRODUCT_WITH_NON_LOTTED_STOCK":
      case "LOT_LINK_WITHOUT_MOVEMENT":
      case "LOT_LINK_PRODUCT_MISMATCH":
      case "LOT_BALANCE_WITHOUT_LOT":
      case "LOT_BALANCE_PRODUCT_BRANCH_MISMATCH":
        return "HIGH";
      case "EXPIRED_ACTIVE_LOT":
      case "BLOCKED_OR_CANCELLED_LOT_WITH_AVAILABLE_BALANCE":
        return "WARNING";
      default:
        return "INFO";
    }
  }

  private enrichDiscrepancies(
    discrepancies: InventoryLotDiscrepancyRecord[]
  ): EnrichedDiscrepancy[] {
    return discrepancies.map((discrepancy) => ({
      ...discrepancy,
      severity: this.severityFor(discrepancy.discrepancyType),
    }));
  }

  private countBySeverity(discrepancies: EnrichedDiscrepancy[]) {
    return {
      discrepancyCount: discrepancies.length,
      criticalCount: discrepancies.filter(
        (discrepancy) => discrepancy.severity === "CRITICAL"
      ).length,
      highCount: discrepancies.filter(
        (discrepancy) => discrepancy.severity === "HIGH"
      ).length,
      warningCount: discrepancies.filter(
        (discrepancy) => discrepancy.severity === "WARNING"
      ).length,
      infoCount: discrepancies.filter(
        (discrepancy) => discrepancy.severity === "INFO"
      ).length,
    };
  }

  private async assertBranchAccess(
    tenantId: string,
    branchId: string,
    actor: InventoryLotReconciliationActor
  ) {
    const branch = await this.financeAccessRepository.findBranchById(
      branchId,
      tenantId
    );
    if (!branch) {
      throw new BadRequestException("branchId is invalid");
    }

    if (canViewAllBranches(actor)) {
      return;
    }

    if (actor.branchId === branchId && !actor.userId) {
      return;
    }

    if (!actor.userId) {
      throw new ForbiddenException("user is required");
    }

    const branchIds =
      await this.financeAccessRepository.findAccessibleBranchIds(
        actor.userId,
        tenantId
      );
    if (branchIds.includes(branchId)) {
      return;
    }

    if (branchIds.length === 0 && actor.branchId === branchId) {
      return;
    }

    throw new ForbiddenException("not authorized for this branch");
  }

  private async normalizeFilters(
    tenantId: string,
    filters: InventoryLotReconciliationQuery = {},
    actor: InventoryLotReconciliationActor
  ): Promise<InventoryLotReconciliationFilters> {
    const branchId =
      this.normalizeOptional(filters.branchId) ??
      (canViewAllBranches(actor) ? undefined : actor.branchId);
    const productId = this.normalizeOptional(filters.productId);
    const lotId = this.normalizeOptional(filters.lotId);
    const from = this.parseDate(filters.from, "from");
    const to = this.parseDate(filters.to, "to");

    if (from && to && from > to) {
      throw new BadRequestException("from cannot be greater than to");
    }

    if (branchId) {
      await this.assertBranchAccess(tenantId, branchId, actor);
    } else if (!canViewAllBranches(actor)) {
      throw new BadRequestException("branchId is required");
    }

    return {
      branchId,
      productId,
      lotId,
      from,
      to,
      onlyDiscrepancies: filters.onlyDiscrepancies,
      discrepancyType: this.normalizeDiscrepancyType(filters.discrepancyType),
    };
  }

  async getSummary(
    tenantId: string,
    filters: InventoryLotReconciliationQuery,
    actor: InventoryLotReconciliationActor
  ) {
    const normalized = await this.normalizeFilters(tenantId, filters, actor);
    const [counts, discrepancies] = await Promise.all([
      this.repository.getSummary(tenantId, normalized),
      this.repository.findDiscrepancies(tenantId, normalized),
    ]);
    const enriched = this.enrichDiscrepancies(discrepancies);

    return {
      ...counts,
      ...this.countBySeverity(enriched),
    };
  }

  async findDiscrepancies(
    tenantId: string,
    filters: InventoryLotReconciliationQuery,
    actor: InventoryLotReconciliationActor
  ) {
    const normalized = await this.normalizeFilters(tenantId, filters, actor);
    const discrepancies = await this.repository.findDiscrepancies(
      tenantId,
      normalized
    );
    return this.enrichDiscrepancies(discrepancies);
  }

  async getProductReconciliation(
    tenantId: string,
    productId: string,
    filters: InventoryLotReconciliationQuery,
    actor: InventoryLotReconciliationActor
  ) {
    const normalized = await this.normalizeFilters(
      tenantId,
      { ...filters, productId },
      actor
    );
    const [detail, discrepancies] = await Promise.all([
      this.repository.getProductReconciliation(tenantId, productId, normalized),
      this.repository.findDiscrepancies(tenantId, normalized),
    ]);
    if (!detail) {
      throw new NotFoundException("product not found");
    }
    const enriched = this.enrichDiscrepancies(discrepancies);

    return {
      ...detail,
      discrepancies: enriched,
      summary: this.countBySeverity(enriched),
    };
  }

  async getLotReconciliation(
    tenantId: string,
    lotId: string,
    filters: InventoryLotReconciliationQuery,
    actor: InventoryLotReconciliationActor
  ) {
    const normalized = await this.normalizeFilters(
      tenantId,
      { ...filters, lotId },
      actor
    );
    const [detail, discrepancies] = await Promise.all([
      this.repository.getLotReconciliation(tenantId, lotId, normalized),
      this.repository.findDiscrepancies(tenantId, normalized),
    ]);
    if (!detail) {
      throw new NotFoundException("inventory lot not found");
    }
    const enriched = this.enrichDiscrepancies(discrepancies);

    return {
      ...detail,
      discrepancies: enriched,
      summary: this.countBySeverity(enriched),
    };
  }
}
