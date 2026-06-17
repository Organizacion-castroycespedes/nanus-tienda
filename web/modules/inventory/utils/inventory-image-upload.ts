import { buildUrl } from "../../../lib/request";

export const INVENTORY_IMAGE_ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export type InventoryImageMimeType =
  (typeof INVENTORY_IMAGE_ALLOWED_TYPES)[number];

export const INVENTORY_IMAGE_MAX_SIZE_MB = 5;

export const formatInventoryImageSize = (sizeBytes: number | null | undefined) => {
  if (!sizeBytes || sizeBytes <= 0) {
    return "Sin tamano";
  }
  if (sizeBytes < 1024 * 1024) {
    return `${Math.round(sizeBytes / 1024)} KB`;
  }
  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
};

export const buildInventoryImageUrl = (imageUrl: string | null | undefined) => {
  const normalized = imageUrl?.trim();
  if (!normalized) {
    return null;
  }
  if (/^https?:\/\//i.test(normalized)) {
    return normalized;
  }
  return buildUrl(normalized);
};

export const normalizeInventoryImageApiPath = (
  imageUrl: string | null | undefined
) => {
  const normalized = imageUrl?.trim();
  if (!normalized) {
    return null;
  }
  if (normalized.startsWith("blob:") || normalized.startsWith("data:")) {
    return normalized;
  }
  if (/^https?:\/\//i.test(normalized)) {
    try {
      const parsed = new URL(normalized);
      return parsed.pathname.replace(/^\/api(?=\/)/, "") + parsed.search;
    } catch {
      return normalized;
    }
  }
  return normalized.replace(/^\/api(?=\/)/, "");
};

export const validateInventoryImageFile = (
  file: File | null | undefined,
  maxSizeMb = INVENTORY_IMAGE_MAX_SIZE_MB
) => {
  if (!file) {
    return "Selecciona una imagen.";
  }
  if (!INVENTORY_IMAGE_ALLOWED_TYPES.includes(file.type as InventoryImageMimeType)) {
    return "Solo se permiten imagenes JPG, PNG o WebP.";
  }
  if (file.size > maxSizeMb * 1024 * 1024) {
    return `La imagen no puede superar ${maxSizeMb} MB.`;
  }
  return null;
};
