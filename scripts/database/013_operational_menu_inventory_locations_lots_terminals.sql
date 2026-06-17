BEGIN;

-- Source of truth for operational navigation items used by /me/menu.
-- Keep this idempotent so local QA can re-apply it safely.

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
    ('INVENTORY', 'inventory', 'Inventario', '/{tenant}/inventory', 'Package', 100),
    ('CONFIGURACION_TENANT_CONFIGURACION', 'configuracion', 'Configuracion', '/{tenant}/configuracion', 'Settings', 40)
) AS seed(key, module, label, route, icon, sort_order)
ON CONFLICT (tenant_id, key) WHERE deleted_at IS NULL
DO UPDATE SET
  module = EXCLUDED.module,
  label = EXCLUDED.label,
  route = EXCLUDED.route,
  icon = EXCLUDED.icon,
  parent_id = NULL,
  sort_order = EXCLUDED.sort_order,
  visible = TRUE,
  below_main_menu = FALSE,
  updated_at = NOW(),
  deleted_at = NULL;

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
    ('INVENTORY_PRODUCTS', 'Productos', '/{tenant}/inventory/products', 'Package', 101),
    ('INVENTORY_UNITS', 'Unidades', '/{tenant}/inventory/units', 'Ruler', 102),
    ('INVENTORY_TAXES', 'Impuestos', '/{tenant}/inventory/taxes', 'Calculator', 103),
    ('INVENTORY_PROMOTIONS', 'Promociones', '/{tenant}/inventory/promotions', 'Tags', 106),
    ('INVENTORY_LOCATIONS', 'Ubicaciones', '/{tenant}/inventory/locations', 'Building', 107),
    ('INVENTORY_LOTS', 'Lotes', '/{tenant}/inventory/lots', 'Archive', 108)
) AS seed(key, label, route, icon, sort_order)
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
  updated_at = NOW(),
  deleted_at = NULL;

WITH config_parent AS (
  SELECT id, tenant_id
  FROM public.menu_items
  WHERE key = 'CONFIGURACION_TENANT_CONFIGURACION'
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
  'CONFIG_TERMINALS',
  'configuracion',
  'Terminales',
  '/{tenant}/config/terminals',
  'Monitor',
  parent.id,
  45,
  TRUE,
  FALSE,
  '{}'::jsonb
FROM config_parent parent
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
  updated_at = NOW(),
  deleted_at = NULL;

WITH role_targets AS (
  SELECT
    mi.tenant_id,
    mi.id AS menu_item_id,
    r.id AS role_id,
    r.nombre AS role_name,
    mi.key
  FROM public.menu_items mi
  INNER JOIN public.roles r
    ON r.nombre IN ('ADMIN', 'SUPER_USER', 'SUPER_ADMIN')
  WHERE mi.deleted_at IS NULL
    AND (
      mi.key IN (
        'INVENTORY_PRODUCTS',
        'INVENTORY_UNITS',
        'INVENTORY_TAXES',
        'INVENTORY_PROMOTIONS',
        'INVENTORY_LOCATIONS',
        'INVENTORY_LOTS'
      )
      OR (
        mi.key = 'CONFIG_TERMINALS'
        AND r.nombre IN ('SUPER_USER', 'SUPER_ADMIN')
      )
    )
)
INSERT INTO public.role_menu_permissions (
  tenant_id,
  role_id,
  menu_item_id,
  access_level,
  actions
)
SELECT
  tenant_id,
  role_id,
  menu_item_id,
  'WRITE',
  '{"read": true, "create": true, "update": true, "delete": true}'::jsonb
FROM role_targets
ON CONFLICT (tenant_id, role_id, menu_item_id) DO UPDATE
SET
  access_level = EXCLUDED.access_level,
  actions = EXCLUDED.actions;

DELETE FROM public.role_menu_permissions rmp
USING public.roles r,
      public.menu_items mi
WHERE rmp.role_id = r.id
  AND rmp.menu_item_id = mi.id
  AND (
    (r.nombre = 'ADMIN' AND mi.key = 'CONFIG_TERMINALS')
    OR (
      r.nombre = 'USER'
      AND mi.key IN (
        'INVENTORY',
        'INVENTORY_PRODUCTS',
        'INVENTORY_UNITS',
        'INVENTORY_TAXES',
        'INVENTORY_PURCHASES',
        'INVENTORY_SUPPLIERS',
        'INVENTORY_PROMOTIONS',
        'INVENTORY_LOCATIONS',
        'INVENTORY_LOTS',
        'CONFIG_TERMINALS'
      )
    )
  );

COMMIT;
