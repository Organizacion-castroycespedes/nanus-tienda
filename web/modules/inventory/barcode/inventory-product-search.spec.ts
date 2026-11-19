import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { searchInventoryProducts, type InventorySearchableProduct } from "./inventory-product-search";

const product = (id: string, name: string, sku: string, codes: string[] = []): InventorySearchableProduct => ({
  id,
  name,
  sku,
  primaryBarcode: codes[0] ?? null,
  barcodeCodes: codes,
  barcodes: [],
});

const catalog = [
  product("1", "Leche entera 1L", "LEC-001", ["7701234567890"]),
  product("2", "Arroz Diana 500g", "ARR-500"),
  product("3", "Bebida de leche achocolatada", "BEB-010"),
  product("4", "Azúcar morena", "AZU-001"),
];

describe("inventory product search", () => {
  it("requires at least 2 characters", () => {
    assert.deepEqual(searchInventoryProducts(catalog, "l"), []);
  });

  it("matches name, SKU and barcode without accents and ranks name prefixes first", () => {
    assert.deepEqual(searchInventoryProducts(catalog, "leche").map((item) => item.id), ["1", "3"]);
    assert.deepEqual(searchInventoryProducts(catalog, "arr-5").map((item) => item.id), ["2"]);
    assert.deepEqual(searchInventoryProducts(catalog, "770123").map((item) => item.id), ["1"]);
    assert.deepEqual(searchInventoryProducts(catalog, "azucar").map((item) => item.id), ["4"]);
  });

  it("requires every term and respects the limit", () => {
    assert.deepEqual(searchInventoryProducts(catalog, "leche choco").map((item) => item.id), ["3"]);
    assert.equal(searchInventoryProducts(catalog, "le", 1).length, 1);
  });
});
