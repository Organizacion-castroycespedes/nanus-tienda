BEGIN;

-- Ensure operational root menus exist for every tenant
INSERT INTO public.menu_items (
  tenant_id,
  key,
  module,
  label,
  route,
  icon,
  parent_id,
  sort_order,
  visible,
  below_main_menu,
  metadata
)
SELECT
  t.id,
  seed.key,
  seed.module,
  seed.label,
  seed.route,
  seed.icon,
  NULL,
  seed.sort_order,
  TRUE,
  FALSE,
  '{}'::jsonb
FROM public.tenants t
CROSS JOIN (
  VALUES
    ('INVENTORY', 'inventory', 'Inventory', '/{tenant}/inventory', 'box', 100),
    ('CUSTOMERS', 'customers', 'Clientes', '/{tenant}/customers', 'users', 140),
    ('ORDERS', 'orders', 'Pedidos', '/{tenant}/orders', 'shopping-cart', 150),
    ('POS', 'pos', 'POS', '/{tenant}/pos', 'shopping-cart', 160)
) AS seed(key, module, label, route, icon, sort_order)
WHERE NOT EXISTS (
  SELECT 1
  FROM public.menu_items mi
  WHERE mi.tenant_id = t.id
    AND mi.key = seed.key
    AND mi.deleted_at IS NULL
);

-- Ensure inventory child menus exist and are attached to the inventory parent
WITH inventory_parent AS (
  SELECT id, tenant_id
  FROM public.menu_items
  WHERE key = 'INVENTORY'
    AND deleted_at IS NULL
)
INSERT INTO public.menu_items (
  tenant_id,
  key,
  module,
  label,
  route,
  icon,
  parent_id,
  sort_order,
  visible,
  below_main_menu,
  metadata
)
SELECT
  parent.tenant_id,
  seed.key,
  'inventory',
  seed.label,
  seed.route,
  seed.icon,
  parent.id,
  seed.sort_order,
  TRUE,
  FALSE,
  '{}'::jsonb
FROM inventory_parent parent
CROSS JOIN (
  VALUES
    ('INVENTORY_PRODUCTS', 'Productos', '/{tenant}/inventory/products', 'box', 101),
    ('INVENTORY_UNITS', 'Unidades', '/{tenant}/inventory/units', 'ruler', 102),
    ('INVENTORY_TAXES', 'Impuestos', '/{tenant}/inventory/taxes', 'calculator', 103),
    ('INVENTORY_PURCHASES', 'Compras', '/{tenant}/inventory/purchases', 'shopping-bag', 104),
    ('INVENTORY_SUPPLIERS', 'Proveedores', '/{tenant}/inventory/suppliers', 'truck', 105)
) AS seed(key, label, route, icon, sort_order)
WHERE NOT EXISTS (
  SELECT 1
  FROM public.menu_items mi
  WHERE mi.tenant_id = parent.tenant_id
    AND mi.key = seed.key
    AND mi.deleted_at IS NULL
);

WITH inventory_parent AS (
  SELECT id, tenant_id
  FROM public.menu_items
  WHERE key = 'INVENTORY'
    AND deleted_at IS NULL
),
inventory_children AS (
  SELECT
    parent.id AS parent_id,
    child.id AS child_id,
    seed.sort_order
  FROM inventory_parent parent
  INNER JOIN public.menu_items child
    ON child.tenant_id = parent.tenant_id
   AND child.deleted_at IS NULL
  INNER JOIN (
    VALUES
      ('INVENTORY_PRODUCTS', 101),
      ('INVENTORY_UNITS', 102),
      ('INVENTORY_TAXES', 103),
      ('INVENTORY_PURCHASES', 104),
      ('INVENTORY_SUPPLIERS', 105)
  ) AS seed(key, sort_order)
    ON seed.key = child.key
)
UPDATE public.menu_items mi
SET
  parent_id = inventory_children.parent_id,
  sort_order = inventory_children.sort_order,
  updated_at = NOW()
FROM inventory_children
WHERE mi.id = inventory_children.child_id
  AND (
    mi.parent_id IS DISTINCT FROM inventory_children.parent_id
    OR mi.sort_order IS DISTINCT FROM inventory_children.sort_order
  );

