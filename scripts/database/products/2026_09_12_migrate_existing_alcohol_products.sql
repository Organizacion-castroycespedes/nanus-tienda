-- Migrate existing Manus QA alcohol products: product_taxes + product_tax_profiles.
-- Idempotent. Tenant default. DANE provisional = products.price (edit later in UI).
-- Depends on: V077/V078/V079 tax model + fiscal tax seeds.

DO $migrate$
DECLARE
  v_tenant UUID := '00000000-0000-0000-0000-000000000001';
  v_iva19 UUID;
  v_iva5 UUID;
  v_icl UUID;
  v_adv UUID;
  v_beer UUID;
  v_cat_liquor UUID := '16000000-0000-0000-0000-000000000010'; -- DISTILLED_LIQUOR
  v_cat_beer UUID := '16000000-0000-0000-0000-000000000014'; -- BEER
  r RECORD;
BEGIN
  SELECT id INTO v_iva19 FROM taxes WHERE tenant_id = v_tenant AND UPPER(BTRIM(name)) = 'IVA 19%' LIMIT 1;
  SELECT id INTO v_iva5 FROM taxes WHERE tenant_id = v_tenant AND UPPER(BTRIM(name)) = 'IVA 5%' LIMIT 1;
  SELECT id INTO v_icl FROM taxes WHERE tenant_id = v_tenant AND UPPER(BTRIM(name)) = UPPER('Impuesto al consumo de licores') LIMIT 1;
  SELECT id INTO v_adv
  FROM taxes t
  JOIN tax_types tt ON tt.id = t.tax_type_id
  WHERE t.tenant_id = v_tenant AND tt.code = 'AD_VALOREM'
  LIMIT 1;
  SELECT id INTO v_beer FROM taxes WHERE tenant_id = v_tenant AND UPPER(BTRIM(name)) = UPPER('Impuesto al consumo de cervezas y refajos') LIMIT 1;

  IF v_iva19 IS NULL OR v_iva5 IS NULL OR v_icl IS NULL OR v_adv IS NULL OR v_beer IS NULL THEN
    RAISE EXCEPTION 'Missing required tenant taxes (IVA19/IVA5/ICL/ADV/Beer)';
  END IF;

  -- Liquors: ICL + ADV + IVA5
  FOR r IN
    SELECT *
    FROM (
      VALUES
        ('d78dfd34-5147-4991-bf4d-6d6e4d6652ff'::uuid, 40.000::numeric, 750.000::numeric),
        ('23d4d786-170e-4718-b933-10b64465180f'::uuid, 29.000::numeric, 1050.000::numeric),
        ('18ba7701-4a74-4d03-a732-c892faa6f98c'::uuid, 29.000::numeric, 1000.000::numeric),
        ('aaccc304-371a-4fb0-9f1a-d37cbb1c08f5'::uuid, 29.000::numeric, 750.000::numeric),
        ('dfea3472-ceb1-43ae-a740-16233d535111'::uuid, 29.000::numeric, 375.000::numeric)
    ) AS x(product_id, alcohol_degree, net_volume_ml)
  LOOP
    IF NOT EXISTS (SELECT 1 FROM products WHERE id = r.product_id AND tenant_id = v_tenant) THEN
      CONTINUE;
    END IF;

    PERFORM public.prc_replace_product_taxes(
      v_tenant,
      r.product_id,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_icl, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_adv, 'calculation_order', 20),
        jsonb_build_object('tax_id', v_iva5, 'calculation_order', 100)
      )
    );

    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant,
      r.product_id,
      jsonb_build_object(
        'tax_product_category_id', v_cat_liquor,
        'alcohol_degree', r.alcohol_degree,
        'net_volume_ml', r.net_volume_ml,
        'dane_certified_retail_price', (
          SELECT price FROM products WHERE id = r.product_id AND tenant_id = v_tenant
        ),
        'dane_price_effective_from', CURRENT_DATE::text,
        'dane_price_effective_to', NULL
      )
    );

    UPDATE products
    SET tax_id = v_iva5,
        updated_at = NOW()
    WHERE id = r.product_id
      AND tenant_id = v_tenant;
  END LOOP;

  -- Beers: beer consumption + IVA19
  FOR r IN
    SELECT *
    FROM (
      VALUES
        ('8943add0-19ff-4cca-9382-a1f89a27da09'::uuid, 4.200::numeric, 330.000::numeric),
        ('3721daf5-00ed-47ae-95f3-8c482a75a311'::uuid, 5.000::numeric, 310.000::numeric),
        ('a42669b5-1866-4168-9a17-75739dd8df16'::uuid, 5.000::numeric, 330.000::numeric),
        ('07efd873-16b8-4e73-b72a-06321d7e8b49'::uuid, 4.700::numeric, 330.000::numeric),
        ('e50a7126-0881-499a-9577-a367beb64e4b'::uuid, 4.500::numeric, 210.000::numeric),
        ('b6b831c5-17be-4419-8a08-f147f6b55572'::uuid, 4.000::numeric, 330.000::numeric)
    ) AS x(product_id, alcohol_degree, net_volume_ml)
  LOOP
    IF NOT EXISTS (SELECT 1 FROM products WHERE id = r.product_id AND tenant_id = v_tenant) THEN
      CONTINUE;
    END IF;

    PERFORM public.prc_replace_product_taxes(
      v_tenant,
      r.product_id,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_beer, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_iva19, 'calculation_order', 100)
      )
    );

    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant,
      r.product_id,
      jsonb_build_object(
        'tax_product_category_id', v_cat_beer,
        'alcohol_degree', r.alcohol_degree,
        'net_volume_ml', r.net_volume_ml,
        'dane_certified_retail_price', NULL,
        'dane_price_effective_from', NULL,
        'dane_price_effective_to', NULL
      )
    );

    UPDATE products
    SET tax_id = v_iva19,
        updated_at = NOW()
    WHERE id = r.product_id
      AND tenant_id = v_tenant;
  END LOOP;
END
$migrate$;
