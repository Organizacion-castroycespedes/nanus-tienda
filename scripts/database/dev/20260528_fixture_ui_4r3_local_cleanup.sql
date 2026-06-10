-- SOLO LOCAL/DEV - NO PRD.
-- Limpia unicamente datos de prueba Fase 4.R3 sobre tenant default local.

\set ON_ERROR_STOP on

DO $$
DECLARE
  c_tenant_id CONSTANT UUID := '00000000-0000-0000-0000-000000000001';
  c_user_id CONSTANT UUID := '93000000-0000-0000-0000-000000000005';
  c_persona_id CONSTANT UUID := '93000000-0000-0000-0000-000000000006';
  c_unit_id CONSTANT UUID := '93000000-0000-0000-0000-000000000004';
  c_supplier_id CONSTANT UUID := '93000000-0000-0000-0000-000000000007';
  c_location_id CONSTANT UUID := '93000000-0000-0000-0000-000000000008';
  c_purchase_lot_id CONSTANT UUID := '93000000-0000-0000-0000-000000000201';
  c_purchase_no_lot_id CONSTANT UUID := '93000000-0000-0000-0000-000000000203';
  v_server_addr TEXT := COALESCE(inet_server_addr()::TEXT, 'local-socket');
BEGIN
  IF NOT (
    v_server_addr = 'local-socket'
    OR v_server_addr LIKE '127.0.0.1%'
    OR v_server_addr LIKE '::1%'
  ) THEN
    RAISE EXCEPTION 'SOLO LOCAL/DEV: servidor no local detectado: %', v_server_addr;
  END IF;

  DELETE FROM stock_movement_lots AS sml
  USING stock_movements AS sm
  WHERE sml.stock_movement_id = sm.id
    AND sm.tenant_id = c_tenant_id
    AND sm.product_id IN (
      SELECT id FROM products WHERE tenant_id = c_tenant_id AND sku LIKE 'S4R3-%'
    );

  DELETE FROM stock_movement_lots
  WHERE tenant_id = c_tenant_id
    AND product_id IN (
      SELECT id FROM products WHERE tenant_id = c_tenant_id AND sku LIKE 'S4R3-%'
    );

  DELETE FROM stock_movements
  WHERE tenant_id = c_tenant_id
    AND product_id IN (
      SELECT id FROM products WHERE tenant_id = c_tenant_id AND sku LIKE 'S4R3-%'
    );

  DELETE FROM inventory_lot_balances
  WHERE tenant_id = c_tenant_id
    AND product_id IN (
      SELECT id FROM products WHERE tenant_id = c_tenant_id AND sku LIKE 'S4R3-%'
    );

  DELETE FROM inventory_lots
  WHERE tenant_id = c_tenant_id
    AND product_id IN (
      SELECT id FROM products WHERE tenant_id = c_tenant_id AND sku LIKE 'S4R3-%'
    );

  DELETE FROM product_barcodes
  WHERE tenant_id = c_tenant_id
    AND product_id IN (
      SELECT id FROM products WHERE tenant_id = c_tenant_id AND sku LIKE 'S4R3-%'
    );

  DELETE FROM purchase_items
  WHERE purchase_id IN (c_purchase_lot_id, c_purchase_no_lot_id);

  DELETE FROM purchases
  WHERE id IN (c_purchase_lot_id, c_purchase_no_lot_id)
    AND tenant_id = c_tenant_id;

  DELETE FROM auditoria_eventos
  WHERE tenant_id = c_tenant_id
    AND (
      entidad_id IN (c_purchase_lot_id::TEXT, c_purchase_no_lot_id::TEXT)
      OR datos_despues::TEXT LIKE '%S4R3-%'
    );

  DELETE FROM products
  WHERE tenant_id = c_tenant_id
    AND sku LIKE 'S4R3-%';

  DELETE FROM inventory_locations
  WHERE id = c_location_id
    AND tenant_id = c_tenant_id;

  DELETE FROM suppliers
  WHERE id = c_supplier_id
    AND tenant_id = c_tenant_id;

  DELETE FROM auth_sessions
  WHERE user_id = c_user_id
    AND tenant_id = c_tenant_id;

  DELETE FROM persona_tenant_branches
  WHERE persona_id = c_persona_id
    AND tenant_id = c_tenant_id;

  DELETE FROM user_roles
  WHERE user_id = c_user_id
    AND tenant_id = c_tenant_id;

  DELETE FROM users
  WHERE id = c_user_id
    AND tenant_id = c_tenant_id;

  DELETE FROM personas
  WHERE id = c_persona_id
    AND tenant_id = c_tenant_id;

  DELETE FROM units
  WHERE id = c_unit_id
    AND tenant_id = c_tenant_id;
END $$;

WITH fixture AS (
  SELECT '00000000-0000-0000-0000-000000000001'::UUID AS tenant_id
)
SELECT
  (
    (SELECT COUNT(*) FROM users WHERE tenant_id = fixture.tenant_id AND email = 'phase-4r3-ui@example.test')
    + (SELECT COUNT(*) FROM products WHERE tenant_id = fixture.tenant_id AND sku LIKE 'S4R3-%')
    + (SELECT COUNT(*) FROM purchases WHERE tenant_id = fixture.tenant_id AND id IN (
        '93000000-0000-0000-0000-000000000201',
        '93000000-0000-0000-0000-000000000203'
      ))
    + (SELECT COUNT(*) FROM inventory_lots WHERE tenant_id = fixture.tenant_id AND lot_code LIKE 'S4R3-%')
    + (SELECT COUNT(*) FROM inventory_lot_balances WHERE tenant_id = fixture.tenant_id AND product_id IN (
        SELECT id FROM products WHERE tenant_id = fixture.tenant_id AND sku LIKE 'S4R3-%'
      ))
    + (SELECT COUNT(*) FROM stock_movement_lots WHERE tenant_id = fixture.tenant_id AND product_id IN (
        SELECT id FROM products WHERE tenant_id = fixture.tenant_id AND sku LIKE 'S4R3-%'
      ))
  ) AS fixture_rows_remaining
FROM fixture;
