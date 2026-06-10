-- SOLO LOCAL/DEV - NO PRD.
-- Fixture controlado para pruebas locales de inventory_create_sale_v2.
-- Reinicia solo el tenant de prueba antes de crear datos.

\set ON_ERROR_STOP on

\ir 20260602_fixture_sale_v2_local_cleanup.sql

DO $$
DECLARE
  c_tenant_id CONSTANT UUID := '90000000-0000-0000-0000-000000000001';
  c_branch_id CONSTANT UUID := '90000000-0000-0000-0000-000000000002';
  c_unit_id CONSTANT UUID := '90000000-0000-0000-0000-000000000003';
  c_user_id CONSTANT UUID := '90000000-0000-0000-0000-000000000004';
  c_auth_session_id CONSTANT UUID := '90000000-0000-0000-0000-000000000005';
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
  c_balance_one_id CONSTANT UUID := '90000000-0000-0000-0000-000000000301';
  c_balance_fefo_soon_id CONSTANT UUID := '90000000-0000-0000-0000-000000000302';
  c_balance_fefo_later_id CONSTANT UUID := '90000000-0000-0000-0000-000000000303';
  c_balance_mixed_id CONSTANT UUID := '90000000-0000-0000-0000-000000000304';
  c_stock_non_lot_in_id CONSTANT UUID := '90000000-0000-0000-0000-000000000401';
  c_stock_lot_one_in_id CONSTANT UUID := '90000000-0000-0000-0000-000000000402';
  c_stock_lot_fefo_soon_in_id CONSTANT UUID := '90000000-0000-0000-0000-000000000403';
  c_stock_lot_fefo_later_in_id CONSTANT UUID := '90000000-0000-0000-0000-000000000404';
  c_stock_lot_mixed_in_id CONSTANT UUID := '90000000-0000-0000-0000-000000000405';
