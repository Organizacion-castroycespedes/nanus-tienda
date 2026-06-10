BEGIN;

-- Rollback conservador de 20260601_inventory_products_lots_phase_1.sql.
-- ADVERTENCIA: elimina datos capturados en tablas nuevas de lotes,
-- barcodes, ubicaciones, precios y alertas.
-- No toca ventas, compras, stock_movements ni funciones SQL criticas.

DROP TABLE IF EXISTS public.inventory_alerts CASCADE;
DROP TABLE IF EXISTS public.inventory_alert_rules CASCADE;
DROP TABLE IF EXISTS public.product_price_history CASCADE;
DROP TABLE IF EXISTS public.stock_movement_lots CASCADE;
DROP TABLE IF EXISTS public.inventory_lot_balances CASCADE;
DROP TABLE IF EXISTS public.inventory_lots CASCADE;
DROP TABLE IF EXISTS public.inventory_locations CASCADE;
DROP TABLE IF EXISTS public.product_barcodes CASCADE;

ALTER TABLE IF EXISTS public.products
  DROP CONSTRAINT IF EXISTS chk_products_perishable_has_control,
  DROP CONSTRAINT IF EXISTS chk_products_expiration_requires_lot,
  DROP CONSTRAINT IF EXISTS chk_products_stock_range,
  DROP CONSTRAINT IF EXISTS chk_products_max_stock_non_negative,
  DROP CONSTRAINT IF EXISTS chk_products_min_stock_non_negative,
  DROP CONSTRAINT IF EXISTS chk_products_rotation_class,
  DROP CONSTRAINT IF EXISTS chk_products_operational_status;

DROP INDEX IF EXISTS public.idx_products_tenant_rotation_class;
DROP INDEX IF EXISTS public.idx_products_tenant_operational_status;

ALTER TABLE IF EXISTS public.products
  DROP COLUMN IF EXISTS max_stock,
  DROP COLUMN IF EXISTS min_stock,
  DROP COLUMN IF EXISTS rotation_class,
  DROP COLUMN IF EXISTS operational_status,
  DROP COLUMN IF EXISTS requires_expiration,
  DROP COLUMN IF EXISTS requires_lot,
  DROP COLUMN IF EXISTS is_perishable;

COMMIT;
