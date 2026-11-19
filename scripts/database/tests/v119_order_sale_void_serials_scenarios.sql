-- Escenarios de V119 sobre el esquema minimo de V117 (fixtures/v117_minimal_schema.sql + V117).
DO $$
DECLARE
  v_tenant UUID := '00000000-0000-0000-0000-0000000000a1';
  v_branch UUID := '00000000-0000-0000-0000-0000000000b1';
  v_product UUID := '00000000-0000-0000-0000-0000000000f1';
  v_order UUID := '00000000-0000-0000-0000-000000009001';
  v_sale_1 UUID := '00000000-0000-0000-0000-000000009101';
  v_sale_2 UUID := '00000000-0000-0000-0000-000000009102';
  v_sale_3 UUID := '00000000-0000-0000-0000-000000009103';
  v_count INTEGER;
BEGIN
  INSERT INTO orders VALUES (v_order, v_tenant, '00000000-0000-0000-0000-0000000000c1');
  INSERT INTO product_serials (tenant_id, product_id, branch_id, serial_number, serial_number_normalized,
    status, source_type, order_id, sold_at)
  VALUES
    (v_tenant, v_product, v_branch, 'V119-A', 'V119-A', 'SOLD', 'ADJUSTMENT', v_order, NOW() - INTERVAL '3 hours'),
    (v_tenant, v_product, v_branch, 'V119-B', 'V119-B', 'SOLD', 'ADJUSTMENT', v_order, NOW() - INTERVAL '2 hours'),
    (v_tenant, v_product, v_branch, 'V119-C', 'V119-C', 'SOLD', 'ADJUSTMENT', v_order, NOW() - INTERVAL '1 hour');

  -- Anulacion sin devolver inventario: solo evento, sin cambio de estado, idempotente.
  v_count := public.prc_product_serials_mark_returned_order_sale(
    v_tenant, v_sale_3, v_order, jsonb_build_array(jsonb_build_object('product_id', v_product, 'quantity', 1)),
    FALSE, NULL, 'sin devolucion');
  IF v_count <> 1 THEN RAISE EXCEPTION 'esperaba 1 evento VOIDED_NOT_RETURNED, obtuvo %', v_count; END IF;
  IF (SELECT count(*) FROM product_serials WHERE order_id = v_order AND status = 'SOLD') <> 3 THEN
    RAISE EXCEPTION 'sin devolucion no debe cambiar estados';
  END IF;

  -- Primera anulacion con devolucion de 2: las dos mas recientes (C y B).
  v_count := public.prc_product_serials_mark_returned_order_sale(
    v_tenant, v_sale_1, v_order, jsonb_build_array(jsonb_build_object('product_id', v_product, 'quantity', 2)),
    TRUE, NULL, 'cliente desiste');
  IF v_count <> 2 THEN RAISE EXCEPTION 'esperaba 2 devueltas, obtuvo %', v_count; END IF;
  IF (SELECT string_agg(serial_number, ',' ORDER BY serial_number) FROM product_serials WHERE status = 'RETURNED') <> 'V119-B,V119-C' THEN
    RAISE EXCEPTION 'debia devolver B y C';
  END IF;
  IF (SELECT count(*) FROM product_serial_events WHERE reference_id = v_sale_1 AND event_type = 'RETURNED') <> 2 THEN
    RAISE EXCEPTION 'faltan eventos RETURNED';
  END IF;

  -- Segunda anulacion pide 2 pero solo queda 1 vendida del pedido.
  v_count := public.prc_product_serials_mark_returned_order_sale(
    v_tenant, v_sale_2, v_order, jsonb_build_array(jsonb_build_object('product_id', v_product, 'quantity', 2)),
    TRUE, NULL, 'segunda');
  IF v_count <> 1 THEN RAISE EXCEPTION 'esperaba 1 devuelta, obtuvo %', v_count; END IF;

  -- Otro tenant u otro pedido no se tocan; lineas invalidas se rechazan.
  v_count := public.prc_product_serials_mark_returned_order_sale(
    '00000000-0000-0000-0000-0000000000a2', v_sale_2, v_order,
    jsonb_build_array(jsonb_build_object('product_id', v_product, 'quantity', 5)), TRUE, NULL, 'x');
  IF v_count <> 0 THEN RAISE EXCEPTION 'otro tenant no debe afectar series'; END IF;
  BEGIN
    PERFORM public.prc_product_serials_mark_returned_order_sale(v_tenant, v_sale_2, v_order, '{}'::jsonb, TRUE, NULL, 'x');
    RAISE EXCEPTION 'lineas invalidas debian fallar';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'SERIAL_ORDER_SALE_LINES_INVALID' THEN RAISE; END IF;
  END;
END $$;
