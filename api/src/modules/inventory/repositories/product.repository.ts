import { Inject, Injectable } from "@nestjs/common";
import type { PoolClient, QueryResultRow } from "pg";
import { DatabaseService } from "../../../common/db/database.service";
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
  created_at: Date | string;
  updated_at: Date | string;
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
  >
>;

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
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    });
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
        created_at,
        updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14
      )
      RETURNING
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
        created_at,
        updated_at
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
        created_at,
        updated_at
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
        created_at,
        updated_at
      FROM products
      WHERE id = $1 AND tenant_id = $2
      LIMIT 1
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
        created_at,
        updated_at
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
    const result = await this.query<ProductRow>(
      `
      UPDATE products
      SET
        unit_id = COALESCE($3, unit_id),
        tax_id = CASE WHEN $4::uuid IS NULL THEN tax_id ELSE $4 END,
        name = COALESCE($5, name),
        description = COALESCE($6, description),
        sku = COALESCE($7, sku),
        price = COALESCE($8, price),
        cost = COALESCE($9, cost),
        price_with_tax = COALESCE($10, price_with_tax),
        price_without_tax = COALESCE($11, price_without_tax),
        is_active = COALESCE($12, is_active),
        updated_at = NOW()
      WHERE id = $1 AND tenant_id = $2
      RETURNING
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
        created_at,
        updated_at
      `,
      [
        id,
        tenantId,
        data.unitId ?? null,
        data.taxId ?? null,
        data.name ?? null,
        data.description ?? null,
        data.sku ?? null,
        data.price ?? null,
        data.cost ?? null,
        data.priceWithTax ?? null,
        data.priceWithoutTax ?? null,
        data.isActive ?? null,
      ],
      client
    );

    return result.rows[0] ? this.mapRowToEntity(result.rows[0]) : null;
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
        created_at,
        updated_at
      `,
      [id, tenantId],
      client
    );

    return result.rows[0] ? this.mapRowToEntity(result.rows[0]) : null;
  }
}
