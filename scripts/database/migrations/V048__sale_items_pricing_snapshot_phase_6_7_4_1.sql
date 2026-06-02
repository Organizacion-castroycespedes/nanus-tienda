-- Fase 6.7.4.1: snapshot de pricing para sale_items.
-- Prepara Sales para conservar precio, descuento, promocion e impuesto.
-- No recalcula ventas historicas y no modifica price/price_without_tax/tax_total/subtotal existentes.

ALTER TABLE sale_items
  ADD COLUMN IF NOT EXISTS base_unit_price NUMERIC(14, 2),
  ADD COLUMN IF NOT EXISTS final_unit_price NUMERIC(14, 2),
  ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(14, 2),
  ADD COLUMN IF NOT EXISTS discount_percent NUMERIC(8, 4),
  ADD COLUMN IF NOT EXISTS discount_total NUMERIC(14, 2),
  ADD COLUMN IF NOT EXISTS applied_promotion_id UUID,
  ADD COLUMN IF NOT EXISTS applied_promotion_name TEXT,
  ADD COLUMN IF NOT EXISTS tax_base NUMERIC(14, 2),
  ADD COLUMN IF NOT EXISTS tax_amount NUMERIC(14, 2),
  ADD COLUMN IF NOT EXISTS line_total NUMERIC(14, 2),
  ADD COLUMN IF NOT EXISTS pricing_snapshot JSONB,
  ADD COLUMN IF NOT EXISTS pricing_calculated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS pricing_source VARCHAR(40);

ALTER TABLE sale_items
  ALTER COLUMN discount_amount SET DEFAULT 0,
  ALTER COLUMN discount_percent SET DEFAULT 0,
  ALTER COLUMN discount_total SET DEFAULT 0,
  ALTER COLUMN tax_base SET DEFAULT 0,
  ALTER COLUMN tax_amount SET DEFAULT 0;

ALTER TABLE sale_items
  DROP CONSTRAINT IF EXISTS chk_sale_items_base_unit_price_non_negative,
  DROP CONSTRAINT IF EXISTS chk_sale_items_final_unit_price_non_negative,
  DROP CONSTRAINT IF EXISTS chk_sale_items_discount_amount_non_negative,
  DROP CONSTRAINT IF EXISTS chk_sale_items_discount_percent_range,
  DROP CONSTRAINT IF EXISTS chk_sale_items_discount_total_non_negative,
  DROP CONSTRAINT IF EXISTS chk_sale_items_tax_base_non_negative,
  DROP CONSTRAINT IF EXISTS chk_sale_items_tax_amount_non_negative,
  DROP CONSTRAINT IF EXISTS chk_sale_items_line_total_non_negative,
  DROP CONSTRAINT IF EXISTS chk_sale_items_pricing_source_not_blank;

ALTER TABLE sale_items
  ADD CONSTRAINT chk_sale_items_base_unit_price_non_negative
    CHECK (base_unit_price IS NULL OR base_unit_price >= 0),
  ADD CONSTRAINT chk_sale_items_final_unit_price_non_negative
    CHECK (final_unit_price IS NULL OR final_unit_price >= 0),
  ADD CONSTRAINT chk_sale_items_discount_amount_non_negative
    CHECK (discount_amount IS NULL OR discount_amount >= 0),
  ADD CONSTRAINT chk_sale_items_discount_percent_range
    CHECK (
      discount_percent IS NULL
      OR (discount_percent >= 0 AND discount_percent <= 100)
    ),
  ADD CONSTRAINT chk_sale_items_discount_total_non_negative
    CHECK (discount_total IS NULL OR discount_total >= 0),
  ADD CONSTRAINT chk_sale_items_tax_base_non_negative
    CHECK (tax_base IS NULL OR tax_base >= 0),
  ADD CONSTRAINT chk_sale_items_tax_amount_non_negative
    CHECK (tax_amount IS NULL OR tax_amount >= 0),
  ADD CONSTRAINT chk_sale_items_line_total_non_negative
    CHECK (line_total IS NULL OR line_total >= 0),
  ADD CONSTRAINT chk_sale_items_pricing_source_not_blank
    CHECK (pricing_source IS NULL OR btrim(pricing_source) <> '');

COMMENT ON COLUMN sale_items.base_unit_price IS
  'Snapshot de precio unitario base antes de promocion. NULL en ventas historicas sin snapshot.';
COMMENT ON COLUMN sale_items.final_unit_price IS
  'Snapshot de precio unitario final despues de promocion. En fases futuras, sale_items.price seguira representando este valor por compatibilidad.';
COMMENT ON COLUMN sale_items.discount_amount IS
  'Descuento unitario aplicado por pricing. NULL en historicos sin snapshot; DEFAULT 0 para nuevos inserts sin promocion.';
COMMENT ON COLUMN sale_items.discount_percent IS
  'Porcentaje de descuento efectivo aplicado por pricing. NULL en historicos sin snapshot; DEFAULT 0 para nuevos inserts sin promocion.';
COMMENT ON COLUMN sale_items.discount_total IS
  'Descuento total de la linea aplicado por pricing. NULL en historicos sin snapshot; DEFAULT 0 para nuevos inserts sin promocion.';
COMMENT ON COLUMN sale_items.applied_promotion_id IS
  'Promocion aplicada por pricing. NULL cuando no aplica promocion o en historicos sin snapshot.';
COMMENT ON COLUMN sale_items.applied_promotion_name IS
  'Nombre de promocion aplicado al crear la venta, conservado como snapshot.';
COMMENT ON COLUMN sale_items.tax_base IS
  'Base gravable calculada por pricing. NULL en historicos sin snapshot; DEFAULT 0 para nuevos inserts sin impuesto.';
COMMENT ON COLUMN sale_items.tax_amount IS
  'Valor de impuesto calculado por pricing. NULL en historicos sin snapshot; DEFAULT 0 para nuevos inserts sin impuesto. sale_item_taxes conserva tax_id, tax_name, tax_rate y tax_amount.';
COMMENT ON COLUMN sale_items.line_total IS
  'Total de linea calculado por pricing. En fases futuras, sale_items.subtotal seguira representando este valor por compatibilidad.';
COMMENT ON COLUMN sale_items.pricing_snapshot IS
  'Snapshot JSONB del resultado de PricingService o del fallback documentado para auditoria.';
COMMENT ON COLUMN sale_items.pricing_calculated_at IS
  'Fecha/hora en que se calculo el snapshot de pricing.';
COMMENT ON COLUMN sale_items.pricing_source IS
  'Origen del snapshot de pricing, por ejemplo ORDER_SNAPSHOT o SALE_LEGACY_FALLBACK.';
