-- Rollback Fase 6.7.4.1: elimina snapshot de pricing en sale_items.
-- No toca price/price_without_tax/tax_total/subtotal ni recalcula ventas.

ALTER TABLE IF EXISTS sale_items
  DROP CONSTRAINT IF EXISTS chk_sale_items_base_unit_price_non_negative,
  DROP CONSTRAINT IF EXISTS chk_sale_items_final_unit_price_non_negative,
  DROP CONSTRAINT IF EXISTS chk_sale_items_discount_amount_non_negative,
  DROP CONSTRAINT IF EXISTS chk_sale_items_discount_percent_range,
  DROP CONSTRAINT IF EXISTS chk_sale_items_discount_total_non_negative,
  DROP CONSTRAINT IF EXISTS chk_sale_items_tax_base_non_negative,
  DROP CONSTRAINT IF EXISTS chk_sale_items_tax_amount_non_negative,
  DROP CONSTRAINT IF EXISTS chk_sale_items_line_total_non_negative,
  DROP CONSTRAINT IF EXISTS chk_sale_items_pricing_source_not_blank;

ALTER TABLE IF EXISTS sale_items
  DROP COLUMN IF EXISTS pricing_source,
  DROP COLUMN IF EXISTS pricing_calculated_at,
  DROP COLUMN IF EXISTS pricing_snapshot,
  DROP COLUMN IF EXISTS line_total,
  DROP COLUMN IF EXISTS tax_amount,
  DROP COLUMN IF EXISTS tax_base,
  DROP COLUMN IF EXISTS applied_promotion_name,
  DROP COLUMN IF EXISTS applied_promotion_id,
  DROP COLUMN IF EXISTS discount_total,
  DROP COLUMN IF EXISTS discount_percent,
  DROP COLUMN IF EXISTS discount_amount,
  DROP COLUMN IF EXISTS final_unit_price,
  DROP COLUMN IF EXISTS base_unit_price;
