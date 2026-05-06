BEGIN;

WITH parent_definition AS (
  SELECT
    'REPORTS'::TEXT AS key,
    'reporteria'::TEXT AS module,
    'Reporteria'::TEXT AS label,
    '/{tenant}/reporteria'::TEXT AS route,
    'FileText'::TEXT AS icon,
    210::INT AS sort_order,
    TRUE AS visible,
    FALSE AS below_main_menu
),
tenant_targets AS (
  SELECT id AS tenant_id
  FROM public.tenants
),
existing_parent AS (
  SELECT tenant_id, id
  FROM public.menu_items
  WHERE key = 'REPORTS'
    AND deleted_at IS NULL
),
missing_parent AS (
  SELECT
    tenant.tenant_id,
    definition.key,
    definition.module,
    definition.label,
    definition.route,
    definition.icon,
    definition.sort_order,
    definition.visible,
    definition.below_main_menu
  FROM tenant_targets AS tenant
  CROSS JOIN parent_definition AS definition
  LEFT JOIN existing_parent AS existing
    ON existing.tenant_id = tenant.tenant_id
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
  parent.tenant_id,
  parent.key,
  parent.module,
  parent.label,
  parent.route,
  parent.icon,
  NULL,
  parent.sort_order,
  parent.visible,
  parent.below_main_menu,
  '{}'::JSONB,
  NOW(),
  NOW(),
  NULL
FROM missing_parent AS parent;

WITH parent_definition AS (
  SELECT
    'reporteria'::TEXT AS module,
    'Reporteria'::TEXT AS label,
    '/{tenant}/reporteria'::TEXT AS route,
    'FileText'::TEXT AS icon,
    210::INT AS sort_order,
    TRUE AS visible,
    FALSE AS below_main_menu
)
UPDATE public.menu_items AS mi
SET
  module = definition.module,
  label = definition.label,
  route = definition.route,
  icon = definition.icon,
  parent_id = NULL,
  sort_order = definition.sort_order,
  visible = definition.visible,
  below_main_menu = definition.below_main_menu,
  metadata = COALESCE(mi.metadata, '{}'::JSONB),
  updated_at = NOW(),
  deleted_at = NULL
FROM parent_definition AS definition
WHERE mi.key = 'REPORTS'
  AND mi.deleted_at IS NULL;

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

  UNION ALL

  SELECT
    'REPORTS_PURCHASES'::TEXT AS key,
    'reporteria'::TEXT AS module,
    'Compras'::TEXT AS label,
    '/{tenant}/reporteria/compras'::TEXT AS route,
    'ShoppingBag'::TEXT AS icon,
    30::INT AS sort_order,
    TRUE AS visible,
    FALSE AS below_main_menu

  UNION ALL

  SELECT
    'REPORTS_ORDERS'::TEXT AS key,
    'reporteria'::TEXT AS module,
    'Pedidos'::TEXT AS label,
    '/{tenant}/reporteria/pedidos'::TEXT AS route,
    'ClipboardList'::TEXT AS icon,
    40::INT AS sort_order,
    TRUE AS visible,
    FALSE AS below_main_menu

  UNION ALL

  SELECT
    'REPORTS_CUSTOMERS'::TEXT AS key,
    'reporteria'::TEXT AS module,
    'Clientes'::TEXT AS label,
    '/{tenant}/reporteria/clientes'::TEXT AS route,
    'Users'::TEXT AS icon,
    50::INT AS sort_order,
    TRUE AS visible,
    FALSE AS below_main_menu
),
reports_parent AS (
  SELECT tenant_id, id
  FROM public.menu_items
  WHERE key = 'REPORTS'
    AND deleted_at IS NULL
),
existing_routes AS (
  SELECT tenant_id, key, id
  FROM public.menu_items
  WHERE key IN (
    'REPORTS_POS',
    'REPORTS_CASH',
    'REPORTS_PURCHASES',
    'REPORTS_ORDERS',
    'REPORTS_CUSTOMERS'
  )
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
  LEFT JOIN existing_routes AS existing
    ON existing.tenant_id = parent.tenant_id
   AND existing.key = definition.key
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

  UNION ALL

  SELECT
    'REPORTS_PURCHASES'::TEXT AS key,
    'reporteria'::TEXT AS module,
    'Compras'::TEXT AS label,
    '/{tenant}/reporteria/compras'::TEXT AS route,
    'ShoppingBag'::TEXT AS icon,
    30::INT AS sort_order,
    TRUE AS visible,
    FALSE AS below_main_menu

  UNION ALL

  SELECT
    'REPORTS_ORDERS'::TEXT AS key,
    'reporteria'::TEXT AS module,
    'Pedidos'::TEXT AS label,
    '/{tenant}/reporteria/pedidos'::TEXT AS route,
    'ClipboardList'::TEXT AS icon,
    40::INT AS sort_order,
    TRUE AS visible,
    FALSE AS below_main_menu

  UNION ALL

  SELECT
    'REPORTS_CUSTOMERS'::TEXT AS key,
    'reporteria'::TEXT AS module,
    'Clientes'::TEXT AS label,
    '/{tenant}/reporteria/clientes'::TEXT AS route,
    'Users'::TEXT AS icon,
    50::INT AS sort_order,
    TRUE AS visible,
    FALSE AS below_main_menu
),
reports_parent AS (
  SELECT tenant_id, id
  FROM public.menu_items
  WHERE key = 'REPORTS'
    AND deleted_at IS NULL
)
UPDATE public.menu_items AS mi
SET
  module = definition.module,
  label = definition.label,
  route = definition.route,
  icon = definition.icon,
  parent_id = parent.id,
  sort_order = definition.sort_order,
  visible = definition.visible,
  below_main_menu = definition.below_main_menu,
  metadata = COALESCE(mi.metadata, '{}'::JSONB),
  updated_at = NOW(),
  deleted_at = NULL
FROM route_definitions AS definition
CROSS JOIN reports_parent AS parent
WHERE mi.key = definition.key
  AND mi.tenant_id = parent.tenant_id
  AND mi.deleted_at IS NULL;

COMMIT;
