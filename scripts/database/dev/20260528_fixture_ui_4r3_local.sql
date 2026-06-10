-- SOLO LOCAL/DEV - NO PRD.
-- Fixture controlado para prueba UI/API/DB Fase 4.R3.
-- Usa tenant default local porque la prueba web navega /00000000-0000-0000-0000-000000000001.

\set ON_ERROR_STOP on

\ir 20260528_fixture_ui_4r3_local_cleanup.sql

DO $$
DECLARE
  c_tenant_id CONSTANT UUID := '00000000-0000-0000-0000-000000000001';
  c_branch_id CONSTANT UUID := 'ab41d3da-6686-4de3-9191-875a5a7da5a5';
  c_control_branch_id CONSTANT UUID := 'dc1b81e0-5ea9-4972-839c-2eb158112e40';
  c_unit_id CONSTANT UUID := '93000000-0000-0000-0000-000000000004';
  c_user_id CONSTANT UUID := '93000000-0000-0000-0000-000000000005';
  c_persona_id CONSTANT UUID := '93000000-0000-0000-0000-000000000006';
  c_supplier_id CONSTANT UUID := '93000000-0000-0000-0000-000000000007';
  c_location_id CONSTANT UUID := '93000000-0000-0000-0000-000000000008';
  c_product_lot_id CONSTANT UUID := '93000000-0000-0000-0000-000000000101';
  c_product_no_lot_id CONSTANT UUID := '93000000-0000-0000-0000-000000000102';
  c_purchase_lot_id CONSTANT UUID := '93000000-0000-0000-0000-000000000201';
  c_purchase_item_lot_id CONSTANT UUID := '93000000-0000-0000-0000-000000000202';
  c_purchase_no_lot_id CONSTANT UUID := '93000000-0000-0000-0000-000000000203';
  c_purchase_item_no_lot_id CONSTANT UUID := '93000000-0000-0000-0000-000000000204';
  v_super_admin_role_id UUID;
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

  IF NOT EXISTS (
    SELECT 1 FROM tenant_branches
    WHERE id = c_branch_id AND tenant_id = c_tenant_id AND estado = 'ACTIVE'
  ) THEN
    RAISE EXCEPTION 'Sucursal piloto local no existe o no esta activa: %', c_branch_id;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM tenant_branches
    WHERE id = c_control_branch_id AND tenant_id = c_tenant_id AND estado = 'ACTIVE'
  ) THEN
    RAISE EXCEPTION 'Sucursal control local no existe o no esta activa: %', c_control_branch_id;
  END IF;

  SELECT id INTO v_super_admin_role_id
  FROM roles
  WHERE nombre = 'SUPER_ADMIN'
  LIMIT 1;

  IF v_super_admin_role_id IS NULL THEN
    RAISE EXCEPTION 'Rol SUPER_ADMIN no existe';
  END IF;

  INSERT INTO units (id, tenant_id, name, abbreviation, is_active)
  VALUES (c_unit_id, c_tenant_id, 'Unidad prueba UI 4R3', 'U4R3', TRUE);

  INSERT INTO personas (
    id,
    tenant_id,
    nombres,
    apellidos,
    documento_tipo,
    documento_numero,
    cargo_nombre,
    email_personal
  )
  VALUES (
    c_persona_id,
    c_tenant_id,
    'Phase',
    'Four R3 UI',
    'CC',
    'S4R3UIPERSON',
    'QA funcional local',
    'phase-4r3-ui@example.test'
  );

  INSERT INTO persona_tenant_branches (
    persona_id,
    tenant_branch_id,
    tenant_id,
    es_principal
  )
  VALUES
    (c_persona_id, c_branch_id, c_tenant_id, TRUE),
    (c_persona_id, c_control_branch_id, c_tenant_id, FALSE);

  INSERT INTO users (id, tenant_id, persona_id, email, password_hash, estado)
  VALUES (
    c_user_id,
    c_tenant_id,
    c_persona_id,
    'phase-4r3-ui@example.test',
    '$2b$10$n1.t/z8W7.EcntEnI8O4nuLQAbnr53Mt4g2vG9vEfgUCAvGddlEJS',
    'ACTIVE'
  );

  INSERT INTO user_roles (user_id, role_id, tenant_id)
  VALUES (c_user_id, v_super_admin_role_id, c_tenant_id);

  INSERT INTO suppliers (
    id,
    tenant_id,
    name,
    document_number,
    phone,
    email,
    is_active
  )
  VALUES (
    c_supplier_id,
    c_tenant_id,
    'Proveedor prueba UI 4R3',
    'S4R3SUP',
    '3000000000',
    'proveedor-4r3@example.test',
    TRUE
  );

  INSERT INTO inventory_locations (
    id,
    tenant_id,
    branch_id,
    code,
    name,
    type,
    description,
    is_active
  )
  VALUES (
    c_location_id,
    c_tenant_id,
    c_branch_id,
    'S4R3-A1',
    'Ubicacion prueba UI 4R3',
    'WAREHOUSE',
    'SOLO LOCAL/DEV',
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
    operational_status,
    rotation_class,
    min_stock,
    max_stock
  )
  VALUES
    (
      c_product_lot_id,
      c_tenant_id,
      c_unit_id,
      NULL,
      'S4R3 producto loteado UI',
      'SOLO LOCAL/DEV',
      'S4R3-LOT-FIXTURE',
      120,
      70,
      120,
      120,
      TRUE,
      TRUE,
      TRUE,
      TRUE,
      'ACTIVE',
      'HIGH',
      2,
      50
    ),
    (
      c_product_no_lot_id,
      c_tenant_id,
      c_unit_id,
      NULL,
      'S4R3 producto no loteado UI',
      'SOLO LOCAL/DEV',
      'S4R3-NOLOT-FIXTURE',
      80,
      40,
      80,
      80,
      TRUE,
      FALSE,
      FALSE,
      FALSE,
      'ACTIVE',
      'MEDIUM',
      1,
      40
    );

  INSERT INTO purchases (
    id,
    tenant_id,
    supplier_id,
    type,
    status,
    total,
    balance,
    payment_status,
    total_paid,
    balance_due,
    created_at
  )
  VALUES
    (
      c_purchase_lot_id,
      c_tenant_id,
      c_supplier_id,
      'CASH',
      'PENDING',
      560,
      560,
      'PENDING',
      0,
      560,
      NOW()
    ),
    (
      c_purchase_no_lot_id,
      c_tenant_id,
      c_supplier_id,
      'CASH',
      'PENDING',
      160,
      160,
      'PENDING',
      0,
      160,
      NOW()
    );

  INSERT INTO purchase_items (
    id,
    purchase_id,
    product_id,
    ordered_quantity,
    received_quantity,
    cost,
    subtotal
  )
  VALUES
    (c_purchase_item_lot_id, c_purchase_lot_id, c_product_lot_id, 8, 0, 70, 560),
    (c_purchase_item_no_lot_id, c_purchase_no_lot_id, c_product_no_lot_id, 4, 0, 40, 160);

  INSERT INTO auditoria_eventos (
    tenant_id,
    usuario_id,
    modulo,
    entidad,
    entidad_id,
    accion,
    datos_despues
  )
  VALUES
    (
      c_tenant_id,
      c_user_id,
      'inventory',
      'purchases',
      c_purchase_lot_id::TEXT,
      'PURCHASE_CREATED',
      jsonb_build_object(
        'branchId',
        c_branch_id::TEXT,
        'terminalId',
        NULL,
        'posSessionId',
        NULL,
        'fixture',
        'S4R3'
      )
    ),
    (
      c_tenant_id,
      c_user_id,
      'inventory',
      'purchases',
      c_purchase_no_lot_id::TEXT,
      'PURCHASE_CREATED',
      jsonb_build_object(
        'branchId',
        c_branch_id::TEXT,
        'terminalId',
        NULL,
        'posSessionId',
        NULL,
        'fixture',
        'S4R3'
      )
    );
END $$;

SELECT
  'phase-4r3-ui-fixture-ready' AS fixture,
  '00000000-0000-0000-0000-000000000001'::UUID AS tenant_id,
  'ab41d3da-6686-4de3-9191-875a5a7da5a5'::UUID AS branch_id,
  'phase-4r3-ui@example.test' AS login_email,
  'S4R3-LOT-FIXTURE' AS lot_product_sku,
  'S4R3-NOLOT-FIXTURE' AS no_lot_product_sku;
