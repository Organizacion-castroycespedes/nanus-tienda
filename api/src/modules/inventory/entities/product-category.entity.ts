const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value
  );

export const PRODUCT_IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export type ProductImageMimeType = (typeof PRODUCT_IMAGE_MIME_TYPES)[number];

export type ProductImageMetadata = {
  defaultImageUrl?: string | null;
  defaultImageStorageKey?: string | null;
  defaultImageAltText?: string | null;
  defaultImageMimeType?: ProductImageMimeType | null;
  defaultImageSizeBytes?: number | null;
};

export type ProductCategoryProps = ProductImageMetadata & {
  id: string;
  tenantId: string;
  name: string;
  slug: string;
  description?: string | null;
  isActive?: boolean;
  sortOrder?: number;
  createdAt: Date;
  updatedAt: Date;
};

const normalizeNullableText = (value: string | null | undefined) =>
  value?.trim() || null;

const assertOptionalNonNegative = (
  value: number | null | undefined,
  field: string
) => {
  if (value === undefined || value === null) {
    return;
  }
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${field} must be a non-negative number`);
  }
};

const assertOptionalImageMimeType = (
  value: ProductImageMimeType | null | undefined,
  field: string
) => {
  if (value === undefined || value === null) {
    return;
  }
  if (!PRODUCT_IMAGE_MIME_TYPES.includes(value)) {
    throw new Error(`${field} is invalid`);
  }
};

export class ProductCategoryEntity {
  readonly id: string;
  readonly tenantId: string;
  readonly name: string;
  readonly slug: string;
  readonly description: string | null;
  readonly defaultImageUrl: string | null;
  readonly defaultImageStorageKey: string | null;
  readonly defaultImageAltText: string | null;
  readonly defaultImageMimeType: ProductImageMimeType | null;
  readonly defaultImageSizeBytes: number | null;
  readonly isActive: boolean;
  readonly sortOrder: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  constructor(props: ProductCategoryProps) {
    if (!isUuid(props.id)) {
      throw new Error("id must be a valid UUID");
    }
    if (!isUuid(props.tenantId)) {
      throw new Error("tenantId must be a valid UUID");
    }
    if (!props.name?.trim()) {
      throw new Error("name is required");
    }
    if (!props.slug?.trim()) {
      throw new Error("slug is required");
    }
    if (props.sortOrder !== undefined && props.sortOrder < 0) {
      throw new Error("sortOrder must be a non-negative number");
    }
    assertOptionalImageMimeType(
      props.defaultImageMimeType,
      "defaultImageMimeType"
    );
    assertOptionalNonNegative(
      props.defaultImageSizeBytes,
      "defaultImageSizeBytes"
    );

    this.id = props.id;
    this.tenantId = props.tenantId;
    this.name = props.name.trim();
    this.slug = props.slug.trim().toLowerCase();
    this.description = normalizeNullableText(props.description);
    this.defaultImageUrl = normalizeNullableText(props.defaultImageUrl);
    this.defaultImageStorageKey = normalizeNullableText(
      props.defaultImageStorageKey
    );
    this.defaultImageAltText = normalizeNullableText(
      props.defaultImageAltText
    );
    this.defaultImageMimeType = props.defaultImageMimeType ?? null;
    this.defaultImageSizeBytes = props.defaultImageSizeBytes ?? null;
    this.isActive = props.isActive ?? true;
    this.sortOrder = props.sortOrder ?? 0;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  static create(props: ProductCategoryProps) {
    return new ProductCategoryEntity(props);
  }
}
