-- Rollback de V118__product_decimal_quantity_and_units.sql
-- Falla de forma segura si hay productos con las unidades nuevas.
-- Los productos marcados con decimales pierden la marca (la columna se elimina);
-- revertir antes el codigo que valida entero/decimal.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.products WHERE measurement_unit IN ('M', 'L', 'CM', 'M2')) THEN
    RAISE EXCEPTION 'PRODUCT_DECIMAL_ROLLBACK_BLOCKED_DATA products.measurement_unit';
  END IF;
END $$;

ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS chk_products_decimal_quantity_rules;

ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS chk_products_sale_model_measurement_unit;
ALTER TABLE public.products
  ADD CONSTRAINT chk_products_sale_model_measurement_unit
  CHECK (
    (sale_type = 'UNIT' AND measurement_unit = 'UND')
    OR (sale_type IN ('WEIGHT', 'BOTH') AND measurement_unit IN ('KG', 'LB', 'G', 'OZ'))
  );

ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS chk_products_measurement_unit;
ALTER TABLE public.products
  ADD CONSTRAINT chk_products_measurement_unit
  CHECK (measurement_unit IN ('UND', 'KG', 'LB', 'G', 'OZ'));

ALTER TABLE public.products
  DROP COLUMN IF EXISTS allows_decimal_quantity;
