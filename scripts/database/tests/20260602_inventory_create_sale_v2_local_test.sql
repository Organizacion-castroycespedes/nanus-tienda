-- SOLO LOCAL/DEV - NO PRD.
-- Pruebas controladas locales de inventory_create_sale_v2.

\set ON_ERROR_STOP on

\ir ../dev/20260602_fixture_sale_v2_local.sql

CREATE TEMP TABLE sale_v2_test_results (
  scenario TEXT PRIMARY KEY,
  status TEXT NOT NULL,
  detail TEXT NOT NULL
) ON COMMIT PRESERVE ROWS;

CREATE TEMP TABLE sale_v2_test_counts (
  metric TEXT PRIMARY KEY,
  value NUMERIC NOT NULL
) ON COMMIT PRESERVE ROWS;

DO $$
DECLARE
  c_tenant_id CONSTANT UUID := '90000000-0000-0000-0000-000000000001';
  c_branch_id CONSTANT UUID := '90000000-0000-0000-0000-000000000002';
  c_unit_id CONSTANT UUID := '90000000-0000-0000-0000-000000000003';
  c_user_id CONSTANT UUID := '90000000-0000-0000-0000-000000000004';
  c_terminal_id CONSTANT UUID := '90000000-0000-0000-0000-000000000006';
  c_pos_session_id CONSTANT UUID := '90000000-0000-0000-0000-000000000007';
  c_customer_id CONSTANT UUID := '90000000-0000-0000-0000-000000000008';
  c_product_non_lot_id CONSTANT UUID := '90000000-0000-0000-0000-000000000101';
  c_product_lot_one_id CONSTANT UUID := '90000000-0000-0000-0000-000000000102';
  c_product_lot_fefo_id CONSTANT UUID := '90000000-0000-0000-0000-000000000103';
  c_product_lot_mixed_id CONSTANT UUID := '90000000-0000-0000-0000-000000000104';
  c_lot_one_id CONSTANT UUID := '90000000-0000-0000-0000-000000000201';
  c_lot_fefo_soon_id CONSTANT UUID := '90000000-0000-0000-0000-000000000202';
  c_lot_fefo_later_id CONSTANT UUID := '90000000-0000-0000-0000-000000000203';
  c_lot_mixed_id CONSTANT UUID := '90000000-0000-0000-0000-000000000204';
  c_product_fail_insufficient_id CONSTANT UUID := '90000000-0000-0000-0000-000000000105';
  c_product_fail_expired_id CONSTANT UUID := '90000000-0000-0000-0000-000000000106';
  c_product_fail_blocked_id CONSTANT UUID := '90000000-0000-0000-0000-000000000107';
  c_product_fail_cancelled_id CONSTANT UUID := '90000000-0000-0000-0000-000000000108';
  c_lot_fail_insufficient_id CONSTANT UUID := '90000000-0000-0000-0000-000000000205';
  c_lot_fail_expired_id CONSTANT UUID := '90000000-0000-0000-0000-000000000206';
  c_lot_fail_blocked_id CONSTANT UUID := '90000000-0000-0000-0000-000000000207';
  c_lot_fail_cancelled_id CONSTANT UUID := '90000000-0000-0000-0000-000000000208';
  v_server_addr TEXT := COALESCE(inet_server_addr()::TEXT, 'local-socket');
  v_sale_id UUID;
  v_count INTEGER;
  v_sales_before INTEGER;
  v_items_before INTEGER;
  v_movements_before INTEGER;
  v_links_before INTEGER;
  v_balance_before NUMERIC;
  v_error TEXT;
