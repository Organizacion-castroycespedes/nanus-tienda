BEGIN;

-- Fase 11.1 perifericos: modelo formal de venta de productos.
-- No toca ventas, facturacion, reporteria ni hardware.

DO $$
BEGIN
  IF to_regclass('public.products') IS NULL THEN
    RAISE EXCEPTION 'Required table public.products does not exist';
  END IF;
END $$;

ALTER TABLE IF EXISTS public.products
  ADD COLUMN IF NOT EXISTS sale_type text NOT NULL DEFAULT 'UNIT',
  ADD COLUMN IF NOT EXISTS measurement_unit text NOT NULL DEFAULT 'UND';

UPDATE public.products
SET sale_type = 'UNIT'
WHERE sale_type IS NULL OR btrim(sale_type) = '';

UPDATE public.products
SET measurement_unit = 'UND'
WHERE measurement_unit IS NULL OR btrim(measurement_unit) = '';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_products_sale_type'
      AND conrelid = 'public.products'::regclass
  ) THEN
    ALTER TABLE public.products
      ADD CONSTRAINT chk_products_sale_type
      CHECK (sale_type IN ('UNIT', 'WEIGHT', 'BOTH'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_products_measurement_unit'
      AND conrelid = 'public.products'::regclass
  ) THEN
    ALTER TABLE public.products
      ADD CONSTRAINT chk_products_measurement_unit
      CHECK (measurement_unit IN ('UND', 'KG', 'LB', 'G', 'OZ'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_products_sale_model_measurement_unit'
      AND conrelid = 'public.products'::regclass
  ) THEN
    ALTER TABLE public.products
      ADD CONSTRAINT chk_products_sale_model_measurement_unit
      CHECK (
        (sale_type = 'UNIT' AND measurement_unit = 'UND')
        OR (sale_type IN ('WEIGHT', 'BOTH') AND measurement_unit IN ('KG', 'LB', 'G', 'OZ'))
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_products_tenant_sale_type
  ON public.products (tenant_id, sale_type);

CREATE INDEX IF NOT EXISTS idx_products_tenant_measurement_unit
  ON public.products (tenant_id, measurement_unit);

COMMIT;
