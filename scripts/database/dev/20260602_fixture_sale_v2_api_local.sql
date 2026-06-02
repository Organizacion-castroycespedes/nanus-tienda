-- SOLO LOCAL/DEV - NO PRD.
-- Fixture controlado para prueba end-to-end API de inventory_create_sale_v2.
-- Crea tenant piloto con v2 activo solo para una sucursal.

\set ON_ERROR_STOP on

\ir 20260602_fixture_sale_v2_api_local_cleanup.sql

DO $$
DECLARE
  c_tenant_id CONSTANT UUID := '91000000-0000-0000-0000-000000000001';
  c_pilot_branch_id CONSTANT UUID := '91000000-0000-0000-0000-000000000002';
  c_disabled_branch_id CONSTANT UUID := '91000000-0000-0000-0000-000000000003';
  c_unit_id CONSTANT UUID := '91000000-0000-0000-0000-000000000004';
  c_pilot_user_id CONSTANT UUID := '91000000-0000-0000-0000-000000000005';
  c_disabled_user_id CONSTANT UUID := '91000000-0000-0000-0000-000000000006';
  c_pilot_auth_session_id CONSTANT UUID := '91000000-0000-0000-0000-000000000007';
  c_disabled_auth_session_id CONSTANT UUID := '91000000-0000-0000-0000-000000000008';
  c_pilot_terminal_id CONSTANT UUID := '91000000-0000-0000-0000-000000000009';
  c_disabled_terminal_id CONSTANT UUID := '91000000-0000-0000-0000-000000000010';
  c_pilot_pos_session_id CONSTANT UUID := '91000000-0000-0000-0000-000000000011';
  c_disabled_pos_session_id CONSTANT UUID := '91000000-0000-0000-0000-000000000012';
  c_customer_id CONSTANT UUID := '91000000-0000-0000-0000-000000000013';
  c_disabled_customer_id CONSTANT UUID := '91000000-0000-0000-0000-000000000014';
  c_payment_method_cash_id CONSTANT UUID := '91000000-0000-0000-0000-000000000015';
  c_pilot_cash_register_id CONSTANT UUID := '91000000-0000-0000-0000-000000000016';
  c_disabled_cash_register_id CONSTANT UUID := '91000000-0000-0000-0000-000000000017';
  c_pilot_cash_session_id CONSTANT UUID := '91000000-0000-0000-0000-000000000018';
  c_disabled_cash_session_id CONSTANT UUID := '91000000-0000-0000-0000-000000000019';
  c_pilot_persona_id CONSTANT UUID := '91000000-0000-0000-0000-000000000020';
  c_disabled_persona_id CONSTANT UUID := '91000000-0000-0000-0000-000000000021';
  c_product_non_lot_id CONSTANT UUID := '91000000-0000-0000-0000-000000000101';
  c_product_lot_one_id CONSTANT UUID := '91000000-0000-0000-0000-000000000102';
  c_product_lot_mixed_id CONSTANT UUID := '91000000-0000-0000-0000-000000000103';
  c_product_disabled_non_lot_id CONSTANT UUID := '91000000-0000-0000-0000-000000000104';
  c_lot_one_id CONSTANT UUID := '91000000-0000-0000-0000-000000000201';
  c_lot_mixed_id CONSTANT UUID := '91000000-0000-0000-0000-000000000202';
  c_balance_one_id CONSTANT UUID := '91000000-0000-0000-0000-000000000301';
  c_balance_mixed_id CONSTANT UUID := '91000000-0000-0000-0000-000000000302';
  c_stock_non_lot_in_id CONSTANT UUID := '91000000-0000-0000-0000-000000000401';
  c_stock_lot_one_in_id CONSTANT UUID := '91000000-0000-0000-0000-000000000402';
  c_stock_lot_mixed_in_id CONSTANT UUID := '91000000-0000-0000-0000-000000000403';
  c_stock_disabled_non_lot_in_id CONSTANT UUID := '91000000-0000-0000-0000-000000000404';
  c_stock_disabled_lot_in_id CONSTANT UUID := '91000000-0000-0000-0000-000000000405';
  v_server_addr TEXT := COALESCE(inet_server_addr()::TEXT, 'local-socket');
