import { Inject, Injectable } from "@nestjs/common";
import type { PoolClient, QueryResultRow } from "pg";
import { DatabaseService } from "../../../common/db/database.service";
import {
  ProductCategoryEntity,
  type ProductCategoryProps,
  type ProductImageMimeType,
} from "../entities/product-category.entity";

type ProductCategoryRow = QueryResultRow & {
  id: string;
  tenant_id: string;
  name: string;
  slug: string;
  description: string | null;
  default_image_url: string | null;
  default_image_storage_key: string | null;
  default_image_alt_text: string | null;
  default_image_mime_type: ProductImageMimeType | null;
  default_image_size_bytes: string | number | null;
  is_active: boolean;
  sort_order: number;
  created_at: Date | string;
  updated_at: Date | string;
};

export type ProductCategoryFilters = {
  isActive?: boolean;
  search?: string;
};

type CreateProductCategoryData = ProductCategoryProps;

type UpdateProductCategoryData = Partial<
  Pick<
    ProductCategoryProps,
    | "name"
    | "slug"
    | "description"
    | "defaultImageUrl"
    | "defaultImageStorageKey"
    | "defaultImageAltText"
    | "defaultImageMimeType"
    | "defaultImageSizeBytes"
    | "isActive"
    | "sortOrder"
  >
>;

@Injectable()
export class ProductCategoryRepository {
  constructor(
    @Inject(DatabaseService) private readonly db: DatabaseService
  ) {}

  private readonly selectColumns = `
    id,
    tenant_id,
    name,
    slug,
    description,
    default_image_url,
    default_image_storage_key,
    default_image_alt_text,
    default_image_mime_type,
    default_image_size_bytes,
    is_active,
    sort_order,
    created_at,
    updated_at
  `;

  private async query<T extends QueryResultRow>(
    text: string,
    params: unknown[] = [],
    client?: PoolClient
  ) {
    if (client) {
      return client.query<T>(text, params);
    }
    return this.db.query<T>(text, params);
  }

  private mapRowToEntity(row: ProductCategoryRow): ProductCategoryEntity {
    return ProductCategoryEntity.create({
      id: row.id,
      tenantId: row.tenant_id,
      name: row.name,
      slug: row.slug,
      description: row.description,
      defaultImageUrl: row.default_image_url,
      defaultImageStorageKey: row.default_image_storage_key,
      defaultImageAltText: row.default_image_alt_text,
      defaultImageMimeType: row.default_image_mime_type,
      defaultImageSizeBytes:
        row.default_image_size_bytes === null
          ? null
          : Number(row.default_image_size_bytes),
      isActive: row.is_active,
      sortOrder: row.sort_order,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    });
  }

  async findMany(
    tenantId: string,
    filters: ProductCategoryFilters = {},
    client?: PoolClient
  ): Promise<ProductCategoryEntity[]> {
    const params: unknown[] = [tenantId];
    const where = ["tenant_id = $1"];

    if (filters.isActive !== undefined) {
      params.push(filters.isActive);
      where.push(`is_active = $${params.length}`);
    }

    const search = filters.search?.trim();
    if (search) {
      params.push(`%${search}%`);
      where.push(
        `(name ILIKE $${params.length} OR slug ILIKE $${params.length})`
      );
    }

    const result = await this.query<ProductCategoryRow>(
      `
      SELECT
        ${this.selectColumns}
      FROM product_categories
      WHERE ${where.join("\n        AND ")}
      ORDER BY sort_order ASC, name ASC
      `,
      params,
      client
    );

    return (result.rows ?? []).map((row) => this.mapRowToEntity(row));
  }

  async findById(
    tenantId: string,
    categoryId: string,
    client?: PoolClient
  ): Promise<ProductCategoryEntity | null> {
    const result = await this.query<ProductCategoryRow>(
      `
      SELECT
        ${this.selectColumns}
      FROM product_categories
      WHERE tenant_id = $1 AND id = $2
      LIMIT 1
      `,
      [tenantId, categoryId],
      client
    );

    return result.rows[0] ? this.mapRowToEntity(result.rows[0]) : null;
  }

