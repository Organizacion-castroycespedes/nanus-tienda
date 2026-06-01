BEGIN;

WITH promotion_menu AS (
  SELECT
    tenant.id AS tenant_id,
    inventory_parent.id AS parent_id
  FROM public.tenants tenant
  LEFT JOIN public.menu_items inventory_parent
    ON inventory_parent.tenant_id = tenant.id
   AND inventory_parent.key = 'INVENTORY'
   AND inventory_parent.deleted_at IS NULL
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
  promotion_menu.tenant_id,
  'INVENTORY_PROMOTIONS',
  'inventory',
  'Promociones',
  '/{tenant}/inventory/promotions',
  'tags',
  promotion_menu.parent_id,
  106,
  FALSE,
  FALSE,
  '{}'::jsonb,
  NOW(),
  NOW(),
  NULL
FROM promotion_menu
ON CONFLICT (tenant_id, key) WHERE deleted_at IS NULL
DO UPDATE SET
  module = EXCLUDED.module,
  label = EXCLUDED.label,
  route = EXCLUDED.route,
  icon = EXCLUDED.icon,
  parent_id = EXCLUDED.parent_id,
  sort_order = EXCLUDED.sort_order,
  visible = FALSE,
  below_main_menu = FALSE,
  metadata = COALESCE(public.menu_items.metadata, '{}'::jsonb),
  updated_at = NOW();

WITH target_permissions AS (
  SELECT
    menu_item.tenant_id,
    menu_item.id AS menu_item_id,
    role.id AS role_id
  FROM public.menu_items menu_item
  INNER JOIN public.roles role
    ON role.nombre IN ('SUPER_ADMIN', 'SUPER_USER', 'ADMIN')
  WHERE menu_item.key = 'INVENTORY_PROMOTIONS'
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
  target_permissions.tenant_id,
  target_permissions.role_id,
  target_permissions.menu_item_id,
  'WRITE',
  '{"read": true, "create": true, "update": true, "delete": true}'::jsonb
FROM target_permissions
ON CONFLICT (tenant_id, role_id, menu_item_id)
DO UPDATE SET
  access_level = 'WRITE',
  actions = COALESCE(public.role_menu_permissions.actions, '{}'::jsonb)
    || '{"read": true, "create": true, "update": true, "delete": true}'::jsonb;

COMMIT;
