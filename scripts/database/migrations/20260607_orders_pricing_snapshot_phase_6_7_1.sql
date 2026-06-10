-- Fase 6.7.1: snapshot de pricing para order_items.
-- Prepara Orders para persistir precio, descuento, promocion e impuesto calculado.
-- No recalcula pedidos historicos y no modifica price/subtotal existentes.

ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS base_unit_price NUMERIC(14, 2),
  ADD COLUMN IF NOT EXISTS final_unit_price NUMERIC(14, 2),
  ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(14, 2),
  ADD COLUMN IF NOT EXISTS discount_percent NUMERIC(8, 4),
  ADD COLUMN IF NOT EXISTS discount_total NUMERIC(14, 2),
  ADD COLUMN IF NOT EXISTS applied_promotion_id UUID,
  ADD COLUMN IF NOT EXISTS applied_promotion_name TEXT,
  ADD COLUMN IF NOT EXISTS tax_id UUID,
  ADD COLUMN IF NOT EXISTS tax_rate NUMERIC(8, 4),
  ADD COLUMN IF NOT EXISTS tax_base NUMERIC(14, 2),
  ADD COLUMN IF NOT EXISTS tax_amount NUMERIC(14, 2),
  ADD COLUMN IF NOT EXISTS line_total NUMERIC(14, 2),
  ADD COLUMN IF NOT EXISTS pricing_snapshot JSONB,
  ADD COLUMN IF NOT EXISTS pricing_calculated_at TIMESTAMPTZ;

ALTER TABLE order_items
  ALTER COLUMN discount_amount SET DEFAULT 0,
  ALTER COLUMN discount_percent SET DEFAULT 0,
  ALTER COLUMN discount_total SET DEFAULT 0,
  ALTER COLUMN tax_rate SET DEFAULT 0,
  ALTER COLUMN tax_base SET DEFAULT 0,
  ALTER COLUMN tax_amount SET DEFAULT 0;

ALTER TABLE order_items
  DROP CONSTRAINT IF EXISTS chk_order_items_base_unit_price_non_negative,
  DROP CONSTRAINT IF EXISTS chk_order_items_final_unit_price_non_negative,
  DROP CONSTRAINT IF EXISTS chk_order_items_discount_amount_non_negative,
  DROP CONSTRAINT IF EXISTS chk_order_items_discount_percent_range,
  DROP CONSTRAINT IF EXISTS chk_order_items_discount_total_non_negative,
  DROP CONSTRAINT IF EXISTS chk_order_items_tax_rate_non_negative,
  DROP CONSTRAINT IF EXISTS chk_order_items_tax_base_non_negative,
  DROP CONSTRAINT IF EXISTS chk_order_items_tax_amount_non_negative,
  DROP CONSTRAINT IF EXISTS chk_order_items_line_total_non_negative;

ALTER TABLE order_items
  ADD CONSTRAINT chk_order_items_base_unit_price_non_negative
    CHECK (base_unit_price IS NULL OR base_unit_price >= 0),
  ADD CONSTRAINT chk_order_items_final_unit_price_non_negative
    CHECK (final_unit_price IS NULL OR final_unit_price >= 0),
  ADD CONSTRAINT chk_order_items_discount_amount_non_negative
    CHECK (discount_amount IS NULL OR discount_amount >= 0),
  ADD CONSTRAINT chk_order_items_discount_percent_range
    CHECK (
      discount_percent IS NULL
      OR (discount_percent >= 0 AND discount_percent <= 100)
    ),
  ADD CONSTRAINT chk_order_items_discount_total_non_negative
    CHECK (discount_total IS NULL OR discount_total >= 0),
  ADD CONSTRAINT chk_order_items_tax_rate_non_negative
    CHECK (tax_rate IS NULL OR tax_rate >= 0),
  ADD CONSTRAINT chk_order_items_tax_base_non_negative
    CHECK (tax_base IS NULL OR tax_base >= 0),
  ADD CONSTRAINT chk_order_items_tax_amount_non_negative
    CHECK (tax_amount IS NULL OR tax_amount >= 0),
  ADD CONSTRAINT chk_order_items_line_total_non_negative
    CHECK (line_total IS NULL OR line_total >= 0);

COMMENT ON COLUMN order_items.base_unit_price IS
  'Snapshot de products.price antes de promocion. NULL en pedidos historicos sin snapshot.';
COMMENT ON COLUMN order_items.final_unit_price IS
  'Snapshot de precio unitario final despues de promocion. En Fase 6.7.2, price seguira representando este valor por compatibilidad.';
COMMENT ON COLUMN order_items.discount_amount IS
  'Descuento unitario aplicado por pricing. NULL en historicos sin snapshot; DEFAULT 0 para nuevos inserts sin promocion.';
COMMENT ON COLUMN order_items.discount_percent IS
  'Porcentaje de descuento efectivo aplicado por pricing. NULL en historicos sin snapshot; DEFAULT 0 para nuevos inserts sin promocion.';
COMMENT ON COLUMN order_items.discount_total IS
  'Descuento total de la linea aplicado por pricing. NULL en historicos sin snapshot; DEFAULT 0 para nuevos inserts sin promocion.';
COMMENT ON COLUMN order_items.applied_promotion_id IS
  'Promocion aplicada por pricing. NULL cuando no aplica promocion o en historicos sin snapshot.';
COMMENT ON COLUMN order_items.applied_promotion_name IS
  'Nombre de promocion aplicado al crear/actualizar el pedido, conservado como snapshot.';
COMMENT ON COLUMN order_items.tax_id IS
  'Impuesto aplicado por pricing al crear/actualizar el pedido, conservado como snapshot.';
COMMENT ON COLUMN order_items.tax_rate IS
  'Tasa de impuesto aplicada por pricing. NULL en historicos sin snapshot; DEFAULT 0 para nuevos inserts sin impuesto.';
COMMENT ON COLUMN order_items.tax_base IS
  'Base gravable calculada por pricing. NULL en historicos sin snapshot; DEFAULT 0 para nuevos inserts sin impuesto.';
COMMENT ON COLUMN order_items.tax_amount IS
  'Valor de impuesto calculado por pricing. NULL en historicos sin snapshot; DEFAULT 0 para nuevos inserts sin impuesto.';
COMMENT ON COLUMN order_items.line_total IS
  'Total de linea calculado por pricing. En Fase 6.7.2, subtotal seguira representando este valor por compatibilidad.';
COMMENT ON COLUMN order_items.pricing_snapshot IS
  'Snapshot JSONB del resultado de PricingService para auditoria.';
COMMENT ON COLUMN order_items.pricing_calculated_at IS
  'Fecha/hora en que se calculo el snapshot de pricing.';
