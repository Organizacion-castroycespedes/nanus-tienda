WITH default_tenant AS (
  SELECT id
  FROM tenants
  WHERE id = '00000000-0000-0000-0000-000000000001'
    AND slug = 'default'
  LIMIT 1
)
INSERT INTO taxes (id, tenant_id, name, rate, is_included)
SELECT seed.id, tenant.id, seed.name, seed.rate, seed.is_included
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
      OR UPPER(t.name) = UPPER(seed.name)
      OR (t.rate = seed.rate AND t.is_included = seed.is_included)
    )
);
