BEGIN;

-- MVP-01.2B optional QA fixtures.
-- Runs only when migrate_prd.sh receives RUN_OPTIONAL_QA_FIXTURES=YES.
-- Data is prefixed with QA and scoped to the default QA tenant.

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;

DO $$
DECLARE
  c_tenant_id constant uuid := '00000000-0000-0000-0000-000000000001';
  c_supplier_seed_id constant uuid := '92010000-0000-0000-0000-000000000001';
  c_customer_seed_id constant uuid := '92020000-0000-0000-0000-000000000001';
  c_product_seed_id constant uuid := '92030000-0000-0000-0000-000000000001';
  c_location_seed_id constant uuid := '92040000-0000-0000-0000-000000000001';
  c_lot_seed_id constant uuid := '92050000-0000-0000-0000-000000000001';
  c_balance_seed_id constant uuid := '92060000-0000-0000-0000-000000000001';
  c_stock_movement_seed_id constant uuid := '92070000-0000-0000-0000-000000000001';
  c_stock_movement_lot_seed_id constant uuid := '92080000-0000-0000-0000-000000000001';
  c_primary_barcode_seed_id constant uuid := '92090000-0000-0000-0000-000000000001';
  c_alt_barcode_seed_id constant uuid := '92090000-0000-0000-0000-000000000002';
  v_branch_id uuid;
  v_unit_id uuid;
  v_tax_id uuid;
  v_supplier_id uuid;
  v_customer_id uuid;
  v_product_id uuid;
  v_location_id uuid;
  v_lot_id uuid;
  v_primary_barcode_id uuid;
  v_alt_barcode_id uuid;
  v_balance_id uuid;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.tenants WHERE id = c_tenant_id
  ) THEN
    RAISE EXCEPTION 'MVP-01.2B QA fixtures require default tenant %', c_tenant_id;
  END IF;

  SELECT id
  INTO v_branch_id
  FROM public.tenant_branches
  WHERE tenant_id = c_tenant_id
    AND estado = 'ACTIVE'
  ORDER BY es_principal DESC, created_at ASC, id
  LIMIT 1;

  IF v_branch_id IS NULL THEN
    RAISE EXCEPTION 'MVP-01.2B QA fixtures require an active branch for tenant %', c_tenant_id;
  END IF;

  SELECT id
  INTO v_unit_id
  FROM public.units
  WHERE tenant_id = c_tenant_id
    AND UPPER(abbreviation) = 'UND'
    AND is_active = true
  ORDER BY id
  LIMIT 1;

  IF v_unit_id IS NULL THEN
    RAISE EXCEPTION 'MVP-01.2B QA fixtures require active unit UND';
  END IF;

  SELECT id
  INTO v_tax_id
  FROM public.taxes
  WHERE tenant_id = c_tenant_id
    AND UPPER(name) = 'IVA 19%'
    AND is_active = true
  ORDER BY id
  LIMIT 1;

  IF v_tax_id IS NULL THEN
    RAISE EXCEPTION 'MVP-01.2B QA fixtures require active tax IVA 19%%';
  END IF;

  SELECT id
  INTO v_supplier_id
  FROM public.suppliers
  WHERE tenant_id = c_tenant_id
    AND (
      id = c_supplier_seed_id
      OR (
        COALESCE(NULLIF(btrim(dian_identification_type), ''), NULLIF(btrim(document_type_code), '')) = '31'
        AND COALESCE(NULLIF(btrim(identification_number), ''), NULLIF(btrim(document_number_normalized), '')) = '900123456'
      )
    )
  ORDER BY
    CASE
      WHEN COALESCE(NULLIF(btrim(dian_identification_type), ''), NULLIF(btrim(document_type_code), '')) = '31'
       AND COALESCE(NULLIF(btrim(identification_number), ''), NULLIF(btrim(document_number_normalized), '')) = '900123456' THEN 0
      WHEN id = c_supplier_seed_id THEN 1
      ELSE 2
    END,
    id
  LIMIT 1;

  IF v_supplier_id IS NULL THEN
    v_supplier_id := c_supplier_seed_id;
    INSERT INTO public.suppliers (
      id,
      tenant_id,
      name,
      document_number,
      phone,
      email,
      address,
      is_active,
      document_type_code,
      document_number_normalized,
      verification_digit,
      legal_name,
      fiscal_email,
      fiscal_status,
      fiscal_provider,
      fiscal_last_lookup_status,
      dian_identification_type,
      identification_number,
      trade_name,
      invoice_email,
      country_code,
      department_code,
      municipality_code,
      person_type,
      tax_regime,
      tax_responsibilities,
      is_dian_validated,
      dian_metadata,
      fiscal_data_source,
      created_at,
      updated_at
    )
    VALUES (
      v_supplier_id,
      c_tenant_id,
      'QA Proveedor FE Base',
      '900123456',
      '3007654321',
      'proveedor-fe-base@mock.local',
      'CL 4 5 6',
      true,
      '31',
      '900123456',
      '8',
      'QA Proveedor FE Base SAS',
      'proveedor-fe-base@mock.local',
      'VALIDATED',
      'MOCK_LOCAL',
      'FOUND',
      '31',
      '900123456',
      'QA Proveedor FE Base',
      'proveedor-fe-base@mock.local',
      'CO',
      '05',
      '05001',
      'JURIDICA',
      'ORDINARIO',
      '["R-99-PN"]'::jsonb,
      true,
      '{"fixture":"MVP-01.2B","provider":"MOCK_LOCAL"}'::jsonb,
      'MOCK_LOCAL',
      now(),
      now()
    );
  ELSE
    UPDATE public.suppliers
    SET
      name = 'QA Proveedor FE Base',
      document_number = '900123456',
      phone = '3007654321',
      email = 'proveedor-fe-base@mock.local',
      address = 'CL 4 5 6',
      is_active = true,
      document_type_code = '31',
      document_number_normalized = '900123456',
      verification_digit = '8',
      legal_name = 'QA Proveedor FE Base SAS',
      fiscal_email = 'proveedor-fe-base@mock.local',
      fiscal_status = 'VALIDATED',
      fiscal_provider = 'MOCK_LOCAL',
      fiscal_last_lookup_status = 'FOUND',
      dian_identification_type = '31',
      identification_number = '900123456',
      trade_name = 'QA Proveedor FE Base',
      invoice_email = 'proveedor-fe-base@mock.local',
      country_code = 'CO',
      department_code = '05',
      municipality_code = '05001',
      person_type = 'JURIDICA',
      tax_regime = 'ORDINARIO',
      tax_responsibilities = '["R-99-PN"]'::jsonb,
      is_dian_validated = true,
      dian_metadata = '{"fixture":"MVP-01.2B","provider":"MOCK_LOCAL"}'::jsonb,
      fiscal_data_source = 'MOCK_LOCAL',
      updated_at = now()
    WHERE id = v_supplier_id;
  END IF;

  SELECT id
  INTO v_customer_id
  FROM public.customers
  WHERE tenant_id = c_tenant_id
    AND (
      id = c_customer_seed_id
      OR (
        COALESCE(NULLIF(btrim(dian_identification_type), ''), NULLIF(btrim(document_type_code), '')) = '31'
        AND COALESCE(NULLIF(btrim(identification_number), ''), NULLIF(btrim(document_number_normalized), '')) = '900654321'
      )
    )
  ORDER BY
    CASE
      WHEN COALESCE(NULLIF(btrim(dian_identification_type), ''), NULLIF(btrim(document_type_code), '')) = '31'
       AND COALESCE(NULLIF(btrim(identification_number), ''), NULLIF(btrim(document_number_normalized), '')) = '900654321' THEN 0
      WHEN id = c_customer_seed_id THEN 1
      ELSE 2
    END,
    id
  LIMIT 1;

  IF v_customer_id IS NULL THEN
    v_customer_id := c_customer_seed_id;
    INSERT INTO public.customers (
      id,
      tenant_id,
      name,
      document_number,
      phone,
      email,
      address,
      is_active,
      document_type_code,
      document_number_normalized,
      verification_digit,
      legal_name,
      fiscal_email,
      is_final_consumer,
      is_default,
      fiscal_status,
      dian_identification_type,
      identification_number,
      trade_name,
      invoice_email,
      country_code,
      department_code,
      municipality_code,
      person_type,
      tax_regime,
      tax_responsibilities,
      is_dian_validated,
      dian_last_lookup_status,
      dian_metadata,
      fiscal_data_source,
      created_at,
      updated_at
    )
    VALUES (
      v_customer_id,
      c_tenant_id,
      'QA Cliente FE Base',
      '900654321',
      '3001234567',
      'cliente-fe-base@mock.local',
      'CL 1 2 3',
      true,
      '31',
      '900654321',
      '0',
      'QA Cliente FE Base SAS',
      'cliente-fe-base@mock.local',
      false,
      false,
      'VALIDATED',
      '31',
      '900654321',
      'QA Cliente FE Base',
      'cliente-fe-base@mock.local',
      'CO',
      '11',
      '11001',
      'JURIDICA',
      'ORDINARIO',
      '["R-99-PN"]'::jsonb,
      true,
      'FOUND',
      '{"fixture":"MVP-01.2B","provider":"MOCK_LOCAL"}'::jsonb,
      'MOCK_LOCAL',
      now(),
      now()
    );
  ELSE
    UPDATE public.customers
    SET
      name = 'QA Cliente FE Base',
      document_number = '900654321',
      phone = '3001234567',
      email = 'cliente-fe-base@mock.local',
      address = 'CL 1 2 3',
      is_active = true,
      document_type_code = '31',
      document_number_normalized = '900654321',
      verification_digit = '0',
      legal_name = 'QA Cliente FE Base SAS',
      fiscal_email = 'cliente-fe-base@mock.local',
      is_final_consumer = false,
      is_default = false,
      fiscal_status = 'VALIDATED',
      dian_identification_type = '31',
      identification_number = '900654321',
      trade_name = 'QA Cliente FE Base',
      invoice_email = 'cliente-fe-base@mock.local',
      country_code = 'CO',
      department_code = '11',
      municipality_code = '11001',
      person_type = 'JURIDICA',
      tax_regime = 'ORDINARIO',
      tax_responsibilities = '["R-99-PN"]'::jsonb,
      is_dian_validated = true,
      dian_last_lookup_status = 'FOUND',
      dian_metadata = '{"fixture":"MVP-01.2B","provider":"MOCK_LOCAL"}'::jsonb,
      fiscal_data_source = 'MOCK_LOCAL',
      updated_at = now()
    WHERE id = v_customer_id;
  END IF;

  SELECT id
  INTO v_product_id
  FROM public.products
  WHERE tenant_id = c_tenant_id
    AND (id = c_product_seed_id OR UPPER(sku) = 'QA-BASE-LOT-001')
  ORDER BY
    CASE
      WHEN UPPER(sku) = 'QA-BASE-LOT-001' THEN 0
      WHEN id = c_product_seed_id THEN 1
      ELSE 2
    END,
    id
  LIMIT 1;

  IF v_product_id IS NULL THEN
    v_product_id := c_product_seed_id;
    INSERT INTO public.products (
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
      max_stock,
      sale_type,
      measurement_unit,
      created_at,
      updated_at
    )
    VALUES (
      v_product_id,
      c_tenant_id,
      v_unit_id,
      v_tax_id,
      'QA Producto loteado MVP-01.2B',
      'Producto QA opcional para validar lotes, barcodes e impuestos',
      'QA-BASE-LOT-001',
      12500.00,
      9000.00,
      12500.00,
      10504.20,
      true,
      true,
      true,
      true,
      'ACTIVE',
      'MEDIUM',
      2.00,
      120.00,
      'UNIT',
      'UND',
      now(),
      now()
    );
  ELSE
    UPDATE public.products
    SET
      unit_id = v_unit_id,
      tax_id = v_tax_id,
      name = 'QA Producto loteado MVP-01.2B',
      description = 'Producto QA opcional para validar lotes, barcodes e impuestos',
      sku = 'QA-BASE-LOT-001',
      price = 12500.00,
      cost = 9000.00,
      price_with_tax = 12500.00,
      price_without_tax = 10504.20,
      is_active = true,
      is_perishable = true,
      requires_lot = true,
      requires_expiration = true,
      operational_status = 'ACTIVE',
      rotation_class = 'MEDIUM',
      min_stock = 2.00,
      max_stock = 120.00,
      sale_type = 'UNIT',
      measurement_unit = 'UND',
      updated_at = now()
    WHERE id = v_product_id;
  END IF;

  UPDATE public.product_barcodes
  SET is_primary = false,
      updated_at = now()
  WHERE tenant_id = c_tenant_id
    AND product_id = v_product_id
    AND is_primary = true;

  SELECT id
  INTO v_primary_barcode_id
  FROM public.product_barcodes
  WHERE tenant_id = c_tenant_id
    AND (id = c_primary_barcode_seed_id OR barcode = '7700000000011')
  ORDER BY
    CASE
      WHEN barcode = '7700000000011' THEN 0
      WHEN id = c_primary_barcode_seed_id THEN 1
      ELSE 2
    END,
    id
  LIMIT 1;

  IF v_primary_barcode_id IS NULL THEN
    v_primary_barcode_id := c_primary_barcode_seed_id;
    INSERT INTO public.product_barcodes (
      id,
      tenant_id,
      product_id,
      barcode,
      barcode_type,
      is_primary,
      is_active,
      created_at,
      updated_at
    )
    VALUES (
      v_primary_barcode_id,
      c_tenant_id,
      v_product_id,
      '7700000000011',
      'UNIT',
      true,
      true,
      now(),
      now()
    );
  ELSE
    UPDATE public.product_barcodes
    SET
      product_id = v_product_id,
      barcode = '7700000000011',
      barcode_type = 'UNIT',
      is_primary = true,
      is_active = true,
      updated_at = now()
    WHERE id = v_primary_barcode_id;
  END IF;

  SELECT id
  INTO v_alt_barcode_id
  FROM public.product_barcodes
  WHERE tenant_id = c_tenant_id
    AND (id = c_alt_barcode_seed_id OR barcode = 'QA-ALT-BASE-LOT-001')
  ORDER BY
    CASE
      WHEN barcode = 'QA-ALT-BASE-LOT-001' THEN 0
      WHEN id = c_alt_barcode_seed_id THEN 1
      ELSE 2
    END,
    id
  LIMIT 1;

  IF v_alt_barcode_id IS NULL THEN
    v_alt_barcode_id := c_alt_barcode_seed_id;
    INSERT INTO public.product_barcodes (
      id,
      tenant_id,
      product_id,
      barcode,
      barcode_type,
      is_primary,
      is_active,
      created_at,
      updated_at
    )
    VALUES (
      v_alt_barcode_id,
      c_tenant_id,
      v_product_id,
      'QA-ALT-BASE-LOT-001',
      'OTHER',
      false,
      true,
      now(),
      now()
    );
  ELSE
    UPDATE public.product_barcodes
    SET
      product_id = v_product_id,
      barcode = 'QA-ALT-BASE-LOT-001',
      barcode_type = 'OTHER',
      is_primary = false,
      is_active = true,
      updated_at = now()
    WHERE id = v_alt_barcode_id;
  END IF;

  SELECT id
  INTO v_location_id
  FROM public.inventory_locations
  WHERE tenant_id = c_tenant_id
    AND branch_id = v_branch_id
    AND (id = c_location_seed_id OR UPPER(code) = 'QA-DEMO')
  ORDER BY
    CASE
      WHEN UPPER(code) = 'QA-DEMO' THEN 0
      WHEN id = c_location_seed_id THEN 1
      ELSE 2
    END,
    id
  LIMIT 1;

  IF v_location_id IS NULL THEN
    v_location_id := c_location_seed_id;
    INSERT INTO public.inventory_locations (
      id,
      tenant_id,
      branch_id,
      code,
      name,
      type,
      description,
      is_active,
      created_at,
      updated_at
    )
    VALUES (
      v_location_id,
      c_tenant_id,
      v_branch_id,
      'QA-DEMO',
      'QA Demo',
      'WAREHOUSE',
      'Ubicacion QA opcional para MVP-01.2B',
      true,
      now(),
      now()
    );
  ELSE
    UPDATE public.inventory_locations
    SET
      code = 'QA-DEMO',
      name = 'QA Demo',
      type = 'WAREHOUSE',
      description = 'Ubicacion QA opcional para MVP-01.2B',
      is_active = true,
      updated_at = now()
    WHERE id = v_location_id;
  END IF;

  SELECT id
  INTO v_lot_id
  FROM public.inventory_lots
  WHERE tenant_id = c_tenant_id
    AND branch_id = v_branch_id
    AND product_id = v_product_id
    AND (id = c_lot_seed_id OR lot_code = 'QA-LOT-MVP-01-2B-001')
  ORDER BY
    CASE
      WHEN lot_code = 'QA-LOT-MVP-01-2B-001' THEN 0
      WHEN id = c_lot_seed_id THEN 1
      ELSE 2
    END,
    id
  LIMIT 1;

  IF v_lot_id IS NULL THEN
    v_lot_id := c_lot_seed_id;
    INSERT INTO public.inventory_lots (
      id,
      tenant_id,
      branch_id,
      product_id,
      supplier_id,
      lot_code,
      expiration_date,
      received_at,
      unit_cost,
      status,
      is_legacy,
      created_at,
      updated_at
    )
    VALUES (
      v_lot_id,
      c_tenant_id,
      v_branch_id,
      v_product_id,
      v_supplier_id,
      'QA-LOT-MVP-01-2B-001',
      CURRENT_DATE + 180,
      now() - interval '1 day',
      9000.00,
      'ACTIVE',
      false,
      now(),
      now()
    );
  ELSE
    UPDATE public.inventory_lots
    SET
      supplier_id = v_supplier_id,
      lot_code = 'QA-LOT-MVP-01-2B-001',
      expiration_date = CURRENT_DATE + 180,
      received_at = now() - interval '1 day',
      unit_cost = 9000.00,
      status = 'ACTIVE',
      is_legacy = false,
      updated_at = now()
    WHERE id = v_lot_id;
  END IF;

  SELECT id
  INTO v_balance_id
  FROM public.inventory_lot_balances
  WHERE tenant_id = c_tenant_id
    AND branch_id = v_branch_id
    AND product_id = v_product_id
    AND lot_id = v_lot_id
    AND location_id = v_location_id
  ORDER BY CASE WHEN id = c_balance_seed_id THEN 0 ELSE 1 END, id
  LIMIT 1;

  IF v_balance_id IS NULL THEN
    v_balance_id := c_balance_seed_id;
    INSERT INTO public.inventory_lot_balances (
      id,
      tenant_id,
      branch_id,
      product_id,
      lot_id,
      location_id,
      quantity_on_hand,
      quantity_reserved,
      last_movement_at,
      created_at,
      updated_at
    )
    VALUES (
      v_balance_id,
      c_tenant_id,
      v_branch_id,
      v_product_id,
      v_lot_id,
      v_location_id,
      25.00,
      0.00,
      now(),
      now(),
      now()
    );
  ELSE
    UPDATE public.inventory_lot_balances
    SET
      branch_id = v_branch_id,
      product_id = v_product_id,
      lot_id = v_lot_id,
      location_id = v_location_id,
      quantity_on_hand = 25.00,
      quantity_reserved = 0.00,
      last_movement_at = now(),
      updated_at = now()
    WHERE id = v_balance_id;
  END IF;

  INSERT INTO public.stock_movements (
    id,
    tenant_id,
    product_id,
    type,
    quantity,
    reference_type,
    reference_id,
    branch_id,
    reference_table,
    stock_before,
    stock_after,
    created_at
  )
  VALUES (
    c_stock_movement_seed_id,
    c_tenant_id,
    v_product_id,
    'IN',
    25.00,
    'ADJUSTMENT',
    c_lot_seed_id,
    v_branch_id,
    'qa_functional_fixture',
    0.00,
    25.00,
    now()
  )
  ON CONFLICT (id) DO UPDATE
  SET
    product_id = EXCLUDED.product_id,
    quantity = EXCLUDED.quantity,
    reference_id = EXCLUDED.reference_id,
    branch_id = EXCLUDED.branch_id,
    reference_table = EXCLUDED.reference_table,
    stock_before = EXCLUDED.stock_before,
    stock_after = EXCLUDED.stock_after,
    created_at = now();

  INSERT INTO public.stock_movement_lots (
    id,
    tenant_id,
    stock_movement_id,
    product_id,
    lot_id,
    location_id,
    quantity,
    created_at
  )
  VALUES (
    c_stock_movement_lot_seed_id,
    c_tenant_id,
    c_stock_movement_seed_id,
    v_product_id,
    v_lot_id,
    v_location_id,
    25.00,
    now()
  )
  ON CONFLICT (id) DO UPDATE
  SET
    stock_movement_id = EXCLUDED.stock_movement_id,
    product_id = EXCLUDED.product_id,
    lot_id = EXCLUDED.lot_id,
    location_id = EXCLUDED.location_id,
    quantity = EXCLUDED.quantity,
    created_at = now();
END $$;

COMMIT;
