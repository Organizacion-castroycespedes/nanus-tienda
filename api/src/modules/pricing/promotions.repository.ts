import { Inject, Injectable } from "@nestjs/common";
import type { PoolClient, QueryResultRow } from "pg";
import { DatabaseService } from "../../common/db/database.service";
import type {
  PromotionDiscountType,
  PromotionEntity,
  PromotionListFilters,
  PromotionRecordInput,
  PromotionType,
} from "./promotions.types";

type PromotionRow = QueryResultRow & {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  promotion_type: PromotionType;
  discount_type: PromotionDiscountType;
  discount_value: string | number;
  starts_at: Date | string;
  ends_at: Date | string;
  priority: number;
  is_stackable: boolean;
  is_active: boolean;
  created_by: string | null;
  created_at: Date | string;
  updated_at: Date | string;
  product_ids: string[] | null;
  branch_ids: string[] | null;
};

@Injectable()
export class PromotionsRepository {
  constructor(
    @Inject(DatabaseService)
    private readonly db: DatabaseService
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

  private mapRow(row: PromotionRow): PromotionEntity {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      name: row.name,
      description: row.description,
      promotionType: row.promotion_type,
      discountType: row.discount_type,
      discountValue: Number(row.discount_value),
      startsAt: new Date(row.starts_at),
      endsAt: new Date(row.ends_at),
      priority: Number(row.priority),
      isStackable: row.is_stackable,
      isActive: row.is_active,
      createdBy: row.created_by,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      productIds: row.product_ids ?? [],
      branchIds: row.branch_ids ?? [],
    };
  }

  private readonly selectPromotion = `
    SELECT
      p.id,
      p.tenant_id,
      p.name,
      p.description,
      p.promotion_type,
      p.discount_type,
      p.discount_value,
      p.starts_at,
      p.ends_at,
      p.priority,
      p.is_stackable,
      p.is_active,
      p.created_by,
      p.created_at,
      p.updated_at,
      COALESCE(pp.product_ids, ARRAY[]::uuid[]) AS product_ids,
      COALESCE(pb.branch_ids, ARRAY[]::uuid[]) AS branch_ids
    FROM promotions p
    LEFT JOIN LATERAL (
      SELECT ARRAY_AGG(product_id ORDER BY product_id) AS product_ids
      FROM promotion_products
      WHERE promotion_id = p.id
        AND tenant_id = p.tenant_id
    ) pp ON TRUE
    LEFT JOIN LATERAL (
      SELECT ARRAY_AGG(branch_id ORDER BY branch_id) AS branch_ids
      FROM promotion_branches
      WHERE promotion_id = p.id
        AND tenant_id = p.tenant_id
    ) pb ON TRUE
  `;

  async list(
    tenantId: string,
    filters: PromotionListFilters = {}
  ): Promise<PromotionEntity[]> {
    const params: unknown[] = [tenantId];
    const where = ["p.tenant_id = $1"];

    if (filters.search?.trim()) {
      params.push(`%${filters.search.trim().toLowerCase()}%`);
      where.push(
        `(lower(p.name) LIKE $${params.length} OR lower(COALESCE(p.description, '')) LIKE $${params.length})`
      );
    }
    if (filters.isActive !== undefined) {
      params.push(filters.isActive);
      where.push(`p.is_active = $${params.length}`);
    }
    if (filters.productId?.trim()) {
      params.push(filters.productId.trim());
      where.push(
        `EXISTS (
          SELECT 1
          FROM promotion_products ppf
          WHERE ppf.promotion_id = p.id
            AND ppf.tenant_id = p.tenant_id
            AND ppf.product_id = $${params.length}
        )`
      );
    }
    if (filters.branchId?.trim()) {
      params.push(filters.branchId.trim());
      where.push(
        `(NOT EXISTS (
          SELECT 1
          FROM promotion_branches pbf_all
          WHERE pbf_all.promotion_id = p.id
            AND pbf_all.tenant_id = p.tenant_id
        ) OR EXISTS (
          SELECT 1
          FROM promotion_branches pbf
          WHERE pbf.promotion_id = p.id
            AND pbf.tenant_id = p.tenant_id
            AND pbf.branch_id = $${params.length}
        ))`
      );
    }
    if (filters.startsAt?.trim()) {
      params.push(filters.startsAt.trim());
      where.push(`p.ends_at >= $${params.length}::timestamptz`);
    }
    if (filters.endsAt?.trim()) {
      params.push(filters.endsAt.trim());
      where.push(`p.starts_at <= $${params.length}::timestamptz`);
    }

    const result = await this.query<PromotionRow>(
      `
      ${this.selectPromotion}
      WHERE ${where.join("\n        AND ")}
      ORDER BY p.priority ASC, p.starts_at DESC, p.created_at DESC
      `,
      params
    );

    return result.rows.map((row) => this.mapRow(row));
  }

