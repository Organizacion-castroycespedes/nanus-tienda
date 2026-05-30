-- SOLO LOCAL/DEV - NO PRD.
-- Fixture controlado Fase 5.1.R2 para validar producto sin price/cost en UI.

\set ON_ERROR_STOP on

\ir 20260529_fixture_phase_5_1r2_price_cost_local_cleanup.sql

DO $$
DECLARE
  c_tenant_id CONSTANT UUID := '00000000-0000-0000-0000-000000000001';
  c_unit_id CONSTANT UUID := '95120000-0000-0000-0000-000000000001';
  c_product_no_price_id CONSTANT UUID := '95120000-0000-0000-0000-000000000101';
  c_product_no_cost_id CONSTANT UUID := '95120000-0000-0000-0000-000000000102';
  v_server_addr TEXT := COALESCE(inet_server_addr()::TEXT, 'local-socket');
BEGIN
  IF NOT (
    v_server_addr = 'local-socket'
    OR v_server_addr LIKE '127.0.0.1%'
    OR v_server_addr LIKE '::1%'
  ) THEN
    RAISE EXCEPTION 'SOLO LOCAL/DEV: servidor no local detectado: %', v_server_addr;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM tenants WHERE id = c_tenant_id AND activo = TRUE) THEN
    RAISE EXCEPTION 'Tenant default local no existe o no esta activo: %', c_tenant_id;
  END IF;

  INSERT INTO units (id, tenant_id, name, abbreviation, is_active)
  VALUES (c_unit_id, c_tenant_id, 'Unidad prueba 5.1R2', 'U51R2', TRUE);

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
    operational_status,
    rotation_class,
    min_stock,
    max_stock
  )
  VALUES
    (
      c_product_no_price_id,
      c_tenant_id,
      c_unit_id,
      NULL,
      'S51R2 producto sin precio',
      'SOLO LOCAL/DEV',
      'S51R2-NO-PRICE',
      0,
      25,
      0,
      0,
      TRUE,
      FALSE,
      FALSE,
      FALSE,
      'ACTIVE',
      'LOW',
      0,
      10
    ),
    (
      c_product_no_cost_id,
      c_tenant_id,
      c_unit_id,
      NULL,
      'S51R2 producto sin costo',
      'SOLO LOCAL/DEV',
      'S51R2-NO-COST',
      50,
      0,
      50,
      50,
      TRUE,
      FALSE,
      FALSE,
      FALSE,
      'ACTIVE',
      'LOW',
      0,
      10
    );
END $$;

WITH fixture AS (
  SELECT '00000000-0000-0000-0000-000000000001'::UUID AS tenant_id
)
SELECT
  (
    (SELECT COUNT(*) FROM units WHERE tenant_id = fixture.tenant_id AND abbreviation = 'U51R2')
    + (SELECT COUNT(*) FROM products WHERE tenant_id = fixture.tenant_id AND sku LIKE 'S51R2-%')
  ) AS fixture_rows_created
FROM fixture;
