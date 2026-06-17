import { Inject, Injectable } from "@nestjs/common";
import type { PoolClient, QueryResultRow } from "pg";
import { DatabaseService } from "../../../common/db/database.service";
import type { ProductImageMimeType } from "../entities/product-category.entity";
import { ProductEntity, type ProductProps } from "../entities/product.entity";

type ProductRow = QueryResultRow & {
  id: string;
  tenant_id: string;
  unit_id: string;
  tax_id: string | null;
  name: string;
  description: string | null;
  sku: string;
  price: string | number;
  cost: string | number;
  price_with_tax: string | number;
  price_without_tax: string | number;
  is_active: boolean;
  is_perishable: boolean;
  requires_lot: boolean;
  requires_expiration: boolean;
  operational_status: ProductProps["operationalStatus"];
  rotation_class: ProductProps["rotationClass"];
  sale_type: ProductProps["saleType"];
  measurement_unit: ProductProps["measurementUnit"];
  min_stock: string | number | null;
  max_stock: string | number | null;
  category_id: string | null;
  subcategory_id: string | null;
  image_url: string | null;
  image_storage_key: string | null;
  image_alt_text: string | null;
  image_mime_type: ProductImageMimeType | null;
  image_size_bytes: string | number | null;
  image_updated_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
};

type ProductPriceHistoryRow = QueryResultRow & {
  id: string;
  tenant_id: string;
  product_id: string;
  previous_price: string | number;
  new_price: string | number;
  reason: string;
  changed_by: string | null;
  valid_from: Date | string;
  valid_to: Date | string | null;
  status: "APPLIED" | "PENDING_APPROVAL" | "REJECTED";
  approved_by: string | null;
  approved_at: Date | string | null;
  created_at: Date | string;
};

type CreateProductData = ProductProps;

type UpdateProductData = Partial<
  Pick<
    ProductProps,
    | "unitId"
    | "taxId"
    | "name"
    | "description"
    | "sku"
    | "price"
    | "cost"
    | "priceWithTax"
    | "priceWithoutTax"
    | "isActive"
    | "isPerishable"
    | "requiresLot"
    | "requiresExpiration"
    | "operationalStatus"
    | "rotationClass"
    | "saleType"
    | "measurementUnit"
    | "minStock"
    | "maxStock"
    | "categoryId"
    | "subcategoryId"
    | "imageUrl"
    | "imageStorageKey"
    | "imageAltText"
    | "imageMimeType"
    | "imageSizeBytes"
    | "imageUpdatedAt"
  >
>;

export type ProductPriceHistoryEntity = {
  id: string;
  tenantId: string;
  productId: string;
  previousPrice: number;
  newPrice: number;
  reason: string;
  changedBy: string | null;
  validFrom: Date;
  validTo: Date | null;
  status: "APPLIED" | "PENDING_APPROVAL" | "REJECTED";
  approvedBy: string | null;
  approvedAt: Date | null;
  createdAt: Date;
};

export type CreateProductPriceHistoryData = {
  tenantId: string;
  productId: string;
  previousPrice: number;
  newPrice: number;
  reason: string;
  changedBy: string;
  validFrom: Date;
};

@Injectable()
export class ProductRepository {
  constructor(
    @Inject(DatabaseService) private readonly db: DatabaseService
  ) {}

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

  private readonly selectColumns = `
    id,
    tenant_id,
    unit_id,
    tax_id,
    name,
    description,
    sku,
    price,
    cost,
    price_with_tax,
    price_without_tax,
    is_active,
    is_perishable,
    requires_lot,
    requires_expiration,
    operational_status,
    rotation_class,
    sale_type,
    measurement_unit,
    min_stock,
    max_stock,
    category_id,
    subcategory_id,
    image_url,
    image_storage_key,
    image_alt_text,
    image_mime_type,
    image_size_bytes,
    image_updated_at,
    created_at,
    updated_at
  `;

