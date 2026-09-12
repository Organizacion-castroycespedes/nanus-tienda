import { Inject, Injectable } from "@nestjs/common";
import type { QueryResultRow } from "pg";
import { DatabaseService } from "../../common/db/database.service";
import type {
  PricingProductSnapshot,
  PricingProductTaxProfileSnapshot,
  PricingProductTaxSnapshot,
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
  tax_name: string | null;
  tax_type_dian_code: string | null;
  tax_type_code: string | null;
  calculation_method_code: string | null;
  tax_base_type_code: string | null;
  is_active: boolean;
};

type PricingProductTaxRow = QueryResultRow & {
  tax_id: string;
  tax_name: string | null;
  dian_code: string | null;
  tax_type_code: string | null;
  calculation_method_code: string | null;
  tax_base_type_code: string | null;
  calculation_order: string | number;
  is_included: boolean | null;
  tax_rate: string | number | null;
  percentage_rate: string | number | null;
  fixed_amount: string | number | null;
  base_quantity: string | number | null;
  base_unit_code: string | null;
};

type PricingProductTaxProfileRow = QueryResultRow & {
  tax_product_category_id: string;
  alcohol_degree: string | number | null;
  net_volume_ml: string | number | null;
  dane_certified_retail_price: string | number | null;
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

  private mapProductTax(row: PricingProductTaxRow): PricingProductTaxSnapshot {
    return {
      taxId: row.tax_id,
      taxName: row.tax_name ?? "",
      dianCode: row.dian_code,
      taxTypeCode: row.tax_type_code,
      calculationMethodCode: row.calculation_method_code,
      taxBaseTypeCode: row.tax_base_type_code,
      calculationOrder: Number(row.calculation_order),
      isIncluded: row.is_included ?? false,
      rate: Number(row.tax_rate ?? 0),
      percentageRate:
        row.percentage_rate === null ? null : Number(row.percentage_rate),
      fixedAmount: row.fixed_amount === null ? null : Number(row.fixed_amount),
      baseQuantity:
        row.base_quantity === null ? null : Number(row.base_quantity),
      baseUnitCode: row.base_unit_code,
    };
  }

  private mapProductTaxProfile(
    row: PricingProductTaxProfileRow
  ): PricingProductTaxProfileSnapshot {
    return {
      taxProductCategoryId: row.tax_product_category_id,
      alcoholDegree:
        row.alcohol_degree === null ? null : Number(row.alcohol_degree),
      netVolumeMl:
        row.net_volume_ml === null ? null : Number(row.net_volume_ml),
      daneCertifiedRetailPrice:
        row.dane_certified_retail_price === null
          ? null
          : Number(row.dane_certified_retail_price),
    };
  }

  async findProductSnapshot(
    tenantId: string,
    productId: string,
    pricingDate: Date
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
        t.name AS tax_name,
        tt.dian_code AS tax_type_dian_code,
        tt.code AS tax_type_code,
        cm.code AS calculation_method_code,
        bt.code AS tax_base_type_code,
        p.is_active
      FROM products p
      LEFT JOIN taxes t
        ON t.id = p.tax_id
       AND t.tenant_id = p.tenant_id
      LEFT JOIN tax_types tt
        ON tt.id = t.tax_type_id
      LEFT JOIN tax_calculation_methods cm
        ON cm.id = t.calculation_method_id
      LEFT JOIN tax_base_types bt
        ON bt.id = t.tax_base_type_id
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

    const [taxesResult, profileResult] = await Promise.all([
      this.db.query<PricingProductTaxRow>(
        `
        SELECT
          tax_id,
          tax_name,
          dian_code,
          tax_type_code,
          calculation_method_code,
          tax_base_type_code,
          calculation_order,
          is_included,
          tax_rate,
          percentage_rate,
          fixed_amount,
          base_quantity,
          base_unit_code
        FROM public.fnc_list_product_taxes_for_pricing($1::uuid, $2::uuid, $3::date)
        `,
        [tenantId, productId, pricingDate]
      ),
      this.db.query<PricingProductTaxProfileRow>(
        `
        SELECT
          tax_product_category_id,
          alcohol_degree,
          net_volume_ml,
          dane_certified_retail_price
        FROM public.fnc_get_product_tax_profile($1::uuid, $2::uuid)
        `,
        [tenantId, productId]
      ),
    ]);

    const taxes = (taxesResult.rows ?? []).map((item) => this.mapProductTax(item));
    const taxProfile = profileResult.rows[0]
      ? this.mapProductTaxProfile(profileResult.rows[0])
      : null;

    const fallbackTaxes =
      taxes.length > 0 || row.tax_id === null
        ? taxes
        : [
            {
              taxId: row.tax_id,
              taxName: row.tax_name ?? "",
              dianCode: row.tax_type_dian_code,
              taxTypeCode: row.tax_type_code,
              calculationMethodCode: row.calculation_method_code,
              taxBaseTypeCode: row.tax_base_type_code,
              calculationOrder: 1,
              isIncluded: row.tax_is_included ?? false,
              rate: Number(row.tax_rate ?? 0),
              percentageRate: Number(row.tax_rate ?? 0),
              fixedAmount: null,
              baseQuantity: null,
              baseUnitCode: null,
            },
          ];

    return {
      id: row.id,
      tenantId: row.tenant_id,
      price: Number(row.price),
      taxId: row.tax_id,
      taxRate: Number(row.tax_rate ?? 0),
      taxIsIncluded: row.tax_is_included ?? false,
      taxes: fallbackTaxes,
      taxProfile,
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
