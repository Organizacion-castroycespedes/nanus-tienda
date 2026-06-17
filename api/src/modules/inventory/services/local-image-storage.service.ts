import {
  BadRequestException,
  Injectable,
  NotFoundException,
  PayloadTooLargeException,
} from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { access, mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

export type InventoryImageTarget =
  | "products"
  | "product-categories"
  | "product-subcategories";

export type UploadedInventoryImageFile = {
  originalname?: string;
  mimetype?: string;
  size?: number;
  buffer?: Buffer;
};

type SaveImageInput = {
  target: InventoryImageTarget;
  tenantId: string;
  ownerId: string;
  file: UploadedInventoryImageFile | undefined;
  maxSizeMb?: number;
};

export type SavedInventoryImage = {
  storageKey: string;
  mimeType: InventoryImageMimeType;
  sizeBytes: number;
};

export type ReadInventoryImage = {
  buffer: Buffer;
  mimeType: InventoryImageMimeType;
};

export const INVENTORY_IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export type InventoryImageMimeType =
  (typeof INVENTORY_IMAGE_MIME_TYPES)[number];

const MIME_EXTENSION_MAP: Record<InventoryImageMimeType, string[]> = {
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
  "image/webp": [".webp"],
};

const DEFAULT_MAX_IMAGE_SIZE_MB = 5;

const parsePositiveNumber = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

@Injectable()
export class LocalImageStorageService {
  readonly baseDir: string;

  constructor() {
    this.baseDir = this.resolveBaseDir();
  }

  getProductMaxSizeMb() {
    return parsePositiveNumber(
      process.env.MAX_PRODUCT_IMAGE_SIZE_MB,
      DEFAULT_MAX_IMAGE_SIZE_MB
    );
  }

  getCategoryMaxSizeMb() {
    return parsePositiveNumber(
      process.env.MAX_CATEGORY_IMAGE_SIZE_MB,
      DEFAULT_MAX_IMAGE_SIZE_MB
    );
  }

  async saveImage(input: SaveImageInput): Promise<SavedInventoryImage> {
    const validation = this.validateImageFile(input.file, input.maxSizeMb);
    const storageKey = this.buildStorageKey(
      input.target,
      input.tenantId,
      input.ownerId,
      validation.extension
    );
    const filePath = this.resolveStoragePath(storageKey);

    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, validation.buffer, { flag: "wx" });

    return {
      storageKey,
      mimeType: validation.mimeType,
      sizeBytes: validation.sizeBytes,
    };
  }

  async readImage(
    storageKey: string,
    mimeType: InventoryImageMimeType
  ): Promise<ReadInventoryImage> {
    const filePath = this.resolveStoragePath(storageKey);

    try {
      const buffer = await readFile(filePath);
      return { buffer, mimeType };
    } catch {
      throw new NotFoundException("image file not found");
    }
  }

  async deleteImage(storageKey: string | null | undefined) {
    if (!storageKey) {
      return;
    }

    const filePath = this.resolveStoragePath(storageKey);
    try {
      await unlink(filePath);
    } catch {
      // DB metadata is source of truth. Missing local file is already deleted.
    }
  }

  buildImageUrl(target: InventoryImageTarget, ownerId: string) {
    if (target === "products") {
      return `/inventory/products/${ownerId}/image`;
    }
    if (target === "product-categories") {
      return `/inventory/product-categories/${ownerId}/image`;
    }
    return `/inventory/product-subcategories/${ownerId}/image`;
  }

  buildStorageKey(
    target: InventoryImageTarget,
    tenantId: string,
    ownerId: string,
    extension: string
  ) {
    const safeExtension = this.normalizeExtension(extension);
    return `${target}/${tenantId}/${ownerId}/${randomUUID()}${safeExtension}`;
  }

  resolveStoragePath(storageKey: string) {
    if (!storageKey || storageKey.includes("..")) {
      throw new BadRequestException("storage key is invalid");
    }

    const normalizedKey = storageKey.replace(/\\/g, "/");
    const filePath = path.resolve(this.baseDir, normalizedKey);
    const basePath = path.resolve(this.baseDir);

    if (filePath !== basePath && !filePath.startsWith(`${basePath}${path.sep}`)) {
      throw new BadRequestException("storage key is invalid");
    }

    return filePath;
  }

  validateImageFile(
    file: UploadedInventoryImageFile | undefined,
    maxSizeMb = DEFAULT_MAX_IMAGE_SIZE_MB
  ) {
    if (!file?.buffer || file.buffer.length === 0) {
      throw new BadRequestException("image file is required");
    }

    const mimeType = file.mimetype as InventoryImageMimeType | undefined;
    if (!mimeType || !INVENTORY_IMAGE_MIME_TYPES.includes(mimeType)) {
      throw new BadRequestException("image MIME type is not allowed");
    }

    const originalName = file.originalname ?? "";
    if (
      !originalName ||
      originalName.includes("/") ||
      originalName.includes("\\") ||
      originalName.includes("..")
    ) {
      throw new BadRequestException("image filename is invalid");
    }

    const extension = this.normalizeExtension(path.extname(originalName));
    if (!MIME_EXTENSION_MAP[mimeType].includes(extension)) {
      throw new BadRequestException("image extension is not allowed");
    }

    const sizeBytes = file.size ?? file.buffer.length;
    const maxBytes = Math.floor(maxSizeMb * 1024 * 1024);
    if (sizeBytes > maxBytes) {
      throw new PayloadTooLargeException("image file is too large");
    }

    this.assertMagicBytes(file.buffer, mimeType);

    return {
      buffer: file.buffer,
      extension,
      mimeType,
      sizeBytes,
    };
  }

  async exists(storageKey: string) {
    try {
      await access(this.resolveStoragePath(storageKey));
      return true;
    } catch {
      return false;
    }
  }

  private resolveBaseDir() {
    const configured = process.env.LOCAL_UPLOADS_DIR?.trim();
    if (configured) {
      return path.resolve(process.cwd(), configured);
    }

    const cwd = process.cwd();
    if (path.basename(cwd).toLowerCase() === "api") {
      return path.resolve(cwd, "..", "storage", "uploads");
    }
    return path.resolve(cwd, "storage", "uploads");
  }

  private normalizeExtension(extension: string) {
    const normalized = extension.trim().toLowerCase();
    if (![".jpg", ".jpeg", ".png", ".webp"].includes(normalized)) {
      throw new BadRequestException("image extension is not allowed");
    }
    return normalized === ".jpeg" ? ".jpg" : normalized;
  }

  private assertMagicBytes(buffer: Buffer, mimeType: InventoryImageMimeType) {
    const hasJpegSignature =
      buffer.length >= 3 &&
      buffer[0] === 0xff &&
      buffer[1] === 0xd8 &&
      buffer[2] === 0xff;
    const hasPngSignature =
      buffer.length >= 8 &&
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47 &&
      buffer[4] === 0x0d &&
      buffer[5] === 0x0a &&
      buffer[6] === 0x1a &&
      buffer[7] === 0x0a;
    const hasWebpSignature =
      buffer.length >= 12 &&
      buffer.toString("ascii", 0, 4) === "RIFF" &&
      buffer.toString("ascii", 8, 12) === "WEBP";

    if (
      (mimeType === "image/jpeg" && !hasJpegSignature) ||
      (mimeType === "image/png" && !hasPngSignature) ||
      (mimeType === "image/webp" && !hasWebpSignature)
    ) {
      throw new BadRequestException("image file signature is invalid");
    }
  }
}
