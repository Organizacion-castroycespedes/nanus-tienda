-- V099: Standardize liquor taxes to is_included: false across all liquor products and fix statutory rates

DO $$
DECLARE
  v_icl_false UUID := '44672be8-2342-42eb-b96d-186db57addaf';
  v_adv_false UUID := '0db55ee2-2a42-43c3-9663-d34479614a28';
  v_iva5_false UUID := 'bdd0842b-e047-459a-a069-584d0d64278a';
  v_tenant_id UUID := '00000000-0000-0000-0000-000000000001';
  r RECORD;
BEGIN
  -- 1. Fix tax rates for ICL_FALSE and ADV_FALSE
  DELETE FROM tax_rates WHERE tax_id IN (v_icl_false, v_adv_false);

  -- ICL false rates (360 COP for >35 deg, 243 COP for <=35 deg per 750ml)
  INSERT INTO tax_rates (id, tenant_id, tax_id, tax_product_category_id, calculation_method_id, tax_base_type_id, fixed_amount, base_quantity, base_unit_code, effective_from, effective_to, is_active, created_at, updated_at)
  VALUES
    (gen_random_uuid(), v_tenant_id, v_icl_false, '16000000-0000-0000-0000-000000000010', '12000000-0000-0000-0000-000000000003', '13000000-0000-0000-0000-000000000004', 360.0000, 750.000000, 'ML', '2026-01-01', '2026-12-31', true, NOW(), NOW()),
    (gen_random_uuid(), v_tenant_id, v_icl_false, '16000000-0000-0000-0000-000000000011', '12000000-0000-0000-0000-000000000003', '13000000-0000-0000-0000-000000000004', 360.0000, 750.000000, 'ML', '2026-01-01', '2026-12-31', true, NOW(), NOW()),
    (gen_random_uuid(), v_tenant_id, v_icl_false, '16000000-0000-0000-0000-000000000012', '12000000-0000-0000-0000-000000000003', '13000000-0000-0000-0000-000000000004', 243.0000, 750.000000, 'ML', '2026-01-01', '2026-12-31', true, NOW(), NOW()),
    (gen_random_uuid(), v_tenant_id, v_icl_false, '16000000-0000-0000-0000-000000000013', '12000000-0000-0000-0000-000000000003', '13000000-0000-0000-0000-000000000004', 243.0000, 750.000000, 'ML', '2026-01-01', '2026-12-31', true, NOW(), NOW());

  -- ADV false rates (25% for >35 deg, 20% for <=35 deg)
  INSERT INTO tax_rates (id, tenant_id, tax_id, tax_product_category_id, calculation_method_id, tax_base_type_id, percentage_rate, effective_from, effective_to, is_active, created_at, updated_at)
  VALUES
    (gen_random_uuid(), v_tenant_id, v_adv_false, '16000000-0000-0000-0000-000000000010', '12000000-0000-0000-0000-000000000001', '13000000-0000-0000-0000-000000000003', 0.25000000, '2026-01-01', '2026-12-31', true, NOW(), NOW()),
    (gen_random_uuid(), v_tenant_id, v_adv_false, '16000000-0000-0000-0000-000000000011', '12000000-0000-0000-0000-000000000001', '13000000-0000-0000-0000-000000000003', 0.25000000, '2026-01-01', '2026-12-31', true, NOW(), NOW()),
    (gen_random_uuid(), v_tenant_id, v_adv_false, '16000000-0000-0000-0000-000000000012', '12000000-0000-0000-0000-000000000001', '13000000-0000-0000-0000-000000000003', 0.20000000, '2026-01-01', '2026-12-31', true, NOW(), NOW()),
    (gen_random_uuid(), v_tenant_id, v_adv_false, '16000000-0000-0000-0000-000000000013', '12000000-0000-0000-0000-000000000001', '13000000-0000-0000-0000-000000000003', 0.20000000, '2026-01-01', '2026-12-31', true, NOW(), NOW());

  -- 2. Identify products that have inclusive liquor taxes
  FOR r IN (
    SELECT DISTINCT p.id, p.price, p.price_without_tax, p.price_with_tax
    FROM products p
    JOIN product_taxes pt ON pt.product_id = p.id
    WHERE pt.tax_id IN (
      'a27cf4ec-31c7-4649-8227-9854215f2ace', -- ICL included
      'ee2ab393-5a2c-4b32-95f0-b0df768071de', -- ADV included
      'a2c70ca7-e747-46c5-8f25-f46db19f4a43'  -- IVA 5% included
    )
  ) LOOP
    -- Update product price to base price and link tax_id to ADV false
    UPDATE products
    SET price = COALESCE(price_without_tax, price),
        tax_id = v_adv_false,
        updated_at = NOW()
    WHERE id = r.id;

    -- Remove old inclusive product_taxes
    DELETE FROM product_taxes WHERE product_id = r.id;

    -- Insert new non-inclusive taxes (ICL 10, ADV 20, IVA 100)
    INSERT INTO product_taxes (id, tenant_id, product_id, tax_id, calculation_order, is_included, is_active, created_at)
    VALUES
      (gen_random_uuid(), v_tenant_id, r.id, v_icl_false, 10, false, true, NOW()),
      (gen_random_uuid(), v_tenant_id, r.id, v_adv_false, 20, false, true, NOW()),
      (gen_random_uuid(), v_tenant_id, r.id, v_iva5_false, 100, false, true, NOW());
  END LOOP;
END $$;
