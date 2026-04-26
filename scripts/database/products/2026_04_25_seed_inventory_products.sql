WITH default_tenant AS (
  SELECT id
  FROM tenants
  WHERE id = '00000000-0000-0000-0000-000000000001'
    AND slug = 'default'
  LIMIT 1
),
unit_refs AS (
  SELECT
    u.tenant_id,
    (ARRAY_AGG(u.id ORDER BY u.id) FILTER (WHERE UPPER(u.abbreviation) = 'KG'))[1] AS kg_unit_id,
    (ARRAY_AGG(u.id ORDER BY u.id) FILTER (WHERE UPPER(u.abbreviation) = 'LT'))[1] AS lt_unit_id,
    (ARRAY_AGG(u.id ORDER BY u.id) FILTER (WHERE UPPER(u.abbreviation) = 'CJ'))[1] AS cj_unit_id,
    (ARRAY_AGG(u.id ORDER BY u.id) FILTER (WHERE UPPER(u.abbreviation) = 'UND'))[1] AS und_unit_id
  FROM units u
  INNER JOIN default_tenant dt ON dt.id = u.tenant_id
  GROUP BY u.tenant_id
),
tax_refs AS (
  SELECT
    t.tenant_id,
    (ARRAY_AGG(t.id ORDER BY t.id) FILTER (WHERE UPPER(t.name) = 'IVA 19%'))[1] AS iva_19_tax_id,
    (ARRAY_AGG(t.id ORDER BY t.id) FILTER (WHERE UPPER(t.name) = 'EXENTO'))[1] AS exento_tax_id
  FROM taxes t
  INNER JOIN default_tenant dt ON dt.id = t.tenant_id
  GROUP BY t.tenant_id
)
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
  is_active
)
SELECT
  seed.id,
  tenant.id,
  seed.unit_id,
  seed.tax_id,
  seed.name,
  seed.description,
  seed.sku,
  seed.price,
  seed.cost,
  seed.price_with_tax,
  seed.price_without_tax,
  TRUE
FROM default_tenant tenant
INNER JOIN unit_refs ur ON ur.tenant_id = tenant.id
INNER JOIN tax_refs tr ON tr.tenant_id = tenant.id
CROSS JOIN LATERAL (
  VALUES
    (
      '30000000-0000-0000-0000-000000000001'::uuid,
      ur.kg_unit_id,
      tr.exento_tax_id,
      'Arroz',
      'Arroz blanco por kilogramo',
      'PROD-ARROZ-001',
      4200.00::numeric,
      3400.00::numeric,
      4200.00::numeric,
      4200.00::numeric
    ),
    (
      '30000000-0000-0000-0000-000000000002'::uuid,
      ur.kg_unit_id,
      tr.exento_tax_id,
      'Azúcar',
      'Azúcar refinada por kilogramo',
      'PROD-AZUCAR-001',
      3900.00::numeric,
      3100.00::numeric,
      3900.00::numeric,
      3900.00::numeric
    ),
    (
      '30000000-0000-0000-0000-000000000003'::uuid,
      ur.lt_unit_id,
      tr.iva_19_tax_id,
      'Aceite',
      'Aceite vegetal por litro',
      'PROD-ACEITE-001',
      9800.00::numeric,
      7600.00::numeric,
      9800.00::numeric,
      8235.29::numeric
    ),
    (
      '30000000-0000-0000-0000-000000000004'::uuid,
      ur.lt_unit_id,
      tr.exento_tax_id,
      'Leche',
      'Leche entera por litro',
      'PROD-LECHE-001',
      4800.00::numeric,
      3600.00::numeric,
      4800.00::numeric,
      4800.00::numeric
    ),
    (
      '30000000-0000-0000-0000-000000000005'::uuid,
      ur.cj_unit_id,
      tr.exento_tax_id,
      'Huevos',
      'Caja de huevos',
      'PROD-HUEVOS-001',
      18000.00::numeric,
      14500.00::numeric,
      18000.00::numeric,
      18000.00::numeric
    )
) AS seed(
  id,
  unit_id,
  tax_id,
  name,
  description,
  sku,
  price,
  cost,
  price_with_tax,
  price_without_tax
)
WHERE seed.unit_id IS NOT NULL
  AND seed.tax_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM products p
    WHERE p.tenant_id = tenant.id
      AND (
        p.id = seed.id
        OR UPPER(p.sku) = UPPER(seed.sku)
        OR UPPER(p.name) = UPPER(seed.name)
      )
  );
