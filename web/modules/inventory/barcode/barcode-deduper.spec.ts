import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createInventoryBarcodeDeduper } from "./barcode-deduper";

describe("inventory barcode deduper", () => {
  it("ignores the same code read again within 300 ms", () => {
    const deduper = createInventoryBarcodeDeduper();
    assert.equal(deduper.shouldProcess("7701234567890", 1000), true);
    assert.equal(deduper.shouldProcess("7701234567890", 1120), false);
  });

  it("processes the same code again after the window", () => {
    const deduper = createInventoryBarcodeDeduper();
    assert.equal(deduper.shouldProcess("7701234567890", 1000), true);
    assert.equal(deduper.shouldProcess("7701234567890", 1600), true);
  });

  it("extends the window during a burst of bounces", () => {
    const deduper = createInventoryBarcodeDeduper();
    assert.equal(deduper.shouldProcess("A1234567", 0), true);
    assert.equal(deduper.shouldProcess("A1234567", 200), false);
    assert.equal(deduper.shouldProcess("A1234567", 400), false);
    assert.equal(deduper.shouldProcess("A1234567", 800), true);
  });

  it("never blocks a different code", () => {
    const deduper = createInventoryBarcodeDeduper();
    assert.equal(deduper.shouldProcess("A1234567", 0), true);
    assert.equal(deduper.shouldProcess("B1234567", 50), true);
  });

  it("compares normalized codes and rejects empty ones", () => {
    const deduper = createInventoryBarcodeDeduper();
    assert.equal(deduper.shouldProcess(" abc12345 ", 0), true);
    assert.equal(deduper.shouldProcess("ABC12345", 100), false);
    assert.equal(deduper.shouldProcess("  ", 500), false);
  });

  it("can be reset", () => {
    const deduper = createInventoryBarcodeDeduper();
    deduper.shouldProcess("A1234567", 0);
    deduper.reset();
    assert.equal(deduper.shouldProcess("A1234567", 100), true);
  });
});
