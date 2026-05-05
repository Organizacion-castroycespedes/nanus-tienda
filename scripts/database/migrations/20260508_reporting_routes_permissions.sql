BEGIN;

WITH route_definitions AS (
  SELECT
    'REPORTS_POS'::TEXT AS key,
    'reporteria'::TEXT AS module,
    'Ventas POS'::TEXT AS label,
    '/{tenant}/reporteria/pos'::TEXT AS route,
    'ReceiptText'::TEXT AS icon,
    10::INT AS sort_order,
    TRUE AS visible,
    FALSE AS below_main_menu

  UNION ALL

  SELECT
    'REPORTS_CASH'::TEXT AS key,
    'reporteria'::TEXT AS module,
    'Caja'::TEXT AS label,
    '/{tenant}/reporteria/caja'::TEXT AS route,
    'Wallet'::TEXT AS icon,
    20::INT AS sort_order,
    TRUE AS visible,
    FALSE AS below_main_menu
),
reports_parent AS (
  SELECT tenant_id, id
  FROM public.menu_items
  WHERE key = 'REPORTS'
    AND deleted_at IS NULL
),
missing_routes AS (
  SELECT
    parent.tenant_id,
    definition.key,
    definition.module,
    definition.label,
    definition.route,
    definition.icon,
    parent.id AS parent_id,
    definition.sort_order,
    definition.visible,
    definition.below_main_menu
  FROM reports_parent AS parent
  CROSS JOIN route_definitions AS definition
  LEFT JOIN public.menu_items AS existing
    ON existing.tenant_id = parent.tenant_id
   AND existing.key = definition.key
   AND existing.deleted_at IS NULL
  WHERE existing.id IS NULL
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
  route.tenant_id,
  route.key,
  route.module,
  route.label,
  route.route,
  route.icon,
  route.parent_id,
  route.sort_order,
  route.visible,
  route.below_main_menu,
  '{}'::JSONB,
  NOW(),
  NOW(),
  NULL
FROM missing_routes AS route;

WITH route_definitions AS (
  SELECT
    'REPORTS_POS'::TEXT AS key,
    'reporteria'::TEXT AS module,
    'Ventas POS'::TEXT AS label,
    '/{tenant}/reporteria/pos'::TEXT AS route

  UNION ALL

  SELECT
    'REPORTS_CASH'::TEXT AS key,
    'reporteria'::TEXT AS module,
    'Caja'::TEXT AS label,
    '/{tenant}/reporteria/caja'::TEXT AS route
),
target_roles AS (
  SELECT id, nombre
  FROM public.roles
  WHERE nombre IN ('SUPER_ADMIN', 'SUPER_USER', 'ADMIN', 'USER')
),
target_menu_items AS (
  SELECT
    mi.tenant_id,
    mi.id AS menu_item_id,
    mi.key
  FROM public.menu_items AS mi
  INNER JOIN route_definitions AS definition
    ON definition.key = mi.key
  WHERE mi.deleted_at IS NULL
)
INSERT INTO public.role_menu_permissions (
  tenant_id,
  role_id,
  menu_item_id,
  access_level,
  actions
)
SELECT
  item.tenant_id,
  role.id AS role_id,
  item.menu_item_id,
  'READ',
  '{"read": true}'::JSONB
FROM target_menu_items AS item
CROSS JOIN target_roles AS role
ON CONFLICT (tenant_id, role_id, menu_item_id) DO UPDATE
SET
  access_level = EXCLUDED.access_level,
  actions = EXCLUDED.actions;

WITH route_definitions AS (
  SELECT
    'reporteria'::TEXT AS module,
    '/{tenant}/reporteria/pos'::TEXT AS route,
    'Ventas POS'::TEXT AS label,
    TRUE AS visible

  UNION ALL

  SELECT
    'reporteria'::TEXT AS module,
    '/{tenant}/reporteria/caja'::TEXT AS route,
    'Caja'::TEXT AS label,
    TRUE AS visible
),
target_roles AS (
  SELECT id, nombre
  FROM public.roles
  WHERE nombre IN ('SUPER_ADMIN', 'SUPER_USER', 'ADMIN', 'USER')
),
target_tenants AS (
  SELECT id
  FROM public.tenants
)
INSERT INTO public.permissions (
  role_id,
  tenant_id,
  module,
  route,
  label,
  visible
)
SELECT
  role.id AS role_id,
  tenant.id AS tenant_id,
  definition.module,
  definition.route,
  definition.label,
  definition.visible
FROM target_roles AS role
CROSS JOIN target_tenants AS tenant
CROSS JOIN route_definitions AS definition
ON CONFLICT (role_id, tenant_id, module, route) DO UPDATE
SET
  label = EXCLUDED.label,
  visible = EXCLUDED.visible;

COMMIT;
