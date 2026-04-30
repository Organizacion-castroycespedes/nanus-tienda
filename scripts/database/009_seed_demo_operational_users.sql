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

COMMIT;
