-- V118: cantidades con decimales por producto y unidades de medida M, L, CM y M2.
-- OpenSpec: soportar-cantidades-decimales-unidades
-- Requiere V117 (products.requires_serial).
-- No modifica inventory_create_sale_v2, el consumo FEFO ni el calculo de existencias:
-- esas rutas ya operan con NUMERIC. La regla entero/decimal se valida en la API.
-- Sin control transaccional: lo aporta apply_single_migration.sh.

DO $$
BEGIN
  IF to_regclass('public.products') IS NULL
    OR to_regclass('public.stock_movements') IS NULL
    OR to_regclass('public.purchase_items') IS NULL THEN
    RAISE EXCEPTION 'PRODUCT_DECIMAL_PREREQUISITES_MISSING';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'requires_serial'
  ) THEN
    RAISE EXCEPTION 'PRODUCT_DECIMAL_V117_REQUIRED';
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'allows_decimal_quantity'
  ) THEN
    RAISE EXCEPTION 'PRODUCT_DECIMAL_V118_ALREADY_APPLIED';
  END IF;
END $$;

-- 1. Marca por producto: permite cantidades con hasta 2 decimales en compras, recepcion y venta por unidad.
ALTER TABLE public.products
  ADD COLUMN allows_decimal_quantity BOOLEAN NOT NULL DEFAULT FALSE;

-- 2. Unidades nuevas para productos por unidad: metro, litro, centimetro y metro cuadrado.
--    Codigo DIAN (UN/ECE Rec. 20): M=MTR, L=LTR, CM=CMT, M2=MTK.
ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS chk_products_measurement_unit;
ALTER TABLE public.products
  ADD CONSTRAINT chk_products_measurement_unit
  CHECK (measurement_unit IN ('UND', 'M', 'L', 'CM', 'M2', 'KG', 'LB', 'G', 'OZ'));

ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS chk_products_sale_model_measurement_unit;
ALTER TABLE public.products
  ADD CONSTRAINT chk_products_sale_model_measurement_unit
  CHECK (
    (sale_type = 'UNIT' AND measurement_unit IN ('UND', 'M', 'L', 'CM', 'M2'))
    OR (sale_type IN ('WEIGHT', 'BOTH') AND measurement_unit IN ('KG', 'LB', 'G', 'OZ'))
  );

-- 3. Los decimales aplican a la venta por unidad (peso ya es decimal por bascula)
--    y no se combinan con serie (una serie es una unidad entera).
ALTER TABLE public.products
  ADD CONSTRAINT chk_products_decimal_quantity_rules
  CHECK (
    allows_decimal_quantity = FALSE
    OR (sale_type = 'UNIT' AND requires_serial = FALSE)
  );

-- 4. Proteccion de datos existentes: un producto por unidad que ya tiene movimientos
--    o renglones de compra con decimales queda marcado, para no bloquear su operacion.
DO $$
DECLARE
  v_marked INTEGER;
BEGIN
  UPDATE public.products AS p
  SET allows_decimal_quantity = TRUE
  WHERE p.sale_type = 'UNIT'
    AND p.requires_serial = FALSE
    AND (
      EXISTS (
        SELECT 1 FROM public.stock_movements AS sm
        WHERE sm.product_id = p.id
          AND sm.quantity <> trunc(sm.quantity)
      )
      OR EXISTS (
        SELECT 1 FROM public.purchase_items AS pi
        WHERE pi.product_id = p.id
          AND (
            pi.ordered_quantity <> trunc(pi.ordered_quantity)
            OR pi.received_quantity <> trunc(pi.received_quantity)
          )
      )
    );
  GET DIAGNOSTICS v_marked = ROW_COUNT;
  RAISE NOTICE 'PRODUCT_DECIMAL_BACKFILL marked=%', v_marked;
END $$;

COMMENT ON COLUMN public.products.allows_decimal_quantity IS
  'Permite cantidades con hasta 2 decimales en compras, recepcion y venta por unidad (V118).';
