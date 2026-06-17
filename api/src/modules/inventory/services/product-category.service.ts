import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import crypto from "crypto";
import {
  PRODUCT_IMAGE_MIME_TYPES,
  ProductCategoryEntity,
  type ProductImageMimeType,
} from "../entities/product-category.entity";
import { ProductCategoryRepository } from "../repositories/product-category.repository";

type ProductCategoryImageInput = {
  defaultImageUrl?: string | null;
  defaultImageStorageKey?: string | null;
  defaultImageAltText?: string | null;
  defaultImageMimeType?: ProductImageMimeType | null;
  defaultImageSizeBytes?: number | null;
};

type CreateProductCategoryInput = ProductCategoryImageInput & {
  tenantId: string;
  name: string;
  slug?: string;
  description?: string | null;
  isActive?: boolean;
  sortOrder?: number;
};

type UpdateProductCategoryInput = ProductCategoryImageInput & {
  tenantId: string;
  categoryId: string;
  name?: string;
  slug?: string;
  description?: string | null;
  isActive?: boolean;
  sortOrder?: number;
};

export type ProductCategoryListFilters = {
  isActive?: boolean;
  search?: string;
};

@Injectable()
export class ProductCategoryService {
  constructor(
    @Inject(ProductCategoryRepository)
    private readonly productCategoryRepository: ProductCategoryRepository
  ) {}

  private normalizeRequired(value: string | undefined, field: string) {
    const normalized = value?.trim();
    if (!normalized) {
      throw new BadRequestException(`${field} is required`);
    }
    return normalized;
  }

  private normalizeNullableText(value: string | null | undefined) {
    if (value === null) {
      return null;
    }
    const normalized = value?.trim();
    return normalized ? normalized : null;
  }

  private normalizeSlug(value: string | undefined, fallbackName: string) {
    const source = value?.trim() || fallbackName;
    const slug = source
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 180);

    if (!slug) {
      throw new BadRequestException("slug is required");
    }