  async findById(
    tenantId: string,
    promotionId: string,
    client?: PoolClient
  ): Promise<PromotionEntity | null> {
    const result = await this.query<PromotionRow>(
      `
      ${this.selectPromotion}
      WHERE p.tenant_id = $1
        AND p.id = $2
      LIMIT 1
      `,
      [tenantId, promotionId],
      client
    );

    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  async countProductsByTenant(tenantId: string, productIds: string[]) {
    const result = await this.query<{ count: string }>(
      `
      SELECT count(DISTINCT id)::text AS count
      FROM products
      WHERE tenant_id = $1
        AND id = ANY($2::uuid[])
      `,
      [tenantId, productIds]
    );
    return Number(result.rows[0]?.count ?? 0);
  }

  async countBranchesByTenant(tenantId: string, branchIds: string[]) {
    const result = await this.query<{ count: string }>(
      `
      SELECT count(DISTINCT id)::text AS count
      FROM tenant_branches
      WHERE tenant_id = $1
        AND id = ANY($2::uuid[])
      `,
      [tenantId, branchIds]
    );
    return Number(result.rows[0]?.count ?? 0);
  }

  async create(
    data: PromotionRecordInput,
    productIds: string[],
    branchIds: string[],
    client: PoolClient
  ): Promise<PromotionEntity> {
    await this.query(
      `
      INSERT INTO promotions (
        id,
        tenant_id,
        name,
        description,
        promotion_type,
        discount_type,
        discount_value,
        starts_at,
        ends_at,
        priority,
        is_stackable,
        is_active,
        created_by,
        created_at,
        updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
        $11, $12, $13, NOW(), NOW()
      )
      `,
      [
        data.id,
        data.tenantId,
        data.name,
        data.description,
        data.promotionType,
        data.discountType,
        data.discountValue,
        data.startsAt,
        data.endsAt,
        data.priority,
        data.isStackable,
        data.isActive,
        data.createdBy,
      ],
      client
    );

    await this.replaceProducts(data.tenantId, data.id, productIds, client);
    await this.replaceBranches(data.tenantId, data.id, branchIds, client);

    return (await this.findById(data.tenantId, data.id, client)) as PromotionEntity;
  }

  async update(
    tenantId: string,
    promotionId: string,
    data: Partial<
      Omit<PromotionRecordInput, "id" | "tenantId" | "createdBy">
    >,
    client: PoolClient
  ): Promise<PromotionEntity | null> {
    const updates: string[] = [];
    const params: unknown[] = [tenantId, promotionId];
    const addUpdate = (column: string, value: unknown) => {
      params.push(value);
      updates.push(`${column} = $${params.length}`);
    };

    if (data.name !== undefined) {
      addUpdate("name", data.name);
    }
    if (data.description !== undefined) {
      addUpdate("description", data.description);
    }
    if (data.promotionType !== undefined) {
      addUpdate("promotion_type", data.promotionType);
    }
    if (data.discountType !== undefined) {
      addUpdate("discount_type", data.discountType);
    }
    if (data.discountValue !== undefined) {
      addUpdate("discount_value", data.discountValue);
    }
    if (data.startsAt !== undefined) {
      addUpdate("starts_at", data.startsAt);
    }
    if (data.endsAt !== undefined) {
      addUpdate("ends_at", data.endsAt);
    }
    if (data.priority !== undefined) {
      addUpdate("priority", data.priority);
    }
    if (data.isStackable !== undefined) {
      addUpdate("is_stackable", data.isStackable);
    }
    if (data.isActive !== undefined) {
      addUpdate("is_active", data.isActive);
    }

    if (updates.length > 0) {
      await this.query(
        `
        UPDATE promotions
        SET
          ${updates.join(",\n          ")},
          updated_at = NOW()
        WHERE tenant_id = $1
          AND id = $2
        `,
        params,
        client
      );
    }

    return this.findById(tenantId, promotionId, client);
  }

  async replaceProducts(
    tenantId: string,
    promotionId: string,
    productIds: string[],
    client: PoolClient
  ) {
    await this.query(
      `DELETE FROM promotion_products WHERE tenant_id = $1 AND promotion_id = $2`,
      [tenantId, promotionId],
      client
    );

    for (const productId of productIds) {
      await this.query(
        `
        INSERT INTO promotion_products (
          tenant_id,
          promotion_id,
          product_id
        ) VALUES ($1, $2, $3)
        `,
        [tenantId, promotionId, productId],
        client
      );
    }
  }

  async replaceBranches(
    tenantId: string,
    promotionId: string,
    branchIds: string[],
    client: PoolClient
  ) {
    await this.query(
      `DELETE FROM promotion_branches WHERE tenant_id = $1 AND promotion_id = $2`,
      [tenantId, promotionId],
      client
    );

    for (const branchId of branchIds) {
      await this.query(
        `
        INSERT INTO promotion_branches (
          tenant_id,
          promotion_id,
          branch_id
        ) VALUES ($1, $2, $3)
        `,
        [tenantId, promotionId, branchId],
        client
      );
    }
  }
}
