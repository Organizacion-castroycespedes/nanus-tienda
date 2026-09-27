import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  getCachedInventoryImageUrl,
  getInventoryImageCacheSize,
  invalidateInventoryImageCache,
} from "./inventory-image-cache";

describe("inventory-image-cache", () => {
  beforeEach(() => {
    // Clean cache state
    invalidateInventoryImageCache();
  });

  it("returns null for non-existent or empty image path", () => {
    assert.equal(getCachedInventoryImageUrl(""), null);
    assert.equal(getCachedInventoryImageUrl("/non-existent.jpg"), null);
  });

  it("handles blob: and data: urls directly without cache lookup", () => {
    const blobUrl = "blob:http://localhost:3000/1234-5678";
    const dataUrl = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA";

    assert.equal(getCachedInventoryImageUrl(blobUrl), blobUrl);
    assert.equal(getCachedInventoryImageUrl(dataUrl), dataUrl);
  });

  it("tracks cache size and allows total invalidation", () => {
    assert.equal(getInventoryImageCacheSize(), 0);
    invalidateInventoryImageCache();
    assert.equal(getInventoryImageCacheSize(), 0);
  });
});
