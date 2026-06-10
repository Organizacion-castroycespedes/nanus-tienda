import { Inject, Injectable } from "@nestjs/common";
import type { QueryResultRow } from "pg";
import { DatabaseService } from "../../common/db/database.service";
import type {
  PricingProductSnapshot,
  PricingPromotionDiscountType,
  PricingPromotionSnapshot,
} from "./pricing.types";

type PricingProductRow = QueryResultRow & {
  id: string;
  tenant_id: string;
  price: string | number;
  tax_id: string | null;
  tax_rate: string | number | null;
  tax_is_included: boolean | null;
  is_active: boolean;
};

type PricingPromotionRow = QueryResultRow & {
  id: string;
  name: string;
  discount_type: PricingPromotionDiscountType;
  discount_value: string | number;
  priority: number;
  created_at: Date | string;
};

@Injectable()
export class PricingRepository {
  constructor(
    @Inject(DatabaseService)
    private readonly db: DatabaseService
  ) {}

  async findProductSnapshot(
    tenantId: string,
    productId: string
  ): Promise<PricingProductSnapshot | null> {
    const result = await this.db.query<PricingProductRow>(
      `
      SELECT
        p.id,
        p.tenant_id,
        p.price,
        p.tax_id,
        COALESCE(t.rate, 0) AS tax_rate,
        COALESCE(t.is_included, FALSE) AS tax_is_included,
        p.is_active
      FROM products p
      LEFT JOIN taxes t
        ON t.id = p.tax_id
       AND t.tenant_id = p.tenant_id
      WHERE p.id = $1
        AND p.tenant_id = $2
      LIMIT 1
      `,
      [productId, tenantId]
    );

    const row = result.rows[0];
    if (!row) {
      return null;
    }

    return {
      id: row.id,
      tenantId: row.tenant_id,
      price: Number(row.price),
      taxId: row.tax_id,
      taxRate: Number(row.tax_rate ?? 0),
      taxIsIncluded: row.tax_is_included ?? false,
      isActive: row.is_active,
    };
  }

  async findApplicablePromotions(input: {
    tenantId: string;
    branchId: string;
    productId: string;
    date: Date;
  }): Promise<PricingPromotionSnapshot[]> {
    const result = await this.db.query<PricingPromotionRow>(
      `
      SELECT
        p.id,
        p.name,
        p.discount_type,
        p.discount_value,
        p.priority,
        p.created_at
      FROM promotions p
      INNER JOIN promotion_products pp
        ON pp.promotion_id = p.id
       AND pp.tenant_id = p.tenant_id
       AND pp.product_id = $3
      WHERE p.tenant_id = $1
        AND p.is_active = TRUE
        AND p.starts_at <= $4::timestamptz
        AND p.ends_at >= $4::timestamptz
        AND (
          NOT EXISTS (
            SELECT 1
            FROM promotion_branches pb_all
            WHERE pb_all.promotion_id = p.id
              AND pb_all.tenant_id = p.tenant_id
          )
          OR EXISTS (
            SELECT 1
            FROM promotion_branches pb
            WHERE pb.promotion_id = p.id
              AND pb.tenant_id = p.tenant_id
              AND pb.branch_id = $2
          )
        )
      ORDER BY p.priority ASC, p.created_at DESC, p.id ASC
      `,
      [input.tenantId, input.branchId, input.productId, input.date]
    );

    return result.rows.map((row) => ({
      id: row.id,
      name: row.name,
      discountType: row.discount_type,
      discountValue: Number(row.discount_value),
      priority: Number(row.priority),
      createdAt: new Date(row.created_at),
    }));
  }
}
