-- SOLO LOCAL/DEV - NO PRD.
-- Limpia unicamente fixture Fase 5.1.R2 de producto sin price/cost.

\set ON_ERROR_STOP on

DO $$
DECLARE
  c_tenant_id CONSTANT UUID := '00000000-0000-0000-0000-000000000001';
  c_unit_id CONSTANT UUID := '95120000-0000-0000-0000-000000000001';
  v_server_addr TEXT := COALESCE(inet_server_addr()::TEXT, 'local-socket');
BEGIN
  IF NOT (
    v_server_addr = 'local-socket'
    OR v_server_addr LIKE '127.0.0.1%'
    OR v_server_addr LIKE '::1%'
  ) THEN
    RAISE EXCEPTION 'SOLO LOCAL/DEV: servidor no local detectado: %', v_server_addr;
  END IF;

  DELETE FROM product_barcodes
  WHERE tenant_id = c_tenant_id
    AND product_id IN (
      SELECT id FROM products WHERE tenant_id = c_tenant_id AND sku LIKE 'S51R2-%'
    );

  DELETE FROM products
  WHERE tenant_id = c_tenant_id
    AND sku LIKE 'S51R2-%';

  DELETE FROM units
  WHERE id = c_unit_id
    AND tenant_id = c_tenant_id;
END $$;

WITH fixture AS (
  SELECT '00000000-0000-0000-0000-000000000001'::UUID AS tenant_id
)
SELECT
  (
    (SELECT COUNT(*) FROM units WHERE tenant_id = fixture.tenant_id AND abbreviation = 'U51R2')
    + (SELECT COUNT(*) FROM products WHERE tenant_id = fixture.tenant_id AND sku LIKE 'S51R2-%')
  ) AS fixture_rows_remaining
FROM fixture;