  private mapRowToEntity(row: ProductRow): ProductEntity {
    return ProductEntity.create({
      id: row.id,
      tenantId: row.tenant_id,
      unitId: row.unit_id,
      taxId: row.tax_id,
      unit: null,
      tax: null,
      name: row.name,
      description: row.description,
      sku: row.sku,
      price: Number(row.price),
      cost: Number(row.cost),
      priceWithTax: Number(row.price_with_tax),
      priceWithoutTax: Number(row.price_without_tax),
      isActive: row.is_active,
      isPerishable: row.is_perishable,
      requiresLot: row.requires_lot,
      requiresExpiration: row.requires_expiration,
      operationalStatus: row.operational_status,
      rotationClass: row.rotation_class,
      saleType: row.sale_type ?? "UNIT",
      measurementUnit: row.measurement_unit ?? "UND",
      minStock: row.min_stock === null ? null : Number(row.min_stock),
      maxStock: row.max_stock === null ? null : Number(row.max_stock),
      categoryId: row.category_id,
      subcategoryId: row.subcategory_id,
      imageUrl: row.image_url,
      imageStorageKey: row.image_storage_key,
      imageAltText: row.image_alt_text,
      imageMimeType: row.image_mime_type,
      imageSizeBytes:
        row.image_size_bytes === null ? null : Number(row.image_size_bytes),
      imageUpdatedAt:
        row.image_updated_at === null ? null : new Date(row.image_updated_at),
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    });
  }