BEGIN
  IF NOT (
    v_server_addr = 'local-socket'
    OR v_server_addr LIKE '127.0.0.1%'
    OR v_server_addr LIKE '::1%'
  ) THEN
    RAISE EXCEPTION 'SOLO LOCAL/DEV: servidor no local detectado: %', v_server_addr;
  END IF;

  INSERT INTO tenants (id, slug, nombre, config, activo)
  VALUES (
    c_tenant_id,
    'phase-3-17-sale-v2-api-local',
    'Tenant prueba API sale v2 local',
    jsonb_build_object(
      'inventory',
      jsonb_build_object(
        'saleV2Enabled',
        TRUE,
        'saleV2Branches',
        jsonb_build_array(c_pilot_branch_id::TEXT)
      )
    ),
    TRUE
  );

  INSERT INTO tenant_branches (
    id,
    tenant_id,
    codigo,
    nombre,
    es_principal,
    estado
  )
  VALUES
    (
      c_pilot_branch_id,
      c_tenant_id,
      'S317-PILOT',
      'Sucursal piloto sale v2 API local',
      TRUE,
      'ACTIVE'
    ),
    (
      c_disabled_branch_id,
      c_tenant_id,
      'S317-V1',
      'Sucursal fallback sale v1 API local',
      FALSE,
      'ACTIVE'
    );

  INSERT INTO units (id, tenant_id, name, abbreviation, is_active)
  VALUES (c_unit_id, c_tenant_id, 'Unidad prueba API sale v2', 'UND', TRUE);

  INSERT INTO personas (
    id,
    tenant_id,
    nombres,
    apellidos,
    documento_tipo,
    documento_numero,
    cargo_nombre
  )
  VALUES
    (
      c_pilot_persona_id,
      c_tenant_id,
      'Piloto',
      'Sale V2 API',
      'CC',
      'S317PILOTPERSON',
      'Cajero piloto'
    ),
    (
      c_disabled_persona_id,
      c_tenant_id,
      'Fallback',
      'Sale V1 API',
      'CC',
      'S317V1PERSON',
      'Cajero fallback'
    );

  INSERT INTO persona_tenant_branches (
    persona_id,
    tenant_branch_id,
    tenant_id,
    es_principal
  )
  VALUES
    (c_pilot_persona_id, c_pilot_branch_id, c_tenant_id, TRUE),
    (c_disabled_persona_id, c_disabled_branch_id, c_tenant_id, TRUE);

  INSERT INTO users (id, tenant_id, persona_id, email, password_hash, estado)
  VALUES
    (
      c_pilot_user_id,
      c_tenant_id,
      c_pilot_persona_id,
      'phase-3-17-sale-v2-api-pilot@example.test',
      'local-dev-only',
      'ACTIVE'
    ),
    (
      c_disabled_user_id,
      c_tenant_id,
      c_disabled_persona_id,
      'phase-3-17-sale-v2-api-disabled@example.test',
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
  VALUES
    (
      c_pilot_auth_session_id,
      c_pilot_user_id,
      c_tenant_id,
      'phase-3-17-api-pilot-refresh-token',
      'phase-3-17-api-local',
      '127.0.0.1',
      TRUE
    ),
    (
      c_disabled_auth_session_id,
      c_disabled_user_id,
      c_tenant_id,
      'phase-3-17-api-disabled-refresh-token',
      'phase-3-17-api-local',
      '127.0.0.1',
      TRUE
    );

  INSERT INTO terminals (id, tenant_id, branch_id, name, code, is_active)
  VALUES
    (
      c_pilot_terminal_id,
      c_tenant_id,
      c_pilot_branch_id,
      'Terminal piloto sale v2 API local',
      'TERM-S317-PILOT',
      TRUE
    ),
    (
      c_disabled_terminal_id,
      c_tenant_id,
      c_disabled_branch_id,
      'Terminal fallback sale v1 API local',
      'TERM-S317-V1',
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
  VALUES
    (
      c_pilot_pos_session_id,
      c_pilot_auth_session_id,
      c_pilot_user_id,
      c_tenant_id,
      c_pilot_branch_id,
      c_pilot_terminal_id,
      TRUE
    ),
    (
      c_disabled_pos_session_id,
      c_disabled_auth_session_id,
      c_disabled_user_id,
      c_tenant_id,
      c_disabled_branch_id,
      c_disabled_terminal_id,
      TRUE
    );

  INSERT INTO customers (id, tenant_id, name, document_number, is_active)
  VALUES
    (
      c_customer_id,
      c_tenant_id,
      'Cliente piloto prueba API sale v2',
      'S317PILOT',
      TRUE
    ),
    (
      c_disabled_customer_id,
      c_tenant_id,
      'Cliente fallback prueba API sale v1',
      'S317V1',
      TRUE
    );

  INSERT INTO payment_methods (
    id,
    tenant_id,
    codigo,
    nombre,
    tipo,
    allows_change,
    active
  )
  VALUES (
    c_payment_method_cash_id,
    c_tenant_id,
    'CASH-S317',
    'Efectivo prueba API sale v2',
    'CASH',
    TRUE,
    TRUE
  );

  INSERT INTO cash_registers (
    id,
    tenant_id,
    branch_id,
    terminal_id,
    codigo,
    nombre,
    activo
  )
  VALUES
    (
      c_pilot_cash_register_id,
      c_tenant_id,
      c_pilot_branch_id,
      c_pilot_terminal_id,
      'CAJA-S317-PILOT',
      'Caja piloto API sale v2',
      TRUE
    ),
    (
      c_disabled_cash_register_id,
      c_tenant_id,
      c_disabled_branch_id,
      c_disabled_terminal_id,
      'CAJA-S317-V1',
      'Caja fallback API sale v1',
      TRUE
    );

  INSERT INTO cash_sessions (
    id,
    tenant_id,
    branch_id,
    cash_register_id,
    opened_by_user_id,
    opening_amount,
    status
  )
  VALUES
    (
      c_pilot_cash_session_id,
      c_tenant_id,
      c_pilot_branch_id,
      c_pilot_cash_register_id,
      c_pilot_user_id,
      0,
      'OPEN'
    ),
    (
      c_disabled_cash_session_id,
      c_tenant_id,
      c_disabled_branch_id,
      c_disabled_cash_register_id,
      c_disabled_user_id,
      0,
      'OPEN'
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
      'S317 producto no loteado API',
      'SOLO LOCAL/DEV',
      'S317-API-NO-LOT',
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
      'S317 producto lote API',
      'SOLO LOCAL/DEV',
      'S317-API-LOT-ONE',
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
      c_product_lot_mixed_id,
      c_tenant_id,
      c_unit_id,
      NULL,
      'S317 producto lote mixto API',
      'SOLO LOCAL/DEV',
      'S317-API-LOT-MIXED',
      60,
      25,
      60,
      60,
      TRUE,
      TRUE,
      TRUE,
      TRUE,
      'ACTIVE'
    ),
    (
      c_product_disabled_non_lot_id,
      c_tenant_id,
      c_unit_id,
      NULL,
      'S317 producto fallback v1 API',
      'SOLO LOCAL/DEV',
      'S317-API-V1-NO-LOT',
      40,
      15,
      40,
      40,
      TRUE,
      FALSE,
      FALSE,
      FALSE,
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
    (c_stock_non_lot_in_id, c_tenant_id, c_product_non_lot_id, 'IN', 20, 'ADJUSTMENT', c_product_non_lot_id, c_pilot_branch_id, c_pilot_terminal_id, c_pilot_pos_session_id::TEXT, c_pilot_user_id, 'phase_3_17_api_fixture', 0, 20),
    (c_stock_lot_one_in_id, c_tenant_id, c_product_lot_one_id, 'IN', 10, 'ADJUSTMENT', c_product_lot_one_id, c_pilot_branch_id, c_pilot_terminal_id, c_pilot_pos_session_id::TEXT, c_pilot_user_id, 'phase_3_17_api_fixture', 0, 10),
    (c_stock_lot_mixed_in_id, c_tenant_id, c_product_lot_mixed_id, 'IN', 5, 'ADJUSTMENT', c_product_lot_mixed_id, c_pilot_branch_id, c_pilot_terminal_id, c_pilot_pos_session_id::TEXT, c_pilot_user_id, 'phase_3_17_api_fixture', 0, 5),
    (c_stock_disabled_non_lot_in_id, c_tenant_id, c_product_disabled_non_lot_id, 'IN', 8, 'ADJUSTMENT', c_product_disabled_non_lot_id, c_disabled_branch_id, c_disabled_terminal_id, c_disabled_pos_session_id::TEXT, c_disabled_user_id, 'phase_3_17_api_fixture', 0, 8),
    (c_stock_disabled_lot_in_id, c_tenant_id, c_product_lot_one_id, 'IN', 3, 'ADJUSTMENT', c_product_lot_one_id, c_disabled_branch_id, c_disabled_terminal_id, c_disabled_pos_session_id::TEXT, c_disabled_user_id, 'phase_3_17_api_fixture', 0, 3);

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
    (c_lot_one_id, c_tenant_id, c_pilot_branch_id, c_product_lot_one_id, 'S317-API-ONE-A', CURRENT_DATE + 90, NOW() - INTERVAL '10 days', 20, 'ACTIVE', FALSE),
    (c_lot_mixed_id, c_tenant_id, c_pilot_branch_id, c_product_lot_mixed_id, 'S317-API-MIX-A', CURRENT_DATE + 120, NOW() - INTERVAL '7 days', 25, 'ACTIVE', FALSE);

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
    (c_balance_one_id, c_tenant_id, c_pilot_branch_id, c_product_lot_one_id, c_lot_one_id, NULL, 10, 0, NOW()),
    (c_balance_mixed_id, c_tenant_id, c_pilot_branch_id, c_product_lot_mixed_id, c_lot_mixed_id, NULL, 5, 0, NOW());

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
    ('91000000-0000-0000-0000-000000000501', c_tenant_id, c_stock_lot_one_in_id, c_product_lot_one_id, c_lot_one_id, NULL, 10),
    ('91000000-0000-0000-0000-000000000502', c_tenant_id, c_stock_lot_mixed_in_id, c_product_lot_mixed_id, c_lot_mixed_id, NULL, 5);
END $$;

SELECT
  'phase-3-17-api-fixture-ready' AS fixture,
  id AS tenant_id,
  config -> 'inventory' AS inventory_config
FROM tenants
WHERE id = '91000000-0000-0000-0000-000000000001'::UUID;