BEGIN
  INSERT INTO tenants (id, slug, nombre, config, activo)
  VALUES (c_tenant_id, 'phase-3-14-sale-v2-local', 'Tenant prueba sale v2 local', '{}'::JSONB, TRUE);

  INSERT INTO tenant_branches (
    id,
    tenant_id,
    codigo,
    nombre,
    es_principal,
    estado
  )
  VALUES (
    c_branch_id,
    c_tenant_id,
    'S314',
    'Sucursal prueba sale v2 local',
    TRUE,
    'ACTIVE'
  );

  INSERT INTO units (id, tenant_id, name, abbreviation, is_active)
  VALUES (c_unit_id, c_tenant_id, 'Unidad prueba sale v2', 'UND', TRUE);

  INSERT INTO users (id, tenant_id, email, password_hash, estado)
  VALUES (
    c_user_id,
    c_tenant_id,
    'phase-3-14-sale-v2-local@example.test',
    'local-dev-only',
    'ACTIVE'
  );

  INSERT INTO auth_sessions (
    id,
    user_id,
    tenant_id,
    refresh_token,
    user_agent,
    ip_address,
    is_active
  )
  VALUES (
    c_auth_session_id,
    c_user_id,
    c_tenant_id,
    'phase-3-14-local-refresh-token',
    'phase-3-14-local',
    '127.0.0.1',
    TRUE
  );

  INSERT INTO terminals (id, tenant_id, branch_id, name, code, is_active)
  VALUES (
    c_terminal_id,
    c_tenant_id,
    c_branch_id,
    'Terminal prueba sale v2 local',
    'TERM-S314',
    TRUE
  );

  INSERT INTO pos_user_sessions (
    id,
    auth_session_id,
    user_id,
    tenant_id,
    branch_id,
    terminal_id,
    is_active
  )
  VALUES (
    c_pos_session_id,
    c_auth_session_id,
    c_user_id,
    c_tenant_id,
    c_branch_id,
    c_terminal_id,
    TRUE
  );

  INSERT INTO customers (id, tenant_id, name, document_number, is_active)
  VALUES (
    c_customer_id,
    c_tenant_id,
    'Cliente prueba sale v2 local',
    'S314LOCAL',
    TRUE
  );

  INSERT INTO products (
    id,
    tenant_id,
    unit_id,
    tax_id,
    name,
    description,
    sku,
    price,
    cost,
    price_with_tax,
    price_without_tax,
    is_active,
    is_perishable,
    requires_lot,
    requires_expiration,
    operational_status
  )
  VALUES
    (
      c_product_non_lot_id,
      c_tenant_id,
      c_unit_id,
      NULL,
      'S314 producto no loteado',
      'SOLO LOCAL/DEV',
      'S314-NO-LOT',
      100,
      50,
      100,
      100,
      TRUE,
      FALSE,
      FALSE,
      FALSE,
      'ACTIVE'
    ),
    (
      c_product_lot_one_id,
      c_tenant_id,
      c_unit_id,
      NULL,
      'S314 producto lote unico',
      'SOLO LOCAL/DEV',
      'S314-LOT-ONE',
      50,
      20,
      50,
      50,
      TRUE,
      TRUE,
      TRUE,
      TRUE,
      'ACTIVE'
    ),
    (
      c_product_lot_fefo_id,
      c_tenant_id,
      c_unit_id,
      NULL,
      'S314 producto FEFO',
      'SOLO LOCAL/DEV',
      'S314-LOT-FEFO',
      30,
      10,
      30,
      30,
      TRUE,
      TRUE,
      TRUE,
      TRUE,
      'ACTIVE'
    ),
    (
      c_product_lot_mixed_id,
      c_tenant_id,
      c_unit_id,
      NULL,
      'S314 producto lote mixto',
      'SOLO LOCAL/DEV',
      'S314-LOT-MIXED',
      60,
      25,
      60,
      60,
      TRUE,
      TRUE,
      TRUE,
      TRUE,
      'ACTIVE'
    );

  INSERT INTO stock_movements (
    id,
    tenant_id,
    product_id,
    type,
    quantity,
    reference_type,
    reference_id,
    branch_id,
    terminal_id,
    pos_session_code,
    user_id,
    reference_table,
    stock_before,
    stock_after
  )
  VALUES
    (c_stock_non_lot_in_id, c_tenant_id, c_product_non_lot_id, 'IN', 20, 'ADJUSTMENT', c_product_non_lot_id, c_branch_id, c_terminal_id, c_pos_session_id::TEXT, c_user_id, 'phase_3_14_fixture', 0, 20),
    (c_stock_lot_one_in_id, c_tenant_id, c_product_lot_one_id, 'IN', 10, 'ADJUSTMENT', c_product_lot_one_id, c_branch_id, c_terminal_id, c_pos_session_id::TEXT, c_user_id, 'phase_3_14_fixture', 0, 10),
    (c_stock_lot_fefo_soon_in_id, c_tenant_id, c_product_lot_fefo_id, 'IN', 2, 'ADJUSTMENT', c_product_lot_fefo_id, c_branch_id, c_terminal_id, c_pos_session_id::TEXT, c_user_id, 'phase_3_14_fixture', 0, 2),
    (c_stock_lot_fefo_later_in_id, c_tenant_id, c_product_lot_fefo_id, 'IN', 5, 'ADJUSTMENT', c_product_lot_fefo_id, c_branch_id, c_terminal_id, c_pos_session_id::TEXT, c_user_id, 'phase_3_14_fixture', 2, 7),
    (c_stock_lot_mixed_in_id, c_tenant_id, c_product_lot_mixed_id, 'IN', 5, 'ADJUSTMENT', c_product_lot_mixed_id, c_branch_id, c_terminal_id, c_pos_session_id::TEXT, c_user_id, 'phase_3_14_fixture', 0, 5);

  INSERT INTO inventory_lots (
    id,
    tenant_id,
    branch_id,
    product_id,
    lot_code,
    expiration_date,
    received_at,
    unit_cost,
    status,
    is_legacy
  )
  VALUES
    (c_lot_one_id, c_tenant_id, c_branch_id, c_product_lot_one_id, 'S314-ONE-A', CURRENT_DATE + 90, NOW() - INTERVAL '10 days', 20, 'ACTIVE', FALSE),
    (c_lot_fefo_soon_id, c_tenant_id, c_branch_id, c_product_lot_fefo_id, 'S314-FEFO-A', CURRENT_DATE + 10, NOW() - INTERVAL '9 days', 10, 'ACTIVE', FALSE),
    (c_lot_fefo_later_id, c_tenant_id, c_branch_id, c_product_lot_fefo_id, 'S314-FEFO-B', CURRENT_DATE + 60, NOW() - INTERVAL '8 days', 10, 'ACTIVE', FALSE),
    (c_lot_mixed_id, c_tenant_id, c_branch_id, c_product_lot_mixed_id, 'S314-MIX-A', CURRENT_DATE + 120, NOW() - INTERVAL '7 days', 25, 'ACTIVE', FALSE);

  INSERT INTO inventory_lot_balances (
    id,
    tenant_id,
    branch_id,
    product_id,
    lot_id,
    location_id,
    quantity_on_hand,
    quantity_reserved,
    last_movement_at
  )
  VALUES
    (c_balance_one_id, c_tenant_id, c_branch_id, c_product_lot_one_id, c_lot_one_id, NULL, 10, 0, NOW()),
    (c_balance_fefo_soon_id, c_tenant_id, c_branch_id, c_product_lot_fefo_id, c_lot_fefo_soon_id, NULL, 2, 0, NOW()),
    (c_balance_fefo_later_id, c_tenant_id, c_branch_id, c_product_lot_fefo_id, c_lot_fefo_later_id, NULL, 5, 0, NOW()),
    (c_balance_mixed_id, c_tenant_id, c_branch_id, c_product_lot_mixed_id, c_lot_mixed_id, NULL, 5, 0, NOW());

  INSERT INTO stock_movement_lots (
    id,
    tenant_id,
    stock_movement_id,
    product_id,
    lot_id,
    location_id,
    quantity
  )
  VALUES
    ('90000000-0000-0000-0000-000000000501', c_tenant_id, c_stock_lot_one_in_id, c_product_lot_one_id, c_lot_one_id, NULL, 10),
    ('90000000-0000-0000-0000-000000000502', c_tenant_id, c_stock_lot_fefo_soon_in_id, c_product_lot_fefo_id, c_lot_fefo_soon_id, NULL, 2),
    ('90000000-0000-0000-0000-000000000503', c_tenant_id, c_stock_lot_fefo_later_in_id, c_product_lot_fefo_id, c_lot_fefo_later_id, NULL, 5),
    ('90000000-0000-0000-0000-000000000504', c_tenant_id, c_stock_lot_mixed_in_id, c_product_lot_mixed_id, c_lot_mixed_id, NULL, 5);
END $$;
