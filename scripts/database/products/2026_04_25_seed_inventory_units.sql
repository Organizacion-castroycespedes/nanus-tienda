WITH default_tenant AS (
  SELECT id
  FROM tenants
  WHERE id = '00000000-0000-0000-0000-000000000001'
  LIMIT 1
)
INSERT INTO units (id, tenant_id, name, abbreviation)
SELECT seed.id, tenant.id, seed.name, seed.abbreviation
FROM default_tenant tenant
CROSS JOIN (
  VALUES
    ('10000000-0000-0000-0000-000000000001'::uuid, 'Unidad', 'UND'),
    ('10000000-0000-0000-0000-000000000002'::uuid, 'Kilogramo', 'KG'),
    ('10000000-0000-0000-0000-000000000003'::uuid, 'Litro', 'LT'),
    ('10000000-0000-0000-0000-000000000004'::uuid, 'Caja', 'CJ')
) AS seed(id, name, abbreviation)
WHERE NOT EXISTS (
  SELECT 1
  FROM units u
  WHERE u.tenant_id = tenant.id
    AND (
      u.id = seed.id
      OR UPPER(u.name) = UPPER(seed.name)
      OR UPPER(u.abbreviation) = UPPER(seed.abbreviation)
    )
);
