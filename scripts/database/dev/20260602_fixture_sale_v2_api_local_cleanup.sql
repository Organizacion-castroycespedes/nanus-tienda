-- SOLO LOCAL/DEV - NO PRD.
-- Limpia unicamente datos con UUID/tenant controlados para pruebas API sale v2.

\set ON_ERROR_STOP on

DO $$
DECLARE
  c_tenant_id CONSTANT UUID := '91000000-0000-0000-0000-000000000001';
  v_server_addr TEXT := COALESCE(inet_server_addr()::TEXT, 'local-socket');
BEGIN
  IF NOT (
    v_server_addr = 'local-socket'
    OR v_server_addr LIKE '127.0.0.1%'
    OR v_server_addr LIKE '::1%'
  ) THEN
    RAISE EXCEPTION 'SOLO LOCAL/DEV: servidor no local detectado: %', v_server_addr;
  END IF;

  DELETE FROM cash_movements WHERE tenant_id = c_tenant_id;

  DELETE FROM payment_allocations AS pa
  USING payments AS p
  WHERE pa.payment_id = p.id
    AND p.tenant_id = c_tenant_id;

  DELETE FROM payment_allocations AS pa
  USING sales AS s
  WHERE pa.reference_id = s.id
    AND s.tenant_id = c_tenant_id;

  DELETE FROM payments WHERE tenant_id = c_tenant_id;
  DELETE FROM sale_item_taxes WHERE tenant_id = c_tenant_id;
  DELETE FROM sale_payment_methods WHERE tenant_id = c_tenant_id;
  DELETE FROM sale_items WHERE tenant_id = c_tenant_id;
  DELETE FROM stock_movement_lots WHERE tenant_id = c_tenant_id;
  DELETE FROM stock_movements WHERE tenant_id = c_tenant_id;
  DELETE FROM sales WHERE tenant_id = c_tenant_id;
  DELETE FROM inventory_lot_balances WHERE tenant_id = c_tenant_id;
  DELETE FROM inventory_lots WHERE tenant_id = c_tenant_id;
  DELETE FROM products WHERE tenant_id = c_tenant_id;
  DELETE FROM cash_sessions WHERE tenant_id = c_tenant_id;
  DELETE FROM cash_registers WHERE tenant_id = c_tenant_id;
  DELETE FROM payment_methods WHERE tenant_id = c_tenant_id;
  DELETE FROM pos_user_sessions WHERE tenant_id = c_tenant_id;
  DELETE FROM auth_sessions WHERE tenant_id = c_tenant_id;
  DELETE FROM terminals WHERE tenant_id = c_tenant_id;
  DELETE FROM customers WHERE tenant_id = c_tenant_id;
  DELETE FROM persona_tenant_branches WHERE tenant_id = c_tenant_id;
  DELETE FROM users WHERE tenant_id = c_tenant_id;
  DELETE FROM personas WHERE tenant_id = c_tenant_id;
  DELETE FROM tenant_branches WHERE tenant_id = c_tenant_id;
  DELETE FROM units WHERE tenant_id = c_tenant_id;
  DELETE FROM tenants WHERE id = c_tenant_id;
END $$;

WITH fixture AS (
  SELECT '91000000-0000-0000-0000-000000000001'::UUID AS tenant_id
)
SELECT
  (
    (SELECT COUNT(*) FROM tenants WHERE id = fixture.tenant_id)
    + (SELECT COUNT(*) FROM tenant_branches WHERE tenant_id = fixture.tenant_id)
    + (SELECT COUNT(*) FROM users WHERE tenant_id = fixture.tenant_id)
    + (SELECT COUNT(*) FROM personas WHERE tenant_id = fixture.tenant_id)
    + (SELECT COUNT(*) FROM persona_tenant_branches WHERE tenant_id = fixture.tenant_id)
    + (SELECT COUNT(*) FROM products WHERE tenant_id = fixture.tenant_id)
    + (SELECT COUNT(*) FROM sales WHERE tenant_id = fixture.tenant_id)
    + (SELECT COUNT(*) FROM stock_movements WHERE tenant_id = fixture.tenant_id)
    + (SELECT COUNT(*) FROM inventory_lots WHERE tenant_id = fixture.tenant_id)
    + (SELECT COUNT(*) FROM inventory_lot_balances WHERE tenant_id = fixture.tenant_id)
    + (SELECT COUNT(*) FROM stock_movement_lots WHERE tenant_id = fixture.tenant_id)
    + (SELECT COUNT(*) FROM payments WHERE tenant_id = fixture.tenant_id)
    + (SELECT COUNT(*) FROM cash_movements WHERE tenant_id = fixture.tenant_id)
  ) AS fixture_rows_remaining
FROM fixture;
