-- Product classification menu and permissions.
-- Idempotent. Do not execute directly in production outside the normal migration flow.
-- Categories and subcategories inherit the same role grants that Products already has.

BEGIN;

DO $$
BEGIN
  IF to_regclass('public.tenants') IS NULL THEN
    RAISE EXCEPTION 'Required table public.tenants does not exist';
  END IF;
  IF to_regclass('public.menu_items') IS NULL THEN
    RAISE EXCEPTION 'Required table public.menu_items does not exist';
  END IF;
  IF to_regclass('public.roles') IS NULL THEN
    RAISE EXCEPTION 'Required table public.roles does not exist';
  END IF;
  IF to_regclass('public.role_menu_permissions') IS NULL THEN
    RAISE EXCEPTION 'Required table public.role_menu_permissions does not exist';
  END IF;
END $$;

WITH inventory_parent AS (
  SELECT id, tenant_id
  FROM public.menu_items
  WHERE key = 'INVENTORY'
    AND deleted_at IS NULL
),
target_menu AS (
  SELECT
    tenant.id AS tenant_id,
    parent.id AS parent_id
  FROM public.tenants tenant
  LEFT JOIN inventory_parent parent
    ON parent.tenant_id = tenant.id
),
seed(key, label, route, icon, sort_order, metadata) AS (
  VALUES
    (
      'INVENTORY_PRODUCT_CATEGORIES',
      'Categorias',
      '/{tenant}/inventory/product-categories',
      'Tags',
      102,
      '{"permissionEquivalentTo": "INVENTORY_PRODUCTS"}'::jsonb
    ),
    (
      'INVENTORY_PRODUCT_SUBCATEGORIES',
      'Subcategorias',
      '/{tenant}/inventory/product-subcategories',
      'Grid3X3',
      103,
      '{"permissionEquivalentTo": "INVENTORY_PRODUCTS"}'::jsonb
    )
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
  metadata,
  created_at,
  updated_at,
  deleted_at
)
SELECT
  target_menu.tenant_id,
  seed.key,
  'inventory',
  seed.label,
  seed.route,
  seed.icon,
  target_menu.parent_id,
  seed.sort_order,
  TRUE,
  FALSE,
  seed.metadata,
  NOW(),
  NOW(),
  NULL
FROM target_menu
CROSS JOIN seed
ON CONFLICT (tenant_id, key) WHERE deleted_at IS NULL
DO UPDATE SET
  module = EXCLUDED.module,
  label = EXCLUDED.label,
  route = EXCLUDED.route,
  icon = EXCLUDED.icon,
  parent_id = EXCLUDED.parent_id,
  sort_order = EXCLUDED.sort_order,
  visible = TRUE,
  below_main_menu = FALSE,
  metadata = COALESCE(public.menu_items.metadata, '{}'::jsonb) || EXCLUDED.metadata,
  updated_at = NOW();

WITH desired_inventory_order(key, sort_order) AS (
  VALUES
    ('INVENTORY_PRODUCTS', 101),
    ('INVENTORY_PRODUCT_CATEGORIES', 102),
    ('INVENTORY_PRODUCT_SUBCATEGORIES', 103),
    ('INVENTORY_UNITS', 104),
    ('INVENTORY_TAXES', 105),
    ('INVENTORY_PURCHASES', 106),
    ('INVENTORY_SUPPLIERS', 107),
    ('INVENTORY_PROMOTIONS', 108),
    ('INVENTORY_LOCATIONS', 109),
    ('INVENTORY_LOTS', 110)
)
UPDATE public.menu_items menu_item
SET
  sort_order = desired.sort_order,
  updated_at = NOW()
FROM desired_inventory_order desired
WHERE menu_item.key = desired.key
  AND menu_item.deleted_at IS NULL
  AND menu_item.sort_order IS DISTINCT FROM desired.sort_order;

WITH product_permissions AS (
  SELECT
    product_menu.tenant_id,
    source_permission.role_id,
    source_permission.access_level,
    source_permission.actions
  FROM public.role_menu_permissions source_permission
  INNER JOIN public.menu_items product_menu
    ON product_menu.id = source_permission.menu_item_id
   AND product_menu.tenant_id = source_permission.tenant_id
   AND product_menu.key = 'INVENTORY_PRODUCTS'
   AND product_menu.deleted_at IS NULL
),
classification_menu AS (
  SELECT
    menu_item.tenant_id,
    menu_item.id AS menu_item_id
  FROM public.menu_items menu_item
  WHERE menu_item.key IN (
      'INVENTORY_PRODUCT_CATEGORIES',
      'INVENTORY_PRODUCT_SUBCATEGORIES'
    )
    AND menu_item.deleted_at IS NULL
)
INSERT INTO public.role_menu_permissions (
  tenant_id,
  role_id,
  menu_item_id,
  access_level,
  actions
)
SELECT
  classification_menu.tenant_id,
  product_permissions.role_id,
  classification_menu.menu_item_id,
  product_permissions.access_level,
  COALESCE(product_permissions.actions, '{}'::jsonb)
FROM classification_menu
INNER JOIN product_permissions
  ON product_permissions.tenant_id = classification_menu.tenant_id
ON CONFLICT (tenant_id, role_id, menu_item_id)
DO UPDATE SET
  access_level = EXCLUDED.access_level,
  actions = EXCLUDED.actions;

DO $$
DECLARE
  duplicate_count integer;
  mismatch_count integer;
  orphan_count integer;