-- Ensure demo personas are linked to the principal branch
WITH tenant_branches AS (
  SELECT
    t.id AS tenant_id,
    t.slug AS tenant_slug,
    b.id AS branch_id
  FROM public.tenants t
  INNER JOIN public.tenant_branches b
    ON b.tenant_id = t.id
   AND b.es_principal = TRUE
),
seed_users AS (
  SELECT
    tb.tenant_id,
    tb.branch_id,
    seed.documento_numero_prefix || upper(replace(tb.tenant_slug, '-', '_')) AS documento_numero
  FROM tenant_branches tb
  CROSS JOIN (
    VALUES
      ('SU-'),
      ('AD-'),
      ('US-')
  ) AS seed(documento_numero_prefix)
)
INSERT INTO public.persona_tenant_branches (
  persona_id,
  tenant_branch_id,
  tenant_id,
  es_principal
)
SELECT
  p.id,
  su.branch_id,
  su.tenant_id,
  TRUE
FROM seed_users su
INNER JOIN public.personas p
  ON p.tenant_id = su.tenant_id
 AND p.documento_numero = su.documento_numero
ON CONFLICT (persona_id, tenant_branch_id) DO UPDATE
SET
  tenant_id = EXCLUDED.tenant_id,
  es_principal = TRUE;

-- Ensure operational demo personas exist for every tenant principal branch
WITH tenant_branches AS (
  SELECT
    t.id AS tenant_id,
    t.slug AS tenant_slug,
    t.nombre AS tenant_name,
    b.id AS branch_id,
    b.nombre AS branch_name
  FROM public.tenants t
  INNER JOIN public.tenant_branches b
    ON b.tenant_id = t.id
   AND b.es_principal = TRUE
),
seed_users AS (
  SELECT
    tb.tenant_id,
    tb.tenant_slug,
    tb.tenant_name,
    tb.branch_id,
    tb.branch_name,
    seed.role_name,
    seed.nombres,
    seed.apellidos,
    seed.documento_tipo,
    seed.documento_numero_prefix || upper(replace(tb.tenant_slug, '-', '_')) AS documento_numero,
    lower(seed.email_prefix || '+' || tb.tenant_slug || '@manustienda.local') AS email,
    seed.cargo_nombre
  FROM tenant_branches tb
  CROSS JOIN (
    VALUES
      ('SUPER_USER', 'Super', 'User', 'CC', 'SU-', 'super.user', 'SUPER_USER'),
      ('ADMIN', 'Tenant', 'Admin', 'CC', 'AD-', 'admin', 'ADMIN'),
      ('USER', 'Pos', 'User', 'CC', 'US-', 'user', 'USER')
  ) AS seed(
    role_name,
    nombres,
    apellidos,
    documento_tipo,
    documento_numero_prefix,
    email_prefix,
    cargo_nombre
  )
),
upsert_personas AS (
  INSERT INTO public.personas (
    tenant_id,
    nombres,
    apellidos,
    documento_tipo,
    documento_numero,
    email_personal,
    cargo_nombre,
    cargo_descripcion,
    funciones_descripcion
  )
  SELECT
    su.tenant_id,
    su.nombres,
    su.apellidos,
    su.documento_tipo,
    su.documento_numero,
    su.email,
    su.cargo_nombre,
    'Seed automatico FASE 7',
    'Usuario operativo de prueba para perfil ' || su.role_name
  FROM seed_users su
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.personas p
    WHERE p.tenant_id = su.tenant_id
      AND p.documento_numero = su.documento_numero
  )
  RETURNING id, tenant_id, documento_numero
),
personas_final AS (
  SELECT
    su.tenant_id,
    su.branch_id,
    su.role_name,
    su.email,
    su.documento_numero,
    up.id AS persona_id
  FROM seed_users su
  INNER JOIN upsert_personas up
    ON up.tenant_id = su.tenant_id
   AND up.documento_numero = su.documento_numero
  UNION ALL
  SELECT
    su.tenant_id,
    su.branch_id,
    su.role_name,
    su.email,
    su.documento_numero,
    p.id AS persona_id
  FROM seed_users su
  INNER JOIN public.personas p
    ON p.tenant_id = su.tenant_id
   AND p.documento_numero = su.documento_numero
  WHERE NOT EXISTS (
    SELECT 1
    FROM upsert_personas up
    WHERE up.tenant_id = su.tenant_id
      AND up.documento_numero = su.documento_numero
  )
),
upsert_users AS (
  INSERT INTO public.users (
    tenant_id,
    persona_id,
    email,
    password_hash,
    estado
  )
  SELECT
    pf.tenant_id,
    pf.persona_id,
    pf.email,
    crypt('12345678!', gen_salt('bf')),
    'ACTIVE'
  FROM personas_final pf
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.tenant_id = pf.tenant_id
      AND lower(u.email) = lower(pf.email)
  )
  RETURNING id, tenant_id, persona_id, email
),
users_final AS (
  SELECT
    pf.tenant_id,
    pf.branch_id,
    pf.role_name,
    up.persona_id,
    up.email,
    up.id AS user_id
  FROM personas_final pf
  INNER JOIN upsert_users up
    ON up.tenant_id = pf.tenant_id
   AND lower(up.email) = lower(pf.email)
  UNION ALL
  SELECT
    pf.tenant_id,
    pf.branch_id,
    pf.role_name,
    pf.persona_id,
    pf.email,
    u.id AS user_id
  FROM personas_final pf
  INNER JOIN public.users u
    ON u.tenant_id = pf.tenant_id
   AND lower(u.email) = lower(pf.email)
  WHERE NOT EXISTS (
    SELECT 1
    FROM upsert_users up
    WHERE up.tenant_id = pf.tenant_id
      AND lower(up.email) = lower(pf.email)
  )
)
INSERT INTO public.persona_tenant_branches (
  persona_id,
  tenant_branch_id,
  tenant_id,
  es_principal
)
SELECT
  pf.persona_id,
  pf.branch_id,
  pf.tenant_id,
  TRUE
