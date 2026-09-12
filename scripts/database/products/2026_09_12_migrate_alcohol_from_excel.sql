-- Auto-generated from inventory Excel. Do not hand-edit.
-- DANE provisional = sale price for liquors.
DO $excel$
DECLARE
  v_tenant UUID := '00000000-0000-0000-0000-000000000001';
  v_iva19 UUID;
  v_iva5 UUID;
  v_icl UUID;
  v_adv UUID;
  v_beer UUID;
  v_product UUID;
  v_matched UUID;
BEGIN
  SELECT id INTO v_iva19 FROM taxes WHERE tenant_id = v_tenant AND UPPER(BTRIM(name)) = 'IVA 19%' LIMIT 1;
  SELECT id INTO v_iva5 FROM taxes WHERE tenant_id = v_tenant AND UPPER(BTRIM(name)) = 'IVA 5%' LIMIT 1;
  SELECT id INTO v_icl FROM taxes WHERE tenant_id = v_tenant AND UPPER(BTRIM(name)) = UPPER('Impuesto al consumo de licores') LIMIT 1;
  SELECT t.id INTO v_adv
  FROM taxes t
  JOIN tax_types tt ON tt.id = t.tax_type_id
  WHERE t.tenant_id = v_tenant AND tt.code = 'AD_VALOREM'
  LIMIT 1;
  SELECT id INTO v_beer FROM taxes WHERE tenant_id = v_tenant AND UPPER(BTRIM(name)) = UPPER('Impuesto al consumo de cervezas y refajos') LIMIT 1;
  IF v_iva19 IS NULL OR v_iva5 IS NULL OR v_icl IS NULL OR v_adv IS NULL OR v_beer IS NULL THEN
    RAISE EXCEPTION 'Missing required tenant taxes';
  END IF;

  -- LIQUOR 5000267024233 / WHISKY JOHNNIE WALKER BLACK BOTELLA 700ML
  v_product := NULL;
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-5000267024233'))
      OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('WHISKY JOHNNIE WALKER BLACK BOTELLA 700ML'))
      OR UPPER(BTRIM(p.name)) LIKE '%' || UPPER(BTRIM('WHISKY JOHNNIE WALKER BLACK BOTELLA 700ML')) || '%')
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    v_product := v_matched;
  ELSIF NOT EXISTS (
    SELECT 1 FROM products
    WHERE tenant_id = v_tenant AND UPPER(BTRIM(sku)) = UPPER(BTRIM('XLS-5000267024233'))
  ) THEN
    v_product := '78df2afa-ccfb-54f4-a312-a51fa7a3c3a2'::uuid;
    INSERT INTO products (
      id, tenant_id, unit_id, tax_id, name, description, sku, price, cost,
      price_with_tax, price_without_tax, is_active, requires_lot,
      operational_status, sale_type, measurement_unit,
      category_id, subcategory_id, created_at, updated_at
    ) VALUES (
      v_product, v_tenant, '10000000-0000-0000-0000-000000000001'::uuid, v_iva5, 'WHISKY JOHNNIE WALKER BLACK BOTELLA 700ML', 'WHISKY JOHNNIE WALKER BLACK BOTELLA 700ML', 'XLS-5000267024233',
      162800.00, 130260.00,
      162800.00, 162800.00, TRUE, FALSE,
      'ACTIVE', 'UNIT', 'UND',
      'd62a28a9-32ac-4df5-ad91-142c14b0edd8'::uuid, '7fd6dac4-6a98-4cda-822f-332ff15c791e'::uuid, NOW(), NOW()
    );
  END IF;
  IF v_product IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_product,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_icl, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_adv, 'calculation_order', 20),
        jsonb_build_object('tax_id', v_iva5, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_product,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000010'::uuid,
        'alcohol_degree', 40.000,
        'net_volume_ml', 700.000,
        'dane_certified_retail_price', 162800.00,
        'dane_price_effective_from', CURRENT_DATE::text,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva5, updated_at = NOW()
    WHERE id = v_product AND tenant_id = v_tenant;
  END IF;

  -- LIQUOR 50196388 / WHISKY BUCHANANS DE LUXE 750ml
  v_product := NULL;
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-50196388'))
      OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('WHISKY BUCHANANS DE LUXE 750ml'))
      OR UPPER(BTRIM(p.name)) LIKE '%' || UPPER(BTRIM('WHISKY BUCHANANS DE LUXE 750ml')) || '%')
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    v_product := v_matched;
  ELSIF NOT EXISTS (
    SELECT 1 FROM products
    WHERE tenant_id = v_tenant AND UPPER(BTRIM(sku)) = UPPER(BTRIM('XLS-50196388'))
  ) THEN
    v_product := '67335538-be74-5f60-adcc-b0cb740f5a20'::uuid;
    INSERT INTO products (
      id, tenant_id, unit_id, tax_id, name, description, sku, price, cost,
      price_with_tax, price_without_tax, is_active, requires_lot,
      operational_status, sale_type, measurement_unit,
      category_id, subcategory_id, created_at, updated_at
    ) VALUES (
      v_product, v_tenant, '10000000-0000-0000-0000-000000000001'::uuid, v_iva5, 'WHISKY BUCHANANS DE LUXE 750ml', 'WHISKY BUCHANANS DE LUXE 750ml', 'XLS-50196388',
      180867.00, 144694.00,
      180867.00, 180867.00, TRUE, FALSE,
      'ACTIVE', 'UNIT', 'UND',
      'd62a28a9-32ac-4df5-ad91-142c14b0edd8'::uuid, '7fd6dac4-6a98-4cda-822f-332ff15c791e'::uuid, NOW(), NOW()
    );
  END IF;
  IF v_product IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_product,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_icl, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_adv, 'calculation_order', 20),
        jsonb_build_object('tax_id', v_iva5, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_product,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000010'::uuid,
        'alcohol_degree', 40.000,
        'net_volume_ml', 750.000,
        'dane_certified_retail_price', 180867.00,
        'dane_price_effective_from', CURRENT_DATE::text,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva5, updated_at = NOW()
    WHERE id = v_product AND tenant_id = v_tenant;
  END IF;

  -- LIQUOR 7707096297583 / WODKA SMIRNOFF TAMARINDO 750ML
  v_product := NULL;
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-7707096297583'))
      OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('WODKA SMIRNOFF TAMARINDO 750ML'))
      OR UPPER(BTRIM(p.name)) LIKE '%' || UPPER(BTRIM('WODKA SMIRNOFF TAMARINDO 750ML')) || '%')
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    v_product := v_matched;
  ELSIF NOT EXISTS (
    SELECT 1 FROM products
    WHERE tenant_id = v_tenant AND UPPER(BTRIM(sku)) = UPPER(BTRIM('XLS-7707096297583'))
  ) THEN
    v_product := '34e00185-a9c3-5352-8479-feae0f60031f'::uuid;
    INSERT INTO products (
      id, tenant_id, unit_id, tax_id, name, description, sku, price, cost,
      price_with_tax, price_without_tax, is_active, requires_lot,
      operational_status, sale_type, measurement_unit,
      category_id, subcategory_id, created_at, updated_at
    ) VALUES (
      v_product, v_tenant, '10000000-0000-0000-0000-000000000001'::uuid, v_iva5, 'WODKA SMIRNOFF TAMARINDO 750ML', 'WODKA SMIRNOFF TAMARINDO 750ML', 'XLS-7707096297583',
      53000.00, 42195.00,
      53000.00, 53000.00, TRUE, FALSE,
      'ACTIVE', 'UNIT', 'UND',
      'd62a28a9-32ac-4df5-ad91-142c14b0edd8'::uuid, '59469cae-477c-4263-b086-3883c987a82b'::uuid, NOW(), NOW()
    );
  END IF;
  IF v_product IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_product,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_icl, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_adv, 'calculation_order', 20),
        jsonb_build_object('tax_id', v_iva5, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_product,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000010'::uuid,
        'alcohol_degree', 29.000,
        'net_volume_ml', 750.000,
        'dane_certified_retail_price', 53000.00,
        'dane_price_effective_from', CURRENT_DATE::text,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva5, updated_at = NOW()
    WHERE id = v_product AND tenant_id = v_tenant;
  END IF;

  -- LIQUOR 50196364 / WHISKY BUCHANANS DE LUXE 1000
  v_product := NULL;
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-50196364'))
      OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('WHISKY BUCHANANS DE LUXE 1000'))
      OR UPPER(BTRIM(p.name)) LIKE '%' || UPPER(BTRIM('WHISKY BUCHANANS DE LUXE 1000')) || '%')
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    v_product := v_matched;
  ELSIF NOT EXISTS (
    SELECT 1 FROM products
    WHERE tenant_id = v_tenant AND UPPER(BTRIM(sku)) = UPPER(BTRIM('XLS-50196364'))
  ) THEN
    v_product := '010d8be4-8b62-5b48-b0fd-e4b3fa29a249'::uuid;
    INSERT INTO products (
      id, tenant_id, unit_id, tax_id, name, description, sku, price, cost,
      price_with_tax, price_without_tax, is_active, requires_lot,
      operational_status, sale_type, measurement_unit,
      category_id, subcategory_id, created_at, updated_at
    ) VALUES (
      v_product, v_tenant, '10000000-0000-0000-0000-000000000001'::uuid, v_iva5, 'WHISKY BUCHANANS DE LUXE 1000', 'WHISKY BUCHANANS DE LUXE 1000', 'XLS-50196364',
      229238.00, 183391.00,
      229238.00, 229238.00, TRUE, FALSE,
      'ACTIVE', 'UNIT', 'UND',
      'd62a28a9-32ac-4df5-ad91-142c14b0edd8'::uuid, '7fd6dac4-6a98-4cda-822f-332ff15c791e'::uuid, NOW(), NOW()
    );
  END IF;
  IF v_product IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_product,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_icl, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_adv, 'calculation_order', 20),
        jsonb_build_object('tax_id', v_iva5, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_product,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000010'::uuid,
        'alcohol_degree', 40.000,
        'net_volume_ml', 1000.000,
        'dane_certified_retail_price', 229238.00,
        'dane_price_effective_from', CURRENT_DATE::text,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva5, updated_at = NOW()
    WHERE id = v_product AND tenant_id = v_tenant;
  END IF;

  -- LIQUOR I-17816551480 / WHISKY JOHNNIE WALKER RED LABEL BOTELLA 1OOOML
  v_product := NULL;
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-I-17816551480'))
      OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('WHISKY JOHNNIE WALKER RED LABEL BOTELLA 1OOOML'))
      OR UPPER(BTRIM(p.name)) LIKE '%' || UPPER(BTRIM('WHISKY JOHNNIE WALKER RED LABEL BOTELLA 1OOOML')) || '%')
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    v_product := v_matched;
  ELSIF NOT EXISTS (
    SELECT 1 FROM products
    WHERE tenant_id = v_tenant AND UPPER(BTRIM(sku)) = UPPER(BTRIM('XLS-I-17816551480'))
  ) THEN
    v_product := 'ffac6174-0854-53a1-85d2-a78bf75ce9a4'::uuid;
    INSERT INTO products (
      id, tenant_id, unit_id, tax_id, name, description, sku, price, cost,
      price_with_tax, price_without_tax, is_active, requires_lot,
      operational_status, sale_type, measurement_unit,
      category_id, subcategory_id, created_at, updated_at
    ) VALUES (
      v_product, v_tenant, '10000000-0000-0000-0000-000000000001'::uuid, v_iva5, 'WHISKY JOHNNIE WALKER RED LABEL BOTELLA 1OOOML', 'WHISKY JOHNNIE WALKER RED LABEL BOTELLA 1OOOML', 'XLS-I-17816551480',
      99700.00, 79737.00,
      99700.00, 99700.00, TRUE, FALSE,
      'ACTIVE', 'UNIT', 'UND',
      'd62a28a9-32ac-4df5-ad91-142c14b0edd8'::uuid, '7fd6dac4-6a98-4cda-822f-332ff15c791e'::uuid, NOW(), NOW()
    );
  END IF;
  IF v_product IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_product,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_icl, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_adv, 'calculation_order', 20),
        jsonb_build_object('tax_id', v_iva5, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_product,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000010'::uuid,
        'alcohol_degree', 40.000,
        'net_volume_ml', 750.000,
        'dane_certified_retail_price', 99700.00,
        'dane_price_effective_from', CURRENT_DATE::text,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva5, updated_at = NOW()
    WHERE id = v_product AND tenant_id = v_tenant;
  END IF;

  -- LIQUOR 5000281005034 / WHISKY OLD PARR 12 AÑOS 500ML
  v_product := NULL;
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-5000281005034'))
      OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('WHISKY OLD PARR 12 AÑOS 500ML'))
      OR UPPER(BTRIM(p.name)) LIKE '%' || UPPER(BTRIM('WHISKY OLD PARR 12 AÑOS 500ML')) || '%')
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    v_product := v_matched;
  ELSIF NOT EXISTS (
    SELECT 1 FROM products
    WHERE tenant_id = v_tenant AND UPPER(BTRIM(sku)) = UPPER(BTRIM('XLS-5000281005034'))
  ) THEN
    v_product := '7335a2e1-59d8-51c1-86c3-0ce83c39f917'::uuid;
    INSERT INTO products (
      id, tenant_id, unit_id, tax_id, name, description, sku, price, cost,
      price_with_tax, price_without_tax, is_active, requires_lot,
      operational_status, sale_type, measurement_unit,
      category_id, subcategory_id, created_at, updated_at
    ) VALUES (
      v_product, v_tenant, '10000000-0000-0000-0000-000000000001'::uuid, v_iva5, 'WHISKY OLD PARR 12 AÑOS 500ML', 'WHISKY OLD PARR 12 AÑOS 500ML', 'XLS-5000281005034',
      116200.00, 93011.00,
      116200.00, 116200.00, TRUE, FALSE,
      'ACTIVE', 'UNIT', 'UND',
      'd62a28a9-32ac-4df5-ad91-142c14b0edd8'::uuid, '7fd6dac4-6a98-4cda-822f-332ff15c791e'::uuid, NOW(), NOW()
    );
  END IF;
  IF v_product IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_product,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_icl, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_adv, 'calculation_order', 20),
        jsonb_build_object('tax_id', v_iva5, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_product,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000010'::uuid,
        'alcohol_degree', 40.000,
        'net_volume_ml', 500.000,
        'dane_certified_retail_price', 116200.00,
        'dane_price_effective_from', CURRENT_DATE::text,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva5, updated_at = NOW()
    WHERE id = v_product AND tenant_id = v_tenant;
  END IF;

  -- LIQUOR 5000281004020 / WHISKY OLD PARR 12 AÑOS 1000ML
  v_product := NULL;
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-5000281004020'))
      OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('WHISKY OLD PARR 12 AÑOS 1000ML'))
      OR UPPER(BTRIM(p.name)) LIKE '%' || UPPER(BTRIM('WHISKY OLD PARR 12 AÑOS 1000ML')) || '%')
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    v_product := v_matched;
  ELSIF NOT EXISTS (
    SELECT 1 FROM products
    WHERE tenant_id = v_tenant AND UPPER(BTRIM(sku)) = UPPER(BTRIM('XLS-5000281004020'))
  ) THEN
    v_product := '60965809-b0cb-5a47-9266-562096a5615d'::uuid;
    INSERT INTO products (
      id, tenant_id, unit_id, tax_id, name, description, sku, price, cost,
      price_with_tax, price_without_tax, is_active, requires_lot,
      operational_status, sale_type, measurement_unit,
      category_id, subcategory_id, created_at, updated_at
    ) VALUES (
      v_product, v_tenant, '10000000-0000-0000-0000-000000000001'::uuid, v_iva5, 'WHISKY OLD PARR 12 AÑOS 1000ML', 'WHISKY OLD PARR 12 AÑOS 1000ML', 'XLS-5000281004020',
      200400.00, 160347.00,
      200400.00, 200400.00, TRUE, FALSE,
      'ACTIVE', 'UNIT', 'UND',
      'd62a28a9-32ac-4df5-ad91-142c14b0edd8'::uuid, '7fd6dac4-6a98-4cda-822f-332ff15c791e'::uuid, NOW(), NOW()
    );
  END IF;
  IF v_product IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_product,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_icl, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_adv, 'calculation_order', 20),
        jsonb_build_object('tax_id', v_iva5, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_product,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000010'::uuid,
        'alcohol_degree', 40.000,
        'net_volume_ml', 1000.000,
        'dane_certified_retail_price', 200400.00,
        'dane_price_effective_from', CURRENT_DATE::text,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva5, updated_at = NOW()
    WHERE id = v_product AND tenant_id = v_tenant;
  END IF;

  -- LIQUOR 5000281003160 / WHISKY OLD PARR 750ML
  v_product := NULL;
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-5000281003160'))
      OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('WHISKY OLD PARR 750ML'))
      OR UPPER(BTRIM(p.name)) LIKE '%' || UPPER(BTRIM('WHISKY OLD PARR 750ML')) || '%')
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    v_product := v_matched;
  ELSIF NOT EXISTS (
    SELECT 1 FROM products
    WHERE tenant_id = v_tenant AND UPPER(BTRIM(sku)) = UPPER(BTRIM('XLS-5000281003160'))
  ) THEN
    v_product := '98088425-7775-5415-8919-ae871937323e'::uuid;
    INSERT INTO products (
      id, tenant_id, unit_id, tax_id, name, description, sku, price, cost,
      price_with_tax, price_without_tax, is_active, requires_lot,
      operational_status, sale_type, measurement_unit,
      category_id, subcategory_id, created_at, updated_at
    ) VALUES (
      v_product, v_tenant, '10000000-0000-0000-0000-000000000001'::uuid, v_iva5, 'WHISKY OLD PARR 750ML', 'WHISKY OLD PARR 750ML', 'XLS-5000281003160',
      159900.00, 127912.00,
      159900.00, 159900.00, TRUE, FALSE,
      'ACTIVE', 'UNIT', 'UND',
      'd62a28a9-32ac-4df5-ad91-142c14b0edd8'::uuid, '7fd6dac4-6a98-4cda-822f-332ff15c791e'::uuid, NOW(), NOW()
    );
  END IF;
  IF v_product IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_product,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_icl, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_adv, 'calculation_order', 20),
        jsonb_build_object('tax_id', v_iva5, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_product,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000010'::uuid,
        'alcohol_degree', 40.000,
        'net_volume_ml', 750.000,
        'dane_certified_retail_price', 159900.00,
        'dane_price_effective_from', CURRENT_DATE::text,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva5, updated_at = NOW()
    WHERE id = v_product AND tenant_id = v_tenant;
  END IF;

  -- LIQUOR 5000267014609 / WHISKY JOHNNIE WALKER RED LABEL 375ML
  v_product := NULL;
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-5000267014609'))
      OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('WHISKY JOHNNIE WALKER RED LABEL 375ML'))
      OR UPPER(BTRIM(p.name)) LIKE '%' || UPPER(BTRIM('WHISKY JOHNNIE WALKER RED LABEL 375ML')) || '%')
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    v_product := v_matched;
  ELSIF NOT EXISTS (
    SELECT 1 FROM products
    WHERE tenant_id = v_tenant AND UPPER(BTRIM(sku)) = UPPER(BTRIM('XLS-5000267014609'))
  ) THEN
    v_product := 'e1cb1676-1f15-5b76-9585-5037b927c2f2'::uuid;
    INSERT INTO products (
      id, tenant_id, unit_id, tax_id, name, description, sku, price, cost,
      price_with_tax, price_without_tax, is_active, requires_lot,
      operational_status, sale_type, measurement_unit,
      category_id, subcategory_id, created_at, updated_at
    ) VALUES (
      v_product, v_tenant, '10000000-0000-0000-0000-000000000001'::uuid, v_iva5, 'WHISKY JOHNNIE WALKER RED LABEL 375ML', 'WHISKY JOHNNIE WALKER RED LABEL 375ML', 'XLS-5000267014609',
      50866.00, 40693.00,
      50866.00, 50866.00, TRUE, FALSE,
      'ACTIVE', 'UNIT', 'UND',
      'd62a28a9-32ac-4df5-ad91-142c14b0edd8'::uuid, '7fd6dac4-6a98-4cda-822f-332ff15c791e'::uuid, NOW(), NOW()
    );
  END IF;
  IF v_product IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_product,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_icl, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_adv, 'calculation_order', 20),
        jsonb_build_object('tax_id', v_iva5, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_product,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000010'::uuid,
        'alcohol_degree', 40.000,
        'net_volume_ml', 375.000,
        'dane_certified_retail_price', 50866.00,
        'dane_price_effective_from', CURRENT_DATE::text,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva5, updated_at = NOW()
    WHERE id = v_product AND tenant_id = v_tenant;
  END IF;

  -- LIQUOR 5410316948999 / SMIRNOFF ICE GREEN APPLE BOTELLA 275ML
  v_product := NULL;
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-5410316948999'))
      OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('SMIRNOFF ICE GREEN APPLE BOTELLA 275ML'))
      OR UPPER(BTRIM(p.name)) LIKE '%' || UPPER(BTRIM('SMIRNOFF ICE GREEN APPLE BOTELLA 275ML')) || '%')
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    v_product := v_matched;
  ELSIF NOT EXISTS (
    SELECT 1 FROM products
    WHERE tenant_id = v_tenant AND UPPER(BTRIM(sku)) = UPPER(BTRIM('XLS-5410316948999'))
  ) THEN
    v_product := 'e328c070-3642-50ac-a458-105768b44045'::uuid;
    INSERT INTO products (
      id, tenant_id, unit_id, tax_id, name, description, sku, price, cost,
      price_with_tax, price_without_tax, is_active, requires_lot,
      operational_status, sale_type, measurement_unit,
      category_id, subcategory_id, created_at, updated_at
    ) VALUES (
      v_product, v_tenant, '10000000-0000-0000-0000-000000000001'::uuid, v_iva5, 'SMIRNOFF ICE GREEN APPLE BOTELLA 275ML', 'SMIRNOFF ICE GREEN APPLE BOTELLA 275ML', 'XLS-5410316948999',
      8500.00, 5218.00,
      8500.00, 8500.00, TRUE, FALSE,
      'ACTIVE', 'UNIT', 'UND',
      'd62a28a9-32ac-4df5-ad91-142c14b0edd8'::uuid, '59469cae-477c-4263-b086-3883c987a82b'::uuid, NOW(), NOW()
    );
  END IF;
  IF v_product IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_product,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_icl, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_adv, 'calculation_order', 20),
        jsonb_build_object('tax_id', v_iva5, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_product,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000010'::uuid,
        'alcohol_degree', 29.000,
        'net_volume_ml', 275.000,
        'dane_certified_retail_price', 8500.00,
        'dane_price_effective_from', CURRENT_DATE::text,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva5, updated_at = NOW()
    WHERE id = v_product AND tenant_id = v_tenant;
  END IF;

  -- LIQUOR 5000196003774 / WHISKY BUCHANANS MASTER 750ML
  v_product := NULL;
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-5000196003774'))
      OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('WHISKY BUCHANANS MASTER 750ML'))
      OR UPPER(BTRIM(p.name)) LIKE '%' || UPPER(BTRIM('WHISKY BUCHANANS MASTER 750ML')) || '%')
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    v_product := v_matched;
  ELSIF NOT EXISTS (
    SELECT 1 FROM products
    WHERE tenant_id = v_tenant AND UPPER(BTRIM(sku)) = UPPER(BTRIM('XLS-5000196003774'))
  ) THEN
    v_product := 'd9436678-426f-591c-93a1-f4e2e180ee40'::uuid;
    INSERT INTO products (
      id, tenant_id, unit_id, tax_id, name, description, sku, price, cost,
      price_with_tax, price_without_tax, is_active, requires_lot,
      operational_status, sale_type, measurement_unit,
      category_id, subcategory_id, created_at, updated_at
    ) VALUES (
      v_product, v_tenant, '10000000-0000-0000-0000-000000000001'::uuid, v_iva5, 'WHISKY BUCHANANS MASTER 750ML', 'WHISKY BUCHANANS MASTER 750ML', 'XLS-5000196003774',
      210200.00, 168173.00,
      210200.00, 210200.00, TRUE, FALSE,
      'ACTIVE', 'UNIT', 'UND',
      'd62a28a9-32ac-4df5-ad91-142c14b0edd8'::uuid, '7fd6dac4-6a98-4cda-822f-332ff15c791e'::uuid, NOW(), NOW()
    );
  END IF;
  IF v_product IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_product,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_icl, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_adv, 'calculation_order', 20),
        jsonb_build_object('tax_id', v_iva5, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_product,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000010'::uuid,
        'alcohol_degree', 40.000,
        'net_volume_ml', 750.000,
        'dane_certified_retail_price', 210200.00,
        'dane_price_effective_from', CURRENT_DATE::text,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva5, updated_at = NOW()
    WHERE id = v_product AND tenant_id = v_tenant;
  END IF;

  -- LIQUOR 5011013100156 / Crema de whisky baileys 700ml
  v_product := NULL;
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-5011013100156'))
      OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('Crema de whisky baileys 700ml'))
      OR UPPER(BTRIM(p.name)) LIKE '%' || UPPER(BTRIM('Crema de whisky baileys 700ml')) || '%')
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    v_product := v_matched;
  ELSIF NOT EXISTS (
    SELECT 1 FROM products
    WHERE tenant_id = v_tenant AND UPPER(BTRIM(sku)) = UPPER(BTRIM('XLS-5011013100156'))
  ) THEN
    v_product := '528120b8-5fbd-5f94-923e-ad3ce5162e08'::uuid;
    INSERT INTO products (
      id, tenant_id, unit_id, tax_id, name, description, sku, price, cost,
      price_with_tax, price_without_tax, is_active, requires_lot,
      operational_status, sale_type, measurement_unit,
      category_id, subcategory_id, created_at, updated_at
    ) VALUES (
      v_product, v_tenant, '10000000-0000-0000-0000-000000000001'::uuid, v_iva5, 'Crema de whisky baileys 700ml', 'Crema de whisky baileys 700ml', 'XLS-5011013100156',
      90500.00, 72382.00,
      90500.00, 90500.00, TRUE, FALSE,
      'ACTIVE', 'UNIT', 'UND',
      'd62a28a9-32ac-4df5-ad91-142c14b0edd8'::uuid, '7fd6dac4-6a98-4cda-822f-332ff15c791e'::uuid, NOW(), NOW()
    );
  END IF;
  IF v_product IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_product,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_icl, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_adv, 'calculation_order', 20),
        jsonb_build_object('tax_id', v_iva5, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_product,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000010'::uuid,
        'alcohol_degree', 40.000,
        'net_volume_ml', 700.000,
        'dane_certified_retail_price', 90500.00,
        'dane_price_effective_from', CURRENT_DATE::text,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva5, updated_at = NOW()
    WHERE id = v_product AND tenant_id = v_tenant;
  END IF;

  -- LIQUOR 50196135 / whisky black white botella 700ml
  v_product := NULL;
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-50196135'))
      OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('whisky black white botella 700ml'))
      OR UPPER(BTRIM(p.name)) LIKE '%' || UPPER(BTRIM('whisky black white botella 700ml')) || '%')
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    v_product := v_matched;
  ELSIF NOT EXISTS (
    SELECT 1 FROM products
    WHERE tenant_id = v_tenant AND UPPER(BTRIM(sku)) = UPPER(BTRIM('XLS-50196135'))
  ) THEN
    v_product := 'd54ed37c-de84-5b39-b85d-db6ddca7044d'::uuid;
    INSERT INTO products (
      id, tenant_id, unit_id, tax_id, name, description, sku, price, cost,
      price_with_tax, price_without_tax, is_active, requires_lot,
      operational_status, sale_type, measurement_unit,
      category_id, subcategory_id, created_at, updated_at
    ) VALUES (
      v_product, v_tenant, '10000000-0000-0000-0000-000000000001'::uuid, v_iva5, 'whisky black white botella 700ml', 'whisky black white botella 700ml', 'XLS-50196135',
      61200.00, 48927.00,
      61200.00, 61200.00, TRUE, FALSE,
      'ACTIVE', 'UNIT', 'UND',
      'd62a28a9-32ac-4df5-ad91-142c14b0edd8'::uuid, '7fd6dac4-6a98-4cda-822f-332ff15c791e'::uuid, NOW(), NOW()
    );
  END IF;
  IF v_product IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_product,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_icl, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_adv, 'calculation_order', 20),
        jsonb_build_object('tax_id', v_iva5, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_product,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000010'::uuid,
        'alcohol_degree', 40.000,
        'net_volume_ml', 700.000,
        'dane_certified_retail_price', 61200.00,
        'dane_price_effective_from', CURRENT_DATE::text,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva5, updated_at = NOW()
    WHERE id = v_product AND tenant_id = v_tenant;
  END IF;

  -- LIQUOR 50196166 / whisky black white botella 375ml
  v_product := NULL;
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-50196166'))
      OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('whisky black white botella 375ml'))
      OR UPPER(BTRIM(p.name)) LIKE '%' || UPPER(BTRIM('whisky black white botella 375ml')) || '%')
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    v_product := v_matched;
  ELSIF NOT EXISTS (
    SELECT 1 FROM products
    WHERE tenant_id = v_tenant AND UPPER(BTRIM(sku)) = UPPER(BTRIM('XLS-50196166'))
  ) THEN
    v_product := 'cfedcd71-9688-562b-ae65-0b37bd1f83fc'::uuid;
    INSERT INTO products (
      id, tenant_id, unit_id, tax_id, name, description, sku, price, cost,
      price_with_tax, price_without_tax, is_active, requires_lot,
      operational_status, sale_type, measurement_unit,
      category_id, subcategory_id, created_at, updated_at
    ) VALUES (
      v_product, v_tenant, '10000000-0000-0000-0000-000000000001'::uuid, v_iva5, 'whisky black white botella 375ml', 'whisky black white botella 375ml', 'XLS-50196166',
      33200.00, 26478.00,
      33200.00, 33200.00, TRUE, FALSE,
      'ACTIVE', 'UNIT', 'UND',
      'd62a28a9-32ac-4df5-ad91-142c14b0edd8'::uuid, '7fd6dac4-6a98-4cda-822f-332ff15c791e'::uuid, NOW(), NOW()
    );
  END IF;
  IF v_product IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_product,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_icl, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_adv, 'calculation_order', 20),
        jsonb_build_object('tax_id', v_iva5, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_product,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000010'::uuid,
        'alcohol_degree', 40.000,
        'net_volume_ml', 375.000,
        'dane_certified_retail_price', 33200.00,
        'dane_price_effective_from', CURRENT_DATE::text,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva5, updated_at = NOW()
    WHERE id = v_product AND tenant_id = v_tenant;
  END IF;

  -- LIQUOR 7707096271682 / wodka smirnoff lulo 750ml
  v_product := NULL;
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-7707096271682'))
      OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('wodka smirnoff lulo 750ml'))
      OR UPPER(BTRIM(p.name)) LIKE '%' || UPPER(BTRIM('wodka smirnoff lulo 750ml')) || '%')
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    v_product := v_matched;
  ELSIF NOT EXISTS (
    SELECT 1 FROM products
    WHERE tenant_id = v_tenant AND UPPER(BTRIM(sku)) = UPPER(BTRIM('XLS-7707096271682'))
  ) THEN
    v_product := 'a122771c-61e3-5206-b506-9b81cc091478'::uuid;
    INSERT INTO products (
      id, tenant_id, unit_id, tax_id, name, description, sku, price, cost,
      price_with_tax, price_without_tax, is_active, requires_lot,
      operational_status, sale_type, measurement_unit,
      category_id, subcategory_id, created_at, updated_at
    ) VALUES (
      v_product, v_tenant, '10000000-0000-0000-0000-000000000001'::uuid, v_iva5, 'wodka smirnoff lulo 750ml', 'wodka smirnoff lulo 750ml', 'XLS-7707096271682',
      52353.00, 39900.00,
      52353.00, 52353.00, TRUE, FALSE,
      'ACTIVE', 'UNIT', 'UND',
      'd62a28a9-32ac-4df5-ad91-142c14b0edd8'::uuid, '59469cae-477c-4263-b086-3883c987a82b'::uuid, NOW(), NOW()
    );
  END IF;
  IF v_product IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_product,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_icl, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_adv, 'calculation_order', 20),
        jsonb_build_object('tax_id', v_iva5, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_product,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000010'::uuid,
        'alcohol_degree', 29.000,
        'net_volume_ml', 750.000,
        'dane_certified_retail_price', 52353.00,
        'dane_price_effective_from', CURRENT_DATE::text,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva5, updated_at = NOW()
    WHERE id = v_product AND tenant_id = v_tenant;
  END IF;

  -- LIQUOR 5000267014203 / whisky johnnie walker red label botella 700ml
  v_product := NULL;
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-5000267014203'))
      OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('whisky johnnie walker red label botella 700ml'))
      OR UPPER(BTRIM(p.name)) LIKE '%' || UPPER(BTRIM('whisky johnnie walker red label botella 700ml')) || '%')
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    v_product := v_matched;
  ELSIF NOT EXISTS (
    SELECT 1 FROM products
    WHERE tenant_id = v_tenant AND UPPER(BTRIM(sku)) = UPPER(BTRIM('XLS-5000267014203'))
  ) THEN
    v_product := 'e17dd830-6e6c-5c6f-88d6-b0a372e0f526'::uuid;
    INSERT INTO products (
      id, tenant_id, unit_id, tax_id, name, description, sku, price, cost,
      price_with_tax, price_without_tax, is_active, requires_lot,
      operational_status, sale_type, measurement_unit,
      category_id, subcategory_id, created_at, updated_at
    ) VALUES (
      v_product, v_tenant, '10000000-0000-0000-0000-000000000001'::uuid, v_iva5, 'whisky johnnie walker red label botella 700ml', 'whisky johnnie walker red label botella 700ml', 'XLS-5000267014203',
      77000.00, 61564.00,
      77000.00, 77000.00, TRUE, FALSE,
      'ACTIVE', 'UNIT', 'UND',
      'd62a28a9-32ac-4df5-ad91-142c14b0edd8'::uuid, '7fd6dac4-6a98-4cda-822f-332ff15c791e'::uuid, NOW(), NOW()
    );
  END IF;
  IF v_product IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_product,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_icl, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_adv, 'calculation_order', 20),
        jsonb_build_object('tax_id', v_iva5, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_product,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000010'::uuid,
        'alcohol_degree', 40.000,
        'net_volume_ml', 700.000,
        'dane_certified_retail_price', 77000.00,
        'dane_price_effective_from', CURRENT_DATE::text,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva5, updated_at = NOW()
    WHERE id = v_product AND tenant_id = v_tenant;
  END IF;

  -- LIQUOR 5410316983693 / smirnoff ice red botella 275ml
  v_product := NULL;
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-5410316983693'))
      OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('smirnoff ice red botella 275ml'))
      OR UPPER(BTRIM(p.name)) LIKE '%' || UPPER(BTRIM('smirnoff ice red botella 275ml')) || '%')
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    v_product := v_matched;
  ELSIF NOT EXISTS (
    SELECT 1 FROM products
    WHERE tenant_id = v_tenant AND UPPER(BTRIM(sku)) = UPPER(BTRIM('XLS-5410316983693'))
  ) THEN
    v_product := 'd08ca35e-848e-538c-934d-177353211068'::uuid;
    INSERT INTO products (
      id, tenant_id, unit_id, tax_id, name, description, sku, price, cost,
      price_with_tax, price_without_tax, is_active, requires_lot,
      operational_status, sale_type, measurement_unit,
      category_id, subcategory_id, created_at, updated_at
    ) VALUES (
      v_product, v_tenant, '10000000-0000-0000-0000-000000000001'::uuid, v_iva5, 'smirnoff ice red botella 275ml', 'smirnoff ice red botella 275ml', 'XLS-5410316983693',
      8500.00, 5217.00,
      8500.00, 8500.00, TRUE, FALSE,
      'ACTIVE', 'UNIT', 'UND',
      'd62a28a9-32ac-4df5-ad91-142c14b0edd8'::uuid, '59469cae-477c-4263-b086-3883c987a82b'::uuid, NOW(), NOW()
    );
  END IF;
  IF v_product IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_product,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_icl, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_adv, 'calculation_order', 20),
        jsonb_build_object('tax_id', v_iva5, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_product,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000010'::uuid,
        'alcohol_degree', 29.000,
        'net_volume_ml', 275.000,
        'dane_certified_retail_price', 8500.00,
        'dane_price_effective_from', CURRENT_DATE::text,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva5, updated_at = NOW()
    WHERE id = v_product AND tenant_id = v_tenant;
  END IF;

  -- LIQUOR 5410316945981 / smirnoff ice green apple lata 250ml
  v_product := NULL;
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-5410316945981'))
      OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('smirnoff ice green apple lata 250ml'))
      OR UPPER(BTRIM(p.name)) LIKE '%' || UPPER(BTRIM('smirnoff ice green apple lata 250ml')) || '%')
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    v_product := v_matched;
  ELSIF NOT EXISTS (
    SELECT 1 FROM products
    WHERE tenant_id = v_tenant AND UPPER(BTRIM(sku)) = UPPER(BTRIM('XLS-5410316945981'))
  ) THEN
    v_product := '792673dd-7146-5b6f-be86-78e1dac665cc'::uuid;
    INSERT INTO products (
      id, tenant_id, unit_id, tax_id, name, description, sku, price, cost,
      price_with_tax, price_without_tax, is_active, requires_lot,
      operational_status, sale_type, measurement_unit,
      category_id, subcategory_id, created_at, updated_at
    ) VALUES (
      v_product, v_tenant, '10000000-0000-0000-0000-000000000001'::uuid, v_iva5, 'smirnoff ice green apple lata 250ml', 'smirnoff ice green apple lata 250ml', 'XLS-5410316945981',
      7500.00, 5217.00,
      7500.00, 7500.00, TRUE, FALSE,
      'ACTIVE', 'UNIT', 'UND',
      'd62a28a9-32ac-4df5-ad91-142c14b0edd8'::uuid, '59469cae-477c-4263-b086-3883c987a82b'::uuid, NOW(), NOW()
    );
  END IF;
  IF v_product IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_product,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_icl, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_adv, 'calculation_order', 20),
        jsonb_build_object('tax_id', v_iva5, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_product,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000010'::uuid,
        'alcohol_degree', 29.000,
        'net_volume_ml', 250.000,
        'dane_certified_retail_price', 7500.00,
        'dane_price_effective_from', CURRENT_DATE::text,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva5, updated_at = NOW()
    WHERE id = v_product AND tenant_id = v_tenant;
  END IF;

  -- LIQUOR 7702049001675 / aguardiente antioqueño verde tetra 1050
  v_product := NULL;
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-7702049001675'))
      OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('aguardiente antioqueño verde tetra 1050'))
      OR UPPER(BTRIM(p.name)) LIKE '%' || UPPER(BTRIM('aguardiente antioqueño verde tetra 1050')) || '%')
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    v_product := v_matched;
  ELSIF NOT EXISTS (
    SELECT 1 FROM products
    WHERE tenant_id = v_tenant AND UPPER(BTRIM(sku)) = UPPER(BTRIM('XLS-7702049001675'))
  ) THEN
    v_product := '5b8e9ddb-26f3-5f05-a586-a4ebb7f33baf'::uuid;
    INSERT INTO products (
      id, tenant_id, unit_id, tax_id, name, description, sku, price, cost,
      price_with_tax, price_without_tax, is_active, requires_lot,
      operational_status, sale_type, measurement_unit,
      category_id, subcategory_id, created_at, updated_at
    ) VALUES (
      v_product, v_tenant, '10000000-0000-0000-0000-000000000001'::uuid, v_iva5, 'aguardiente antioqueño verde tetra 1050', 'aguardiente antioqueño verde tetra 1050', 'XLS-7702049001675',
      67200.00, 53750.00,
      67200.00, 67200.00, TRUE, FALSE,
      'ACTIVE', 'UNIT', 'UND',
      'd62a28a9-32ac-4df5-ad91-142c14b0edd8'::uuid, '59469cae-477c-4263-b086-3883c987a82b'::uuid, NOW(), NOW()
    );
  END IF;
  IF v_product IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_product,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_icl, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_adv, 'calculation_order', 20),
        jsonb_build_object('tax_id', v_iva5, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_product,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000010'::uuid,
        'alcohol_degree', 29.000,
        'net_volume_ml', 1050.000,
        'dane_certified_retail_price', 67200.00,
        'dane_price_effective_from', CURRENT_DATE::text,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva5, updated_at = NOW()
    WHERE id = v_product AND tenant_id = v_tenant;
  END IF;

  -- LIQUOR 7702049001514 / Aguardiente antioqueño sin azucar azul 1050 ml
  v_product := NULL;
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-7702049001514'))
      OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('Aguardiente antioqueño sin azucar azul 1050 ml'))
      OR UPPER(BTRIM(p.name)) LIKE '%' || UPPER(BTRIM('Aguardiente antioqueño sin azucar azul 1050 ml')) || '%')
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    v_product := v_matched;
  ELSIF NOT EXISTS (
    SELECT 1 FROM products
    WHERE tenant_id = v_tenant AND UPPER(BTRIM(sku)) = UPPER(BTRIM('XLS-7702049001514'))
  ) THEN
    v_product := 'f9dc9ef3-8d46-5b5d-9863-c4b972b7a1fe'::uuid;
    INSERT INTO products (
      id, tenant_id, unit_id, tax_id, name, description, sku, price, cost,
      price_with_tax, price_without_tax, is_active, requires_lot,
      operational_status, sale_type, measurement_unit,
      category_id, subcategory_id, created_at, updated_at
    ) VALUES (
      v_product, v_tenant, '10000000-0000-0000-0000-000000000001'::uuid, v_iva5, 'Aguardiente antioqueño sin azucar azul 1050 ml', 'Aguardiente antioqueño sin azucar azul 1050 ml', 'XLS-7702049001514',
      71800.00, 57500.00,
      71800.00, 71800.00, TRUE, FALSE,
      'ACTIVE', 'UNIT', 'UND',
      'd62a28a9-32ac-4df5-ad91-142c14b0edd8'::uuid, '59469cae-477c-4263-b086-3883c987a82b'::uuid, NOW(), NOW()
    );
  END IF;
  IF v_product IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_product,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_icl, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_adv, 'calculation_order', 20),
        jsonb_build_object('tax_id', v_iva5, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_product,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000010'::uuid,
        'alcohol_degree', 29.000,
        'net_volume_ml', 1050.000,
        'dane_certified_retail_price', 71800.00,
        'dane_price_effective_from', CURRENT_DATE::text,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva5, updated_at = NOW()
    WHERE id = v_product AND tenant_id = v_tenant;
  END IF;

  -- LIQUOR 7702049000548 / Aguardiente antioqueño sin azucar 375 ml
  v_product := NULL;
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-7702049000548'))
      OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('Aguardiente antioqueño sin azucar 375 ml'))
      OR UPPER(BTRIM(p.name)) LIKE '%' || UPPER(BTRIM('Aguardiente antioqueño sin azucar 375 ml')) || '%')
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    v_product := v_matched;
  ELSIF NOT EXISTS (
    SELECT 1 FROM products
    WHERE tenant_id = v_tenant AND UPPER(BTRIM(sku)) = UPPER(BTRIM('XLS-7702049000548'))
  ) THEN
    v_product := '908262f4-69c1-59ce-9302-fdc8895d06fc'::uuid;
    INSERT INTO products (
      id, tenant_id, unit_id, tax_id, name, description, sku, price, cost,
      price_with_tax, price_without_tax, is_active, requires_lot,
      operational_status, sale_type, measurement_unit,
      category_id, subcategory_id, created_at, updated_at
    ) VALUES (
      v_product, v_tenant, '10000000-0000-0000-0000-000000000001'::uuid, v_iva5, 'Aguardiente antioqueño sin azucar 375 ml', 'Aguardiente antioqueño sin azucar 375 ml', 'XLS-7702049000548',
      31900.00, 25500.00,
      31900.00, 31900.00, TRUE, FALSE,
      'ACTIVE', 'UNIT', 'UND',
      'd62a28a9-32ac-4df5-ad91-142c14b0edd8'::uuid, '59469cae-477c-4263-b086-3883c987a82b'::uuid, NOW(), NOW()
    );
  END IF;
  IF v_product IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_product,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_icl, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_adv, 'calculation_order', 20),
        jsonb_build_object('tax_id', v_iva5, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_product,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000010'::uuid,
        'alcohol_degree', 29.000,
        'net_volume_ml', 375.000,
        'dane_certified_retail_price', 31900.00,
        'dane_price_effective_from', CURRENT_DATE::text,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva5, updated_at = NOW()
    WHERE id = v_product AND tenant_id = v_tenant;
  END IF;

  -- LIQUOR 7702049001750 / Aguardiente antioqueño verde 1750ml
  v_product := NULL;
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-7702049001750'))
      OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('Aguardiente antioqueño verde 1750ml'))
      OR UPPER(BTRIM(p.name)) LIKE '%' || UPPER(BTRIM('Aguardiente antioqueño verde 1750ml')) || '%')
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    v_product := v_matched;
  ELSIF NOT EXISTS (
    SELECT 1 FROM products
    WHERE tenant_id = v_tenant AND UPPER(BTRIM(sku)) = UPPER(BTRIM('XLS-7702049001750'))
  ) THEN
    v_product := 'a73d21c8-74de-520d-b18d-4a14f88cdc6e'::uuid;
    INSERT INTO products (
      id, tenant_id, unit_id, tax_id, name, description, sku, price, cost,
      price_with_tax, price_without_tax, is_active, requires_lot,
      operational_status, sale_type, measurement_unit,
      category_id, subcategory_id, created_at, updated_at
    ) VALUES (
      v_product, v_tenant, '10000000-0000-0000-0000-000000000001'::uuid, v_iva5, 'Aguardiente antioqueño verde 1750ml', 'Aguardiente antioqueño verde 1750ml', 'XLS-7702049001750',
      116000.00, 93200.00,
      116000.00, 116000.00, TRUE, FALSE,
      'ACTIVE', 'UNIT', 'UND',
      'd62a28a9-32ac-4df5-ad91-142c14b0edd8'::uuid, '59469cae-477c-4263-b086-3883c987a82b'::uuid, NOW(), NOW()
    );
  END IF;
  IF v_product IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_product,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_icl, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_adv, 'calculation_order', 20),
        jsonb_build_object('tax_id', v_iva5, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_product,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000010'::uuid,
        'alcohol_degree', 29.000,
        'net_volume_ml', 1750.000,
        'dane_certified_retail_price', 116000.00,
        'dane_price_effective_from', CURRENT_DATE::text,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva5, updated_at = NOW()
    WHERE id = v_product AND tenant_id = v_tenant;
  END IF;

  -- LIQUOR 7702049001637 / Aguardiente antioqueño verde 375 ml
  v_product := NULL;
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-7702049001637'))
      OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('Aguardiente antioqueño verde 375 ml'))
      OR UPPER(BTRIM(p.name)) LIKE '%' || UPPER(BTRIM('Aguardiente antioqueño verde 375 ml')) || '%')
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    v_product := v_matched;
  ELSIF NOT EXISTS (
    SELECT 1 FROM products
    WHERE tenant_id = v_tenant AND UPPER(BTRIM(sku)) = UPPER(BTRIM('XLS-7702049001637'))
  ) THEN
    v_product := 'd5cb0d2e-8729-53bc-9714-8f6fcebdf9dc'::uuid;
    INSERT INTO products (
      id, tenant_id, unit_id, tax_id, name, description, sku, price, cost,
      price_with_tax, price_without_tax, is_active, requires_lot,
      operational_status, sale_type, measurement_unit,
      category_id, subcategory_id, created_at, updated_at
    ) VALUES (
      v_product, v_tenant, '10000000-0000-0000-0000-000000000001'::uuid, v_iva5, 'Aguardiente antioqueño verde 375 ml', 'Aguardiente antioqueño verde 375 ml', 'XLS-7702049001637',
      28500.00, 23500.00,
      28500.00, 28500.00, TRUE, FALSE,
      'ACTIVE', 'UNIT', 'UND',
      'd62a28a9-32ac-4df5-ad91-142c14b0edd8'::uuid, '59469cae-477c-4263-b086-3883c987a82b'::uuid, NOW(), NOW()
    );
  END IF;
  IF v_product IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_product,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_icl, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_adv, 'calculation_order', 20),
        jsonb_build_object('tax_id', v_iva5, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_product,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000010'::uuid,
        'alcohol_degree', 29.000,
        'net_volume_ml', 375.000,
        'dane_certified_retail_price', 28500.00,
        'dane_price_effective_from', CURRENT_DATE::text,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva5, updated_at = NOW()
    WHERE id = v_product AND tenant_id = v_tenant;
  END IF;

  -- LIQUOR 7702049100576 / Ron medellin 3 años 750ml
  v_product := NULL;
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-7702049100576'))
      OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('Ron medellin 3 años 750ml'))
      OR UPPER(BTRIM(p.name)) LIKE '%' || UPPER(BTRIM('Ron medellin 3 años 750ml')) || '%')
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    v_product := v_matched;
  ELSIF NOT EXISTS (
    SELECT 1 FROM products
    WHERE tenant_id = v_tenant AND UPPER(BTRIM(sku)) = UPPER(BTRIM('XLS-7702049100576'))
  ) THEN
    v_product := '822d8f45-cc4d-5561-904f-1fadcc41a75f'::uuid;
    INSERT INTO products (
      id, tenant_id, unit_id, tax_id, name, description, sku, price, cost,
      price_with_tax, price_without_tax, is_active, requires_lot,
      operational_status, sale_type, measurement_unit,
      category_id, subcategory_id, created_at, updated_at
    ) VALUES (
      v_product, v_tenant, '10000000-0000-0000-0000-000000000001'::uuid, v_iva5, 'Ron medellin 3 años 750ml', 'Ron medellin 3 años 750ml', 'XLS-7702049100576',
      62700.00, 52100.00,
      62700.00, 62700.00, TRUE, FALSE,
      'ACTIVE', 'UNIT', 'UND',
      'd62a28a9-32ac-4df5-ad91-142c14b0edd8'::uuid, '59469cae-477c-4263-b086-3883c987a82b'::uuid, NOW(), NOW()
    );
  END IF;
  IF v_product IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_product,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_icl, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_adv, 'calculation_order', 20),
        jsonb_build_object('tax_id', v_iva5, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_product,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000010'::uuid,
        'alcohol_degree', 35.000,
        'net_volume_ml', 750.000,
        'dane_certified_retail_price', 62700.00,
        'dane_price_effective_from', CURRENT_DATE::text,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva5, updated_at = NOW()
    WHERE id = v_product AND tenant_id = v_tenant;
  END IF;

  -- LIQUOR I-17817175040 / Ron medellin 8 años 750
  v_product := NULL;
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-I-17817175040'))
      OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('Ron medellin 8 años 750'))
      OR UPPER(BTRIM(p.name)) LIKE '%' || UPPER(BTRIM('Ron medellin 8 años 750')) || '%')
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    v_product := v_matched;
  ELSIF NOT EXISTS (
    SELECT 1 FROM products
    WHERE tenant_id = v_tenant AND UPPER(BTRIM(sku)) = UPPER(BTRIM('XLS-I-17817175040'))
  ) THEN
    v_product := 'a7ce30e2-9e25-582b-b8a9-1798fb403125'::uuid;
    INSERT INTO products (
      id, tenant_id, unit_id, tax_id, name, description, sku, price, cost,
      price_with_tax, price_without_tax, is_active, requires_lot,
      operational_status, sale_type, measurement_unit,
      category_id, subcategory_id, created_at, updated_at
    ) VALUES (
      v_product, v_tenant, '10000000-0000-0000-0000-000000000001'::uuid, v_iva5, 'Ron medellin 8 años 750', 'Ron medellin 8 años 750', 'XLS-I-17817175040',
      102300.00, 81800.00,
      102300.00, 102300.00, TRUE, FALSE,
      'ACTIVE', 'UNIT', 'UND',
      'd62a28a9-32ac-4df5-ad91-142c14b0edd8'::uuid, '59469cae-477c-4263-b086-3883c987a82b'::uuid, NOW(), NOW()
    );
  END IF;
  IF v_product IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_product,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_icl, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_adv, 'calculation_order', 20),
        jsonb_build_object('tax_id', v_iva5, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_product,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000010'::uuid,
        'alcohol_degree', 35.000,
        'net_volume_ml', 750.000,
        'dane_certified_retail_price', 102300.00,
        'dane_price_effective_from', CURRENT_DATE::text,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva5, updated_at = NOW()
    WHERE id = v_product AND tenant_id = v_tenant;
  END IF;

  -- LIQUOR 7702049001644 / Aguardiente antioqueño verde 750ml
  v_product := NULL;
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-7702049001644'))
      OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('Aguardiente antioqueño verde 750ml'))
      OR UPPER(BTRIM(p.name)) LIKE '%' || UPPER(BTRIM('Aguardiente antioqueño verde 750ml')) || '%')
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    v_product := v_matched;
  ELSIF NOT EXISTS (
    SELECT 1 FROM products
    WHERE tenant_id = v_tenant AND UPPER(BTRIM(sku)) = UPPER(BTRIM('XLS-7702049001644'))
  ) THEN
    v_product := '0ebce76b-9737-572a-97dd-a34470fb4de0'::uuid;
    INSERT INTO products (
      id, tenant_id, unit_id, tax_id, name, description, sku, price, cost,
      price_with_tax, price_without_tax, is_active, requires_lot,
      operational_status, sale_type, measurement_unit,
      category_id, subcategory_id, created_at, updated_at
    ) VALUES (
      v_product, v_tenant, '10000000-0000-0000-0000-000000000001'::uuid, v_iva5, 'Aguardiente antioqueño verde 750ml', 'Aguardiente antioqueño verde 750ml', 'XLS-7702049001644',
      59500.00, 43600.00,
      59500.00, 59500.00, TRUE, FALSE,
      'ACTIVE', 'UNIT', 'UND',
      'd62a28a9-32ac-4df5-ad91-142c14b0edd8'::uuid, '59469cae-477c-4263-b086-3883c987a82b'::uuid, NOW(), NOW()
    );
  END IF;
  IF v_product IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_product,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_icl, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_adv, 'calculation_order', 20),
        jsonb_build_object('tax_id', v_iva5, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_product,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000010'::uuid,
        'alcohol_degree', 29.000,
        'net_volume_ml', 750.000,
        'dane_certified_retail_price', 59500.00,
        'dane_price_effective_from', CURRENT_DATE::text,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva5, updated_at = NOW()
    WHERE id = v_product AND tenant_id = v_tenant;
  END IF;

  -- LIQUOR 7702049101191 / RON MEDELLIN DORADO 375ML
  v_product := NULL;
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-7702049101191'))
      OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('RON MEDELLIN DORADO 375ML'))
      OR UPPER(BTRIM(p.name)) LIKE '%' || UPPER(BTRIM('RON MEDELLIN DORADO 375ML')) || '%')
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    v_product := v_matched;
  ELSIF NOT EXISTS (
    SELECT 1 FROM products
    WHERE tenant_id = v_tenant AND UPPER(BTRIM(sku)) = UPPER(BTRIM('XLS-7702049101191'))
  ) THEN
    v_product := '25b0939e-9e57-5a7d-8099-2f681712b70e'::uuid;
    INSERT INTO products (
      id, tenant_id, unit_id, tax_id, name, description, sku, price, cost,
      price_with_tax, price_without_tax, is_active, requires_lot,
      operational_status, sale_type, measurement_unit,
      category_id, subcategory_id, created_at, updated_at
    ) VALUES (
      v_product, v_tenant, '10000000-0000-0000-0000-000000000001'::uuid, v_iva5, 'RON MEDELLIN DORADO 375ML', 'RON MEDELLIN DORADO 375ML', 'XLS-7702049101191',
      32000.00, 25600.00,
      32000.00, 32000.00, TRUE, FALSE,
      'ACTIVE', 'UNIT', 'UND',
      'd62a28a9-32ac-4df5-ad91-142c14b0edd8'::uuid, '59469cae-477c-4263-b086-3883c987a82b'::uuid, NOW(), NOW()
    );
  END IF;
  IF v_product IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_product,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_icl, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_adv, 'calculation_order', 20),
        jsonb_build_object('tax_id', v_iva5, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_product,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000010'::uuid,
        'alcohol_degree', 35.000,
        'net_volume_ml', 375.000,
        'dane_certified_retail_price', 32000.00,
        'dane_price_effective_from', CURRENT_DATE::text,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva5, updated_at = NOW()
    WHERE id = v_product AND tenant_id = v_tenant;
  END IF;

  -- LIQUOR 7702049000531 / Aguardiente antioqueño azul 750ml
  v_product := NULL;
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-7702049000531'))
      OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('Aguardiente antioqueño azul 750ml'))
      OR UPPER(BTRIM(p.name)) LIKE '%' || UPPER(BTRIM('Aguardiente antioqueño azul 750ml')) || '%')
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    v_product := v_matched;
  ELSIF NOT EXISTS (
    SELECT 1 FROM products
    WHERE tenant_id = v_tenant AND UPPER(BTRIM(sku)) = UPPER(BTRIM('XLS-7702049000531'))
  ) THEN
    v_product := '2b1d5d7d-f916-57b8-9f1e-d566809a9519'::uuid;
    INSERT INTO products (
      id, tenant_id, unit_id, tax_id, name, description, sku, price, cost,
      price_with_tax, price_without_tax, is_active, requires_lot,
      operational_status, sale_type, measurement_unit,
      category_id, subcategory_id, created_at, updated_at
    ) VALUES (
      v_product, v_tenant, '10000000-0000-0000-0000-000000000001'::uuid, v_iva5, 'Aguardiente antioqueño azul 750ml', 'Aguardiente antioqueño azul 750ml', 'XLS-7702049000531',
      61000.00, 48900.00,
      61000.00, 61000.00, TRUE, FALSE,
      'ACTIVE', 'UNIT', 'UND',
      'd62a28a9-32ac-4df5-ad91-142c14b0edd8'::uuid, '59469cae-477c-4263-b086-3883c987a82b'::uuid, NOW(), NOW()
    );
  END IF;
  IF v_product IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_product,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_icl, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_adv, 'calculation_order', 20),
        jsonb_build_object('tax_id', v_iva5, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_product,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000010'::uuid,
        'alcohol_degree', 29.000,
        'net_volume_ml', 750.000,
        'dane_certified_retail_price', 61000.00,
        'dane_price_effective_from', CURRENT_DATE::text,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva5, updated_at = NOW()
    WHERE id = v_product AND tenant_id = v_tenant;
  END IF;

  -- LIQUOR 7702168278477 / Aguardiente amarillo 750ml
  v_product := NULL;
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-7702168278477'))
      OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('Aguardiente amarillo 750ml'))
      OR UPPER(BTRIM(p.name)) LIKE '%' || UPPER(BTRIM('Aguardiente amarillo 750ml')) || '%')
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    v_product := v_matched;
  ELSIF NOT EXISTS (
    SELECT 1 FROM products
    WHERE tenant_id = v_tenant AND UPPER(BTRIM(sku)) = UPPER(BTRIM('XLS-7702168278477'))
  ) THEN
    v_product := '5959bd90-f0c0-55f9-9109-e2f8529cf9c0'::uuid;
    INSERT INTO products (
      id, tenant_id, unit_id, tax_id, name, description, sku, price, cost,
      price_with_tax, price_without_tax, is_active, requires_lot,
      operational_status, sale_type, measurement_unit,
      category_id, subcategory_id, created_at, updated_at
    ) VALUES (
      v_product, v_tenant, '10000000-0000-0000-0000-000000000001'::uuid, v_iva5, 'Aguardiente amarillo 750ml', 'Aguardiente amarillo 750ml', 'XLS-7702168278477',
      55000.00, 48774.00,
      55000.00, 55000.00, TRUE, FALSE,
      'ACTIVE', 'UNIT', 'UND',
      'd62a28a9-32ac-4df5-ad91-142c14b0edd8'::uuid, '59469cae-477c-4263-b086-3883c987a82b'::uuid, NOW(), NOW()
    );
  END IF;
  IF v_product IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_product,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_icl, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_adv, 'calculation_order', 20),
        jsonb_build_object('tax_id', v_iva5, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_product,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000010'::uuid,
        'alcohol_degree', 29.000,
        'net_volume_ml', 750.000,
        'dane_certified_retail_price', 55000.00,
        'dane_price_effective_from', CURRENT_DATE::text,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva5, updated_at = NOW()
    WHERE id = v_product AND tenant_id = v_tenant;
  END IF;

  -- LIQUOR 7702168420135 / Aguardiente amarrillo tetra 1000ml
  v_product := NULL;
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-7702168420135'))
      OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('Aguardiente amarrillo tetra 1000ml'))
      OR UPPER(BTRIM(p.name)) LIKE '%' || UPPER(BTRIM('Aguardiente amarrillo tetra 1000ml')) || '%')
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    v_product := v_matched;
  ELSIF NOT EXISTS (
    SELECT 1 FROM products
    WHERE tenant_id = v_tenant AND UPPER(BTRIM(sku)) = UPPER(BTRIM('XLS-7702168420135'))
  ) THEN
    v_product := 'a08b5449-d3af-5abf-8739-b6b6cfe44c7f'::uuid;
    INSERT INTO products (
      id, tenant_id, unit_id, tax_id, name, description, sku, price, cost,
      price_with_tax, price_without_tax, is_active, requires_lot,
      operational_status, sale_type, measurement_unit,
      category_id, subcategory_id, created_at, updated_at
    ) VALUES (
      v_product, v_tenant, '10000000-0000-0000-0000-000000000001'::uuid, v_iva5, 'Aguardiente amarrillo tetra 1000ml', 'Aguardiente amarrillo tetra 1000ml', 'XLS-7702168420135',
      60000.00, 52643.00,
      60000.00, 60000.00, TRUE, FALSE,
      'ACTIVE', 'UNIT', 'UND',
      'd62a28a9-32ac-4df5-ad91-142c14b0edd8'::uuid, '59469cae-477c-4263-b086-3883c987a82b'::uuid, NOW(), NOW()
    );
  END IF;
  IF v_product IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_product,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_icl, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_adv, 'calculation_order', 20),
        jsonb_build_object('tax_id', v_iva5, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_product,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000010'::uuid,
        'alcohol_degree', 29.000,
        'net_volume_ml', 1000.000,
        'dane_certified_retail_price', 60000.00,
        'dane_price_effective_from', CURRENT_DATE::text,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva5, updated_at = NOW()
    WHERE id = v_product AND tenant_id = v_tenant;
  END IF;

  -- LIQUOR 7702168594300 / Aguardiente amarillo 375ml
  v_product := NULL;
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-7702168594300'))
      OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('Aguardiente amarillo 375ml'))
      OR UPPER(BTRIM(p.name)) LIKE '%' || UPPER(BTRIM('Aguardiente amarillo 375ml')) || '%')
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    v_product := v_matched;
  ELSIF NOT EXISTS (
    SELECT 1 FROM products
    WHERE tenant_id = v_tenant AND UPPER(BTRIM(sku)) = UPPER(BTRIM('XLS-7702168594300'))
  ) THEN
    v_product := '74c79101-f97a-5ad6-b196-5e0fd8945a4f'::uuid;
    INSERT INTO products (
      id, tenant_id, unit_id, tax_id, name, description, sku, price, cost,
      price_with_tax, price_without_tax, is_active, requires_lot,
      operational_status, sale_type, measurement_unit,
      category_id, subcategory_id, created_at, updated_at
    ) VALUES (
      v_product, v_tenant, '10000000-0000-0000-0000-000000000001'::uuid, v_iva5, 'Aguardiente amarillo 375ml', 'Aguardiente amarillo 375ml', 'XLS-7702168594300',
      30000.00, 25600.00,
      30000.00, 30000.00, TRUE, FALSE,
      'ACTIVE', 'UNIT', 'UND',
      'd62a28a9-32ac-4df5-ad91-142c14b0edd8'::uuid, '59469cae-477c-4263-b086-3883c987a82b'::uuid, NOW(), NOW()
    );
  END IF;
  IF v_product IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_product,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_icl, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_adv, 'calculation_order', 20),
        jsonb_build_object('tax_id', v_iva5, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_product,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000010'::uuid,
        'alcohol_degree', 29.000,
        'net_volume_ml', 375.000,
        'dane_certified_retail_price', 30000.00,
        'dane_price_effective_from', CURRENT_DATE::text,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva5, updated_at = NOW()
    WHERE id = v_product AND tenant_id = v_tenant;
  END IF;

  -- LIQUOR 7702168364231 / Ron esencial 750ml
  v_product := NULL;
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-7702168364231'))
      OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('Ron esencial 750ml'))
      OR UPPER(BTRIM(p.name)) LIKE '%' || UPPER(BTRIM('Ron esencial 750ml')) || '%')
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    v_product := v_matched;
  ELSIF NOT EXISTS (
    SELECT 1 FROM products
    WHERE tenant_id = v_tenant AND UPPER(BTRIM(sku)) = UPPER(BTRIM('XLS-7702168364231'))
  ) THEN
    v_product := '07533ba3-059d-594d-a765-4cf961737a51'::uuid;
    INSERT INTO products (
      id, tenant_id, unit_id, tax_id, name, description, sku, price, cost,
      price_with_tax, price_without_tax, is_active, requires_lot,
      operational_status, sale_type, measurement_unit,
      category_id, subcategory_id, created_at, updated_at
    ) VALUES (
      v_product, v_tenant, '10000000-0000-0000-0000-000000000001'::uuid, v_iva5, 'Ron esencial 750ml', 'Ron esencial 750ml', 'XLS-7702168364231',
      48000.00, 38500.00,
      48000.00, 48000.00, TRUE, FALSE,
      'ACTIVE', 'UNIT', 'UND',
      'd62a28a9-32ac-4df5-ad91-142c14b0edd8'::uuid, '59469cae-477c-4263-b086-3883c987a82b'::uuid, NOW(), NOW()
    );
  END IF;
  IF v_product IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_product,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_icl, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_adv, 'calculation_order', 20),
        jsonb_build_object('tax_id', v_iva5, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_product,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000010'::uuid,
        'alcohol_degree', 35.000,
        'net_volume_ml', 750.000,
        'dane_certified_retail_price', 48000.00,
        'dane_price_effective_from', CURRENT_DATE::text,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva5, updated_at = NOW()
    WHERE id = v_product AND tenant_id = v_tenant;
  END IF;

  -- LIQUOR 7702168217308 / Ron viejo de calda 750ml
  v_product := NULL;
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-7702168217308'))
      OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('Ron viejo de calda 750ml'))
      OR UPPER(BTRIM(p.name)) LIKE '%' || UPPER(BTRIM('Ron viejo de calda 750ml')) || '%')
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    v_product := v_matched;
  ELSIF NOT EXISTS (
    SELECT 1 FROM products
    WHERE tenant_id = v_tenant AND UPPER(BTRIM(sku)) = UPPER(BTRIM('XLS-7702168217308'))
  ) THEN
    v_product := '4ae3c840-a341-595f-9ae5-42e07d2a218a'::uuid;
    INSERT INTO products (
      id, tenant_id, unit_id, tax_id, name, description, sku, price, cost,
      price_with_tax, price_without_tax, is_active, requires_lot,
      operational_status, sale_type, measurement_unit,
      category_id, subcategory_id, created_at, updated_at
    ) VALUES (
      v_product, v_tenant, '10000000-0000-0000-0000-000000000001'::uuid, v_iva5, 'Ron viejo de calda 750ml', 'Ron viejo de calda 750ml', 'XLS-7702168217308',
      63000.00, 50800.00,
      63000.00, 63000.00, TRUE, FALSE,
      'ACTIVE', 'UNIT', 'UND',
      'd62a28a9-32ac-4df5-ad91-142c14b0edd8'::uuid, '59469cae-477c-4263-b086-3883c987a82b'::uuid, NOW(), NOW()
    );
  END IF;
  IF v_product IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_product,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_icl, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_adv, 'calculation_order', 20),
        jsonb_build_object('tax_id', v_iva5, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_product,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000010'::uuid,
        'alcohol_degree', 35.000,
        'net_volume_ml', 750.000,
        'dane_certified_retail_price', 63000.00,
        'dane_price_effective_from', CURRENT_DATE::text,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva5, updated_at = NOW()
    WHERE id = v_product AND tenant_id = v_tenant;
  END IF;

  -- LIQUOR 7702168214000 / Ron viejo de calda 375ml
  v_product := NULL;
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-7702168214000'))
      OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('Ron viejo de calda 375ml'))
      OR UPPER(BTRIM(p.name)) LIKE '%' || UPPER(BTRIM('Ron viejo de calda 375ml')) || '%')
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    v_product := v_matched;
  ELSIF NOT EXISTS (
    SELECT 1 FROM products
    WHERE tenant_id = v_tenant AND UPPER(BTRIM(sku)) = UPPER(BTRIM('XLS-7702168214000'))
  ) THEN
    v_product := 'b074e93b-9a4d-58c6-884a-5d8382bd9836'::uuid;
    INSERT INTO products (
      id, tenant_id, unit_id, tax_id, name, description, sku, price, cost,
      price_with_tax, price_without_tax, is_active, requires_lot,
      operational_status, sale_type, measurement_unit,
      category_id, subcategory_id, created_at, updated_at
    ) VALUES (
      v_product, v_tenant, '10000000-0000-0000-0000-000000000001'::uuid, v_iva5, 'Ron viejo de calda 375ml', 'Ron viejo de calda 375ml', 'XLS-7702168214000',
      32600.00, 26054.00,
      32600.00, 32600.00, TRUE, FALSE,
      'ACTIVE', 'UNIT', 'UND',
      'd62a28a9-32ac-4df5-ad91-142c14b0edd8'::uuid, '59469cae-477c-4263-b086-3883c987a82b'::uuid, NOW(), NOW()
    );
  END IF;
  IF v_product IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_product,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_icl, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_adv, 'calculation_order', 20),
        jsonb_build_object('tax_id', v_iva5, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_product,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000010'::uuid,
        'alcohol_degree', 35.000,
        'net_volume_ml', 375.000,
        'dane_certified_retail_price', 32600.00,
        'dane_price_effective_from', CURRENT_DATE::text,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva5, updated_at = NOW()
    WHERE id = v_product AND tenant_id = v_tenant;
  END IF;

  -- LIQUOR 7702168239201 / Ron juan cruz 750ml
  v_product := NULL;
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-7702168239201'))
      OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('Ron juan cruz 750ml'))
      OR UPPER(BTRIM(p.name)) LIKE '%' || UPPER(BTRIM('Ron juan cruz 750ml')) || '%')
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    v_product := v_matched;
  ELSIF NOT EXISTS (
    SELECT 1 FROM products
    WHERE tenant_id = v_tenant AND UPPER(BTRIM(sku)) = UPPER(BTRIM('XLS-7702168239201'))
  ) THEN
    v_product := '3e1bb420-6aa5-5784-be4a-a7d901049640'::uuid;
    INSERT INTO products (
      id, tenant_id, unit_id, tax_id, name, description, sku, price, cost,
      price_with_tax, price_without_tax, is_active, requires_lot,
      operational_status, sale_type, measurement_unit,
      category_id, subcategory_id, created_at, updated_at
    ) VALUES (
      v_product, v_tenant, '10000000-0000-0000-0000-000000000001'::uuid, v_iva5, 'Ron juan cruz 750ml', 'Ron juan cruz 750ml', 'XLS-7702168239201',
      82400.00, 65658.00,
      82400.00, 82400.00, TRUE, FALSE,
      'ACTIVE', 'UNIT', 'UND',
      'd62a28a9-32ac-4df5-ad91-142c14b0edd8'::uuid, '59469cae-477c-4263-b086-3883c987a82b'::uuid, NOW(), NOW()
    );
  END IF;
  IF v_product IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_product,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_icl, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_adv, 'calculation_order', 20),
        jsonb_build_object('tax_id', v_iva5, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_product,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000010'::uuid,
        'alcohol_degree', 35.000,
        'net_volume_ml', 750.000,
        'dane_certified_retail_price', 82400.00,
        'dane_price_effective_from', CURRENT_DATE::text,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva5, updated_at = NOW()
    WHERE id = v_product AND tenant_id = v_tenant;
  END IF;

  -- LIQUOR 7702168117400 / Aguardiente cristal xs verde
  v_product := NULL;
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-7702168117400'))
      OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('Aguardiente cristal xs verde'))
      OR UPPER(BTRIM(p.name)) LIKE '%' || UPPER(BTRIM('Aguardiente cristal xs verde')) || '%')
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    v_product := v_matched;
  ELSIF NOT EXISTS (
    SELECT 1 FROM products
    WHERE tenant_id = v_tenant AND UPPER(BTRIM(sku)) = UPPER(BTRIM('XLS-7702168117400'))
  ) THEN
    v_product := '5b619296-2fc0-56f8-abd5-bbb6a38eb272'::uuid;
    INSERT INTO products (
      id, tenant_id, unit_id, tax_id, name, description, sku, price, cost,
      price_with_tax, price_without_tax, is_active, requires_lot,
      operational_status, sale_type, measurement_unit,
      category_id, subcategory_id, created_at, updated_at
    ) VALUES (
      v_product, v_tenant, '10000000-0000-0000-0000-000000000001'::uuid, v_iva5, 'Aguardiente cristal xs verde', 'Aguardiente cristal xs verde', 'XLS-7702168117400',
      44900.00, 36000.00,
      44900.00, 44900.00, TRUE, FALSE,
      'ACTIVE', 'UNIT', 'UND',
      'd62a28a9-32ac-4df5-ad91-142c14b0edd8'::uuid, '59469cae-477c-4263-b086-3883c987a82b'::uuid, NOW(), NOW()
    );
  END IF;
  IF v_product IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_product,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_icl, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_adv, 'calculation_order', 20),
        jsonb_build_object('tax_id', v_iva5, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_product,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000010'::uuid,
        'alcohol_degree', 29.000,
        'net_volume_ml', 750.000,
        'dane_certified_retail_price', 44900.00,
        'dane_price_effective_from', CURRENT_DATE::text,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva5, updated_at = NOW()
    WHERE id = v_product AND tenant_id = v_tenant;
  END IF;

  -- LIQUOR 7702354958190 / Los cuates tequila margarita limon 269ml unida
  v_product := NULL;
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-7702354958190'))
      OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('Los cuates tequila margarita limon 269ml unida'))
      OR UPPER(BTRIM(p.name)) LIKE '%' || UPPER(BTRIM('Los cuates tequila margarita limon 269ml unida')) || '%')
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    v_product := v_matched;
  ELSIF NOT EXISTS (
    SELECT 1 FROM products
    WHERE tenant_id = v_tenant AND UPPER(BTRIM(sku)) = UPPER(BTRIM('XLS-7702354958190'))
  ) THEN
    v_product := '6470032a-ee13-56ae-a73e-c542b63cb487'::uuid;
    INSERT INTO products (
      id, tenant_id, unit_id, tax_id, name, description, sku, price, cost,
      price_with_tax, price_without_tax, is_active, requires_lot,
      operational_status, sale_type, measurement_unit,
      category_id, subcategory_id, created_at, updated_at
    ) VALUES (
      v_product, v_tenant, '10000000-0000-0000-0000-000000000001'::uuid, v_iva5, 'Los cuates tequila margarita limon 269ml unida', 'Los cuates tequila margarita limon 269ml unida', 'XLS-7702354958190',
      5000.00, 4100.00,
      5000.00, 5000.00, TRUE, FALSE,
      'ACTIVE', 'UNIT', 'UND',
      'd62a28a9-32ac-4df5-ad91-142c14b0edd8'::uuid, '59469cae-477c-4263-b086-3883c987a82b'::uuid, NOW(), NOW()
    );
  END IF;
  IF v_product IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_product,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_icl, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_adv, 'calculation_order', 20),
        jsonb_build_object('tax_id', v_iva5, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_product,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000010'::uuid,
        'alcohol_degree', 29.000,
        'net_volume_ml', 269.000,
        'dane_certified_retail_price', 5000.00,
        'dane_price_effective_from', CURRENT_DATE::text,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva5, updated_at = NOW()
    WHERE id = v_product AND tenant_id = v_tenant;
  END IF;

  -- LIQUOR 7501035010109 / Tequila jose cuervo reposdo 750ml
  v_product := NULL;
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-7501035010109'))
      OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('Tequila jose cuervo reposdo 750ml'))
      OR UPPER(BTRIM(p.name)) LIKE '%' || UPPER(BTRIM('Tequila jose cuervo reposdo 750ml')) || '%')
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    v_product := v_matched;
  ELSIF NOT EXISTS (
    SELECT 1 FROM products
    WHERE tenant_id = v_tenant AND UPPER(BTRIM(sku)) = UPPER(BTRIM('XLS-7501035010109'))
  ) THEN
    v_product := 'c3c8052a-bf02-59dd-b6aa-4060f52f0c71'::uuid;
    INSERT INTO products (
      id, tenant_id, unit_id, tax_id, name, description, sku, price, cost,
      price_with_tax, price_without_tax, is_active, requires_lot,
      operational_status, sale_type, measurement_unit,
      category_id, subcategory_id, created_at, updated_at
    ) VALUES (
      v_product, v_tenant, '10000000-0000-0000-0000-000000000001'::uuid, v_iva5, 'Tequila jose cuervo reposdo 750ml', 'Tequila jose cuervo reposdo 750ml', 'XLS-7501035010109',
      94800.00, 75839.00,
      94800.00, 94800.00, TRUE, FALSE,
      'ACTIVE', 'UNIT', 'UND',
      'd62a28a9-32ac-4df5-ad91-142c14b0edd8'::uuid, '59469cae-477c-4263-b086-3883c987a82b'::uuid, NOW(), NOW()
    );
  END IF;
  IF v_product IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_product,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_icl, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_adv, 'calculation_order', 20),
        jsonb_build_object('tax_id', v_iva5, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_product,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000010'::uuid,
        'alcohol_degree', 29.000,
        'net_volume_ml', 750.000,
        'dane_certified_retail_price', 94800.00,
        'dane_price_effective_from', CURRENT_DATE::text,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva5, updated_at = NOW()
    WHERE id = v_product AND tenant_id = v_tenant;
  END IF;

  -- LIQUOR 7501035011335 / Tequila jose cuervo silver 750ml
  v_product := NULL;
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-7501035011335'))
      OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('Tequila jose cuervo silver 750ml'))
      OR UPPER(BTRIM(p.name)) LIKE '%' || UPPER(BTRIM('Tequila jose cuervo silver 750ml')) || '%')
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    v_product := v_matched;
  ELSIF NOT EXISTS (
    SELECT 1 FROM products
    WHERE tenant_id = v_tenant AND UPPER(BTRIM(sku)) = UPPER(BTRIM('XLS-7501035011335'))
  ) THEN
    v_product := 'e4bcfd1c-4403-53d0-a6ec-12710642e8bf'::uuid;
    INSERT INTO products (
      id, tenant_id, unit_id, tax_id, name, description, sku, price, cost,
      price_with_tax, price_without_tax, is_active, requires_lot,
      operational_status, sale_type, measurement_unit,
      category_id, subcategory_id, created_at, updated_at
    ) VALUES (
      v_product, v_tenant, '10000000-0000-0000-0000-000000000001'::uuid, v_iva5, 'Tequila jose cuervo silver 750ml', 'Tequila jose cuervo silver 750ml', 'XLS-7501035011335',
      101500.00, 81170.00,
      101500.00, 101500.00, TRUE, FALSE,
      'ACTIVE', 'UNIT', 'UND',
      'd62a28a9-32ac-4df5-ad91-142c14b0edd8'::uuid, '59469cae-477c-4263-b086-3883c987a82b'::uuid, NOW(), NOW()
    );
  END IF;
  IF v_product IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_product,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_icl, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_adv, 'calculation_order', 20),
        jsonb_build_object('tax_id', v_iva5, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_product,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000010'::uuid,
        'alcohol_degree', 29.000,
        'net_volume_ml', 750.000,
        'dane_certified_retail_price', 101500.00,
        'dane_price_effective_from', CURRENT_DATE::text,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva5, updated_at = NOW()
    WHERE id = v_product AND tenant_id = v_tenant;
  END IF;

  -- LIQUOR 7501035013230 / Tequila reserva silver 1800 750ml
  v_product := NULL;
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-7501035013230'))
      OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('Tequila reserva silver 1800 750ml'))
      OR UPPER(BTRIM(p.name)) LIKE '%' || UPPER(BTRIM('Tequila reserva silver 1800 750ml')) || '%')
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    v_product := v_matched;
  ELSIF NOT EXISTS (
    SELECT 1 FROM products
    WHERE tenant_id = v_tenant AND UPPER(BTRIM(sku)) = UPPER(BTRIM('XLS-7501035013230'))
  ) THEN
    v_product := 'd98ac956-e604-599a-95d3-dc2b521665d6'::uuid;
    INSERT INTO products (
      id, tenant_id, unit_id, tax_id, name, description, sku, price, cost,
      price_with_tax, price_without_tax, is_active, requires_lot,
      operational_status, sale_type, measurement_unit,
      category_id, subcategory_id, created_at, updated_at
    ) VALUES (
      v_product, v_tenant, '10000000-0000-0000-0000-000000000001'::uuid, v_iva5, 'Tequila reserva silver 1800 750ml', 'Tequila reserva silver 1800 750ml', 'XLS-7501035013230',
      230000.00, 184080.00,
      230000.00, 230000.00, TRUE, FALSE,
      'ACTIVE', 'UNIT', 'UND',
      'd62a28a9-32ac-4df5-ad91-142c14b0edd8'::uuid, '59469cae-477c-4263-b086-3883c987a82b'::uuid, NOW(), NOW()
    );
  END IF;
  IF v_product IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_product,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_icl, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_adv, 'calculation_order', 20),
        jsonb_build_object('tax_id', v_iva5, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_product,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000010'::uuid,
        'alcohol_degree', 29.000,
        'net_volume_ml', 750.000,
        'dane_certified_retail_price', 230000.00,
        'dane_price_effective_from', CURRENT_DATE::text,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva5, updated_at = NOW()
    WHERE id = v_product AND tenant_id = v_tenant;
  END IF;

  -- LIQUOR 082184090473 / Whisky jack daniel  tennessee sour mash 700ml
  v_product := NULL;
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-082184090473'))
      OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('Whisky jack daniel  tennessee sour mash 700ml'))
      OR UPPER(BTRIM(p.name)) LIKE '%' || UPPER(BTRIM('Whisky jack daniel  tennessee sour mash 700ml')) || '%')
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    v_product := v_matched;
  ELSIF NOT EXISTS (
    SELECT 1 FROM products
    WHERE tenant_id = v_tenant AND UPPER(BTRIM(sku)) = UPPER(BTRIM('XLS-082184090473'))
  ) THEN
    v_product := 'b273b143-cab7-5eb2-b8e4-e138d0b8f396'::uuid;
    INSERT INTO products (
      id, tenant_id, unit_id, tax_id, name, description, sku, price, cost,
      price_with_tax, price_without_tax, is_active, requires_lot,
      operational_status, sale_type, measurement_unit,
      category_id, subcategory_id, created_at, updated_at
    ) VALUES (
      v_product, v_tenant, '10000000-0000-0000-0000-000000000001'::uuid, v_iva5, 'Whisky jack daniel  tennessee sour mash 700ml', 'Whisky jack daniel  tennessee sour mash 700ml', 'XLS-082184090473',
      130000.00, 104064.00,
      130000.00, 130000.00, TRUE, FALSE,
      'ACTIVE', 'UNIT', 'UND',
      'd62a28a9-32ac-4df5-ad91-142c14b0edd8'::uuid, '7fd6dac4-6a98-4cda-822f-332ff15c791e'::uuid, NOW(), NOW()
    );
  END IF;
  IF v_product IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_product,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_icl, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_adv, 'calculation_order', 20),
        jsonb_build_object('tax_id', v_iva5, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_product,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000010'::uuid,
        'alcohol_degree', 40.000,
        'net_volume_ml', 700.000,
        'dane_certified_retail_price', 130000.00,
        'dane_price_effective_from', CURRENT_DATE::text,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva5, updated_at = NOW()
    WHERE id = v_product AND tenant_id = v_tenant;
  END IF;

  -- LIQUOR 5099873001370 / Whisky jack daniel honey 700ml
  v_product := NULL;
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-5099873001370'))
      OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('Whisky jack daniel honey 700ml'))
      OR UPPER(BTRIM(p.name)) LIKE '%' || UPPER(BTRIM('Whisky jack daniel honey 700ml')) || '%')
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    v_product := v_matched;
  ELSIF NOT EXISTS (
    SELECT 1 FROM products
    WHERE tenant_id = v_tenant AND UPPER(BTRIM(sku)) = UPPER(BTRIM('XLS-5099873001370'))
  ) THEN
    v_product := '15d75856-bf6a-5e30-8f3a-69ad9b15108e'::uuid;
    INSERT INTO products (
      id, tenant_id, unit_id, tax_id, name, description, sku, price, cost,
      price_with_tax, price_without_tax, is_active, requires_lot,
      operational_status, sale_type, measurement_unit,
      category_id, subcategory_id, created_at, updated_at
    ) VALUES (
      v_product, v_tenant, '10000000-0000-0000-0000-000000000001'::uuid, v_iva5, 'Whisky jack daniel honey 700ml', 'Whisky jack daniel honey 700ml', 'XLS-5099873001370',
      130000.00, 104209.00,
      130000.00, 130000.00, TRUE, FALSE,
      'ACTIVE', 'UNIT', 'UND',
      'd62a28a9-32ac-4df5-ad91-142c14b0edd8'::uuid, '7fd6dac4-6a98-4cda-822f-332ff15c791e'::uuid, NOW(), NOW()
    );
  END IF;
  IF v_product IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_product,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_icl, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_adv, 'calculation_order', 20),
        jsonb_build_object('tax_id', v_iva5, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_product,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000010'::uuid,
        'alcohol_degree', 40.000,
        'net_volume_ml', 700.000,
        'dane_certified_retail_price', 130000.00,
        'dane_price_effective_from', CURRENT_DATE::text,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva5, updated_at = NOW()
    WHERE id = v_product AND tenant_id = v_tenant;
  END IF;

  -- LIQUOR 5010314700003 / Whisky the famous grouse 700ml
  v_product := NULL;
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-5010314700003'))
      OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('Whisky the famous grouse 700ml'))
      OR UPPER(BTRIM(p.name)) LIKE '%' || UPPER(BTRIM('Whisky the famous grouse 700ml')) || '%')
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    v_product := v_matched;
  ELSIF NOT EXISTS (
    SELECT 1 FROM products
    WHERE tenant_id = v_tenant AND UPPER(BTRIM(sku)) = UPPER(BTRIM('XLS-5010314700003'))
  ) THEN
    v_product := 'b42e11ac-0bba-5c6e-a449-77735a1a836a'::uuid;
    INSERT INTO products (
      id, tenant_id, unit_id, tax_id, name, description, sku, price, cost,
      price_with_tax, price_without_tax, is_active, requires_lot,
      operational_status, sale_type, measurement_unit,
      category_id, subcategory_id, created_at, updated_at
    ) VALUES (
      v_product, v_tenant, '10000000-0000-0000-0000-000000000001'::uuid, v_iva5, 'Whisky the famous grouse 700ml', 'Whisky the famous grouse 700ml', 'XLS-5010314700003',
      79000.00, 63233.00,
      79000.00, 79000.00, TRUE, FALSE,
      'ACTIVE', 'UNIT', 'UND',
      'd62a28a9-32ac-4df5-ad91-142c14b0edd8'::uuid, '7fd6dac4-6a98-4cda-822f-332ff15c791e'::uuid, NOW(), NOW()
    );
  END IF;
  IF v_product IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_product,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_icl, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_adv, 'calculation_order', 20),
        jsonb_build_object('tax_id', v_iva5, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_product,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000010'::uuid,
        'alcohol_degree', 40.000,
        'net_volume_ml', 700.000,
        'dane_certified_retail_price', 79000.00,
        'dane_price_effective_from', CURRENT_DATE::text,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva5, updated_at = NOW()
    WHERE id = v_product AND tenant_id = v_tenant;
  END IF;

  -- LIQUOR I-17824271250 / Ron bacardi mojito 750ml
  v_product := NULL;
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-I-17824271250'))
      OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('Ron bacardi mojito 750ml'))
      OR UPPER(BTRIM(p.name)) LIKE '%' || UPPER(BTRIM('Ron bacardi mojito 750ml')) || '%')
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    v_product := v_matched;
  ELSIF NOT EXISTS (
    SELECT 1 FROM products
    WHERE tenant_id = v_tenant AND UPPER(BTRIM(sku)) = UPPER(BTRIM('XLS-I-17824271250'))
  ) THEN
    v_product := 'b93aaf10-9a97-5977-8f9d-ad9b604e76b9'::uuid;
    INSERT INTO products (
      id, tenant_id, unit_id, tax_id, name, description, sku, price, cost,
      price_with_tax, price_without_tax, is_active, requires_lot,
      operational_status, sale_type, measurement_unit,
      category_id, subcategory_id, created_at, updated_at
    ) VALUES (
      v_product, v_tenant, '10000000-0000-0000-0000-000000000001'::uuid, v_iva5, 'Ron bacardi mojito 750ml', 'Ron bacardi mojito 750ml', 'XLS-I-17824271250',
      52000.00, 40989.00,
      52000.00, 52000.00, TRUE, FALSE,
      'ACTIVE', 'UNIT', 'UND',
      'd62a28a9-32ac-4df5-ad91-142c14b0edd8'::uuid, '59469cae-477c-4263-b086-3883c987a82b'::uuid, NOW(), NOW()
    );
  END IF;
  IF v_product IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_product,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_icl, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_adv, 'calculation_order', 20),
        jsonb_build_object('tax_id', v_iva5, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_product,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000010'::uuid,
        'alcohol_degree', 35.000,
        'net_volume_ml', 750.000,
        'dane_certified_retail_price', 52000.00,
        'dane_price_effective_from', CURRENT_DATE::text,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva5, updated_at = NOW()
    WHERE id = v_product AND tenant_id = v_tenant;
  END IF;

  -- LIQUOR 7610113024942 / Ron bacardi carta blanca superior 700ml
  v_product := NULL;
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-7610113024942'))
      OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('Ron bacardi carta blanca superior 700ml'))
      OR UPPER(BTRIM(p.name)) LIKE '%' || UPPER(BTRIM('Ron bacardi carta blanca superior 700ml')) || '%')
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    v_product := v_matched;
  ELSIF NOT EXISTS (
    SELECT 1 FROM products
    WHERE tenant_id = v_tenant AND UPPER(BTRIM(sku)) = UPPER(BTRIM('XLS-7610113024942'))
  ) THEN
    v_product := '924a8526-df1d-5bed-b245-169ca8c60f8b'::uuid;
    INSERT INTO products (
      id, tenant_id, unit_id, tax_id, name, description, sku, price, cost,
      price_with_tax, price_without_tax, is_active, requires_lot,
      operational_status, sale_type, measurement_unit,
      category_id, subcategory_id, created_at, updated_at
    ) VALUES (
      v_product, v_tenant, '10000000-0000-0000-0000-000000000001'::uuid, v_iva5, 'Ron bacardi carta blanca superior 700ml', 'Ron bacardi carta blanca superior 700ml', 'XLS-7610113024942',
      62000.00, 49080.00,
      62000.00, 62000.00, TRUE, FALSE,
      'ACTIVE', 'UNIT', 'UND',
      'd62a28a9-32ac-4df5-ad91-142c14b0edd8'::uuid, '59469cae-477c-4263-b086-3883c987a82b'::uuid, NOW(), NOW()
    );
  END IF;
  IF v_product IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_product,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_icl, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_adv, 'calculation_order', 20),
        jsonb_build_object('tax_id', v_iva5, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_product,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000010'::uuid,
        'alcohol_degree', 35.000,
        'net_volume_ml', 700.000,
        'dane_certified_retail_price', 62000.00,
        'dane_price_effective_from', CURRENT_DATE::text,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva5, updated_at = NOW()
    WHERE id = v_product AND tenant_id = v_tenant;
  END IF;

  -- LIQUOR 764009055361 / Smirnoff spicy tamarindo lata 350ml 1 unidad
  v_product := NULL;
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-764009055361'))
      OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('Smirnoff spicy tamarindo lata 350ml 1 unidad'))
      OR UPPER(BTRIM(p.name)) LIKE '%' || UPPER(BTRIM('Smirnoff spicy tamarindo lata 350ml 1 unidad')) || '%')
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    v_product := v_matched;
  ELSIF NOT EXISTS (
    SELECT 1 FROM products
    WHERE tenant_id = v_tenant AND UPPER(BTRIM(sku)) = UPPER(BTRIM('XLS-764009055361'))
  ) THEN
    v_product := '1911cab7-4562-5d0d-8f5d-17994e649142'::uuid;
    INSERT INTO products (
      id, tenant_id, unit_id, tax_id, name, description, sku, price, cost,
      price_with_tax, price_without_tax, is_active, requires_lot,
      operational_status, sale_type, measurement_unit,
      category_id, subcategory_id, created_at, updated_at
    ) VALUES (
      v_product, v_tenant, '10000000-0000-0000-0000-000000000001'::uuid, v_iva5, 'Smirnoff spicy tamarindo lata 350ml 1 unidad', 'Smirnoff spicy tamarindo lata 350ml 1 unidad', 'XLS-764009055361',
      10500.00, 8260.00,
      10500.00, 10500.00, TRUE, FALSE,
      'ACTIVE', 'UNIT', 'UND',
      'd62a28a9-32ac-4df5-ad91-142c14b0edd8'::uuid, '59469cae-477c-4263-b086-3883c987a82b'::uuid, NOW(), NOW()
    );
  END IF;
  IF v_product IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_product,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_icl, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_adv, 'calculation_order', 20),
        jsonb_build_object('tax_id', v_iva5, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_product,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000010'::uuid,
        'alcohol_degree', 29.000,
        'net_volume_ml', 350.000,
        'dane_certified_retail_price', 10500.00,
        'dane_price_effective_from', CURRENT_DATE::text,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva5, updated_at = NOW()
    WHERE id = v_product AND tenant_id = v_tenant;
  END IF;

  -- LIQUOR 5000299609347 / The glenlivet  founder,reserve
  v_product := NULL;
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-5000299609347'))
      OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('The glenlivet  founder,reserve'))
      OR UPPER(BTRIM(p.name)) LIKE '%' || UPPER(BTRIM('The glenlivet  founder,reserve')) || '%')
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    v_product := v_matched;
  ELSIF NOT EXISTS (
    SELECT 1 FROM products
    WHERE tenant_id = v_tenant AND UPPER(BTRIM(sku)) = UPPER(BTRIM('XLS-5000299609347'))
  ) THEN
    v_product := 'd34a2905-4385-5334-a211-76c1d3738f83'::uuid;
    INSERT INTO products (
      id, tenant_id, unit_id, tax_id, name, description, sku, price, cost,
      price_with_tax, price_without_tax, is_active, requires_lot,
      operational_status, sale_type, measurement_unit,
      category_id, subcategory_id, created_at, updated_at
    ) VALUES (
      v_product, v_tenant, '10000000-0000-0000-0000-000000000001'::uuid, v_iva5, 'The glenlivet  founder,reserve', 'The glenlivet  founder,reserve', 'XLS-5000299609347',
      174873.00, 139899.00,
      174873.00, 174873.00, TRUE, FALSE,
      'ACTIVE', 'UNIT', 'UND',
      'd62a28a9-32ac-4df5-ad91-142c14b0edd8'::uuid, '59469cae-477c-4263-b086-3883c987a82b'::uuid, NOW(), NOW()
    );
  END IF;
  IF v_product IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_product,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_icl, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_adv, 'calculation_order', 20),
        jsonb_build_object('tax_id', v_iva5, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_product,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000010'::uuid,
        'alcohol_degree', 29.000,
        'net_volume_ml', 750.000,
        'dane_certified_retail_price', 174873.00,
        'dane_price_effective_from', CURRENT_DATE::text,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva5, updated_at = NOW()
    WHERE id = v_product AND tenant_id = v_tenant;
  END IF;

  -- LIQUOR I-17829470540 / Ron medellin 3 años bot lt
  v_product := NULL;
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-I-17829470540'))
      OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('Ron medellin 3 años bot lt'))
      OR UPPER(BTRIM(p.name)) LIKE '%' || UPPER(BTRIM('Ron medellin 3 años bot lt')) || '%')
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    v_product := v_matched;
  ELSIF NOT EXISTS (
    SELECT 1 FROM products
    WHERE tenant_id = v_tenant AND UPPER(BTRIM(sku)) = UPPER(BTRIM('XLS-I-17829470540'))
  ) THEN
    v_product := 'd3078d4d-352e-52c1-8939-b5e6c92ec90c'::uuid;
    INSERT INTO products (
      id, tenant_id, unit_id, tax_id, name, description, sku, price, cost,
      price_with_tax, price_without_tax, is_active, requires_lot,
      operational_status, sale_type, measurement_unit,
      category_id, subcategory_id, created_at, updated_at
    ) VALUES (
      v_product, v_tenant, '10000000-0000-0000-0000-000000000001'::uuid, v_iva5, 'Ron medellin 3 años bot lt', 'Ron medellin 3 años bot lt', 'XLS-I-17829470540',
      83000.00, 66200.00,
      83000.00, 83000.00, TRUE, FALSE,
      'ACTIVE', 'UNIT', 'UND',
      'd62a28a9-32ac-4df5-ad91-142c14b0edd8'::uuid, '59469cae-477c-4263-b086-3883c987a82b'::uuid, NOW(), NOW()
    );
  END IF;
  IF v_product IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_product,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_icl, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_adv, 'calculation_order', 20),
        jsonb_build_object('tax_id', v_iva5, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_product,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000010'::uuid,
        'alcohol_degree', 35.000,
        'net_volume_ml', 750.000,
        'dane_certified_retail_price', 83000.00,
        'dane_price_effective_from', CURRENT_DATE::text,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva5, updated_at = NOW()
    WHERE id = v_product AND tenant_id = v_tenant;
  END IF;

  -- LIQUOR I-17829473050 / Aguardiente antioqueño verde 1000 botella
  v_product := NULL;
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-I-17829473050'))
      OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('Aguardiente antioqueño verde 1000 botella'))
      OR UPPER(BTRIM(p.name)) LIKE '%' || UPPER(BTRIM('Aguardiente antioqueño verde 1000 botella')) || '%')
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    v_product := v_matched;
  ELSIF NOT EXISTS (
    SELECT 1 FROM products
    WHERE tenant_id = v_tenant AND UPPER(BTRIM(sku)) = UPPER(BTRIM('XLS-I-17829473050'))
  ) THEN
    v_product := 'ade34e0d-702e-5b09-8dc8-736e0788b453'::uuid;
    INSERT INTO products (
      id, tenant_id, unit_id, tax_id, name, description, sku, price, cost,
      price_with_tax, price_without_tax, is_active, requires_lot,
      operational_status, sale_type, measurement_unit,
      category_id, subcategory_id, created_at, updated_at
    ) VALUES (
      v_product, v_tenant, '10000000-0000-0000-0000-000000000001'::uuid, v_iva5, 'Aguardiente antioqueño verde 1000 botella', 'Aguardiente antioqueño verde 1000 botella', 'XLS-I-17829473050',
      70000.00, 56600.00,
      70000.00, 70000.00, TRUE, FALSE,
      'ACTIVE', 'UNIT', 'UND',
      'd62a28a9-32ac-4df5-ad91-142c14b0edd8'::uuid, '59469cae-477c-4263-b086-3883c987a82b'::uuid, NOW(), NOW()
    );
  END IF;
  IF v_product IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_product,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_icl, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_adv, 'calculation_order', 20),
        jsonb_build_object('tax_id', v_iva5, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_product,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000010'::uuid,
        'alcohol_degree', 29.000,
        'net_volume_ml', 1000.000,
        'dane_certified_retail_price', 70000.00,
        'dane_price_effective_from', CURRENT_DATE::text,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva5, updated_at = NOW()
    WHERE id = v_product AND tenant_id = v_tenant;
  END IF;

  -- LIQUOR I-17829476520 / Ron medellin dorado 750ml
  v_product := NULL;
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-I-17829476520'))
      OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('Ron medellin dorado 750ml'))
      OR UPPER(BTRIM(p.name)) LIKE '%' || UPPER(BTRIM('Ron medellin dorado 750ml')) || '%')
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    v_product := v_matched;
  ELSIF NOT EXISTS (
    SELECT 1 FROM products
    WHERE tenant_id = v_tenant AND UPPER(BTRIM(sku)) = UPPER(BTRIM('XLS-I-17829476520'))
  ) THEN
    v_product := '78238aa4-0e23-5c03-80b7-89d5f92f60f6'::uuid;
    INSERT INTO products (
      id, tenant_id, unit_id, tax_id, name, description, sku, price, cost,
      price_with_tax, price_without_tax, is_active, requires_lot,
      operational_status, sale_type, measurement_unit,
      category_id, subcategory_id, created_at, updated_at
    ) VALUES (
      v_product, v_tenant, '10000000-0000-0000-0000-000000000001'::uuid, v_iva5, 'Ron medellin dorado 750ml', 'Ron medellin dorado 750ml', 'XLS-I-17829476520',
      60000.00, 49200.00,
      60000.00, 60000.00, TRUE, FALSE,
      'ACTIVE', 'UNIT', 'UND',
      'd62a28a9-32ac-4df5-ad91-142c14b0edd8'::uuid, '59469cae-477c-4263-b086-3883c987a82b'::uuid, NOW(), NOW()
    );
  END IF;
  IF v_product IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_product,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_icl, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_adv, 'calculation_order', 20),
        jsonb_build_object('tax_id', v_iva5, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_product,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000010'::uuid,
        'alcohol_degree', 35.000,
        'net_volume_ml', 750.000,
        'dane_certified_retail_price', 60000.00,
        'dane_price_effective_from', CURRENT_DATE::text,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva5, updated_at = NOW()
    WHERE id = v_product AND tenant_id = v_tenant;
  END IF;

  -- LIQUOR 080432402931 / Whisky chiva regal 12 años 700ml
  v_product := NULL;
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-080432402931'))
      OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('Whisky chiva regal 12 años 700ml'))
      OR UPPER(BTRIM(p.name)) LIKE '%' || UPPER(BTRIM('Whisky chiva regal 12 años 700ml')) || '%')
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    v_product := v_matched;
  ELSIF NOT EXISTS (
    SELECT 1 FROM products
    WHERE tenant_id = v_tenant AND UPPER(BTRIM(sku)) = UPPER(BTRIM('XLS-080432402931'))
  ) THEN
    v_product := '388e8c09-023d-5cba-8983-37ccd79df106'::uuid;
    INSERT INTO products (
      id, tenant_id, unit_id, tax_id, name, description, sku, price, cost,
      price_with_tax, price_without_tax, is_active, requires_lot,
      operational_status, sale_type, measurement_unit,
      category_id, subcategory_id, created_at, updated_at
    ) VALUES (
      v_product, v_tenant, '10000000-0000-0000-0000-000000000001'::uuid, v_iva5, 'Whisky chiva regal 12 años 700ml', 'Whisky chiva regal 12 años 700ml', 'XLS-080432402931',
      134000.00, 107781.00,
      134000.00, 134000.00, TRUE, FALSE,
      'ACTIVE', 'UNIT', 'UND',
      'd62a28a9-32ac-4df5-ad91-142c14b0edd8'::uuid, '7fd6dac4-6a98-4cda-822f-332ff15c791e'::uuid, NOW(), NOW()
    );
  END IF;
  IF v_product IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_product,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_icl, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_adv, 'calculation_order', 20),
        jsonb_build_object('tax_id', v_iva5, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_product,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000010'::uuid,
        'alcohol_degree', 40.000,
        'net_volume_ml', 700.000,
        'dane_certified_retail_price', 134000.00,
        'dane_price_effective_from', CURRENT_DATE::text,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva5, updated_at = NOW()
    WHERE id = v_product AND tenant_id = v_tenant;
  END IF;

  -- LIQUOR 7312040017683 / Vodka absolut 700ml
  v_product := NULL;
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-7312040017683'))
      OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('Vodka absolut 700ml'))
      OR UPPER(BTRIM(p.name)) LIKE '%' || UPPER(BTRIM('Vodka absolut 700ml')) || '%')
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    v_product := v_matched;
  ELSIF NOT EXISTS (
    SELECT 1 FROM products
    WHERE tenant_id = v_tenant AND UPPER(BTRIM(sku)) = UPPER(BTRIM('XLS-7312040017683'))
  ) THEN
    v_product := 'bc323ef9-2aaf-5192-9a8c-3f3873a76428'::uuid;
    INSERT INTO products (
      id, tenant_id, unit_id, tax_id, name, description, sku, price, cost,
      price_with_tax, price_without_tax, is_active, requires_lot,
      operational_status, sale_type, measurement_unit,
      category_id, subcategory_id, created_at, updated_at
    ) VALUES (
      v_product, v_tenant, '10000000-0000-0000-0000-000000000001'::uuid, v_iva5, 'Vodka absolut 700ml', 'Vodka absolut 700ml', 'XLS-7312040017683',
      86000.00, 69052.00,
      86000.00, 86000.00, TRUE, FALSE,
      'ACTIVE', 'UNIT', 'UND',
      'd62a28a9-32ac-4df5-ad91-142c14b0edd8'::uuid, '59469cae-477c-4263-b086-3883c987a82b'::uuid, NOW(), NOW()
    );
  END IF;
  IF v_product IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_product,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_icl, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_adv, 'calculation_order', 20),
        jsonb_build_object('tax_id', v_iva5, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_product,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000010'::uuid,
        'alcohol_degree', 29.000,
        'net_volume_ml', 700.000,
        'dane_certified_retail_price', 86000.00,
        'dane_price_effective_from', CURRENT_DATE::text,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva5, updated_at = NOW()
    WHERE id = v_product AND tenant_id = v_tenant;
  END IF;

  -- LIQUOR 5000299611104 / Whisky chivas regal 13 años 700ml
  v_product := NULL;
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-5000299611104'))
      OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('Whisky chivas regal 13 años 700ml'))
      OR UPPER(BTRIM(p.name)) LIKE '%' || UPPER(BTRIM('Whisky chivas regal 13 años 700ml')) || '%')
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    v_product := v_matched;
  ELSIF NOT EXISTS (
    SELECT 1 FROM products
    WHERE tenant_id = v_tenant AND UPPER(BTRIM(sku)) = UPPER(BTRIM('XLS-5000299611104'))
  ) THEN
    v_product := '6044e8a9-7ecf-54ec-830a-a8a6ae62783a'::uuid;
    INSERT INTO products (
      id, tenant_id, unit_id, tax_id, name, description, sku, price, cost,
      price_with_tax, price_without_tax, is_active, requires_lot,
      operational_status, sale_type, measurement_unit,
      category_id, subcategory_id, created_at, updated_at
    ) VALUES (
      v_product, v_tenant, '10000000-0000-0000-0000-000000000001'::uuid, v_iva5, 'Whisky chivas regal 13 años 700ml', 'Whisky chivas regal 13 años 700ml', 'XLS-5000299611104',
      184000.00, 146900.00,
      184000.00, 184000.00, TRUE, FALSE,
      'ACTIVE', 'UNIT', 'UND',
      'd62a28a9-32ac-4df5-ad91-142c14b0edd8'::uuid, '7fd6dac4-6a98-4cda-822f-332ff15c791e'::uuid, NOW(), NOW()
    );
  END IF;
  IF v_product IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_product,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_icl, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_adv, 'calculation_order', 20),
        jsonb_build_object('tax_id', v_iva5, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_product,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000010'::uuid,
        'alcohol_degree', 40.000,
        'net_volume_ml', 700.000,
        'dane_certified_retail_price', 184000.00,
        'dane_price_effective_from', CURRENT_DATE::text,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva5, updated_at = NOW()
    WHERE id = v_product AND tenant_id = v_tenant;
  END IF;

  -- LIQUOR 080432402825 / Whisky the glenlivet  single malt scotch 12 años 700
  v_product := NULL;
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-080432402825'))
      OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('Whisky the glenlivet  single malt scotch 12 años 700'))
      OR UPPER(BTRIM(p.name)) LIKE '%' || UPPER(BTRIM('Whisky the glenlivet  single malt scotch 12 años 700')) || '%')
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    v_product := v_matched;
  ELSIF NOT EXISTS (
    SELECT 1 FROM products
    WHERE tenant_id = v_tenant AND UPPER(BTRIM(sku)) = UPPER(BTRIM('XLS-080432402825'))
  ) THEN
    v_product := 'd3983cca-7e3f-504f-b4c5-d737c6659b8b'::uuid;
    INSERT INTO products (
      id, tenant_id, unit_id, tax_id, name, description, sku, price, cost,
      price_with_tax, price_without_tax, is_active, requires_lot,
      operational_status, sale_type, measurement_unit,
      category_id, subcategory_id, created_at, updated_at
    ) VALUES (
      v_product, v_tenant, '10000000-0000-0000-0000-000000000001'::uuid, v_iva5, 'Whisky the glenlivet  single malt scotch 12 años 700', 'Whisky the glenlivet  single malt scotch 12 años 700', 'XLS-080432402825',
      197000.00, 157300.00,
      197000.00, 197000.00, TRUE, FALSE,
      'ACTIVE', 'UNIT', 'UND',
      'd62a28a9-32ac-4df5-ad91-142c14b0edd8'::uuid, '7fd6dac4-6a98-4cda-822f-332ff15c791e'::uuid, NOW(), NOW()
    );
  END IF;
  IF v_product IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_product,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_icl, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_adv, 'calculation_order', 20),
        jsonb_build_object('tax_id', v_iva5, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_product,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000010'::uuid,
        'alcohol_degree', 40.000,
        'net_volume_ml', 700.000,
        'dane_certified_retail_price', 197000.00,
        'dane_price_effective_from', CURRENT_DATE::text,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva5, updated_at = NOW()
    WHERE id = v_product AND tenant_id = v_tenant;
  END IF;

  -- LIQUOR 5000299627471 / Whisky the glenlivet caribbean reserve 700ml
  v_product := NULL;
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-5000299627471'))
      OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('Whisky the glenlivet caribbean reserve 700ml'))
      OR UPPER(BTRIM(p.name)) LIKE '%' || UPPER(BTRIM('Whisky the glenlivet caribbean reserve 700ml')) || '%')
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    v_product := v_matched;
  ELSIF NOT EXISTS (
    SELECT 1 FROM products
    WHERE tenant_id = v_tenant AND UPPER(BTRIM(sku)) = UPPER(BTRIM('XLS-5000299627471'))
  ) THEN
    v_product := '530aa172-f5c8-531e-b6f3-904d12b6a0b8'::uuid;
    INSERT INTO products (
      id, tenant_id, unit_id, tax_id, name, description, sku, price, cost,
      price_with_tax, price_without_tax, is_active, requires_lot,
      operational_status, sale_type, measurement_unit,
      category_id, subcategory_id, created_at, updated_at
    ) VALUES (
      v_product, v_tenant, '10000000-0000-0000-0000-000000000001'::uuid, v_iva5, 'Whisky the glenlivet caribbean reserve 700ml', 'Whisky the glenlivet caribbean reserve 700ml', 'XLS-5000299627471',
      159000.00, 127121.00,
      159000.00, 159000.00, TRUE, FALSE,
      'ACTIVE', 'UNIT', 'UND',
      'd62a28a9-32ac-4df5-ad91-142c14b0edd8'::uuid, '7fd6dac4-6a98-4cda-822f-332ff15c791e'::uuid, NOW(), NOW()
    );
  END IF;
  IF v_product IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_product,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_icl, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_adv, 'calculation_order', 20),
        jsonb_build_object('tax_id', v_iva5, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_product,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000010'::uuid,
        'alcohol_degree', 40.000,
        'net_volume_ml', 700.000,
        'dane_certified_retail_price', 159000.00,
        'dane_price_effective_from', CURRENT_DATE::text,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva5, updated_at = NOW()
    WHERE id = v_product AND tenant_id = v_tenant;
  END IF;

  -- LIQUOR I-17868225770 / Aguardiente amarillo 1500ml
  v_product := NULL;
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-I-17868225770'))
      OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('Aguardiente amarillo 1500ml'))
      OR UPPER(BTRIM(p.name)) LIKE '%' || UPPER(BTRIM('Aguardiente amarillo 1500ml')) || '%')
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    v_product := v_matched;
  ELSIF NOT EXISTS (
    SELECT 1 FROM products
    WHERE tenant_id = v_tenant AND UPPER(BTRIM(sku)) = UPPER(BTRIM('XLS-I-17868225770'))
  ) THEN
    v_product := 'eac5f240-d80c-5921-a03e-7840bd6ed91a'::uuid;
    INSERT INTO products (
      id, tenant_id, unit_id, tax_id, name, description, sku, price, cost,
      price_with_tax, price_without_tax, is_active, requires_lot,
      operational_status, sale_type, measurement_unit,
      category_id, subcategory_id, created_at, updated_at
    ) VALUES (
      v_product, v_tenant, '10000000-0000-0000-0000-000000000001'::uuid, v_iva5, 'Aguardiente amarillo 1500ml', 'Aguardiente amarillo 1500ml', 'XLS-I-17868225770',
      100000.00, 80230.00,
      100000.00, 100000.00, TRUE, FALSE,
      'ACTIVE', 'UNIT', 'UND',
      'd62a28a9-32ac-4df5-ad91-142c14b0edd8'::uuid, '59469cae-477c-4263-b086-3883c987a82b'::uuid, NOW(), NOW()
    );
  END IF;
  IF v_product IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_product,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_icl, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_adv, 'calculation_order', 20),
        jsonb_build_object('tax_id', v_iva5, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_product,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000010'::uuid,
        'alcohol_degree', 29.000,
        'net_volume_ml', 1500.000,
        'dane_certified_retail_price', 100000.00,
        'dane_price_effective_from', CURRENT_DATE::text,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva5, updated_at = NOW()
    WHERE id = v_product AND tenant_id = v_tenant;
  END IF;

  -- LIQUOR 7707096200019 / Smirnoff tamarindo 375ml
  v_product := NULL;
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-7707096200019'))
      OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('Smirnoff tamarindo 375ml'))
      OR UPPER(BTRIM(p.name)) LIKE '%' || UPPER(BTRIM('Smirnoff tamarindo 375ml')) || '%')
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    v_product := v_matched;
  ELSIF NOT EXISTS (
    SELECT 1 FROM products
    WHERE tenant_id = v_tenant AND UPPER(BTRIM(sku)) = UPPER(BTRIM('XLS-7707096200019'))
  ) THEN
    v_product := '22901630-2b81-51b3-92e9-557e448d4a45'::uuid;
    INSERT INTO products (
      id, tenant_id, unit_id, tax_id, name, description, sku, price, cost,
      price_with_tax, price_without_tax, is_active, requires_lot,
      operational_status, sale_type, measurement_unit,
      category_id, subcategory_id, created_at, updated_at
    ) VALUES (
      v_product, v_tenant, '10000000-0000-0000-0000-000000000001'::uuid, v_iva5, 'Smirnoff tamarindo 375ml', 'Smirnoff tamarindo 375ml', 'XLS-7707096200019',
      30500.00, 24350.00,
      30500.00, 30500.00, TRUE, FALSE,
      'ACTIVE', 'UNIT', 'UND',
      'd62a28a9-32ac-4df5-ad91-142c14b0edd8'::uuid, '59469cae-477c-4263-b086-3883c987a82b'::uuid, NOW(), NOW()
    );
  END IF;
  IF v_product IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_product,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_icl, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_adv, 'calculation_order', 20),
        jsonb_build_object('tax_id', v_iva5, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_product,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000010'::uuid,
        'alcohol_degree', 29.000,
        'net_volume_ml', 375.000,
        'dane_certified_retail_price', 30500.00,
        'dane_price_effective_from', CURRENT_DATE::text,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva5, updated_at = NOW()
    WHERE id = v_product AND tenant_id = v_tenant;
  END IF;

  -- LIQUOR 7707096225951 / SMIRNOFF LULO 375ML
  v_product := NULL;
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-7707096225951'))
      OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('SMIRNOFF LULO 375ML'))
      OR UPPER(BTRIM(p.name)) LIKE '%' || UPPER(BTRIM('SMIRNOFF LULO 375ML')) || '%')
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    v_product := v_matched;
  ELSIF NOT EXISTS (
    SELECT 1 FROM products
    WHERE tenant_id = v_tenant AND UPPER(BTRIM(sku)) = UPPER(BTRIM('XLS-7707096225951'))
  ) THEN
    v_product := '7d9e663f-1ffa-5e1b-abe1-73087125bd43'::uuid;
    INSERT INTO products (
      id, tenant_id, unit_id, tax_id, name, description, sku, price, cost,
      price_with_tax, price_without_tax, is_active, requires_lot,
      operational_status, sale_type, measurement_unit,
      category_id, subcategory_id, created_at, updated_at
    ) VALUES (
      v_product, v_tenant, '10000000-0000-0000-0000-000000000001'::uuid, v_iva5, 'SMIRNOFF LULO 375ML', 'SMIRNOFF LULO 375ML', 'XLS-7707096225951',
      29500.00, 23450.00,
      29500.00, 29500.00, TRUE, FALSE,
      'ACTIVE', 'UNIT', 'UND',
      'd62a28a9-32ac-4df5-ad91-142c14b0edd8'::uuid, '59469cae-477c-4263-b086-3883c987a82b'::uuid, NOW(), NOW()
    );
  END IF;
  IF v_product IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_product,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_icl, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_adv, 'calculation_order', 20),
        jsonb_build_object('tax_id', v_iva5, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_product,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000010'::uuid,
        'alcohol_degree', 29.000,
        'net_volume_ml', 375.000,
        'dane_certified_retail_price', 29500.00,
        'dane_price_effective_from', CURRENT_DATE::text,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva5, updated_at = NOW()
    WHERE id = v_product AND tenant_id = v_tenant;
  END IF;

  -- LIQUOR I-17874347680 / Ron medellin 3 años 375ml
  v_product := NULL;
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-I-17874347680'))
      OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('Ron medellin 3 años 375ml'))
      OR UPPER(BTRIM(p.name)) LIKE '%' || UPPER(BTRIM('Ron medellin 3 años 375ml')) || '%')
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    v_product := v_matched;
  ELSIF NOT EXISTS (
    SELECT 1 FROM products
    WHERE tenant_id = v_tenant AND UPPER(BTRIM(sku)) = UPPER(BTRIM('XLS-I-17874347680'))
  ) THEN
    v_product := '7bbd0cb4-f3c2-5481-ad79-5846abca4bec'::uuid;
    INSERT INTO products (
      id, tenant_id, unit_id, tax_id, name, description, sku, price, cost,
      price_with_tax, price_without_tax, is_active, requires_lot,
      operational_status, sale_type, measurement_unit,
      category_id, subcategory_id, created_at, updated_at
    ) VALUES (
      v_product, v_tenant, '10000000-0000-0000-0000-000000000001'::uuid, v_iva5, 'Ron medellin 3 años 375ml', 'Ron medellin 3 años 375ml', 'XLS-I-17874347680',
      34000.00, 26999.00,
      34000.00, 34000.00, TRUE, FALSE,
      'ACTIVE', 'UNIT', 'UND',
      'd62a28a9-32ac-4df5-ad91-142c14b0edd8'::uuid, '59469cae-477c-4263-b086-3883c987a82b'::uuid, NOW(), NOW()
    );
  END IF;
  IF v_product IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_product,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_icl, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_adv, 'calculation_order', 20),
        jsonb_build_object('tax_id', v_iva5, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_product,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000010'::uuid,
        'alcohol_degree', 35.000,
        'net_volume_ml', 375.000,
        'dane_certified_retail_price', 34000.00,
        'dane_price_effective_from', CURRENT_DATE::text,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva5, updated_at = NOW()
    WHERE id = v_product AND tenant_id = v_tenant;
  END IF;

  -- LIQUOR 7702049002177 / Aguardiente antioqueño real 750ml
  v_product := NULL;
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-7702049002177'))
      OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('Aguardiente antioqueño real 750ml'))
      OR UPPER(BTRIM(p.name)) LIKE '%' || UPPER(BTRIM('Aguardiente antioqueño real 750ml')) || '%')
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    v_product := v_matched;
  ELSIF NOT EXISTS (
    SELECT 1 FROM products
    WHERE tenant_id = v_tenant AND UPPER(BTRIM(sku)) = UPPER(BTRIM('XLS-7702049002177'))
  ) THEN
    v_product := '9106bb07-0c33-537c-9bab-1c8fa6477087'::uuid;
    INSERT INTO products (
      id, tenant_id, unit_id, tax_id, name, description, sku, price, cost,
      price_with_tax, price_without_tax, is_active, requires_lot,
      operational_status, sale_type, measurement_unit,
      category_id, subcategory_id, created_at, updated_at
    ) VALUES (
      v_product, v_tenant, '10000000-0000-0000-0000-000000000001'::uuid, v_iva5, 'Aguardiente antioqueño real 750ml', 'Aguardiente antioqueño real 750ml', 'XLS-7702049002177',
      50000.00, 39900.00,
      50000.00, 50000.00, TRUE, FALSE,
      'ACTIVE', 'UNIT', 'UND',
      'd62a28a9-32ac-4df5-ad91-142c14b0edd8'::uuid, '59469cae-477c-4263-b086-3883c987a82b'::uuid, NOW(), NOW()
    );
  END IF;
  IF v_product IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_product,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_icl, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_adv, 'calculation_order', 20),
        jsonb_build_object('tax_id', v_iva5, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_product,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000010'::uuid,
        'alcohol_degree', 29.000,
        'net_volume_ml', 750.000,
        'dane_certified_retail_price', 50000.00,
        'dane_price_effective_from', CURRENT_DATE::text,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva5, updated_at = NOW()
    WHERE id = v_product AND tenant_id = v_tenant;
  END IF;

  -- LIQUOR 7702049101092 / Ron medellin 5 años 750ml
  v_product := NULL;
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-7702049101092'))
      OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('Ron medellin 5 años 750ml'))
      OR UPPER(BTRIM(p.name)) LIKE '%' || UPPER(BTRIM('Ron medellin 5 años 750ml')) || '%')
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    v_product := v_matched;
  ELSIF NOT EXISTS (
    SELECT 1 FROM products
    WHERE tenant_id = v_tenant AND UPPER(BTRIM(sku)) = UPPER(BTRIM('XLS-7702049101092'))
  ) THEN
    v_product := '4269adda-2eed-5349-b33c-be6b23c8fbdf'::uuid;
    INSERT INTO products (
      id, tenant_id, unit_id, tax_id, name, description, sku, price, cost,
      price_with_tax, price_without_tax, is_active, requires_lot,
      operational_status, sale_type, measurement_unit,
      category_id, subcategory_id, created_at, updated_at
    ) VALUES (
      v_product, v_tenant, '10000000-0000-0000-0000-000000000001'::uuid, v_iva5, 'Ron medellin 5 años 750ml', 'Ron medellin 5 años 750ml', 'XLS-7702049101092',
      76000.00, 62300.00,
      76000.00, 76000.00, TRUE, FALSE,
      'ACTIVE', 'UNIT', 'UND',
      'd62a28a9-32ac-4df5-ad91-142c14b0edd8'::uuid, '59469cae-477c-4263-b086-3883c987a82b'::uuid, NOW(), NOW()
    );
  END IF;
  IF v_product IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_product,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_icl, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_adv, 'calculation_order', 20),
        jsonb_build_object('tax_id', v_iva5, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_product,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000010'::uuid,
        'alcohol_degree', 35.000,
        'net_volume_ml', 750.000,
        'dane_certified_retail_price', 76000.00,
        'dane_price_effective_from', CURRENT_DATE::text,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva5, updated_at = NOW()
    WHERE id = v_product AND tenant_id = v_tenant;
  END IF;

  -- BEER match-only I-17816393030 / CERVEZA AGUILA ORIGINAL BOTELLA 330
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-I-17816393030')) OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('CERVEZA AGUILA ORIGINAL BOTELLA 330')))
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_matched,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_beer, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_iva19, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_matched,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000014'::uuid,
        'alcohol_degree', 4.500,
        'net_volume_ml', 330.000,
        'dane_certified_retail_price', NULL,
        'dane_price_effective_from', NULL,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva19, updated_at = NOW()
    WHERE id = v_matched AND tenant_id = v_tenant;
  END IF;

  -- BEER match-only I-17816393031 / CERVEZA AGUILA ORIGINAL BOTELLA 330
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-I-17816393031')) OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('CERVEZA AGUILA ORIGINAL BOTELLA 330')))
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_matched,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_beer, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_iva19, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_matched,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000014'::uuid,
        'alcohol_degree', 4.500,
        'net_volume_ml', 330.000,
        'dane_certified_retail_price', NULL,
        'dane_price_effective_from', NULL,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva19, updated_at = NOW()
    WHERE id = v_matched AND tenant_id = v_tenant;
  END IF;

  -- BEER match-only I-17816409440 / CERVEZA  AGUILA UNIDA 1000
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-I-17816409440')) OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('CERVEZA  AGUILA UNIDA 1000')))
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_matched,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_beer, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_iva19, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_matched,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000014'::uuid,
        'alcohol_degree', 4.500,
        'net_volume_ml', 1000.000,
        'dane_certified_retail_price', NULL,
        'dane_price_effective_from', NULL,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva19, updated_at = NOW()
    WHERE id = v_matched AND tenant_id = v_tenant;
  END IF;

  -- BEER match-only I-1781663870 / CERVEZA  POKER 1000
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-I-1781663870')) OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('CERVEZA  POKER 1000')))
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_matched,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_beer, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_iva19, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_matched,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000014'::uuid,
        'alcohol_degree', 4.500,
        'net_volume_ml', 1000.000,
        'dane_certified_retail_price', NULL,
        'dane_price_effective_from', NULL,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva19, updated_at = NOW()
    WHERE id = v_matched AND tenant_id = v_tenant;
  END IF;

  -- BEER match-only 7702004003454 / CLUB COLOMBIA DORADA BOTELLA 330ML
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-7702004003454')) OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('CLUB COLOMBIA DORADA BOTELLA 330ML')))
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_matched,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_beer, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_iva19, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_matched,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000014'::uuid,
        'alcohol_degree', 4.500,
        'net_volume_ml', 330.000,
        'dane_certified_retail_price', NULL,
        'dane_price_effective_from', NULL,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva19, updated_at = NOW()
    WHERE id = v_matched AND tenant_id = v_tenant;
  END IF;

  -- BEER match-only 7702004111531 / CORONA 330ML BOTELLA
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-7702004111531')) OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('CORONA 330ML BOTELLA')))
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_matched,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_beer, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_iva19, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_matched,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000014'::uuid,
        'alcohol_degree', 4.500,
        'net_volume_ml', 330.000,
        'dane_certified_retail_price', NULL,
        'dane_price_effective_from', NULL,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva19, updated_at = NOW()
    WHERE id = v_matched AND tenant_id = v_tenant;
  END IF;

  -- BEER match-only 7702004002037 / AGUILA LIGTH 330 BOTELLA
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-7702004002037')) OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('AGUILA LIGTH 330 BOTELLA')))
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_matched,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_beer, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_iva19, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_matched,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000014'::uuid,
        'alcohol_degree', 4.500,
        'net_volume_ml', 330.000,
        'dane_certified_retail_price', NULL,
        'dane_price_effective_from', NULL,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva19, updated_at = NOW()
    WHERE id = v_matched AND tenant_id = v_tenant;
  END IF;

  -- BEER match-only 7702004110596 / CERVEZA BUDWEISER LATA 269
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-7702004110596')) OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('CERVEZA BUDWEISER LATA 269')))
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_matched,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_beer, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_iva19, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_matched,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000014'::uuid,
        'alcohol_degree', 4.500,
        'net_volume_ml', 269.000,
        'dane_certified_retail_price', NULL,
        'dane_price_effective_from', NULL,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva19, updated_at = NOW()
    WHERE id = v_matched AND tenant_id = v_tenant;
  END IF;

  -- BEER match-only 7702004007360 / CEREVEZA POKER RUBIA LATA 330ML
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-7702004007360')) OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('CEREVEZA POKER RUBIA LATA 330ML')))
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_matched,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_beer, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_iva19, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_matched,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000014'::uuid,
        'alcohol_degree', 4.500,
        'net_volume_ml', 330.000,
        'dane_certified_retail_price', NULL,
        'dane_price_effective_from', NULL,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva19, updated_at = NOW()
    WHERE id = v_matched AND tenant_id = v_tenant;
  END IF;

  -- BEER match-only 7702004011183 / RED LATA 269ML
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-7702004011183')) OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('RED LATA 269ML')))
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_matched,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_beer, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_iva19, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_matched,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000014'::uuid,
        'alcohol_degree', 4.500,
        'net_volume_ml', 269.000,
        'dane_certified_retail_price', NULL,
        'dane_price_effective_from', NULL,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva19, updated_at = NOW()
    WHERE id = v_matched AND tenant_id = v_tenant;
  END IF;

  -- BEER match-only 7702004011565 / RED ROSE LATA 269ML
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-7702004011565')) OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('RED ROSE LATA 269ML')))
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_matched,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_beer, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_iva19, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_matched,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000014'::uuid,
        'alcohol_degree', 4.500,
        'net_volume_ml', 269.000,
        'dane_certified_retail_price', NULL,
        'dane_price_effective_from', NULL,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva19, updated_at = NOW()
    WHERE id = v_matched AND tenant_id = v_tenant;
  END IF;

  -- BEER match-only I-1781663008 / RED ROSE LATA 269ML 24
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-I-1781663008')) OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('RED ROSE LATA 269ML 24')))
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_matched,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_beer, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_iva19, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_matched,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000014'::uuid,
        'alcohol_degree', 4.500,
        'net_volume_ml', 269.000,
        'dane_certified_retail_price', NULL,
        'dane_price_effective_from', NULL,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva19, updated_at = NOW()
    WHERE id = v_matched AND tenant_id = v_tenant;
  END IF;

  -- BEER match-only I-1781662935 / COSTEÑA BACANA BOTELLA 320
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-I-1781662935')) OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('COSTEÑA BACANA BOTELLA 320')))
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_matched,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_beer, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_iva19, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_matched,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000014'::uuid,
        'alcohol_degree', 4.500,
        'net_volume_ml', 320.000,
        'dane_certified_retail_price', NULL,
        'dane_price_effective_from', NULL,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva19, updated_at = NOW()
    WHERE id = v_matched AND tenant_id = v_tenant;
  END IF;

  -- BEER match-only 7702004007414 / POKER BOTELLA 330ML
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-7702004007414')) OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('POKER BOTELLA 330ML')))
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_matched,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_beer, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_iva19, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_matched,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000014'::uuid,
        'alcohol_degree', 4.500,
        'net_volume_ml', 330.000,
        'dane_certified_retail_price', NULL,
        'dane_price_effective_from', NULL,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva19, updated_at = NOW()
    WHERE id = v_matched AND tenant_id = v_tenant;
  END IF;

  -- BEER match-only 7702004002013 / CERVEZA AGUILA 330ML
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-7702004002013')) OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('CERVEZA AGUILA 330ML')))
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_matched,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_beer, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_iva19, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_matched,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000014'::uuid,
        'alcohol_degree', 4.500,
        'net_volume_ml', 330.000,
        'dane_certified_retail_price', NULL,
        'dane_price_effective_from', NULL,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva19, updated_at = NOW()
    WHERE id = v_matched AND tenant_id = v_tenant;
  END IF;

  -- BEER match-only I-17817267910 / Cerveza aguila original   lata 330ml 1 unida
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-I-17817267910')) OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('Cerveza aguila original   lata 330ml 1 unida')))
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_matched,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_beer, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_iva19, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_matched,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000014'::uuid,
        'alcohol_degree', 4.500,
        'net_volume_ml', 330.000,
        'dane_certified_retail_price', NULL,
        'dane_price_effective_from', NULL,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva19, updated_at = NOW()
    WHERE id = v_matched AND tenant_id = v_tenant;
  END IF;

  -- BEER match-only I-17817274830 / Cerveza costeña lata 330 ml unida
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-I-17817274830')) OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('Cerveza costeña lata 330 ml unida')))
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_matched,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_beer, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_iva19, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_matched,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000014'::uuid,
        'alcohol_degree', 4.500,
        'net_volume_ml', 330.000,
        'dane_certified_retail_price', NULL,
        'dane_price_effective_from', NULL,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva19, updated_at = NOW()
    WHERE id = v_matched AND tenant_id = v_tenant;
  END IF;

  -- BEER match-only 7702354958206 / los cuates margarita mango 269ml
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-7702354958206')) OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('los cuates margarita mango 269ml')))
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_matched,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_beer, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_iva19, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_matched,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000014'::uuid,
        'alcohol_degree', 4.500,
        'net_volume_ml', 269.000,
        'dane_certified_retail_price', NULL,
        'dane_price_effective_from', NULL,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva19, updated_at = NOW()
    WHERE id = v_matched AND tenant_id = v_tenant;
  END IF;

  -- BEER match-only 7702004003539 / Cerveza club colombia dorada unidad
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-7702004003539')) OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('Cerveza club colombia dorada unidad')))
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_matched,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_beer, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_iva19, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_matched,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000014'::uuid,
        'alcohol_degree', 4.500,
        'net_volume_ml', 330.000,
        'dane_certified_retail_price', NULL,
        'dane_price_effective_from', NULL,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva19, updated_at = NOW()
    WHERE id = v_matched AND tenant_id = v_tenant;
  END IF;

  -- BEER match-only I-17817318250 / cerveza club colombia roja 330ml unida
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-I-17817318250')) OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('cerveza club colombia roja 330ml unida')))
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_matched,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_beer, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_iva19, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_matched,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000014'::uuid,
        'alcohol_degree', 4.500,
        'net_volume_ml', 330.000,
        'dane_certified_retail_price', NULL,
        'dane_price_effective_from', NULL,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva19, updated_at = NOW()
    WHERE id = v_matched AND tenant_id = v_tenant;
  END IF;

  -- BEER match-only I-17817320670 / Cerveza club colombia roja lata 330ml
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-I-17817320670')) OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('Cerveza club colombia roja lata 330ml')))
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_matched,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_beer, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_iva19, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_matched,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000014'::uuid,
        'alcohol_degree', 4.500,
        'net_volume_ml', 330.000,
        'dane_certified_retail_price', NULL,
        'dane_price_effective_from', NULL,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva19, updated_at = NOW()
    WHERE id = v_matched AND tenant_id = v_tenant;
  END IF;

  -- BEER match-only 7702004111043 / cerveza corona lata 269ml unidad
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-7702004111043')) OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('cerveza corona lata 269ml unidad')))
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_matched,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_beer, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_iva19, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_matched,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000014'::uuid,
        'alcohol_degree', 4.500,
        'net_volume_ml', 269.000,
        'dane_certified_retail_price', NULL,
        'dane_price_effective_from', NULL,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva19, updated_at = NOW()
    WHERE id = v_matched AND tenant_id = v_tenant;
  END IF;

  -- BEER match-only 7702004010681 / Michelob ultra 269ml unida
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-7702004010681')) OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('Michelob ultra 269ml unida')))
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_matched,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_beer, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_iva19, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_matched,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000014'::uuid,
        'alcohol_degree', 4.500,
        'net_volume_ml', 269.000,
        'dane_certified_retail_price', NULL,
        'dane_price_effective_from', NULL,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva19, updated_at = NOW()
    WHERE id = v_matched AND tenant_id = v_tenant;
  END IF;

  -- BEER match-only 7702004110701 / 1 coronita 210ml
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-7702004110701')) OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('1 coronita 210ml')))
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_matched,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_beer, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_iva19, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_matched,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000014'::uuid,
        'alcohol_degree', 4.500,
        'net_volume_ml', 210.000,
        'dane_certified_retail_price', NULL,
        'dane_price_effective_from', NULL,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva19, updated_at = NOW()
    WHERE id = v_matched AND tenant_id = v_tenant;
  END IF;

  -- BEER match-only 7702004010544 / stella artois botella 330ml unidad
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-7702004010544')) OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('stella artois botella 330ml unidad')))
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_matched,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_beer, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_iva19, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_matched,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000014'::uuid,
        'alcohol_degree', 4.500,
        'net_volume_ml', 330.000,
        'dane_certified_retail_price', NULL,
        'dane_price_effective_from', NULL,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva19, updated_at = NOW()
    WHERE id = v_matched AND tenant_id = v_tenant;
  END IF;

  -- BEER match-only 7702354957407 / Like ice blueberry pet azul 300ml
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-7702354957407')) OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('Like ice blueberry pet azul 300ml')))
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_matched,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_beer, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_iva19, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_matched,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000014'::uuid,
        'alcohol_degree', 4.500,
        'net_volume_ml', 300.000,
        'dane_certified_retail_price', NULL,
        'dane_price_effective_from', NULL,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva19, updated_at = NOW()
    WHERE id = v_matched AND tenant_id = v_tenant;
  END IF;

  -- BEER match-only 7702354953966 / Like ice limon pet 300ml
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-7702354953966')) OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('Like ice limon pet 300ml')))
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_matched,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_beer, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_iva19, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_matched,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000014'::uuid,
        'alcohol_degree', 4.500,
        'net_volume_ml', 300.000,
        'dane_certified_retail_price', NULL,
        'dane_price_effective_from', NULL,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva19, updated_at = NOW()
    WHERE id = v_matched AND tenant_id = v_tenant;
  END IF;

  -- BEER match-only I-17818188490 / Cerveza miller lite lata 310ml 6 unidades
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-I-17818188490')) OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('Cerveza miller lite lata 310ml 6 unidades')))
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_matched,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_beer, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_iva19, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_matched,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000014'::uuid,
        'alcohol_degree', 4.500,
        'net_volume_ml', 310.000,
        'dane_certified_retail_price', NULL,
        'dane_price_effective_from', NULL,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva19, updated_at = NOW()
    WHERE id = v_matched AND tenant_id = v_tenant;
  END IF;

  -- BEER match-only I-17818190640 / Cerveza miller lite lata 310ml 1 unidad
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-I-17818190640')) OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('Cerveza miller lite lata 310ml 1 unidad')))
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_matched,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_beer, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_iva19, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_matched,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000014'::uuid,
        'alcohol_degree', 4.500,
        'net_volume_ml', 310.000,
        'dane_certified_retail_price', NULL,
        'dane_price_effective_from', NULL,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva19, updated_at = NOW()
    WHERE id = v_matched AND tenant_id = v_tenant;
  END IF;

  -- BEER match-only I-17818198790 / Cerveza heineken lata 269ml 6 unidades
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-I-17818198790')) OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('Cerveza heineken lata 269ml 6 unidades')))
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_matched,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_beer, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_iva19, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_matched,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000014'::uuid,
        'alcohol_degree', 4.500,
        'net_volume_ml', 269.000,
        'dane_certified_retail_price', NULL,
        'dane_price_effective_from', NULL,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva19, updated_at = NOW()
    WHERE id = v_matched AND tenant_id = v_tenant;
  END IF;

  -- BEER match-only I-17818200160 / Cerveza heineken lata 269ml  1 unidad
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-I-17818200160')) OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('Cerveza heineken lata 269ml  1 unidad')))
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_matched,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_beer, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_iva19, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_matched,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000014'::uuid,
        'alcohol_degree', 4.500,
        'net_volume_ml', 269.000,
        'dane_certified_retail_price', NULL,
        'dane_price_effective_from', NULL,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva19, updated_at = NOW()
    WHERE id = v_matched AND tenant_id = v_tenant;
  END IF;

  -- BEER match-only I-17819114750 / Cerveza modelo 355ml 6 unidades
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-I-17819114750')) OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('Cerveza modelo 355ml 6 unidades')))
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_matched,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_beer, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_iva19, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_matched,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000014'::uuid,
        'alcohol_degree', 4.500,
        'net_volume_ml', 355.000,
        'dane_certified_retail_price', NULL,
        'dane_price_effective_from', NULL,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva19, updated_at = NOW()
    WHERE id = v_matched AND tenant_id = v_tenant;
  END IF;

  -- BEER match-only I-17819115710 / Cerveza modelo 355ml 1 unidad
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-I-17819115710')) OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('Cerveza modelo 355ml 1 unidad')))
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_matched,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_beer, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_iva19, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_matched,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000014'::uuid,
        'alcohol_degree', 4.500,
        'net_volume_ml', 355.000,
        'dane_certified_retail_price', NULL,
        'dane_price_effective_from', NULL,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva19, updated_at = NOW()
    WHERE id = v_matched AND tenant_id = v_tenant;
  END IF;

  -- BEER match-only I-17819823810 / Cerveza costeña lata 269ml 6 unidades
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-I-17819823810')) OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('Cerveza costeña lata 269ml 6 unidades')))
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_matched,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_beer, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_iva19, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_matched,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000014'::uuid,
        'alcohol_degree', 4.500,
        'net_volume_ml', 269.000,
        'dane_certified_retail_price', NULL,
        'dane_price_effective_from', NULL,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva19, updated_at = NOW()
    WHERE id = v_matched AND tenant_id = v_tenant;
  END IF;

  -- BEER match-only I-17819824890 / Cerveza costeña lata 269ml 1 unidad
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-I-17819824890')) OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('Cerveza costeña lata 269ml 1 unidad')))
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_matched,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_beer, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_iva19, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_matched,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000014'::uuid,
        'alcohol_degree', 4.500,
        'net_volume_ml', 269.000,
        'dane_certified_retail_price', NULL,
        'dane_price_effective_from', NULL,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva19, updated_at = NOW()
    WHERE id = v_matched AND tenant_id = v_tenant;
  END IF;

  -- BEER match-only I-17819827920 / Cerveza aguila original lata 269ml 6 unidades
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-I-17819827920')) OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('Cerveza aguila original lata 269ml 6 unidades')))
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_matched,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_beer, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_iva19, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_matched,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000014'::uuid,
        'alcohol_degree', 4.500,
        'net_volume_ml', 269.000,
        'dane_certified_retail_price', NULL,
        'dane_price_effective_from', NULL,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva19, updated_at = NOW()
    WHERE id = v_matched AND tenant_id = v_tenant;
  END IF;

  -- BEER match-only I-17819828800 / Cerveza aguila original lata 269ml 1 unidad
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-I-17819828800')) OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('Cerveza aguila original lata 269ml 1 unidad')))
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_matched,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_beer, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_iva19, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_matched,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000014'::uuid,
        'alcohol_degree', 4.500,
        'net_volume_ml', 269.000,
        'dane_certified_retail_price', NULL,
        'dane_price_effective_from', NULL,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva19, updated_at = NOW()
    WHERE id = v_matched AND tenant_id = v_tenant;
  END IF;

  -- BEER match-only I-17823309660 / Cerveza stella artois edicion limitada 269ml 1 unida
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-I-17823309660')) OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('Cerveza stella artois edicion limitada 269ml 1 unida')))
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_matched,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_beer, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_iva19, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_matched,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000014'::uuid,
        'alcohol_degree', 4.500,
        'net_volume_ml', 269.000,
        'dane_certified_retail_price', NULL,
        'dane_price_effective_from', NULL,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva19, updated_at = NOW()
    WHERE id = v_matched AND tenant_id = v_tenant;
  END IF;

  -- BEER match-only I-17823314300 / Cerveza costeña roja botella 330ml 30 unidades
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-I-17823314300')) OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('Cerveza costeña roja botella 330ml 30 unidades')))
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_matched,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_beer, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_iva19, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_matched,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000014'::uuid,
        'alcohol_degree', 4.500,
        'net_volume_ml', 330.000,
        'dane_certified_retail_price', NULL,
        'dane_price_effective_from', NULL,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva19, updated_at = NOW()
    WHERE id = v_matched AND tenant_id = v_tenant;
  END IF;

  -- BEER match-only I-17823315180 / Cerveza costeña roja botella 330ml 1 unida
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-I-17823315180')) OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('Cerveza costeña roja botella 330ml 1 unida')))
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_matched,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_beer, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_iva19, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_matched,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000014'::uuid,
        'alcohol_degree', 4.500,
        'net_volume_ml', 330.000,
        'dane_certified_retail_price', NULL,
        'dane_price_effective_from', NULL,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva19, updated_at = NOW()
    WHERE id = v_matched AND tenant_id = v_tenant;
  END IF;

  -- BEER match-only I-17823317760 / Cerveza corona cero botella 330ml
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-I-17823317760')) OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('Cerveza corona cero botella 330ml')))
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_matched,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_beer, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_iva19, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_matched,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000014'::uuid,
        'alcohol_degree', 4.500,
        'net_volume_ml', 330.000,
        'dane_certified_retail_price', NULL,
        'dane_price_effective_from', NULL,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva19, updated_at = NOW()
    WHERE id = v_matched AND tenant_id = v_tenant;
  END IF;

  -- BEER match-only I-17823320440 / Cerveza corona cero lata 269ml
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-I-17823320440')) OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('Cerveza corona cero lata 269ml')))
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_matched,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_beer, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_iva19, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_matched,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000014'::uuid,
        'alcohol_degree', 4.500,
        'net_volume_ml', 269.000,
        'dane_certified_retail_price', NULL,
        'dane_price_effective_from', NULL,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva19, updated_at = NOW()
    WHERE id = v_matched AND tenant_id = v_tenant;
  END IF;

  -- BEER match-only I-17823327910 / Cerveza michelob ultra 330 botella 1 unida
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-I-17823327910')) OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('Cerveza michelob ultra 330 botella 1 unida')))
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_matched,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_beer, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_iva19, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_matched,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000014'::uuid,
        'alcohol_degree', 4.500,
        'net_volume_ml', 330.000,
        'dane_certified_retail_price', NULL,
        'dane_price_effective_from', NULL,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva19, updated_at = NOW()
    WHERE id = v_matched AND tenant_id = v_tenant;
  END IF;

  -- BEER match-only I-17826770510 / Cerveza central lata 330ml 1 unidad
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-I-17826770510')) OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('Cerveza central lata 330ml 1 unidad')))
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_matched,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_beer, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_iva19, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_matched,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000014'::uuid,
        'alcohol_degree', 4.500,
        'net_volume_ml', 330.000,
        'dane_certified_retail_price', NULL,
        'dane_price_effective_from', NULL,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva19, updated_at = NOW()
    WHERE id = v_matched AND tenant_id = v_tenant;
  END IF;

  -- BEER match-only I-17830130950 / Cerveza costeña lata 269 al por mayor 24 unidades
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-I-17830130950')) OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('Cerveza costeña lata 269 al por mayor 24 unidades')))
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_matched,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_beer, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_iva19, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_matched,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000014'::uuid,
        'alcohol_degree', 4.500,
        'net_volume_ml', 269.000,
        'dane_certified_retail_price', NULL,
        'dane_price_effective_from', NULL,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva19, updated_at = NOW()
    WHERE id = v_matched AND tenant_id = v_tenant;
  END IF;

  -- BEER match-only I-17831132120 / Cerveza aguila original lata 330ml 24 al por mayor
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-I-17831132120')) OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('Cerveza aguila original lata 330ml 24 al por mayor')))
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_matched,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_beer, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_iva19, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_matched,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000014'::uuid,
        'alcohol_degree', 4.500,
        'net_volume_ml', 330.000,
        'dane_certified_retail_price', NULL,
        'dane_price_effective_from', NULL,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva19, updated_at = NOW()
    WHERE id = v_matched AND tenant_id = v_tenant;
  END IF;

  -- BEER match-only I-17834405470 / Red bull 250 ml lata energy drink
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-I-17834405470')) OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('Red bull 250 ml lata energy drink')))
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_matched,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_beer, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_iva19, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_matched,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000014'::uuid,
        'alcohol_degree', 4.500,
        'net_volume_ml', 250.000,
        'dane_certified_retail_price', NULL,
        'dane_price_effective_from', NULL,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva19, updated_at = NOW()
    WHERE id = v_matched AND tenant_id = v_tenant;
  END IF;

  -- BEER match-only I-17834406520 / Red bull 250 ml lata 250ml sugar free
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-I-17834406520')) OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('Red bull 250 ml lata 250ml sugar free')))
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_matched,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_beer, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_iva19, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_matched,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000014'::uuid,
        'alcohol_degree', 4.500,
        'net_volume_ml', 250.000,
        'dane_certified_retail_price', NULL,
        'dane_price_effective_from', NULL,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva19, updated_at = NOW()
    WHERE id = v_matched AND tenant_id = v_tenant;
  END IF;

  -- BEER match-only I-17834407580 / Red bull 250 ml lata the red edition
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-I-17834407580')) OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('Red bull 250 ml lata the red edition')))
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_matched,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_beer, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_iva19, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_matched,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000014'::uuid,
        'alcohol_degree', 4.500,
        'net_volume_ml', 250.000,
        'dane_certified_retail_price', NULL,
        'dane_price_effective_from', NULL,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva19, updated_at = NOW()
    WHERE id = v_matched AND tenant_id = v_tenant;
  END IF;

  -- BEER match-only I-17841460720 / Cerveza costeñita 175ml 1 unidad
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-I-17841460720')) OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('Cerveza costeñita 175ml 1 unidad')))
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_matched,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_beer, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_iva19, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_matched,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000014'::uuid,
        'alcohol_degree', 4.500,
        'net_volume_ml', 175.000,
        'dane_certified_retail_price', NULL,
        'dane_price_effective_from', NULL,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva19, updated_at = NOW()
    WHERE id = v_matched AND tenant_id = v_tenant;
  END IF;

  -- BEER match-only I-17844004320 / Cerveza aguila light 269ml 6 unidades
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-I-17844004320')) OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('Cerveza aguila light 269ml 6 unidades')))
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_matched,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_beer, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_iva19, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_matched,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000014'::uuid,
        'alcohol_degree', 4.500,
        'net_volume_ml', 269.000,
        'dane_certified_retail_price', NULL,
        'dane_price_effective_from', NULL,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva19, updated_at = NOW()
    WHERE id = v_matched AND tenant_id = v_tenant;
  END IF;

  -- BEER match-only I-17848319180 / Cerveza andina light lata 269ml
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-I-17848319180')) OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('Cerveza andina light lata 269ml')))
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_matched,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_beer, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_iva19, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_matched,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000014'::uuid,
        'alcohol_degree', 4.500,
        'net_volume_ml', 269.000,
        'dane_certified_retail_price', NULL,
        'dane_price_effective_from', NULL,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva19, updated_at = NOW()
    WHERE id = v_matched AND tenant_id = v_tenant;
  END IF;

  -- BEER match-only I-17848324650 / Cerveza sol bot 250ml 1unida
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-I-17848324650')) OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('Cerveza sol bot 250ml 1unida')))
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_matched,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_beer, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_iva19, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_matched,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000014'::uuid,
        'alcohol_degree', 4.500,
        'net_volume_ml', 250.000,
        'dane_certified_retail_price', NULL,
        'dane_price_effective_from', NULL,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva19, updated_at = NOW()
    WHERE id = v_matched AND tenant_id = v_tenant;
  END IF;

  -- BEER match-only I-17853547110 / Cerveza miller lite lata 269ml 6 unidades
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-I-17853547110')) OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('Cerveza miller lite lata 269ml 6 unidades')))
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_matched,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_beer, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_iva19, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_matched,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000014'::uuid,
        'alcohol_degree', 4.500,
        'net_volume_ml', 269.000,
        'dane_certified_retail_price', NULL,
        'dane_price_effective_from', NULL,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva19, updated_at = NOW()
    WHERE id = v_matched AND tenant_id = v_tenant;
  END IF;

  -- BEER match-only I-17853548760 / Cerveza miller lite lata 269ml 1unidad
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-I-17853548760')) OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('Cerveza miller lite lata 269ml 1unidad')))
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_matched,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_beer, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_iva19, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_matched,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000014'::uuid,
        'alcohol_degree', 4.500,
        'net_volume_ml', 269.000,
        'dane_certified_retail_price', NULL,
        'dane_price_effective_from', NULL,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva19, updated_at = NOW()
    WHERE id = v_matched AND tenant_id = v_tenant;
  END IF;

  -- BEER match-only I-17853558350 / cerveza andina dorada lata 269 1 unidad
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-I-17853558350')) OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('cerveza andina dorada lata 269 1 unidad')))
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_matched,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_beer, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_iva19, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_matched,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000014'::uuid,
        'alcohol_degree', 4.500,
        'net_volume_ml', 269.000,
        'dane_certified_retail_price', NULL,
        'dane_price_effective_from', NULL,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva19, updated_at = NOW()
    WHERE id = v_matched AND tenant_id = v_tenant;
  END IF;

  -- BEER match-only I-17859542620 / Cerveza club colombia trigo lata 330ml 6 unidades
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-I-17859542620')) OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('Cerveza club colombia trigo lata 330ml 6 unidades')))
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_matched,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_beer, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_iva19, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_matched,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000014'::uuid,
        'alcohol_degree', 4.500,
        'net_volume_ml', 330.000,
        'dane_certified_retail_price', NULL,
        'dane_price_effective_from', NULL,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva19, updated_at = NOW()
    WHERE id = v_matched AND tenant_id = v_tenant;
  END IF;

  -- BEER match-only I-17865008490 / Cerveza miller bot 300ml 1 unidad
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-I-17865008490')) OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('Cerveza miller bot 300ml 1 unidad')))
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_matched,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_beer, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_iva19, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_matched,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000014'::uuid,
        'alcohol_degree', 4.500,
        'net_volume_ml', 300.000,
        'dane_certified_retail_price', NULL,
        'dane_price_effective_from', NULL,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva19, updated_at = NOW()
    WHERE id = v_matched AND tenant_id = v_tenant;
  END IF;

  -- BEER match-only I-17874335080 / Cerveza aguila cero lata 330ml 1unid
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-I-17874335080')) OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('Cerveza aguila cero lata 330ml 1unid')))
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_matched,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_beer, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_iva19, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_matched,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000014'::uuid,
        'alcohol_degree', 4.500,
        'net_volume_ml', 330.000,
        'dane_certified_retail_price', NULL,
        'dane_price_effective_from', NULL,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva19, updated_at = NOW()
    WHERE id = v_matched AND tenant_id = v_tenant;
  END IF;

  -- BEER match-only I-17883821820 / Cerveza club colombia trigo bot 330ml
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-I-17883821820')) OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('Cerveza club colombia trigo bot 330ml')))
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_matched,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_beer, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_iva19, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_matched,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000014'::uuid,
        'alcohol_degree', 4.500,
        'net_volume_ml', 330.000,
        'dane_certified_retail_price', NULL,
        'dane_price_effective_from', NULL,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva19, updated_at = NOW()
    WHERE id = v_matched AND tenant_id = v_tenant;
  END IF;

  -- BEER match-only I-17889982000 / Michelob ultra bot 210ml 1unida
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-I-17889982000')) OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('Michelob ultra bot 210ml 1unida')))
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_matched,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_beer, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_iva19, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_matched,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000014'::uuid,
        'alcohol_degree', 4.500,
        'net_volume_ml', 210.000,
        'dane_certified_retail_price', NULL,
        'dane_price_effective_from', NULL,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva19, updated_at = NOW()
    WHERE id = v_matched AND tenant_id = v_tenant;
  END IF;

  -- BEER match-only I-17890710720 / Cerveza heineken  nal bot nr 250mg 1 unidad
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-I-17890710720')) OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('Cerveza heineken  nal bot nr 250mg 1 unidad')))
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_matched,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_beer, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_iva19, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_matched,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000014'::uuid,
        'alcohol_degree', 4.500,
        'net_volume_ml', 330.000,
        'dane_certified_retail_price', NULL,
        'dane_price_effective_from', NULL,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva19, updated_at = NOW()
    WHERE id = v_matched AND tenant_id = v_tenant;
  END IF;
END
$excel$;

-- Generated liquor units: 61; beer match-only: 62; skipped packs: 34