  private mapPriceHistoryRow(
    row: ProductPriceHistoryRow
  ): ProductPriceHistoryEntity {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      productId: row.product_id,
      previousPrice: Number(row.previous_price),
      newPrice: Number(row.new_price),
      reason: row.reason,
      changedBy: row.changed_by,
      validFrom: new Date(row.valid_from),
      validTo: row.valid_to === null ? null : new Date(row.valid_to),
      status: row.status,
      approvedBy: row.approved_by,
      approvedAt: row.approved_at === null ? null : new Date(row.approved_at),
      createdAt: new Date(row.created_at),
    };
  }

  async create(
    product: CreateProductData,
    client?: PoolClient
  ): Promise<ProductEntity | null> {
    const result = await this.query<ProductRow>(
      `
      INSERT INTO products (
        id,
        tenant_id,
        unit_id,
        tax_id,
        name,
        description,
        sku,
        price,
        cost,
        price_with_tax,
        price_without_tax,
        is_active,
        is_perishable,
        requires_lot,
        requires_expiration,
        operational_status,
        rotation_class,
        sale_type,
        measurement_unit,
        min_stock,
        max_stock,
        category_id,
        subcategory_id,
        image_url,
        image_storage_key,
        image_alt_text,
        image_mime_type,
        image_size_bytes,
        image_updated_at,
        created_at,
        updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15, $16, $17, $18, $19,
        $20, $21, $22, $23, $24, $25, $26, $27, $28,
        $29, $30, $31
      )
      RETURNING
        ${this.selectColumns}
      `,
      [
        product.id,
        product.tenantId,
        product.unitId,
        product.taxId ?? null,
        product.name,
        product.description ?? null,
        product.sku,
        product.price,
        product.cost,
        product.priceWithTax,
        product.priceWithoutTax,
        product.isActive ?? true,
        product.isPerishable ?? false,
        product.requiresLot ?? false,
        product.requiresExpiration ?? false,
        product.operationalStatus ?? "ACTIVE",
        product.rotationClass ?? null,
        product.saleType ?? "UNIT",
        product.measurementUnit ?? "UND",
        product.minStock ?? null,
        product.maxStock ?? null,
        product.categoryId ?? null,
        product.subcategoryId ?? null,
        product.imageUrl ?? null,
        product.imageStorageKey ?? null,
        product.imageAltText ?? null,
        product.imageMimeType ?? null,
        product.imageSizeBytes ?? null,
        product.imageUpdatedAt ?? null,
        product.createdAt,
        product.updatedAt,
      ],
      client
    );

    return result.rows[0] ? this.mapRowToEntity(result.rows[0]) : null;
  }

  async findAllByTenant(
    tenantId: string,
    client?: PoolClient
  ): Promise<ProductEntity[]> {
    const result = await this.query<ProductRow>(
      `
      SELECT
        ${this.selectColumns}
      FROM products
      WHERE tenant_id = $1
      ORDER BY created_at DESC
      `,
      [tenantId],
      client
    );

    return (result.rows ?? []).map((row) => this.mapRowToEntity(row));
  }

  async findById(
    id: string,
    tenantId: string,
    client?: PoolClient
  ): Promise<ProductEntity | null> {
    const result = await this.query<ProductRow>(
      `
      SELECT
        ${this.selectColumns}
      FROM products
      WHERE id = $1 AND tenant_id = $2
      LIMIT 1
      `,
      [id, tenantId],
      client
    );

    return result.rows[0] ? this.mapRowToEntity(result.rows[0]) : null;
  }

  async findByIdForUpdate(
    id: string,
    tenantId: string,
    client: PoolClient
  ): Promise<ProductEntity | null> {
    const result = await this.query<ProductRow>(
      `
      SELECT
        ${this.selectColumns}
      FROM products
      WHERE id = $1 AND tenant_id = $2
      FOR UPDATE
      `,
      [id, tenantId],
      client
    );

    return result.rows[0] ? this.mapRowToEntity(result.rows[0]) : null;
  }

  async findBySku(
    sku: string,
    tenantId: string,
    client?: PoolClient
  ): Promise<ProductEntity | null> {
    const result = await this.query<ProductRow>(
      `
      SELECT
        ${this.selectColumns}
      FROM products
      WHERE sku = $1 AND tenant_id = $2
      LIMIT 1
      `,
      [sku, tenantId],
      client
    );

    return result.rows[0] ? this.mapRowToEntity(result.rows[0]) : null;
  }

  async update(
    id: string,
    tenantId: string,
    data: UpdateProductData,
    client?: PoolClient
  ): Promise<ProductEntity | null> {
    const updates: string[] = [];
    const params: unknown[] = [id, tenantId];

    const addUpdate = (column: string, value: unknown) => {
      params.push(value);
      updates.push(`${column} = $${params.length}`);
    };

    if (data.unitId !== undefined && data.unitId !== null) {
      addUpdate("unit_id", data.unitId);
    }
    if (data.taxId !== undefined && data.taxId !== null) {
      addUpdate("tax_id", data.taxId);
    }
    if (data.name !== undefined && data.name !== null) {
      addUpdate("name", data.name);
    }
    if (data.description !== undefined && data.description !== null) {
      addUpdate("description", data.description);
    }
    if (data.sku !== undefined && data.sku !== null) {
      addUpdate("sku", data.sku);
    }
    if (data.price !== undefined && data.price !== null) {
      addUpdate("price", data.price);
    }
    if (data.cost !== undefined && data.cost !== null) {
      addUpdate("cost", data.cost);
    }
    if (data.priceWithTax !== undefined && data.priceWithTax !== null) {
      addUpdate("price_with_tax", data.priceWithTax);
    }
    if (data.priceWithoutTax !== undefined && data.priceWithoutTax !== null) {
      addUpdate("price_without_tax", data.priceWithoutTax);
    }
    if (data.isActive !== undefined && data.isActive !== null) {
      addUpdate("is_active", data.isActive);
    }
    if (data.isPerishable !== undefined && data.isPerishable !== null) {
      addUpdate("is_perishable", data.isPerishable);
    }
    if (data.requiresLot !== undefined && data.requiresLot !== null) {
      addUpdate("requires_lot", data.requiresLot);
    }
    if (
      data.requiresExpiration !== undefined &&
      data.requiresExpiration !== null
    ) {
      addUpdate("requires_expiration", data.requiresExpiration);
    }
    if (
      data.operationalStatus !== undefined &&
      data.operationalStatus !== null
    ) {
      addUpdate("operational_status", data.operationalStatus);
    }
    if (data.rotationClass !== undefined) {
      addUpdate("rotation_class", data.rotationClass);
    }
    if (data.saleType !== undefined && data.saleType !== null) {
      addUpdate("sale_type", data.saleType);
    }
    if (data.measurementUnit !== undefined && data.measurementUnit !== null) {
      addUpdate("measurement_unit", data.measurementUnit);
    }
    if (data.minStock !== undefined) {
      addUpdate("min_stock", data.minStock);
    }
    if (data.maxStock !== undefined) {
      addUpdate("max_stock", data.maxStock);
    }
    if (data.categoryId !== undefined) {
      addUpdate("category_id", data.categoryId);
    }
    if (data.subcategoryId !== undefined) {
      addUpdate("subcategory_id", data.subcategoryId);
    }
    if (data.imageUrl !== undefined) {
      addUpdate("image_url", data.imageUrl);
    }
    if (data.imageStorageKey !== undefined) {
      addUpdate("image_storage_key", data.imageStorageKey);
    }
    if (data.imageAltText !== undefined) {
      addUpdate("image_alt_text", data.imageAltText);
    }
    if (data.imageMimeType !== undefined) {
      addUpdate("image_mime_type", data.imageMimeType);
    }
    if (data.imageSizeBytes !== undefined) {
      addUpdate("image_size_bytes", data.imageSizeBytes);
    }
    if (data.imageUpdatedAt !== undefined) {
      addUpdate("image_updated_at", data.imageUpdatedAt);
    }

    if (updates.length === 0) {
      return this.findById(id, tenantId, client);
    }

    const result = await this.query<ProductRow>(
      `
      UPDATE products
      SET
        ${updates.join(",\n        ")},
        updated_at = NOW()
      WHERE id = $1 AND tenant_id = $2
      RETURNING
        ${this.selectColumns}
      `,
      params,
      client
    );

    return result.rows[0] ? this.mapRowToEntity(result.rows[0]) : null;
  }

  async closeCurrentPriceHistory(
    tenantId: string,
    productId: string,
    validTo: Date,
    client: PoolClient
  ) {
    await this.query(
      `
      UPDATE product_price_history
      SET valid_to = $3
      WHERE tenant_id = $1
        AND product_id = $2
        AND status = 'APPLIED'
        AND valid_to IS NULL
      `,
      [tenantId, productId, validTo],
      client
    );
  }

  async createPriceHistory(
    data: CreateProductPriceHistoryData,
    client: PoolClient
  ): Promise<ProductPriceHistoryEntity> {
    const result = await this.query<ProductPriceHistoryRow>(
      `
      INSERT INTO product_price_history (
        tenant_id,
        product_id,
        previous_price,
        new_price,
        reason,
        changed_by,
        valid_from,
        status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'APPLIED')
      RETURNING
        id,
        tenant_id,
        product_id,
        previous_price,
        new_price,
        reason,
        changed_by,
        valid_from,
        valid_to,
        status,
        approved_by,
        approved_at,
        created_at
      `,
      [
        data.tenantId,
        data.productId,
        data.previousPrice,
        data.newPrice,
        data.reason,
        data.changedBy,
        data.validFrom,
      ],
      client
    );

    return this.mapPriceHistoryRow(result.rows[0]);
  }

  async findPriceHistoryByProduct(
    tenantId: string,
    productId: string,
    client?: PoolClient
  ): Promise<ProductPriceHistoryEntity[]> {
    const result = await this.query<ProductPriceHistoryRow>(
      `
      SELECT
        id,
        tenant_id,
        product_id,
        previous_price,
        new_price,
        reason,
        changed_by,
        valid_from,
        valid_to,
        status,
        approved_by,
        approved_at,
        created_at
      FROM product_price_history
      WHERE tenant_id = $1
        AND product_id = $2
      ORDER BY valid_from DESC, created_at DESC
      `,
      [tenantId, productId],
      client
    );

    return result.rows.map((row) => this.mapPriceHistoryRow(row));
  }

  async softDelete(
    id: string,
    tenantId: string,
    client?: PoolClient
  ): Promise<ProductEntity | null> {
    const result = await this.query<ProductRow>(
      `
      UPDATE products
      SET
        is_active = FALSE,
        updated_at = NOW()
      WHERE id = $1 AND tenant_id = $2
      RETURNING
        ${this.selectColumns}
      `,
      [id, tenantId],
      client
    );

    return result.rows[0] ? this.mapRowToEntity(result.rows[0]) : null;
  }
}
