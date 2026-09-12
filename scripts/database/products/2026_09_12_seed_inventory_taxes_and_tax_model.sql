-- VPS/local idempotent seed: base taxes + tax-model catalog rates (post V077).
-- Safe to re-run. Requires tenants table. Tax dictionaries come from V077 migration.

WITH default_tenant AS (
  SELECT id
  FROM tenants
  WHERE id = '00000000-0000-0000-0000-000000000001'
     OR slug = 'default'
  ORDER BY CASE WHEN id = '00000000-0000-0000-0000-000000000001' THEN 0 ELSE 1 END
  LIMIT 1
)
INSERT INTO taxes (id, tenant_id, name, rate, is_included, is_active)
SELECT seed.id, tenant.id, seed.name, seed.rate, seed.is_included, true
FROM default_tenant tenant
CROSS JOIN (
  VALUES
    ('20000000-0000-0000-0000-000000000001'::uuid, 'IVA 19%', 0.19::numeric, TRUE),
    ('20000000-0000-0000-0000-000000000002'::uuid, 'Exento', 0::numeric, FALSE)
) AS seed(id, name, rate, is_included)
WHERE NOT EXISTS (
  SELECT 1
  FROM taxes t
  WHERE t.tenant_id = tenant.id
    AND (
      t.id = seed.id
      OR UPPER(BTRIM(t.name)) = UPPER(BTRIM(seed.name))
    )
);

-- Classify existing percentage taxes when V077 columns exist.
DO $seed$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'taxes'
      AND column_name = 'tax_type_id'
  ) AND to_regclass('public.tax_types') IS NOT NULL THEN
    UPDATE public.taxes
    SET tax_type_id = COALESCE(tax_type_id, '11000000-0000-0000-0000-000000000001'),
        calculation_method_id = COALESCE(calculation_method_id, '12000000-0000-0000-0000-000000000001'),
        tax_base_type_id = COALESCE(tax_base_type_id, '13000000-0000-0000-0000-000000000001')
    WHERE (
      rate = 0.19
      OR UPPER(BTRIM(name)) LIKE '%IVA%19%'
      OR UPPER(BTRIM(name)) IN ('IVA', 'IVA 19%', 'EXENTO', 'EXENTA')
      OR rate = 0
    );
  END IF;
END
$seed$;