FROM personas_final pf
ON CONFLICT (persona_id, tenant_branch_id) DO UPDATE
SET
  tenant_id = EXCLUDED.tenant_id,
  es_principal = TRUE;

WITH tenant_branches AS (
  SELECT
    t.id AS tenant_id,
    t.slug AS tenant_slug
  FROM public.tenants t
  INNER JOIN public.tenant_branches b
    ON b.tenant_id = t.id
   AND b.es_principal = TRUE
),
seed_users AS (
  SELECT
    tb.tenant_id,
    seed.role_name,
    lower(seed.email_prefix || '+' || tb.tenant_slug || '@manustienda.local') AS email
  FROM tenant_branches tb
  CROSS JOIN (
    VALUES
      ('SUPER_USER', 'super.user'),
      ('ADMIN', 'admin'),
      ('USER', 'user')
  ) AS seed(role_name, email_prefix)
),
users_final AS (
  SELECT
    su.tenant_id,
    su.role_name,
    u.id AS user_id
  FROM seed_users su
  INNER JOIN public.users u
    ON u.tenant_id = su.tenant_id
   AND lower(u.email) = su.email
)
INSERT INTO public.user_roles (user_id, role_id, tenant_id)
SELECT
  uf.user_id,
  r.id,
  uf.tenant_id
FROM users_final uf
INNER JOIN public.roles r
  ON r.nombre = uf.role_name
ON CONFLICT (user_id, role_id, tenant_id) DO NOTHING;

-- Repair operational demo users if personas already existed without linked users
WITH tenant_branches AS (
  SELECT
    t.id AS tenant_id,
    t.slug AS tenant_slug
  FROM public.tenants t
  INNER JOIN public.tenant_branches b
    ON b.tenant_id = t.id
   AND b.es_principal = TRUE
),
seed_users AS (
  SELECT
    tb.tenant_id,
    lower(seed.email_prefix || '+' || tb.tenant_slug || '@manustienda.local') AS email,
    seed.documento_numero_prefix || upper(replace(tb.tenant_slug, '-', '_')) AS documento_numero
  FROM tenant_branches tb
  CROSS JOIN (
    VALUES
      ('super.user', 'SU-'),
      ('admin', 'AD-'),
      ('user', 'US-')
  ) AS seed(email_prefix, documento_numero_prefix)
),
personas_final AS (
  SELECT
    su.tenant_id,
    su.email,
    p.id AS persona_id
  FROM seed_users su
  INNER JOIN public.personas p
    ON p.tenant_id = su.tenant_id
   AND p.documento_numero = su.documento_numero
)
UPDATE public.users u
SET
  persona_id = pf.persona_id,
  password_hash = crypt('12345678!', gen_salt('bf')),
  estado = 'ACTIVE'
FROM personas_final pf
WHERE u.tenant_id = pf.tenant_id
  AND lower(u.email) = lower(pf.email);

COMMIT;
