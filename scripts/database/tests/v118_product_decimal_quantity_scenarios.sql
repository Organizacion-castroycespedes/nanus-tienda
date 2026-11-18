-- Escenarios funcionales de V118 sobre el esquema minimo (fixtures/v118_minimal_schema.sql).
DO $$
DECLARE
  v_flag BOOLEAN;
BEGIN
  -- Backfill: solo productos por unidad, sin serie, con decimales en movimientos o compras.
  SELECT allows_decimal_quantity INTO v_flag FROM products WHERE id = '00000000-0000-0000-0000-0000000000f1';
  IF v_flag THEN RAISE EXCEPTION 'f1 no debia marcarse'; END IF;
  SELECT allows_decimal_quantity INTO v_flag FROM products WHERE id = '00000000-0000-0000-0000-0000000000f2';
  IF NOT v_flag THEN RAISE EXCEPTION 'f2 (stock 10.85) debia marcarse'; END IF;
  SELECT allows_decimal_quantity INTO v_flag FROM products WHERE id = '00000000-0000-0000-0000-0000000000f3';
  IF NOT v_flag THEN RAISE EXCEPTION 'f3 (compra 2.5) debia marcarse'; END IF;
  SELECT allows_decimal_quantity INTO v_flag FROM products WHERE id = '00000000-0000-0000-0000-0000000000f4';
  IF v_flag THEN RAISE EXCEPTION 'f4 con serie no debia marcarse'; END IF;
  SELECT allows_decimal_quantity INTO v_flag FROM products WHERE id = '00000000-0000-0000-0000-0000000000f5';
  IF v_flag THEN RAISE EXCEPTION 'f5 por peso no debia marcarse'; END IF;

  -- Unidades nuevas por unidad.
  UPDATE products SET measurement_unit = 'M' WHERE id = '00000000-0000-0000-0000-0000000000f2';
  UPDATE products SET measurement_unit = 'L' WHERE id = '00000000-0000-0000-0000-0000000000f3';
  UPDATE products SET measurement_unit = 'CM' WHERE id = '00000000-0000-0000-0000-0000000000f1';
  UPDATE products SET measurement_unit = 'M2' WHERE id = '00000000-0000-0000-0000-0000000000f1';

  -- Peso no puede usar unidades de longitud/volumen.
  BEGIN
    UPDATE products SET measurement_unit = 'M' WHERE id = '00000000-0000-0000-0000-0000000000f5';
    RAISE EXCEPTION 'WEIGHT con M debia fallar';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  -- Decimales no aplican a peso ni a productos con serie.
  BEGIN
    UPDATE products SET allows_decimal_quantity = TRUE WHERE id = '00000000-0000-0000-0000-0000000000f5';
    RAISE EXCEPTION 'decimales en WEIGHT debia fallar';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    UPDATE products SET allows_decimal_quantity = TRUE WHERE id = '00000000-0000-0000-0000-0000000000f4';
    RAISE EXCEPTION 'decimales con serie debia fallar';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  -- Unidad desconocida.
  BEGIN
    UPDATE products SET measurement_unit = 'MTR' WHERE id = '00000000-0000-0000-0000-0000000000f1';
    RAISE EXCEPTION 'unidad MTR debia fallar';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
END $$;
