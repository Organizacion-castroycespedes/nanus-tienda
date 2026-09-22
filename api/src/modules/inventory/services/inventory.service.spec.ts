import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { describe, it } from "node:test";
import { InventoryService } from "./inventory.service";
import type { InventoryProductRow } from "../repositories/inventory.repository";

const buildInventoryProductRow = (
  overrides: Partial<InventoryProductRow> = {}
): InventoryProductRow =>
  ({
    category_id: randomUUID(),
    subcategory_id: randomUUID(),
    tenant_id: randomUUID(),
    tenant_name: "Tenant prueba",
    branch_id: randomUUID(),
    branch_name: "Sucursal prueba",
    product_id: randomUUID(),
    product_name: "Producto loteado",
    unit_id: randomUUID(),
    tax_id: null,
    description: null,
    sku: "PROD-LOT",
    price: "100",
    cost: "50",
    price_with_tax: "119",
    price_without_tax: "100",
    is_active: true,
    is_perishable: true,
    requires_lot: true,
    requires_expiration: true,
    operational_status: "ACTIVE",
    rotation_class: "HIGH",
    min_stock: "5",
    max_stock: "20",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-02T00:00:00.000Z",
    stock: "12",
    terminal_name: null,
    ...overrides,
  }) as InventoryProductRow;

describe("InventoryService product mapping", () => {
  it("returns enriched product fields from /inventory/products rows", async () => {
    const row = buildInventoryProductRow();
    const repository = {
      listInventoryProducts: async () => [row],
    };
    const financeAccessRepository = {
      findAccessibleBranchIds: async () => [],
    };
    const service = new InventoryService(
      repository as any,
      financeAccessRepository as any
    );

    const [product] = await service.listInventoryProducts(
      { tenantId: row.tenant_id, branchId: row.branch_id },
      {
        roles: ["SUPER_ADMIN"],
        tenantId: row.tenant_id,
        userId: randomUUID(),
      }
    );

    assert.equal(product.isPerishable, true);
    assert.equal(product.requiresLot, true);
    assert.equal(product.requiresExpiration, true);
    assert.equal(product.operationalStatus, "ACTIVE");
    assert.equal(product.rotationClass, "HIGH");
    assert.equal(product.minStock, 5);
    assert.equal(product.maxStock, 20);
    assert.equal(product.categoryId, row.category_id);
    assert.equal(product.subcategoryId, row.subcategory_id);
  });

  it("forwards remote product search and limit after enforcing tenant scope", async () => {
    const row = buildInventoryProductRow();
    let receivedFilters: Record<string, unknown> | undefined;
    const repository = {
      listInventoryProducts: async (filters: Record<string, unknown>) => {
        receivedFilters = filters;
        return [row];
      },
    };
    const service = new InventoryService(
      repository as any,
      { findAccessibleBranchIds: async () => [] } as any
    );

    await service.listInventoryProducts(
      {
        tenantId: row.tenant_id,
        branchId: row.branch_id,
        search: "needle",
        limit: 25,
      },
      { roles: ["SUPER_ADMIN"], tenantId: row.tenant_id, userId: randomUUID() }
    );

    assert.equal(receivedFilters?.search, "needle");
    assert.equal(receivedFilters?.limit, 25);
    assert.equal(receivedFilters?.tenantId, row.tenant_id);
  });

  it("rejects a restricted actor requesting another tenant product search", async () => {
    const service = new InventoryService(
      { listInventoryProducts: async () => [] } as any,
      { findAccessibleBranchIds: async () => [] } as any
    );

    await assert.rejects(
      () =>
        service.listInventoryProducts(
          { tenantId: "tenant-2", search: "needle", limit: 25 },
          { roles: ["ADMIN"], tenantId: "tenant-1", userId: randomUUID() }
        ),
      /No autorizado para otro tenant/
    );
  });
});
