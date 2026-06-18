import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, describe, it } from "node:test";
import { LocalImageStorageService } from "./local-image-storage.service";

const tenantId = randomUUID();
const ownerId = randomUUID();
const tempDirs: string[] = [];

const jpegBuffer = Buffer.from([0xff, 0xd8, 0xff, 0x00]);
const pngBuffer = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00,
]);
const webpBuffer = Buffer.concat([
  Buffer.from("RIFF", "ascii"),
  Buffer.from([0x00, 0x00, 0x00, 0x00]),
  Buffer.from("WEBP", "ascii"),
]);

const createService = async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "inventory-images-"));
  tempDirs.push(dir);
  process.env.LOCAL_UPLOADS_DIR = dir;
  return new LocalImageStorageService();
};

const buildFile = (
  originalname: string,
  mimetype: string,
  buffer: Buffer
) => ({
  originalname,
  mimetype,
  size: buffer.length,
  buffer,
});

after(async () => {
  delete process.env.LOCAL_UPLOADS_DIR;
  for (const dir of tempDirs) {
    await rm(dir, { recursive: true, force: true });
  }
});

describe("LocalImageStorageService", () => {
  it("accepts jpeg, png and webp images", async () => {
    const service = await createService();

    const jpeg = await service.saveImage({
      target: "products",
      tenantId,
      ownerId,
      file: buildFile("image.jpg", "image/jpeg", jpegBuffer),
    });
    const png = await service.saveImage({
      target: "product-categories",
      tenantId,
      ownerId,
      file: buildFile("image.png", "image/png", pngBuffer),
    });
    const webp = await service.saveImage({
      target: "product-subcategories",
      tenantId,
      ownerId,
      file: buildFile("image.webp", "image/webp", webpBuffer),
    });

    assert.match(jpeg.storageKey, /^products\/.+\.jpg$/);
    assert.match(png.storageKey, /^product-categories\/.+\.png$/);
    assert.match(webp.storageKey, /^product-subcategories\/.+\.webp$/);
    assert.equal(await service.exists(jpeg.storageKey), true);
    assert.equal(await service.exists(png.storageKey), true);
    assert.equal(await service.exists(webp.storageKey), true);
  });

  it("rejects MIME types and extensions that are not allowed", async () => {
    const service = await createService();

    assert.throws(
      () =>
        service.validateImageFile(
          buildFile("image.pdf", "application/pdf", jpegBuffer)
        ),
      /MIME type/
    );
    assert.throws(
      () =>
        service.validateImageFile(
          buildFile("image.png", "image/jpeg", jpegBuffer)
        ),
      /extension/
    );
  });

  it("rejects images over the configured size", async () => {
    const service = await createService();

    assert.throws(
      () =>
        service.validateImageFile(
          buildFile("image.jpg", "image/jpeg", jpegBuffer),
          0.000001
        ),
      /too large/
    );
  });

  it("rejects path traversal and invalid signatures", async () => {
    const service = await createService();

    assert.throws(
      () =>
        service.validateImageFile(
          buildFile("../image.jpg", "image/jpeg", jpegBuffer)
        ),
      /filename/
    );
    assert.throws(
      () =>
        service.validateImageFile(
          buildFile("image.jpg", "image/jpeg", Buffer.from("not-image"))
        ),
      /signature/
    );
    assert.throws(() => service.resolveStoragePath("../bad.jpg"), /storage key/);
  });

  it("builds API-relative image URLs without exposing local paths", async () => {
    const service = await createService();

    assert.equal(
      service.buildImageUrl("products", ownerId),
      `/inventory/products/${ownerId}/image`
    );
    assert.equal(
      service.buildImageUrl("product-categories", ownerId),
      `/inventory/product-categories/${ownerId}/image`
    );
    assert.equal(
      service.buildImageUrl("product-subcategories", ownerId),
      `/inventory/product-subcategories/${ownerId}/image`
    );
  });
});
