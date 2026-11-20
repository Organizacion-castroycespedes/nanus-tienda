-- Escenarios funcionales de V120 sobre el esquema minimo (fixtures/v120_minimal_schema.sql).
DO $$
DECLARE
  t_a CONSTANT UUID := '00000000-0000-0000-0000-0000000000a1';
  t_b CONSTANT UUID := '00000000-0000-0000-0000-0000000000a2';
  q1 CONSTANT UUID := '00000000-0000-0000-0000-000000000101';
  q2 CONSTANT UUID := '00000000-0000-0000-0000-000000000102';
  v_count INTEGER;
  v_code TEXT;
  v_actions JSONB;
BEGIN
  -- Menu y permisos: un menu activo por tenant, incluido el que estaba borrado.
  SELECT count(*) INTO v_count FROM menu_items WHERE key = 'QUOTATIONS' AND deleted_at IS NULL;
  IF v_count <> 2 THEN RAISE EXCEPTION 'se esperaban 2 menus QUOTATIONS activos, hay %', v_count; END IF;
  SELECT count(*) INTO v_count FROM role_menu_permissions rmp
    JOIN menu_items mi ON mi.id = rmp.menu_item_id WHERE mi.key = 'QUOTATIONS';
  IF v_count <> 8 THEN RAISE EXCEPTION 'se esperaban 8 permisos (4 roles x 2 tenants), hay %', v_count; END IF;
  SELECT rmp.actions INTO v_actions FROM role_menu_permissions rmp
    JOIN menu_items mi ON mi.id = rmp.menu_item_id JOIN roles r ON r.id = rmp.role_id
    WHERE mi.key = 'QUOTATIONS' AND mi.tenant_id = t_a AND r.nombre = 'USER';
  IF v_actions ? 'QUOTATIONS_APPROVE' OR v_actions ? 'QUOTATIONS_CONVERT' OR NOT v_actions ? 'QUOTATIONS_CREATE' THEN
    RAISE EXCEPTION 'USER debe crear pero no aprobar ni convertir: %', v_actions;
  END IF;
  SELECT rmp.actions INTO v_actions FROM role_menu_permissions rmp
    JOIN menu_items mi ON mi.id = rmp.menu_item_id JOIN roles r ON r.id = rmp.role_id
    WHERE mi.key = 'QUOTATIONS' AND mi.tenant_id = t_a AND r.nombre = 'ADMIN';
  IF NOT (v_actions ? 'QUOTATIONS_CONVERT' AND v_actions ? 'QUOTATIONS_SETTINGS') THEN
    RAISE EXCEPTION 'ADMIN debe convertir y configurar: %', v_actions;
  END IF;

  -- Consecutivo por tenant.
  v_code := fnc_quotation_next_code(t_a);
  IF v_code <> 'COT-000001' THEN RAISE EXCEPTION 'primer codigo A: %', v_code; END IF;
  v_code := fnc_quotation_next_code(t_a);
  IF v_code <> 'COT-000002' THEN RAISE EXCEPTION 'segundo codigo A: %', v_code; END IF;
  v_code := fnc_quotation_next_code(t_b);
  IF v_code <> 'COT-000001' THEN RAISE EXCEPTION 'primer codigo B: %', v_code; END IF;

  -- Estado efectivo.
  IF fnc_quotation_effective_status('APPROVED', DATE '2026-12-04', DATE '2026-12-04') <> 'APPROVED' THEN
    RAISE EXCEPTION 'el ultimo dia de vigencia sigue vigente';
  END IF;
  IF fnc_quotation_effective_status('APPROVED', DATE '2026-12-04', DATE '2026-12-05') <> 'EXPIRED' THEN
    RAISE EXCEPTION 'APPROVED vencida debe ser EXPIRED';
  END IF;
  IF fnc_quotation_effective_status('DRAFT', DATE '2026-12-04', DATE '2026-12-05') <> 'EXPIRED'
    OR fnc_quotation_effective_status('SENT', DATE '2026-12-04', DATE '2026-12-05') <> 'EXPIRED' THEN
    RAISE EXCEPTION 'DRAFT/SENT vencidas deben ser EXPIRED';
  END IF;
  IF fnc_quotation_effective_status('CONVERTED', DATE '2026-12-04', DATE '2026-12-05') <> 'CONVERTED'
    OR fnc_quotation_effective_status('REJECTED', DATE '2026-12-04', DATE '2026-12-05') <> 'REJECTED' THEN
    RAISE EXCEPTION 'CONVERTED/REJECTED no vencen';
  END IF;

  -- Cotizacion valida con una linea.
  INSERT INTO quotations (id, tenant_id, branch_id, customer_id, code, issue_date, validity_days, valid_until,
    subtotal, tax_total, total)
  VALUES (q1, t_a, '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000c1',
    'COT-000001', DATE '2026-11-19', 15, DATE '2026-12-04', 100, 19, 119);
  INSERT INTO quotation_items (tenant_id, quotation_id, line_number, product_id, product_name, quantity,
    base_unit_price, final_unit_price, tax_rate, tax_base, tax_amount, line_total, pricing_snapshot)
  VALUES (t_a, q1, 1, '00000000-0000-0000-0000-0000000000f1', 'Cable', 10.85, 10, 10, 19, 100, 19, 119,
    '{"channel":"QUOTATION"}');

  -- Codigo duplicado en el tenant.
  BEGIN
    INSERT INTO quotations (tenant_id, branch_id, customer_id, code, issue_date, validity_days, valid_until)
    VALUES (t_a, '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000c1',
      'COT-000001', DATE '2026-11-19', 15, DATE '2026-12-04');
    RAISE EXCEPTION 'codigo duplicado debia fallar';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;

  -- Cliente obligatorio.
  BEGIN
    INSERT INTO quotations (tenant_id, branch_id, customer_id, code, issue_date, validity_days, valid_until)
    VALUES (t_a, '00000000-0000-0000-0000-0000000000b1', NULL, 'COT-000099', DATE '2026-11-19', 15, DATE '2026-12-04');
    RAISE EXCEPTION 'cotizacion sin cliente debia fallar';
  EXCEPTION WHEN not_null_violation THEN NULL;
  END;

  -- Vigencia invalida.
  BEGIN
    INSERT INTO quotations (tenant_id, branch_id, customer_id, code, issue_date, validity_days, valid_until)
    VALUES (t_a, '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000c1',
      'COT-000098', DATE '2026-11-19', 0, DATE '2026-11-18');
    RAISE EXCEPTION 'vigencia invalida debia fallar';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  -- Linea sin producto y cantidad no positiva.
  BEGIN
    INSERT INTO quotation_items (tenant_id, quotation_id, line_number, product_id, product_name, quantity, pricing_snapshot)
    VALUES (t_a, q1, 2, NULL, 'Texto libre', 1, '{}');
    RAISE EXCEPTION 'linea sin producto debia fallar';
  EXCEPTION WHEN not_null_violation THEN NULL;
  END;
  BEGIN
    INSERT INTO quotation_items (tenant_id, quotation_id, line_number, product_id, product_name, quantity, pricing_snapshot)
    VALUES (t_a, q1, 2, '00000000-0000-0000-0000-0000000000f1', 'Cable', 0, '{}');
    RAISE EXCEPTION 'cantidad cero debia fallar';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  -- Rechazo sin motivo.
  BEGIN
    UPDATE quotations SET status = 'REJECTED' WHERE id = q1;
    RAISE EXCEPTION 'rechazo sin motivo debia fallar';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  -- CONVERTED exige pedido y viceversa.
  BEGIN
    UPDATE quotations SET status = 'CONVERTED' WHERE id = q1;
    RAISE EXCEPTION 'CONVERTED sin pedido debia fallar';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    UPDATE quotations SET converted_order_id = '00000000-0000-0000-0000-000000000d01' WHERE id = q1;
    RAISE EXCEPTION 'pedido sin CONVERTED debia fallar';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  UPDATE quotations SET status = 'APPROVED', approved_at = NOW() WHERE id = q1;
  UPDATE quotations SET status = 'CONVERTED', converted_order_id = '00000000-0000-0000-0000-000000000d01',
    converted_at = NOW() WHERE id = q1;
  UPDATE orders SET quotation_id = q1 WHERE id = '00000000-0000-0000-0000-000000000d01';

  -- Un solo pedido por cotizacion.
  BEGIN
    UPDATE orders SET quotation_id = q1 WHERE id = '00000000-0000-0000-0000-000000000d02';
    RAISE EXCEPTION 'segundo pedido de la misma cotizacion debia fallar';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;
  INSERT INTO quotations (id, tenant_id, branch_id, customer_id, code, status, issue_date, validity_days,
    valid_until, converted_order_id, converted_at)
  VALUES (q2, t_a, '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000c1',
    'COT-000002', 'APPROVED', DATE '2026-11-19', 15, DATE '2026-12-04', NULL, NULL);
  BEGIN
    UPDATE quotations SET status = 'CONVERTED', converted_order_id = '00000000-0000-0000-0000-000000000d01' WHERE id = q2;
    RAISE EXCEPTION 'el mismo pedido en dos cotizaciones debia fallar';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;

  -- Configuracion de vigencia.
  INSERT INTO quotation_settings (tenant_id) VALUES (t_a);
  IF (SELECT default_validity_days FROM quotation_settings WHERE tenant_id = t_a) <> 15 THEN
    RAISE EXCEPTION 'la vigencia por defecto debe ser 15';
  END IF;
  BEGIN
    UPDATE quotation_settings SET default_validity_days = 400 WHERE tenant_id = t_a;
    RAISE EXCEPTION 'vigencia de 400 dias debia fallar';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  -- Borrar la cotizacion borra sus lineas.
  DELETE FROM quotations WHERE id = q2;
END $$;