  async findBySlug(
    tenantId: string,
    slug: string,
    client?: PoolClient
  ): Promise<ProductCategoryEntity | null> {
    const result = await this.query<ProductCategoryRow>(
      `
      SELECT
        ${this.selectColumns}
      FROM product_categories
      WHERE tenant_id = $1 AND slug = $2
      LIMIT 1
      `,
      [tenantId, slug],
      client
    );

    return result.rows[0] ? this.mapRowToEntity(result.rows[0]) : null;
  }

  async create(
    data: CreateProductCategoryData,
    client?: PoolClient
  ): Promise<ProductCategoryEntity> {
    const result = await this.query<ProductCategoryRow>(
      `
      INSERT INTO product_categories (
        id,
        tenant_id,
        name,
        slug,
        description,
        default_image_url,
        default_image_storage_key,
        default_image_alt_text,
        default_image_mime_type,
        default_image_size_bytes,
        is_active,
        sort_order,
        created_at,
        updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7,
        $8, $9, $10, $11, $12, $13, $14
      )
      RETURNING
        ${this.selectColumns}
      `,
      [
        data.id,
        data.tenantId,
        data.name,
        data.slug,
        data.description ?? null,
        data.defaultImageUrl ?? null,
        data.defaultImageStorageKey ?? null,
        data.defaultImageAltText ?? null,
        data.defaultImageMimeType ?? null,
        data.defaultImageSizeBytes ?? null,
        data.isActive ?? true,
        data.sortOrder ?? 0,
        data.createdAt,
        data.updatedAt,
      ],
      client
    );

    return this.mapRowToEntity(result.rows[0]);
  }

  async update(
    tenantId: string,
    categoryId: string,
    data: UpdateProductCategoryData,
    client?: PoolClient
  ): Promise<ProductCategoryEntity | null> {
    const updates: string[] = [];
    const params: unknown[] = [tenantId, categoryId];

    const addUpdate = (column: string, value: unknown) => {
      params.push(value);
      updates.push(`${column} = $${params.length}`);
    };

    if (data.name !== undefined) {
      addUpdate("name", data.name);
    }
    if (data.slug !== undefined) {
      addUpdate("slug", data.slug);
    }
    if (data.description !== undefined) {
      addUpdate("description", data.description);
    }
    if (data.defaultImageUrl !== undefined) {
      addUpdate("default_image_url", data.defaultImageUrl);
    }
    if (data.defaultImageStorageKey !== undefined) {
      addUpdate("default_image_storage_key", data.defaultImageStorageKey);
    }
    if (data.defaultImageAltText !== undefined) {
      addUpdate("default_image_alt_text", data.defaultImageAltText);
    }
    if (data.defaultImageMimeType !== undefined) {
      addUpdate("default_image_mime_type", data.defaultImageMimeType);
    }
    if (data.defaultImageSizeBytes !== undefined) {
      addUpdate("default_image_size_bytes", data.defaultImageSizeBytes);
    }
    if (data.isActive !== undefined) {
      addUpdate("is_active", data.isActive);
    }
    if (data.sortOrder !== undefined) {
      addUpdate("sort_order", data.sortOrder);
    }

    if (updates.length === 0) {
      return this.findById(tenantId, categoryId, client);
    }

    const result = await this.query<ProductCategoryRow>(
      `
      UPDATE product_categories
      SET
        ${updates.join(",\n        ")},
        updated_at = NOW()
      WHERE tenant_id = $1 AND id = $2
      RETURNING
        ${this.selectColumns}
      `,
      params,
      client
    );

    return result.rows[0] ? this.mapRowToEntity(result.rows[0]) : null;
  }

  async countProducts(
    tenantId: string,
    categoryId: string,
    client?: PoolClient
  ): Promise<number> {
    const result = await this.query<{ count: string }>(
      `
      SELECT COUNT(*)::text AS count
      FROM products
      WHERE tenant_id = $1 AND category_id = $2
      `,
      [tenantId, categoryId],
      client
    );

    return Number(result.rows[0]?.count ?? 0);
  }
}
