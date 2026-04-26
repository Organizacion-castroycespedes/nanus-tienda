WITH default_tenant AS (
  SELECT id
  FROM tenants
  WHERE id = '00000000-0000-0000-0000-000000000001'
    AND slug = 'default'
  LIMIT 1
)
INSERT INTO suppliers (
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
      '30000000-0000-0000-0000-000000000001'::uuid,
      'Distribuidora Central S.A.',
      '900123456-1',
      '+57 601 3100001',
      'compras@distribuidoracentral.com',
      'Calle 72 # 10-45, Bogota'
    ),
    (
      '30000000-0000-0000-0000-000000000002'::uuid,
      'Proveedores del Caribe Ltda.',
      '901234567-2',
      '+57 605 3200002',
      'ventas@proveedoresdelcaribe.com',
      'Carrera 53 # 74-18, Barranquilla'
    ),
    (
      '30000000-0000-0000-0000-000000000003'::uuid,
      'Comercializadora Andina',
      '800345678-3',
      '+57 604 3300003',
      'contacto@comercializadoraandina.com',
      'Avenida El Poblado # 12-90, Medellin'
    ),
    (
      '30000000-0000-0000-0000-000000000004'::uuid,
      'Importaciones Globales SAS',
      '900456789-4',
      '+57 602 3400004',
      'abastecimiento@importacionesglobales.com',
      'Calle 5 # 38-22, Cali'
    ),
    (
      '30000000-0000-0000-0000-000000000005'::uuid,
      'Alimentos y Granos del Norte',
      '901567890-5',
      '+57 605 3500005',
      'pedidos@alimentosgranosnorte.com',
      'Via 40 # 85-60, Barranquilla'
    )
) AS seed(id, name, document_number, phone, email, address)
WHERE NOT EXISTS (
  SELECT 1
  FROM suppliers s
  WHERE s.tenant_id = tenant.id
    AND (
      s.id = seed.id
      OR UPPER(s.name) = UPPER(seed.name)
      OR UPPER(COALESCE(s.document_number, '')) = UPPER(seed.document_number)
      OR UPPER(COALESCE(s.email, '')) = UPPER(seed.email)
    )
);