BEGIN
  IF NOT (
    v_server_addr = 'local-socket'
    OR v_server_addr LIKE '127.0.0.1%'
    OR v_server_addr LIKE '::1%'
  ) THEN
    RAISE EXCEPTION 'SOLO LOCAL/DEV: servidor no local detectado: %', v_server_addr;
  END IF;

  IF to_regprocedure('public.inventory_create_sale(uuid,uuid,uuid,uuid,uuid,uuid,uuid,character varying,jsonb,jsonb)') IS NULL THEN
    RAISE EXCEPTION 'inventory_create_sale v1 no existe';
  END IF;

  IF to_regprocedure('public.inventory_create_sale_v2(uuid,uuid,uuid,uuid,uuid,uuid,uuid,character varying,jsonb,jsonb)') IS NULL THEN
    RAISE EXCEPTION 'inventory_create_sale_v2 no existe';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'inventory_invoice_order') THEN
    RAISE EXCEPTION 'inventory_invoice_order no existe';
  END IF;

  INSERT INTO sale_v2_test_counts(metric, value)
  SELECT 'before_sales', COUNT(*) FROM sales WHERE tenant_id = c_tenant_id
  UNION ALL
  SELECT 'before_sale_items', COUNT(*) FROM sale_items WHERE tenant_id = c_tenant_id
  UNION ALL
  SELECT 'before_stock_movements_out', COUNT(*) FROM stock_movements WHERE tenant_id = c_tenant_id AND type = 'OUT'
  UNION ALL
  SELECT 'before_stock_movement_lots', COUNT(*) FROM stock_movement_lots WHERE tenant_id = c_tenant_id;

  SELECT sale_result.id
  INTO v_sale_id
  FROM public.inventory_create_sale_v2(
    c_tenant_id,
    c_branch_id,
    c_terminal_id,
    c_user_id,
    c_pos_session_id,
    c_customer_id,
    NULL,
    'CASH',
    jsonb_build_array(
      jsonb_build_object(
        'product_id', c_product_non_lot_id,
        'quantity', 2,
        'price', 100,
        'order_item_id', NULL
      )
    ),
    jsonb_build_array(
      jsonb_build_object('payment_method', 'CASH', 'amount', 200, 'reference', 'PHASE-3-14-A')
    )
  ) AS sale_result;

  IF NOT EXISTS (SELECT 1 FROM sales WHERE id = v_sale_id AND tenant_id = c_tenant_id AND total = 200) THEN
    RAISE EXCEPTION 'A: venta no loteada no creo sales esperado';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM sale_items WHERE sale_id = v_sale_id AND product_id = c_product_non_lot_id AND quantity = 2) THEN
    RAISE EXCEPTION 'A: venta no loteada no creo sale_items esperado';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM stock_movements WHERE reference_id = v_sale_id AND product_id = c_product_non_lot_id AND type = 'OUT' AND quantity = 2) THEN
    RAISE EXCEPTION 'A: venta no loteada no creo stock_movements OUT esperado';
  END IF;

  SELECT COUNT(*)
  INTO v_count
  FROM stock_movement_lots sml
  INNER JOIN stock_movements sm ON sm.id = sml.stock_movement_id
  WHERE sm.reference_id = v_sale_id;

  IF v_count <> 0 THEN
    RAISE EXCEPTION 'A: producto no loteado creo stock_movement_lots';
  END IF;

  INSERT INTO sale_v2_test_results VALUES ('A', 'OK', 'Venta no loteada crea sale, item y OUT sin stock_movement_lots.');

  SELECT sale_result.id
  INTO v_sale_id
  FROM public.inventory_create_sale_v2(
    c_tenant_id,
    c_branch_id,
    c_terminal_id,
    c_user_id,
    c_pos_session_id,
    c_customer_id,
    NULL,
    'CASH',
    jsonb_build_array(
      jsonb_build_object('product_id', c_product_lot_one_id, 'quantity', 4, 'price', 50, 'order_item_id', NULL)
    ),
    jsonb_build_array(
      jsonb_build_object('payment_method', 'CASH', 'amount', 200, 'reference', 'PHASE-3-14-B')
    )
  ) AS sale_result;

  IF NOT EXISTS (
    SELECT 1
    FROM inventory_lot_balances
    WHERE lot_id = c_lot_one_id
      AND quantity_on_hand = 6
      AND quantity_available = 6
  ) THEN
    RAISE EXCEPTION 'B: balance de lote unico no bajo a 6';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM stock_movement_lots sml
    INNER JOIN stock_movements sm ON sm.id = sml.stock_movement_id
    WHERE sm.reference_id = v_sale_id
      AND sml.lot_id = c_lot_one_id
      AND sml.quantity = 4
  ) THEN
    RAISE EXCEPTION 'B: no creo stock_movement_lots esperado para lote unico';
  END IF;

  INSERT INTO sale_v2_test_results VALUES ('B', 'OK', 'Venta loteada con un lote suficiente descuenta balance y crea link.');

  SELECT sale_result.id
  INTO v_sale_id
  FROM public.inventory_create_sale_v2(
    c_tenant_id,
    c_branch_id,
    c_terminal_id,
    c_user_id,
    c_pos_session_id,
    c_customer_id,
    NULL,
    'CASH',
    jsonb_build_array(
      jsonb_build_object('product_id', c_product_lot_fefo_id, 'quantity', 5, 'price', 30, 'order_item_id', NULL)
    ),
    jsonb_build_array(
      jsonb_build_object('payment_method', 'CASH', 'amount', 150, 'reference', 'PHASE-3-14-C')
    )
  ) AS sale_result;

  IF NOT EXISTS (SELECT 1 FROM inventory_lot_balances WHERE lot_id = c_lot_fefo_soon_id AND quantity_on_hand = 0) THEN
    RAISE EXCEPTION 'C: lote FEFO proximo no se consumio primero';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM inventory_lot_balances WHERE lot_id = c_lot_fefo_later_id AND quantity_on_hand = 2) THEN
    RAISE EXCEPTION 'C: lote FEFO posterior no quedo en 2';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM stock_movement_lots sml
    INNER JOIN stock_movements sm ON sm.id = sml.stock_movement_id
    WHERE sm.reference_id = v_sale_id
      AND sml.lot_id = c_lot_fefo_soon_id
      AND sml.quantity = 2
  ) THEN
    RAISE EXCEPTION 'C: no registro consumo del lote FEFO proximo';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM stock_movement_lots sml
    INNER JOIN stock_movements sm ON sm.id = sml.stock_movement_id
    WHERE sm.reference_id = v_sale_id
      AND sml.lot_id = c_lot_fefo_later_id
      AND sml.quantity = 3
  ) THEN
    RAISE EXCEPTION 'C: no registro consumo parcial del lote FEFO posterior';
  END IF;

  INSERT INTO sale_v2_test_results VALUES ('C', 'OK', 'Venta FEFO consume lote mas proximo y luego lote posterior.');

  SELECT sale_result.id
  INTO v_sale_id
  FROM public.inventory_create_sale_v2(
    c_tenant_id,
    c_branch_id,
    c_terminal_id,
    c_user_id,
    c_pos_session_id,
    c_customer_id,
    NULL,
    'CASH',
    jsonb_build_array(
      jsonb_build_object('product_id', c_product_non_lot_id, 'quantity', 1, 'price', 100, 'order_item_id', NULL),
      jsonb_build_object('product_id', c_product_lot_mixed_id, 'quantity', 2, 'price', 60, 'order_item_id', NULL)
    ),
    jsonb_build_array(
      jsonb_build_object('payment_method', 'CASH', 'amount', 220, 'reference', 'PHASE-3-14-D')
    )
  ) AS sale_result;

  IF (SELECT COUNT(*) FROM sale_items WHERE sale_id = v_sale_id) <> 2 THEN
    RAISE EXCEPTION 'D: venta mixta no creo dos sale_items';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM inventory_lot_balances WHERE lot_id = c_lot_mixed_id AND quantity_on_hand = 3) THEN
    RAISE EXCEPTION 'D: venta mixta no desconto loteado a 3';
  END IF;

  SELECT COUNT(*)
  INTO v_count
  FROM stock_movement_lots sml
  INNER JOIN stock_movements sm ON sm.id = sml.stock_movement_id
  WHERE sm.reference_id = v_sale_id;

  IF v_count <> 1 THEN
    RAISE EXCEPTION 'D: venta mixta debe crear link solo para item loteado, count=%', v_count;
  END IF;

  INSERT INTO sale_v2_test_results VALUES ('D', 'OK', 'Venta mixta vende ambos productos y solo el loteado crea movement_lot.');

  INSERT INTO products (
    id, tenant_id, unit_id, tax_id, name, description, sku, price, cost,
    price_with_tax, price_without_tax, is_active, is_perishable,
    requires_lot, requires_expiration, operational_status
  )
  VALUES (
    c_product_fail_insufficient_id, c_tenant_id, c_unit_id, NULL,
    'S314 fail insuficiente', 'SOLO LOCAL/DEV', 'S314-FAIL-INSUFFICIENT',
    10, 5, 10, 10, TRUE, TRUE, TRUE, TRUE, 'ACTIVE'
  );

  INSERT INTO stock_movements (
    id, tenant_id, product_id, type, quantity, reference_type, reference_id,
    branch_id, terminal_id, pos_session_code, user_id, reference_table,
    stock_before, stock_after
  )
  VALUES (
    gen_random_uuid(), c_tenant_id, c_product_fail_insufficient_id, 'IN', 5,
    'ADJUSTMENT', c_product_fail_insufficient_id, c_branch_id, c_terminal_id,
    c_pos_session_id::TEXT, c_user_id, 'phase_3_14_failure_fixture', 0, 5
  );

  INSERT INTO inventory_lots (
    id, tenant_id, branch_id, product_id, lot_code, expiration_date,
    received_at, unit_cost, status, is_legacy
  )
  VALUES (
    c_lot_fail_insufficient_id, c_tenant_id, c_branch_id, c_product_fail_insufficient_id,
    'S314-FAIL-INSUF', CURRENT_DATE + 30, NOW(), 5, 'ACTIVE', FALSE
  );

  INSERT INTO inventory_lot_balances (
    tenant_id, branch_id, product_id, lot_id, quantity_on_hand, quantity_reserved
  )
  VALUES (c_tenant_id, c_branch_id, c_product_fail_insufficient_id, c_lot_fail_insufficient_id, 2, 0);

  SELECT COUNT(*) INTO v_sales_before FROM sales WHERE tenant_id = c_tenant_id;
  SELECT COUNT(*) INTO v_items_before FROM sale_items WHERE tenant_id = c_tenant_id;
  SELECT COUNT(*) INTO v_movements_before FROM stock_movements WHERE tenant_id = c_tenant_id;
  SELECT COUNT(*) INTO v_links_before FROM stock_movement_lots WHERE tenant_id = c_tenant_id;
  SELECT quantity_on_hand INTO v_balance_before FROM inventory_lot_balances WHERE lot_id = c_lot_fail_insufficient_id;
  v_error := NULL;

  BEGIN
    SELECT sale_result.id
    INTO v_sale_id
    FROM public.inventory_create_sale_v2(
      c_tenant_id, c_branch_id, c_terminal_id, c_user_id, c_pos_session_id,
      c_customer_id, NULL, 'CASH',
      jsonb_build_array(jsonb_build_object('product_id', c_product_fail_insufficient_id, 'quantity', 4, 'price', 10, 'order_item_id', NULL)),
      jsonb_build_array(jsonb_build_object('payment_method', 'CASH', 'amount', 40, 'reference', 'PHASE-3-14-E'))
    ) AS sale_result;
  EXCEPTION WHEN OTHERS THEN
    v_error := SQLERRM;
  END;

  IF v_error IS NULL OR v_error NOT ILIKE '%insufficient FEFO lot stock%' THEN
    RAISE EXCEPTION 'E: error esperado no ocurrio. error=%', v_error;
  END IF;

  IF (SELECT COUNT(*) FROM sales WHERE tenant_id = c_tenant_id) <> v_sales_before
    OR (SELECT COUNT(*) FROM sale_items WHERE tenant_id = c_tenant_id) <> v_items_before
    OR (SELECT COUNT(*) FROM stock_movements WHERE tenant_id = c_tenant_id) <> v_movements_before
    OR (SELECT COUNT(*) FROM stock_movement_lots WHERE tenant_id = c_tenant_id) <> v_links_before
    OR (SELECT quantity_on_hand FROM inventory_lot_balances WHERE lot_id = c_lot_fail_insufficient_id) <> v_balance_before THEN
    RAISE EXCEPTION 'E: rollback de venta insuficiente no fue total';
  END IF;

  DELETE FROM inventory_lot_balances WHERE product_id = c_product_fail_insufficient_id;
  DELETE FROM inventory_lots WHERE product_id = c_product_fail_insufficient_id;
  DELETE FROM stock_movements WHERE product_id = c_product_fail_insufficient_id;
  DELETE FROM products WHERE id = c_product_fail_insufficient_id;
  INSERT INTO sale_v2_test_results VALUES ('E', 'OK', 'Stock loteado insuficiente falla y no deja sale/items/movements/links ni cambia balance.');

  INSERT INTO products (
    id, tenant_id, unit_id, tax_id, name, description, sku, price, cost,
    price_with_tax, price_without_tax, is_active, is_perishable,
    requires_lot, requires_expiration, operational_status
  )
  VALUES (
    c_product_fail_expired_id, c_tenant_id, c_unit_id, NULL,
    'S314 fail vencido', 'SOLO LOCAL/DEV', 'S314-FAIL-EXPIRED',
    10, 5, 10, 10, TRUE, TRUE, TRUE, TRUE, 'ACTIVE'
  );

  INSERT INTO stock_movements (
    id, tenant_id, product_id, type, quantity, reference_type, reference_id,
    branch_id, terminal_id, pos_session_code, user_id, reference_table,
    stock_before, stock_after
  )
  VALUES (
    gen_random_uuid(), c_tenant_id, c_product_fail_expired_id, 'IN', 5,
    'ADJUSTMENT', c_product_fail_expired_id, c_branch_id, c_terminal_id,
    c_pos_session_id::TEXT, c_user_id, 'phase_3_14_failure_fixture', 0, 5
  );

  INSERT INTO inventory_lots (
    id, tenant_id, branch_id, product_id, lot_code, expiration_date,
    received_at, unit_cost, status, is_legacy
  )
  VALUES (
    c_lot_fail_expired_id, c_tenant_id, c_branch_id, c_product_fail_expired_id,
    'S314-FAIL-EXP', CURRENT_DATE - 1, NOW(), 5, 'ACTIVE', FALSE
  );

  INSERT INTO inventory_lot_balances (
    tenant_id, branch_id, product_id, lot_id, quantity_on_hand, quantity_reserved
  )
  VALUES (c_tenant_id, c_branch_id, c_product_fail_expired_id, c_lot_fail_expired_id, 5, 0);

  SELECT COUNT(*) INTO v_sales_before FROM sales WHERE tenant_id = c_tenant_id;
  SELECT COUNT(*) INTO v_items_before FROM sale_items WHERE tenant_id = c_tenant_id;
  SELECT COUNT(*) INTO v_movements_before FROM stock_movements WHERE tenant_id = c_tenant_id;
  SELECT COUNT(*) INTO v_links_before FROM stock_movement_lots WHERE tenant_id = c_tenant_id;
  SELECT quantity_on_hand INTO v_balance_before FROM inventory_lot_balances WHERE lot_id = c_lot_fail_expired_id;
  v_error := NULL;

  BEGIN
    SELECT sale_result.id
    INTO v_sale_id
    FROM public.inventory_create_sale_v2(
      c_tenant_id, c_branch_id, c_terminal_id, c_user_id, c_pos_session_id,
      c_customer_id, NULL, 'CASH',
      jsonb_build_array(jsonb_build_object('product_id', c_product_fail_expired_id, 'quantity', 1, 'price', 10, 'order_item_id', NULL)),
      jsonb_build_array(jsonb_build_object('payment_method', 'CASH', 'amount', 10, 'reference', 'PHASE-3-14-F'))
    ) AS sale_result;
  EXCEPTION WHEN OTHERS THEN
    v_error := SQLERRM;
  END;

  IF v_error IS NULL OR v_error NOT ILIKE '%insufficient FEFO lot stock%' THEN
    RAISE EXCEPTION 'F: error esperado no ocurrio. error=%', v_error;
  END IF;

  IF (SELECT COUNT(*) FROM sales WHERE tenant_id = c_tenant_id) <> v_sales_before
    OR (SELECT COUNT(*) FROM sale_items WHERE tenant_id = c_tenant_id) <> v_items_before
    OR (SELECT COUNT(*) FROM stock_movements WHERE tenant_id = c_tenant_id) <> v_movements_before
    OR (SELECT COUNT(*) FROM stock_movement_lots WHERE tenant_id = c_tenant_id) <> v_links_before
    OR (SELECT quantity_on_hand FROM inventory_lot_balances WHERE lot_id = c_lot_fail_expired_id) <> v_balance_before THEN
    RAISE EXCEPTION 'F: lote vencido dejo mutaciones';
  END IF;

  DELETE FROM inventory_lot_balances WHERE product_id = c_product_fail_expired_id;
  DELETE FROM inventory_lots WHERE product_id = c_product_fail_expired_id;
  DELETE FROM stock_movements WHERE product_id = c_product_fail_expired_id;
  DELETE FROM products WHERE id = c_product_fail_expired_id;
  INSERT INTO sale_v2_test_results VALUES ('F', 'OK', 'Lote vencido se excluye y no muta datos.');

  INSERT INTO products (
    id, tenant_id, unit_id, tax_id, name, description, sku, price, cost,
    price_with_tax, price_without_tax, is_active, is_perishable,
    requires_lot, requires_expiration, operational_status
  )
  VALUES
    (
      c_product_fail_blocked_id, c_tenant_id, c_unit_id, NULL,
      'S314 fail blocked', 'SOLO LOCAL/DEV', 'S314-FAIL-BLOCKED',
      10, 5, 10, 10, TRUE, TRUE, TRUE, TRUE, 'ACTIVE'
    ),
    (
      c_product_fail_cancelled_id, c_tenant_id, c_unit_id, NULL,
      'S314 fail cancelled', 'SOLO LOCAL/DEV', 'S314-FAIL-CANCELLED',
      10, 5, 10, 10, TRUE, TRUE, TRUE, TRUE, 'ACTIVE'
    );

  INSERT INTO stock_movements (
    id, tenant_id, product_id, type, quantity, reference_type, reference_id,
    branch_id, terminal_id, pos_session_code, user_id, reference_table,
    stock_before, stock_after
  )
  VALUES
    (gen_random_uuid(), c_tenant_id, c_product_fail_blocked_id, 'IN', 5, 'ADJUSTMENT', c_product_fail_blocked_id, c_branch_id, c_terminal_id, c_pos_session_id::TEXT, c_user_id, 'phase_3_14_failure_fixture', 0, 5),
    (gen_random_uuid(), c_tenant_id, c_product_fail_cancelled_id, 'IN', 5, 'ADJUSTMENT', c_product_fail_cancelled_id, c_branch_id, c_terminal_id, c_pos_session_id::TEXT, c_user_id, 'phase_3_14_failure_fixture', 0, 5);

  INSERT INTO inventory_lots (
    id, tenant_id, branch_id, product_id, lot_code, expiration_date,
    received_at, unit_cost, status, is_legacy
  )
  VALUES
    (c_lot_fail_blocked_id, c_tenant_id, c_branch_id, c_product_fail_blocked_id, 'S314-FAIL-BLOCK', CURRENT_DATE + 30, NOW(), 5, 'BLOCKED', FALSE),
    (c_lot_fail_cancelled_id, c_tenant_id, c_branch_id, c_product_fail_cancelled_id, 'S314-FAIL-CANCEL', CURRENT_DATE + 30, NOW(), 5, 'CANCELLED', FALSE);

  INSERT INTO inventory_lot_balances (
    tenant_id, branch_id, product_id, lot_id, quantity_on_hand, quantity_reserved
  )
  VALUES
    (c_tenant_id, c_branch_id, c_product_fail_blocked_id, c_lot_fail_blocked_id, 5, 0),
    (c_tenant_id, c_branch_id, c_product_fail_cancelled_id, c_lot_fail_cancelled_id, 5, 0);

  FOREACH v_sale_id IN ARRAY ARRAY[c_product_fail_blocked_id, c_product_fail_cancelled_id]
  LOOP
    SELECT COUNT(*) INTO v_sales_before FROM sales WHERE tenant_id = c_tenant_id;
    SELECT COUNT(*) INTO v_items_before FROM sale_items WHERE tenant_id = c_tenant_id;
    SELECT COUNT(*) INTO v_movements_before FROM stock_movements WHERE tenant_id = c_tenant_id;
    SELECT COUNT(*) INTO v_links_before FROM stock_movement_lots WHERE tenant_id = c_tenant_id;
    v_error := NULL;

    BEGIN
      PERFORM *
      FROM public.inventory_create_sale_v2(
        c_tenant_id, c_branch_id, c_terminal_id, c_user_id, c_pos_session_id,
        c_customer_id, NULL, 'CASH',
        jsonb_build_array(jsonb_build_object('product_id', v_sale_id, 'quantity', 1, 'price', 10, 'order_item_id', NULL)),
        jsonb_build_array(jsonb_build_object('payment_method', 'CASH', 'amount', 10, 'reference', 'PHASE-3-14-G'))
      );
    EXCEPTION WHEN OTHERS THEN
      v_error := SQLERRM;
    END;

    IF v_error IS NULL OR v_error NOT ILIKE '%insufficient FEFO lot stock%' THEN
      RAISE EXCEPTION 'G: error esperado no ocurrio para producto %. error=%', v_sale_id, v_error;
    END IF;

    IF (SELECT COUNT(*) FROM sales WHERE tenant_id = c_tenant_id) <> v_sales_before
      OR (SELECT COUNT(*) FROM sale_items WHERE tenant_id = c_tenant_id) <> v_items_before
      OR (SELECT COUNT(*) FROM stock_movements WHERE tenant_id = c_tenant_id) <> v_movements_before
      OR (SELECT COUNT(*) FROM stock_movement_lots WHERE tenant_id = c_tenant_id) <> v_links_before THEN
      RAISE EXCEPTION 'G: lote bloqueado/cancelado dejo mutaciones para producto %', v_sale_id;
    END IF;
  END LOOP;

  DELETE FROM inventory_lot_balances WHERE product_id IN (c_product_fail_blocked_id, c_product_fail_cancelled_id);
  DELETE FROM inventory_lots WHERE product_id IN (c_product_fail_blocked_id, c_product_fail_cancelled_id);
  DELETE FROM stock_movements WHERE product_id IN (c_product_fail_blocked_id, c_product_fail_cancelled_id);
  DELETE FROM products WHERE id IN (c_product_fail_blocked_id, c_product_fail_cancelled_id);
  INSERT INTO sale_v2_test_results VALUES ('G', 'OK', 'Lotes BLOCKED/CANCELLED se excluyen y no mutan datos.');

  WITH scoped_products(product_id) AS (
    VALUES
      (c_product_lot_one_id),
      (c_product_lot_fefo_id),
      (c_product_lot_mixed_id)
  ),
  expected AS (
    SELECT
      sml.lot_id,
      sml.product_id,
      SUM(CASE WHEN sm.type = 'IN' THEN sml.quantity ELSE -sml.quantity END) AS expected_on_hand
    FROM stock_movement_lots sml
    INNER JOIN stock_movements sm ON sm.id = sml.stock_movement_id
    INNER JOIN scoped_products sp ON sp.product_id = sml.product_id
    WHERE sml.tenant_id = c_tenant_id
    GROUP BY sml.lot_id, sml.product_id
  ),
  discrepancies AS (
    SELECT 1
    FROM stock_movement_lots sml
    LEFT JOIN stock_movements sm ON sm.id = sml.stock_movement_id
    INNER JOIN scoped_products sp ON sp.product_id = sml.product_id
    WHERE sml.tenant_id = c_tenant_id
      AND sm.id IS NULL
    UNION ALL
    SELECT 1
    FROM stock_movement_lots sml
    INNER JOIN stock_movements sm ON sm.id = sml.stock_movement_id
    INNER JOIN inventory_lots lot ON lot.id = sml.lot_id
    INNER JOIN scoped_products sp ON sp.product_id = sml.product_id
    WHERE sml.tenant_id = c_tenant_id
      AND (
        sm.tenant_id <> sml.tenant_id
        OR sm.product_id <> sml.product_id
        OR lot.product_id <> sml.product_id
        OR lot.tenant_id <> sml.tenant_id
      )
    UNION ALL
    SELECT 1
    FROM inventory_lot_balances b
    INNER JOIN expected e
      ON e.lot_id = b.lot_id
     AND e.product_id = b.product_id
    WHERE b.tenant_id = c_tenant_id
      AND (
        b.quantity_on_hand <> e.expected_on_hand
        OR b.quantity_available <> e.expected_on_hand
        OR b.quantity_reserved < 0
        OR b.quantity_reserved > b.quantity_on_hand
      )
  )
  SELECT COUNT(*) INTO v_count FROM discrepancies;

  IF v_count <> 0 THEN
    RAISE EXCEPTION 'H: reconciliacion de datos exitosos encontro % discrepancias', v_count;
  END IF;

  INSERT INTO sale_v2_test_results VALUES ('H', 'OK', 'Reconciliacion de lotes exitosos sin discrepancias.');

  INSERT INTO sale_v2_test_counts(metric, value)
  SELECT 'after_sales', COUNT(*) FROM sales WHERE tenant_id = c_tenant_id
  UNION ALL
  SELECT 'after_sale_items', COUNT(*) FROM sale_items WHERE tenant_id = c_tenant_id
  UNION ALL
  SELECT 'after_stock_movements_out', COUNT(*) FROM stock_movements WHERE tenant_id = c_tenant_id AND type = 'OUT'
  UNION ALL
  SELECT 'after_stock_movement_lots', COUNT(*) FROM stock_movement_lots WHERE tenant_id = c_tenant_id;
END $$;

TABLE sale_v2_test_results ORDER BY scenario;
TABLE sale_v2_test_counts ORDER BY metric;

SELECT
  lot.lot_code,
  balance.quantity_on_hand,
  balance.quantity_reserved,
  balance.quantity_available
FROM inventory_lot_balances balance
INNER JOIN inventory_lots lot ON lot.id = balance.lot_id
WHERE balance.tenant_id = '90000000-0000-0000-0000-000000000001'
ORDER BY lot.lot_code;