-- Per-tenant fiscal seeds when dictionaries exist (IVA 5%, beer, ICL, ADV).
DO $seed$
BEGIN
  IF to_regclass('public.tax_types') IS NULL
     OR to_regclass('public.tax_rates') IS NULL THEN
    RAISE NOTICE 'tax model dictionaries missing; skip extended fiscal seed';
    RETURN;
  END IF;

  WITH seed_defs AS (
    SELECT *
    FROM (
      VALUES
        ('IVA 5%'::character varying, 0.0500::numeric, true,
         '11000000-0000-0000-0000-000000000001'::uuid,
         '12000000-0000-0000-0000-000000000001'::uuid,
         '13000000-0000-0000-0000-000000000002'::uuid),
        ('Impuesto al consumo de cervezas y refajos'::character varying, 0.0000::numeric, true,
         '11000000-0000-0000-0000-000000000030'::uuid,
         '12000000-0000-0000-0000-000000000001'::uuid,
         '13000000-0000-0000-0000-000000000005'::uuid),
        ('Impuesto al consumo de licores'::character varying, 0.0000::numeric, true,
         '11000000-0000-0000-0000-000000000032'::uuid,
         '12000000-0000-0000-0000-000000000003'::uuid,
         '13000000-0000-0000-0000-000000000004'::uuid),
        ('Impuesto ad valórem'::character varying, 0.0000::numeric, true,
         '11000000-0000-0000-0000-000000000036'::uuid,
         '12000000-0000-0000-0000-000000000001'::uuid,
         '13000000-0000-0000-0000-000000000003'::uuid)
    ) AS defs(name, rate, is_included, tax_type_id, calculation_method_id, tax_base_type_id)
  ),
  inserted AS (
    INSERT INTO public.taxes
      (id, tenant_id, name, rate, is_included, is_active,
       tax_type_id, calculation_method_id, tax_base_type_id)
    SELECT
      gen_random_uuid(),
      tenant.id,
      seed.name,
      seed.rate,
      seed.is_included,
      true,
      seed.tax_type_id,
      seed.calculation_method_id,
      seed.tax_base_type_id
    FROM public.tenants AS tenant
    CROSS JOIN seed_defs AS seed
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.taxes AS existing
      WHERE existing.tenant_id = tenant.id
        AND (
          UPPER(BTRIM(existing.name)) = UPPER(BTRIM(seed.name))
          OR existing.tax_type_id = seed.tax_type_id
        )
    )
    RETURNING id, tenant_id, name, rate, calculation_method_id, tax_base_type_id
  )
  INSERT INTO public.tax_rates
    (tenant_id, tax_id, calculation_method_id, tax_base_type_id,
     percentage_rate, effective_from)
  SELECT inserted.tenant_id,
         inserted.id,
         inserted.calculation_method_id,
         inserted.tax_base_type_id,
         inserted.rate,
         DATE '2000-01-01'
  FROM inserted
  JOIN public.tax_calculation_methods AS method
    ON method.id = inserted.calculation_method_id
  WHERE method.code = 'PERCENTAGE'
  ON CONFLICT ON CONSTRAINT uq_tax_rates_scope DO NOTHING;

  -- ICL fixed amounts 2026
  INSERT INTO public.tax_rates
    (tenant_id, tax_id, tax_product_category_id, calculation_method_id,
     tax_base_type_id, fixed_amount, base_quantity, base_unit_code,
     effective_from, effective_to)
  SELECT tax.tenant_id, tax.id, product_category.id,
         tax.calculation_method_id, tax.tax_base_type_id,
         rule.fixed_amount, 750, 'ML', DATE '2026-01-01', DATE '2026-12-31'
  FROM public.taxes AS tax
  JOIN public.tax_types AS tax_type
    ON tax_type.id = tax.tax_type_id
   AND tax_type.code = 'LIQUOR_CONSUMPTION'
  CROSS JOIN (
    VALUES
      ('16000000-0000-0000-0000-000000000010'::uuid, 360.0000::numeric),
      ('16000000-0000-0000-0000-000000000011'::uuid, 360.0000::numeric),
      ('16000000-0000-0000-0000-000000000012'::uuid, 243.0000::numeric),
      ('16000000-0000-0000-0000-000000000013'::uuid, 243.0000::numeric)
  ) AS rule(product_category_id, fixed_amount)
  JOIN public.tax_product_categories AS product_category
    ON product_category.id = rule.product_category_id
  ON CONFLICT ON CONSTRAINT uq_tax_rates_scope DO UPDATE
  SET fixed_amount = EXCLUDED.fixed_amount,
      effective_to = EXCLUDED.effective_to,
      is_active = true,
      updated_at = now();

  -- ADV percentages 2026
  INSERT INTO public.tax_rates
    (tenant_id, tax_id, tax_product_category_id, calculation_method_id,
     tax_base_type_id, percentage_rate, effective_from, effective_to)
  SELECT tax.tenant_id, tax.id, product_category.id,
         tax.calculation_method_id, tax.tax_base_type_id,
         rule.percentage_rate, DATE '2026-01-01', DATE '2026-12-31'
  FROM public.taxes AS tax
  JOIN public.tax_types AS tax_type
    ON tax_type.id = tax.tax_type_id
   AND tax_type.code = 'AD_VALOREM'
  CROSS JOIN (
    VALUES
      ('16000000-0000-0000-0000-000000000010'::uuid, 0.25000000::numeric),
      ('16000000-0000-0000-0000-000000000011'::uuid, 0.25000000::numeric),
      ('16000000-0000-0000-0000-000000000012'::uuid, 0.20000000::numeric),
      ('16000000-0000-0000-0000-000000000013'::uuid, 0.20000000::numeric)
  ) AS rule(product_category_id, percentage_rate)
  JOIN public.tax_product_categories AS product_category
    ON product_category.id = rule.product_category_id
  ON CONFLICT ON CONSTRAINT uq_tax_rates_scope DO UPDATE
  SET percentage_rate = EXCLUDED.percentage_rate,
      effective_to = EXCLUDED.effective_to,
      is_active = true,
      updated_at = now();

  -- Beer consumption
  INSERT INTO public.tax_rates
    (tenant_id, tax_id, tax_product_category_id, calculation_method_id,
     tax_base_type_id, percentage_rate, effective_from)
  SELECT tax.tenant_id, tax.id, product_category.id,
         tax.calculation_method_id, tax.tax_base_type_id,
         rule.percentage_rate, DATE '1996-01-01'
  FROM public.taxes AS tax
  JOIN public.tax_types AS tax_type
    ON tax_type.id = tax.tax_type_id
   AND tax_type.code = 'BEER_CONSUMPTION'
  CROSS JOIN (
    VALUES
      ('16000000-0000-0000-0000-000000000014'::uuid, 0.48000000::numeric),
      ('16000000-0000-0000-0000-000000000015'::uuid, 0.48000000::numeric),
      ('16000000-0000-0000-0000-000000000016'::uuid, 0.20000000::numeric)
  ) AS rule(product_category_id, percentage_rate)
  JOIN public.tax_product_categories AS product_category
    ON product_category.id = rule.product_category_id
  ON CONFLICT ON CONSTRAINT uq_tax_rates_scope DO UPDATE
  SET percentage_rate = EXCLUDED.percentage_rate,
      is_active = true,
      updated_at = now();
END
$seed$;

-- Backfill product_taxes bridge when table exists.
DO $seed$
BEGIN
  IF to_regclass('public.product_taxes') IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.product_taxes
    (tenant_id, product_id, tax_id, calculation_order)
  SELECT product.tenant_id, product.id, product.tax_id, 100
  FROM public.products AS product
  JOIN public.taxes AS tax
    ON tax.tenant_id = product.tenant_id
   AND tax.id = product.tax_id
  WHERE product.tax_id IS NOT NULL
  ON CONFLICT (tenant_id, product_id, tax_id) DO NOTHING;
END
$seed$;
