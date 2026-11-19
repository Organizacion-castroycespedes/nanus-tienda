import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { ProductBarcodeSummary } from "../../../domains/products/dtos";
import {
  normalizeInventoryBarcode,
  resolveInventoryBarcode,
  resolveInventoryBarcodeInScope,
  type InventoryBarcodeProduct,
} from "./barcode-resolver";

const barcode = (
  code: string,
  barcodeType: ProductBarcodeSummary["barcodeType"] = "UNIT",
  isActive = true
): ProductBarcodeSummary => ({ code, barcode: code, barcodeType, isPrimary: false, isActive });

const product = (
  id: string,
  sku: string,
  barcodes: ProductBarcodeSummary[] = []
): InventoryBarcodeProduct => ({
  id,
  sku,
  barcodes,
  barcodeCodes: barcodes.filter((item) => item.isActive).map((item) => item.code),
  primaryBarcode: barcodes[0]?.code ?? null,
});

const leche = product("p-leche", "LEC-001", [barcode("7701234567890"), barcode("17701234567897", "BOX")]);
const arroz = product("p-arroz", "ARR-001", [barcode("7709876543210"), barcode("7700000000001", "UNIT", false)]);
const choque = product("p-choque", "7709876543210");

describe("inventory barcode resolver", () => {
  it("normalizes case, accents and spaces", () => {
    assert.equal(normalizeInventoryBarcode("  Ábc-01 "), "abc-01");
    assert.equal(normalizeInventoryBarcode(null), "");
  });

  it("returns MATCH for a unique active barcode", () => {
    const result = resolveInventoryBarcode(" 7701234567890 ", [leche, arroz]);
    assert.equal(result.kind, "MATCH");
    assert.equal(result.kind === "MATCH" && result.product.id, "p-leche");
    assert.equal(result.code, "7701234567890");
  });

  it("matches by SKU case-insensitively", () => {
    const result = resolveInventoryBarcode("arr-001", [leche, arroz]);
    assert.equal(result.kind === "MATCH" && result.product.id, "p-arroz");
  });

  it("returns AMBIGUOUS when the code matches more than one product", () => {
    const result = resolveInventoryBarcode("7709876543210", [leche, arroz, choque]);
    assert.equal(result.kind, "AMBIGUOUS");
    assert.deepEqual(
      result.kind === "AMBIGUOUS" && result.candidates.map((item) => item.id),
      ["p-arroz", "p-choque"]
    );
  });

  it("returns NOT_FOUND for unknown, empty and inactive codes", () => {
    assert.equal(resolveInventoryBarcode("0000", [leche, arroz]).kind, "NOT_FOUND");
    assert.equal(resolveInventoryBarcode("   ", [leche, arroz]).kind, "NOT_FOUND");
    assert.equal(resolveInventoryBarcode("7700000000001", [leche, arroz]).kind, "NOT_FOUND");
  });

  it("blocks BOX and PACKAGE barcodes as unsupported presentations", () => {
    const result = resolveInventoryBarcode("17701234567897", [leche, arroz]);
    assert.equal(result.kind, "PRESENTATION_UNSUPPORTED");
    assert.equal(result.kind === "PRESENTATION_UNSUPPORTED" && result.barcodeType, "BOX");
  });

  it("treats products outside the loaded catalog as not found", () => {
    assert.equal(resolveInventoryBarcode("7701234567890", [arroz]).kind, "NOT_FOUND");
  });

  it("reports OUT_OF_SCOPE when the product exists but not in the document", () => {
    const result = resolveInventoryBarcodeInScope("7701234567890", [arroz], [leche, arroz]);
    assert.equal(result.kind, "OUT_OF_SCOPE");
    assert.equal(result.kind === "OUT_OF_SCOPE" && result.product.id, "p-leche");
  });

  it("keeps NOT_FOUND when the code is unknown everywhere", () => {
    assert.equal(resolveInventoryBarcodeInScope("123", [arroz], [leche, arroz]).kind, "NOT_FOUND");
  });

  it("resolves inside the scope first", () => {
    const result = resolveInventoryBarcodeInScope("7709876543210", [arroz], [arroz, choque]);
    assert.equal(result.kind === "MATCH" && result.product.id, "p-arroz");
  });
});
