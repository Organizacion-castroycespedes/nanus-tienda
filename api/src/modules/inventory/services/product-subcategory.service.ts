import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import crypto from "crypto";
import {
  PRODUCT_IMAGE_MIME_TYPES,
  type ProductImageMimeType,
} from "../entities/product-category.entity";
import {
  ProductSubcategoryEntity,
} from "../entities/product-subcategory.entity";
import { ProductCategoryRepository } from "../repositories/product-category.repository";
import { ProductSubcategoryRepository } from "../repositories/product-subcategory.repository";

type ProductSubcategoryImageInput = {
  defaultImageUrl?: string | null;
  defaultImageStorageKey?: string | null;
  defaultImageAltText?: string | null;
  defaultImageMimeType?: ProductImageMimeType | null;
  defaultImageSizeBytes?: number | null;
};

type CreateProductSubcategoryInput = ProductSubcategoryImageInput & {
  tenantId: string;
  categoryId: string;
  name: string;
  slug?: string;
  description?: string | null;
  isActive?: boolean;
  sortOrder?: number;
};

type UpdateProductSubcategoryInput = ProductSubcategoryImageInput & {
  tenantId: string;
  subcategoryId: string;
  categoryId?: string;
  name?: string;
  slug?: string;
  description?: string | null;
  isActive?: boolean;
  sortOrder?: number;
};

export type ProductSubcategoryListFilters = {
  categoryId?: string;
  isActive?: boolean;
  search?: string;
};

@Injectable()
export class ProductSubcategoryService {
  constructor(
    @Inject(ProductSubcategoryRepository)
    private readonly productSubcategoryRepository: ProductSubcategoryRepository,
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

  private validateImage(input: ProductSubcategoryImageInput) {
    this.assertOptionalImageMimeType(
      input.defaultImageMimeType,
      "defaultImageMimeType"
    );
    this.assertOptionalNonNegative(
      input.defaultImageSizeBytes,
      "defaultImageSizeBytes"
    );
  }

  private assertSubcategoryFound(
    subcategory: ProductSubcategoryEntity | null
  ): ProductSubcategoryEntity {
    if (!subcategory) {
      throw new NotFoundException("product subcategory not found");
    }
    return subcategory;
  }

  private async assertCategoryBelongsToTenant(
    tenantId: string,
    categoryId: string
  ) {
    const category = await this.productCategoryRepository.findById(
      tenantId,
      categoryId
    );
    if (!category) {
      throw new BadRequestException("categoryId is invalid");
    }
    return category;
  }

  private async assertSlugUnique(
    tenantId: string,
    categoryId: string,
    slug: string,
    excludeSubcategoryId?: string
  ) {
    const existing = await this.productSubcategoryRepository.findBySlug(
      tenantId,
      categoryId,
      slug
    );

    if (existing && existing.id !== excludeSubcategoryId) {
      throw new BadRequestException("slug already exists for this category");
    }
  }

  async list(tenantId: string, filters: ProductSubcategoryListFilters = {}) {
    if (filters.categoryId) {
      await this.assertCategoryBelongsToTenant(tenantId, filters.categoryId);
    }
    return this.productSubcategoryRepository.findMany(tenantId, filters);
  }

  async getById(tenantId: string, subcategoryId: string) {
    return this.assertSubcategoryFound(
      await this.productSubcategoryRepository.findById(
        tenantId,
        subcategoryId
      )
    );
  }

  async create(input: CreateProductSubcategoryInput) {
    const categoryId = this.normalizeRequired(input.categoryId, "categoryId");
    await this.assertCategoryBelongsToTenant(input.tenantId, categoryId);
    const name = this.normalizeRequired(input.name, "name");
    const slug = this.normalizeSlug(input.slug, name);
    this.assertOptionalBoolean(input.isActive, "isActive");
    this.assertOptionalNonNegative(input.sortOrder, "sortOrder");
    this.validateImage(input);
    await this.assertSlugUnique(input.tenantId, categoryId, slug);

    const now = new Date();
    const subcategory = ProductSubcategoryEntity.create({
      id: crypto.randomUUID(),
      tenantId: input.tenantId,
      categoryId,
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

    return this.productSubcategoryRepository.create({
      id: subcategory.id,
      tenantId: subcategory.tenantId,
      categoryId: subcategory.categoryId,
      name: subcategory.name,
      slug: subcategory.slug,
      description: subcategory.description,
      defaultImageUrl: subcategory.defaultImageUrl,
      defaultImageStorageKey: subcategory.defaultImageStorageKey,
      defaultImageAltText: subcategory.defaultImageAltText,
      defaultImageMimeType: subcategory.defaultImageMimeType,
      defaultImageSizeBytes: subcategory.defaultImageSizeBytes,
      isActive: subcategory.isActive,
      sortOrder: subcategory.sortOrder,
      createdAt: subcategory.createdAt,
      updatedAt: subcategory.updatedAt,
    });
  }

  async update(input: UpdateProductSubcategoryInput) {
    const current = this.assertSubcategoryFound(
      await this.productSubcategoryRepository.findById(
        input.tenantId,
        input.subcategoryId
      )
    );
    this.assertOptionalBoolean(input.isActive, "isActive");
    this.assertOptionalNonNegative(input.sortOrder, "sortOrder");
    this.validateImage(input);

    const categoryId =
      input.categoryId !== undefined
        ? this.normalizeRequired(input.categoryId, "categoryId")
        : current.categoryId;
    if (input.categoryId !== undefined) {
      await this.assertCategoryBelongsToTenant(input.tenantId, categoryId);
    }

    const name =
      input.name !== undefined
        ? this.normalizeRequired(input.name, "name")
        : undefined;
    const slug =
      input.slug !== undefined ||
      name !== undefined ||
      categoryId !== current.categoryId
        ? this.normalizeSlug(input.slug, name ?? current.name)
        : undefined;

    if (slug !== undefined || categoryId !== current.categoryId) {
      await this.assertSlugUnique(
        input.tenantId,
        categoryId,
        slug ?? current.slug,
        input.subcategoryId
      );
    }

    const updated = await this.productSubcategoryRepository.update(
      input.tenantId,
      input.subcategoryId,
      {
        categoryId:
          categoryId !== current.categoryId ? categoryId : undefined,
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

    return this.assertSubcategoryFound(updated);
  }

  async activate(tenantId: string, subcategoryId: string) {
    const current = await this.getById(tenantId, subcategoryId);
    const updated = await this.productSubcategoryRepository.update(
      tenantId,
      current.id,
      { isActive: true }
    );
    return this.assertSubcategoryFound(updated);
  }

  async deactivate(tenantId: string, subcategoryId: string) {
    const current = await this.getById(tenantId, subcategoryId);
    const updated = await this.productSubcategoryRepository.update(
      tenantId,
      current.id,
      { isActive: false }
    );
    return this.assertSubcategoryFound(updated);
  }
}
