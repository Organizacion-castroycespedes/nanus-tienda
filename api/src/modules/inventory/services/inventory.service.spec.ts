import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { describe, it } from "node:test";
import { InventoryService } from "./inventory.service";
import type { InventoryProductRow } from "../repositories/inventory.repository";

const buildInventoryProductRow = (
  overrides: Partial<InventoryProductRow> = {}
): InventoryProductRow =>
  ({
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
  });
});