BEGIN
  SELECT COUNT(*) INTO duplicate_count
  FROM (
    SELECT tenant_id, key
    FROM public.menu_items
    WHERE deleted_at IS NULL
      AND key IN (
        'INVENTORY_PRODUCT_CATEGORIES',
        'INVENTORY_PRODUCT_SUBCATEGORIES'
      )
    GROUP BY tenant_id, key
    HAVING COUNT(*) > 1
  ) duplicate_menu_keys;

  IF duplicate_count > 0 THEN
    RAISE EXCEPTION 'Duplicate product classification menu keys found: %', duplicate_count;
  END IF;

  SELECT COUNT(*) INTO duplicate_count
  FROM (
    SELECT tenant_id, route
    FROM public.menu_items
    WHERE deleted_at IS NULL
      AND route IN (
        '/{tenant}/inventory/product-categories',
        '/{tenant}/inventory/product-subcategories'
      )
    GROUP BY tenant_id, route
    HAVING COUNT(*) > 1
  ) duplicate_menu_routes;

  IF duplicate_count > 0 THEN
    RAISE EXCEPTION 'Duplicate product classification menu routes found: %', duplicate_count;
  END IF;

  SELECT COUNT(*) INTO duplicate_count
  FROM (
    SELECT rmp.tenant_id, rmp.role_id, rmp.menu_item_id
    FROM public.role_menu_permissions rmp
    INNER JOIN public.menu_items menu_item
      ON menu_item.id = rmp.menu_item_id
     AND menu_item.tenant_id = rmp.tenant_id
    WHERE menu_item.deleted_at IS NULL
      AND menu_item.key IN (
        'INVENTORY_PRODUCT_CATEGORIES',
        'INVENTORY_PRODUCT_SUBCATEGORIES'
      )
    GROUP BY rmp.tenant_id, rmp.role_id, rmp.menu_item_id
    HAVING COUNT(*) > 1
  ) duplicate_role_menu_permissions;

  IF duplicate_count > 0 THEN
    RAISE EXCEPTION 'Duplicate product classification role_menu_permissions found: %',
      duplicate_count;
  END IF;

  WITH product_permissions AS (
    SELECT
      product_menu.tenant_id,
      product_permission.role_id,
      product_permission.access_level,
      product_permission.actions
    FROM public.role_menu_permissions product_permission
    INNER JOIN public.menu_items product_menu
      ON product_menu.id = product_permission.menu_item_id
     AND product_menu.tenant_id = product_permission.tenant_id
     AND product_menu.key = 'INVENTORY_PRODUCTS'
     AND product_menu.deleted_at IS NULL
  ),
  target_keys(key) AS (
    VALUES
      ('INVENTORY_PRODUCT_CATEGORIES'),
      ('INVENTORY_PRODUCT_SUBCATEGORIES')
  ),
  classification_permissions AS (
    SELECT
      classification_menu.tenant_id,
      classification_menu.key,
      classification_permission.role_id,
      classification_permission.access_level,
      classification_permission.actions
    FROM public.role_menu_permissions classification_permission
    INNER JOIN public.menu_items classification_menu
      ON classification_menu.id = classification_permission.menu_item_id
     AND classification_menu.tenant_id = classification_permission.tenant_id
    WHERE classification_menu.deleted_at IS NULL
      AND classification_menu.key IN (
        'INVENTORY_PRODUCT_CATEGORIES',
        'INVENTORY_PRODUCT_SUBCATEGORIES'
      )
  )
  SELECT COUNT(*) INTO mismatch_count
  FROM product_permissions product_permission
  CROSS JOIN target_keys target_key
  LEFT JOIN classification_permissions classification_permission
    ON classification_permission.tenant_id = product_permission.tenant_id
   AND classification_permission.role_id = product_permission.role_id
   AND classification_permission.key = target_key.key
  WHERE classification_permission.role_id IS NULL
     OR classification_permission.access_level IS DISTINCT FROM product_permission.access_level
     OR classification_permission.actions IS DISTINCT FROM product_permission.actions;

  IF mismatch_count > 0 THEN
    RAISE EXCEPTION 'Product classification permissions do not match Products permissions: %',
      mismatch_count;
  END IF;

  WITH product_permissions AS (
    SELECT
      product_menu.tenant_id,
      product_permission.role_id
    FROM public.role_menu_permissions product_permission
    INNER JOIN public.menu_items product_menu
      ON product_menu.id = product_permission.menu_item_id
     AND product_menu.tenant_id = product_permission.tenant_id
     AND product_menu.key = 'INVENTORY_PRODUCTS'
     AND product_menu.deleted_at IS NULL
  ),
  classification_permissions AS (
    SELECT
      classification_menu.tenant_id,
      classification_permission.role_id
    FROM public.role_menu_permissions classification_permission
    INNER JOIN public.menu_items classification_menu
      ON classification_menu.id = classification_permission.menu_item_id
     AND classification_menu.tenant_id = classification_permission.tenant_id
    WHERE classification_menu.deleted_at IS NULL
      AND classification_menu.key IN (
        'INVENTORY_PRODUCT_CATEGORIES',
        'INVENTORY_PRODUCT_SUBCATEGORIES'
      )
  )
  SELECT COUNT(*) INTO orphan_count
  FROM classification_permissions classification_permission
  WHERE NOT EXISTS (
    SELECT 1
    FROM product_permissions product_permission
    WHERE product_permission.tenant_id = classification_permission.tenant_id
      AND product_permission.role_id = classification_permission.role_id
  );

  IF orphan_count > 0 THEN
    RAISE EXCEPTION 'Product classification permissions exist for roles without Products permission: %',
      orphan_count;
  END IF;
END $$;

COMMIT;
