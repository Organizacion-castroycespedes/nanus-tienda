import { ForbiddenException, Inject, Injectable } from "@nestjs/common";
import {
  InventoryRepository,
  type InventoryProductRow,
} from "../repositories/inventory.repository";
import {
  normalizeOptionalFilter,
  type BranchScopedActor,
  type BranchScopedFilters,
} from "../utils/access";

@Injectable()
export class InventoryService {
  constructor(
    @Inject(InventoryRepository)
    private readonly repository: InventoryRepository
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
}
