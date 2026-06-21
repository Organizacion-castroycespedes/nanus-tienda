import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  collectPosScannerProductCodes,
  findUniquePosScannerProduct,
  normalizePosScannerCode,
} from "./pos-scanner";

const buildProduct = (overrides: Record<string, unknown> = {}) =>
  ({
    id: "prod-1",
    tenantId: "tenant-1",
    name: "Leche entera",
    description: null,
    sku: "L-001",
    stock: 10,
    price: 1000,
    priceWithoutTax: 1000,
    taxId: null,
    barcodes: [],
    ...overrides,
  }) as never;

describe("POS scanner helpers", () => {
  it("normalizes scanner codes", () => {
    assert.equal(normalizePosScannerCode("  ÁB-123  "), "ab-123");
    assert.equal(normalizePosScannerCode(null), "");
  });

  it("collects scanner codes from product fields", () => {
    const product = buildProduct({
      primaryBarcode: "ABC-001",
      barcodeCodes: ["ALT-001"],
      barcodes: [
        { barcode: "BAR-001", isActive: true },
        { code: "BAR-002", active: true },
        { value: "BAR-003", isActive: false },
      ],
    });

    assert.deepEqual(collectPosScannerProductCodes(product), [
      "abc-001",
      "l-001",
      "prod-1",
      "alt-001",
      "bar-001",
      "bar-002",
    ]);
  });

  it("finds a unique exact barcode match", () => {
    const result = findUniquePosScannerProduct("  abc-001 ", [
      buildProduct({ id: "prod-1", primaryBarcode: "ABC-001" }),
      buildProduct({ id: "prod-2", primaryBarcode: "XYZ-002" }),
    ]);

    assert.equal(result?.id, "prod-1");
  });

  it("rejects multiple exact matches", () => {
    const result = findUniquePosScannerProduct("ABC-001", [
      buildProduct({ id: "prod-1", primaryBarcode: "ABC-001" }),
      buildProduct({ id: "prod-2", barcodeCodes: ["abc-001"] }),
    ]);

    assert.equal(result, null);
  });

  it("rejects missing exact matches", () => {
    const result = findUniquePosScannerProduct("ABC-001", [
      buildProduct({ id: "prod-1", primaryBarcode: "XYZ-002" }),
    ]);

    assert.equal(result, null);
  });
});
