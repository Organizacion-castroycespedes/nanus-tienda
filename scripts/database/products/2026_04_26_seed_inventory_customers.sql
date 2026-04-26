WITH default_tenant AS (
  SELECT id
  FROM tenants
  WHERE id = '00000000-0000-0000-0000-000000000001'
    AND slug = 'default'
  LIMIT 1
)
INSERT INTO customers (
  id,
  tenant_id,
  name,
  document_number,
  phone,
  email,
  address,
  is_active
)
SELECT
  seed.id,
  tenant.id,
  seed.name,
  seed.document_number,
  seed.phone,
  seed.email,
  seed.address,
  TRUE
FROM default_tenant tenant
CROSS JOIN (
  VALUES
    (
      '40000000-0000-0000-0000-000000000001'::uuid,
      'Juan Perez',
      '1012345678',
      '+57 300 4100001',
      'juan.perez@clientesdemo.com',
      'Calle 45 # 18-20, Bogota'
    ),
    (
      '40000000-0000-0000-0000-000000000002'::uuid,
      'Maria Gomez',
      '1023456789',
      '+57 301 4100002',
      'maria.gomez@clientesdemo.com',
      'Carrera 32 # 12-15, Medellin'
    ),
    (
      '40000000-0000-0000-0000-000000000003'::uuid,
      'Carlos Rodriguez',
      '1034567890',
      '+57 302 4100003',
      'carlos.rodriguez@clientesdemo.com',
      'Avenida 6 # 24-60, Cali'
    ),
    (
      '40000000-0000-0000-0000-000000000004'::uuid,
      'Ana Martinez',
      '1045678901',
      '+57 303 4100004',
      'ana.martinez@clientesdemo.com',
      'Calle 84 # 51-40, Barranquilla'
    ),
    (
      '40000000-0000-0000-0000-000000000005'::uuid,
      'Luis Fernandez',
      '1056789012',
      '+57 304 4100005',
      'luis.fernandez@clientesdemo.com',
      'Carrera 14 # 7-55, Bucaramanga'
    )
) AS seed(id, name, document_number, phone, email, address)
WHERE NOT EXISTS (
  SELECT 1
  FROM customers c
  WHERE c.tenant_id = tenant.id
    AND (
      c.id = seed.id
      OR UPPER(c.name) = UPPER(seed.name)
      OR UPPER(COALESCE(c.document_number, '')) = UPPER(seed.document_number)
      OR UPPER(COALESCE(c.email, '')) = UPPER(seed.email)
    )
);
