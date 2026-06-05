import { Inject, Injectable } from "@nestjs/common";
import type { PoolClient, QueryResultRow } from "pg";
import { DatabaseService } from "../../../common/db/database.service";
import {
  ProductBarcodeEntity,
  type ProductBarcodeProps,
} from "../entities/product-barcode.entity";

type ProductBarcodeRow = QueryResultRow & {
  id: string;
  tenant_id: string;
  product_id: string;
  barcode: string;
  barcode_type: ProductBarcodeProps["barcodeType"];
  is_primary: boolean;
  is_active: boolean;
  created_at: Date | string;
  updated_at: Date | string;
};

type CreateProductBarcodeData = ProductBarcodeProps;

type UpdateProductBarcodeData = Partial<
  Pick<
    ProductBarcodeProps,
    "barcode" | "barcodeType" | "isPrimary" | "isActive"
  >
>;

@Injectable()
export class ProductBarcodeRepository {
  constructor(
    @Inject(DatabaseService) private readonly db: DatabaseService
  ) {}

  private readonly selectColumns = `
    id,
    tenant_id,
    product_id,
    barcode,
    barcode_type,
    is_primary,
    is_active,
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

  private mapRowToEntity(row: ProductBarcodeRow): ProductBarcodeEntity {
    return ProductBarcodeEntity.create({
      id: row.id,
      tenantId: row.tenant_id,
      productId: row.product_id,
      barcode: row.barcode,
      barcodeType: row.barcode_type,
      isPrimary: row.is_primary,
      isActive: row.is_active,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    });
  }

  async findByProduct(
    tenantId: string,
    productId: string,
    client?: PoolClient
  ): Promise<ProductBarcodeEntity[]> {
    const result = await this.query<ProductBarcodeRow>(
      `
      SELECT
        ${this.selectColumns}
      FROM product_barcodes
      WHERE tenant_id = $1 AND product_id = $2
      ORDER BY is_primary DESC, is_active DESC, created_at DESC
      `,
      [tenantId, productId],
      client
    );

    return (result.rows ?? []).map((row) => this.mapRowToEntity(row));
  }

  async findActiveByProductIds(
    tenantId: string,
    productIds: string[],
    client?: PoolClient
  ): Promise<ProductBarcodeEntity[]> {
    if (productIds.length === 0) {
      return [];
    }

    const result = await this.query<ProductBarcodeRow>(
      `
      SELECT
        ${this.selectColumns}
      FROM product_barcodes
      WHERE tenant_id = $1
        AND product_id = ANY($2::uuid[])
        AND is_active = true
      ORDER BY product_id, is_primary DESC, created_at DESC
      `,
      [tenantId, productIds],
      client
    );

    return (result.rows ?? []).map((row) => this.mapRowToEntity(row));
  }

  async findById(
    tenantId: string,
    barcodeId: string,
    client?: PoolClient
  ): Promise<ProductBarcodeEntity | null> {
    const result = await this.query<ProductBarcodeRow>(
      `
      SELECT
        ${this.selectColumns}
      FROM product_barcodes
      WHERE tenant_id = $1 AND id = $2
      LIMIT 1
      `,
      [tenantId, barcodeId],
      client
    );

    return result.rows[0] ? this.mapRowToEntity(result.rows[0]) : null;
  }

  async findActiveByBarcode(
    tenantId: string,
    barcode: string,
    client?: PoolClient
  ): Promise<ProductBarcodeEntity | null> {
    const result = await this.query<ProductBarcodeRow>(
      `
      SELECT
        ${this.selectColumns}
      FROM product_barcodes
      WHERE tenant_id = $1
        AND barcode = $2
        AND is_active = true
      LIMIT 1
      `,
      [tenantId, barcode],
      client
    );

    return result.rows[0] ? this.mapRowToEntity(result.rows[0]) : null;
  }

  async create(
    data: CreateProductBarcodeData,
    client?: PoolClient
  ): Promise<ProductBarcodeEntity> {
    const result = await this.query<ProductBarcodeRow>(
      `
      INSERT INTO product_barcodes (
        id,
        tenant_id,
        product_id,
        barcode,
        barcode_type,
        is_primary,
        is_active,
        created_at,
        updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9
      )
      RETURNING
        ${this.selectColumns}
      `,
      [
        data.id,
        data.tenantId,
        data.productId,
        data.barcode,
        data.barcodeType ?? "UNIT",
        data.isPrimary ?? false,
        data.isActive ?? true,
        data.createdAt,
        data.updatedAt,
      ],
      client
    );

    return this.mapRowToEntity(result.rows[0]);
  }

  async update(
    tenantId: string,
    barcodeId: string,
    data: UpdateProductBarcodeData,
    client?: PoolClient
  ): Promise<ProductBarcodeEntity | null> {
    const updates: string[] = [];
    const params: unknown[] = [tenantId, barcodeId];

    const addUpdate = (column: string, value: unknown) => {
      params.push(value);
      updates.push(`${column} = $${params.length}`);
    };

    if (data.barcode !== undefined) {
      addUpdate("barcode", data.barcode);
    }
    if (data.barcodeType !== undefined) {
      addUpdate("barcode_type", data.barcodeType);
    }
    if (data.isPrimary !== undefined) {
      addUpdate("is_primary", data.isPrimary);
    }
    if (data.isActive !== undefined) {
      addUpdate("is_active", data.isActive);
    }

    if (updates.length === 0) {
      return this.findById(tenantId, barcodeId, client);
    }

    const result = await this.query<ProductBarcodeRow>(
      `
      UPDATE product_barcodes
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

  async deactivate(
    tenantId: string,
    barcodeId: string,
    client?: PoolClient
  ): Promise<ProductBarcodeEntity | null> {
    return this.update(
      tenantId,
      barcodeId,
      {
        isActive: false,
        isPrimary: false,
      },
      client
    );
  }

  async unsetPrimaryForProduct(
    tenantId: string,
    productId: string,
    exceptBarcodeId?: string,
    client?: PoolClient
  ) {
    const params: unknown[] = [tenantId, productId];
    const exceptClause = exceptBarcodeId ? "AND id <> $3" : "";
    if (exceptBarcodeId) {
      params.push(exceptBarcodeId);
    }

    await this.query(
      `
      UPDATE product_barcodes
      SET
        is_primary = false,
        updated_at = NOW()
      WHERE tenant_id = $1
        AND product_id = $2
        AND is_active = true
        ${exceptClause}
      `,
      params,
      client
    );
  }

  async setPrimary(
    tenantId: string,
    productId: string,
    barcodeId: string,
    client?: PoolClient
  ): Promise<ProductBarcodeEntity | null> {
    const result = await this.query<ProductBarcodeRow>(
      `
      UPDATE product_barcodes
      SET
        is_primary = true,
        updated_at = NOW()
      WHERE tenant_id = $1
        AND product_id = $2
        AND id = $3
        AND is_active = true
      RETURNING
        ${this.selectColumns}
      `,
      [tenantId, productId, barcodeId],
      client
    );

    return result.rows[0] ? this.mapRowToEntity(result.rows[0]) : null;
  }
}
