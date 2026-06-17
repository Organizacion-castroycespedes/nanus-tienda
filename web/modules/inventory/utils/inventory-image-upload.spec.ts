import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildInventoryImageUrl,
  formatInventoryImageSize,
  normalizeInventoryImageApiPath,
  validateInventoryImageFile,
} from "./inventory-image-upload";

const buildFile = (type: string, size: number) =>
  ({
    type,
    size,
  }) as File;

describe("inventory image upload helpers", () => {
  it("validates allowed image types", () => {
    assert.equal(validateInventoryImageFile(buildFile("image/jpeg", 100)), null);
    assert.equal(validateInventoryImageFile(buildFile("image/png", 100)), null);
    assert.equal(validateInventoryImageFile(buildFile("image/webp", 100)), null);
    assert.match(
      validateInventoryImageFile(buildFile("application/pdf", 100)) ?? "",
      /JPG, PNG o WebP/
    );
  });

  it("validates missing and oversized files", () => {
    assert.match(validateInventoryImageFile(null) ?? "", /Selecciona/);
    assert.match(
      validateInventoryImageFile(buildFile("image/png", 6 * 1024 * 1024), 5) ??
        "",
      /5 MB/
    );
  });

  it("formats image sizes and resolves API image URLs", () => {
    assert.equal(formatInventoryImageSize(512), "1 KB");
    assert.equal(formatInventoryImageSize(2 * 1024 * 1024), "2.0 MB");
    assert.equal(
      buildInventoryImageUrl("/api/inventory/products/product-id/image"),
      "/api/inventory/products/product-id/image"
    );
    assert.equal(
      buildInventoryImageUrl("https://cdn.test/image.jpg"),
      "https://cdn.test/image.jpg"
    );
    assert.equal(
      normalizeInventoryImageApiPath("/api/inventory/products/product-id/image"),
      "/inventory/products/product-id/image"
    );
    assert.equal(
      normalizeInventoryImageApiPath("http://localhost:4020/api/inventory/products/product-id/image"),
      "/inventory/products/product-id/image"
    );
  });
});
