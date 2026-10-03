-- V100: Realign liquor fiscal base price with the shelf price.
--
-- Liquor products sell at price_with_tax (shelf price) and carry ICL + ADV + IVA
-- as non-included taxes. Pricing uses price_without_tax as the IVA base, so the
-- invoice total is price_without_tax + ICL + ADV + IVA and must equal
-- price_with_tax. Rows where that sum drifts are recomputed from alcohol degree,
-- net volume, DANE price and the active tax rates (same source as pricing).
-- price_with_tax is never changed. Idempotent: matching rows are skipped.

WITH liquor_taxes AS (
  SELECT
    p.id AS product_id,
    p.tenant_id,
    p.price_with_tax,
    p.price_without_tax,
    ptp.alcohol_degree,
    ptp.net_volume_ml,
    ptp.dane_certified_retail_price,
    tax.tax_type_code,
    tax.calculation_method_code,
    tax.is_included,
    COALESCE(tax.percentage_rate, tax.tax_rate) AS percentage_rate,
    tax.fixed_amount,
    tax.base_quantity
  FROM public.products AS p
  JOIN public.product_tax_profiles AS ptp
    ON ptp.tenant_id = p.tenant_id AND ptp.product_id = p.id
  CROSS JOIN LATERAL public.fnc_list_product_taxes_for_pricing(p.tenant_id, p.id, CURRENT_DATE) AS tax
  WHERE p.price_with_tax IS NOT NULL
    AND p.price_with_tax > 0
),
per_product AS (
  SELECT
    product_id,
    tenant_id,
    price_with_tax,
    price_without_tax,
    ROUND(MAX(fixed_amount * alcohol_degree * net_volume_ml / base_quantity)
      FILTER (WHERE calculation_method_code = 'PER_ALCOHOL_DEGREE_VOLUME'), 2) AS icl_amount,
    ROUND(MAX(ROUND(dane_certified_retail_price, 2) * percentage_rate)
      FILTER (WHERE tax_type_code = 'AD_VALOREM'), 2) AS adv_amount,
    MAX(percentage_rate) FILTER (WHERE tax_type_code = 'VAT') AS vat_rate,
    BOOL_OR(is_included) AS any_included,
    COUNT(*) FILTER (
      WHERE calculation_method_code = 'PER_ALCOHOL_DEGREE_VOLUME'
        AND alcohol_degree IS NOT NULL
        AND net_volume_ml IS NOT NULL
        AND base_quantity > 0
    ) AS icl_count,
    COUNT(*) FILTER (
      WHERE tax_type_code = 'AD_VALOREM'
        AND dane_certified_retail_price IS NOT NULL
    ) AS adv_count,
    COUNT(*) FILTER (WHERE tax_type_code = 'VAT') AS vat_count
  FROM liquor_taxes
  GROUP BY product_id, tenant_id, price_with_tax, price_without_tax
),
recomputed AS (
  SELECT
    product_id,
    tenant_id,
    ROUND((price_with_tax - icl_amount - adv_amount) / (1 + vat_rate), 2) AS fiscal_base
  FROM per_product
  WHERE icl_count = 1
    AND adv_count = 1
    AND vat_count = 1
    AND NOT any_included
    AND vat_rate IS NOT NULL
    AND price_with_tax > icl_amount + adv_amount
    AND ABS(
      COALESCE(price_without_tax, 0)
      + icl_amount
      + adv_amount
      + ROUND(COALESCE(price_without_tax, 0) * vat_rate, 2)
      - price_with_tax
    ) > 0.01
)
UPDATE public.products AS p
SET price = r.fiscal_base,
    price_without_tax = r.fiscal_base,
    updated_at = NOW()
FROM recomputed AS r
WHERE p.id = r.product_id
  AND p.tenant_id = r.tenant_id;