    return slug;
  }

  private assertOptionalBoolean(value: boolean | undefined, field: string) {
    if (value === undefined) {
      return;
    }
    if (typeof value !== "boolean") {
      throw new BadRequestException(`${field} must be a boolean`);
    }
  }

  private assertOptionalNonNegative(
    value: number | null | undefined,
    field: string
  ) {
    if (value === undefined || value === null) {
      return;
    }
    if (!Number.isFinite(value) || value < 0) {
      throw new BadRequestException(`${field} must be a non-negative number`);
    }
  }

  private assertOptionalImageMimeType(
    value: ProductImageMimeType | null | undefined,
    field: string
  ) {
    if (value === undefined || value === null) {
      return;
    }
    if (!PRODUCT_IMAGE_MIME_TYPES.includes(value)) {
      throw new BadRequestException(`${field} is invalid`);
    }
  }

  private validateImage(input: ProductCategoryImageInput) {
    this.assertOptionalImageMimeType(
      input.defaultImageMimeType,
      "defaultImageMimeType"
    );
    this.assertOptionalNonNegative(
      input.defaultImageSizeBytes,
      "defaultImageSizeBytes"
    );
  }

  private assertCategoryFound(
    category: ProductCategoryEntity | null
  ): ProductCategoryEntity {
    if (!category) {
      throw new NotFoundException("product category not found");
    }
    return category;
  }

  private async assertSlugUnique(
    tenantId: string,
    slug: string,
    excludeCategoryId?: string
  ) {
    const existing = await this.productCategoryRepository.findBySlug(
      tenantId,
      slug
    );

    if (existing && existing.id !== excludeCategoryId) {
      throw new BadRequestException("slug already exists for this tenant");
    }
  }

  async list(tenantId: string, filters: ProductCategoryListFilters = {}) {
    return this.productCategoryRepository.findMany(tenantId, filters);
  }

  async getById(tenantId: string, categoryId: string) {
    return this.assertCategoryFound(
      await this.productCategoryRepository.findById(tenantId, categoryId)
    );
  }

  async create(input: CreateProductCategoryInput) {
    const name = this.normalizeRequired(input.name, "name");
    const slug = this.normalizeSlug(input.slug, name);
    this.assertOptionalBoolean(input.isActive, "isActive");
    this.assertOptionalNonNegative(input.sortOrder, "sortOrder");
    this.validateImage(input);
    await this.assertSlugUnique(input.tenantId, slug);

    const now = new Date();
    const category = ProductCategoryEntity.create({
      id: crypto.randomUUID(),
      tenantId: input.tenantId,
      name,
      slug,
      description: this.normalizeNullableText(input.description),
      defaultImageUrl: this.normalizeNullableText(input.defaultImageUrl),
      defaultImageStorageKey: this.normalizeNullableText(
        input.defaultImageStorageKey
      ),
      defaultImageAltText: this.normalizeNullableText(
        input.defaultImageAltText
      ),
      defaultImageMimeType: input.defaultImageMimeType ?? null,
      defaultImageSizeBytes: input.defaultImageSizeBytes ?? null,
      isActive: input.isActive ?? true,
      sortOrder: input.sortOrder ?? 0,
      createdAt: now,
      updatedAt: now,
    });

    return this.productCategoryRepository.create({
      id: category.id,
      tenantId: category.tenantId,
      name: category.name,
      slug: category.slug,
      description: category.description,
      defaultImageUrl: category.defaultImageUrl,
      defaultImageStorageKey: category.defaultImageStorageKey,
      defaultImageAltText: category.defaultImageAltText,
      defaultImageMimeType: category.defaultImageMimeType,
      defaultImageSizeBytes: category.defaultImageSizeBytes,
      isActive: category.isActive,
      sortOrder: category.sortOrder,
      createdAt: category.createdAt,
      updatedAt: category.updatedAt,
    });
  }

  async update(input: UpdateProductCategoryInput) {
    const current = this.assertCategoryFound(
      await this.productCategoryRepository.findById(
        input.tenantId,
        input.categoryId
      )
    );
    this.assertOptionalBoolean(input.isActive, "isActive");
    this.assertOptionalNonNegative(input.sortOrder, "sortOrder");
    this.validateImage(input);

    const name =
      input.name !== undefined
        ? this.normalizeRequired(input.name, "name")
        : undefined;
    const slug =
      input.slug !== undefined || name !== undefined
        ? this.normalizeSlug(input.slug, name ?? current.name)
        : undefined;

    if (slug !== undefined) {
      await this.assertSlugUnique(input.tenantId, slug, input.categoryId);
    }

    const updated = await this.productCategoryRepository.update(
      input.tenantId,
      input.categoryId,
      {
        name,
        slug,
        description:
          input.description !== undefined
            ? this.normalizeNullableText(input.description)
            : undefined,
        defaultImageUrl:
          input.defaultImageUrl !== undefined
            ? this.normalizeNullableText(input.defaultImageUrl)
            : undefined,
        defaultImageStorageKey:
          input.defaultImageStorageKey !== undefined
            ? this.normalizeNullableText(input.defaultImageStorageKey)
            : undefined,
        defaultImageAltText:
          input.defaultImageAltText !== undefined
            ? this.normalizeNullableText(input.defaultImageAltText)
            : undefined,
        defaultImageMimeType: input.defaultImageMimeType,
        defaultImageSizeBytes: input.defaultImageSizeBytes,
        isActive: input.isActive,
        sortOrder: input.sortOrder,
      }
    );

    return this.assertCategoryFound(updated);
  }

  async activate(tenantId: string, categoryId: string) {
    const current = await this.getById(tenantId, categoryId);
    const updated = await this.productCategoryRepository.update(
      tenantId,
      current.id,
      { isActive: true }
    );
    return this.assertCategoryFound(updated);
  }

  async deactivate(tenantId: string, categoryId: string) {
    const current = await this.getById(tenantId, categoryId);
    const updated = await this.productCategoryRepository.update(
      tenantId,
      current.id,
      { isActive: false }
    );
    return this.assertCategoryFound(updated);
  }
}
