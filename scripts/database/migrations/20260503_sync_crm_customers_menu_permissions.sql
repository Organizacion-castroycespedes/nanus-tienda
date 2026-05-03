BEGIN;

WITH default_tenant AS (
  SELECT id
  FROM public.tenants
  WHERE slug = 'default'
  LIMIT 1
)
INSERT INTO public.menu_items (
  id,
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
  '25490a20-0e16-439a-b5e0-d46ef9027e14'::uuid,
  t.id,
  'CRM_CUSTOMERS',
  'crm',
  'CRM',
  '/{tenant}/crm/customers',
  'users',
  NULL,
  130,
  TRUE,
  FALSE,
  '{}'::jsonb,
  now(),
  now(),
  NULL
FROM default_tenant t
ON CONFLICT (tenant_id, key) WHERE deleted_at IS NULL
DO UPDATE SET
  module = EXCLUDED.module,
  label = EXCLUDED.label,
  route = EXCLUDED.route,
  icon = EXCLUDED.icon,
  parent_id = EXCLUDED.parent_id,
  sort_order = EXCLUDED.sort_order,
  visible = EXCLUDED.visible,
  below_main_menu = EXCLUDED.below_main_menu,
  metadata = EXCLUDED.metadata,
  updated_at = EXCLUDED.updated_at,
  deleted_at = NULL;

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
  t.id,
  'CRM_CUSTOMERS',
  'crm',
  'CRM',
  '/{tenant}/crm/customers',
  'users',
  NULL,
  130,
  TRUE,
  FALSE,
  '{}'::jsonb,
  now(),
  now(),
  NULL
FROM public.tenants t
WHERE t.slug <> 'default'
  AND NOT EXISTS (
    SELECT 1
    FROM public.menu_items mi
    WHERE mi.tenant_id = t.id
      AND mi.deleted_at IS NULL
      AND (mi.key = 'CRM_CUSTOMERS' OR mi.route = '/{tenant}/crm/customers')
  );

WITH target_permissions AS (
  SELECT
    mi.tenant_id,
    mi.id AS menu_item_id,
    r.id AS role_id,
    r.nombre AS role_name,
    CASE
      WHEN r.nombre IN ('SUPER_ADMIN', 'SUPER_USER', 'ADMIN') THEN 'WRITE'
      WHEN r.nombre = 'USER' THEN 'WRITE'
      ELSE NULL
    END AS access_level,
    CASE
      WHEN r.nombre IN ('SUPER_ADMIN', 'SUPER_USER', 'ADMIN')
        THEN '{"read": true, "create": true, "update": true, "delete": true}'::jsonb
      WHEN r.nombre = 'USER'
        THEN '{"read": true, "create": true}'::jsonb
      ELSE NULL
    END AS actions
  FROM public.menu_items mi
  JOIN public.roles r
    ON r.nombre IN ('SUPER_ADMIN', 'SUPER_USER', 'ADMIN', 'USER')
  WHERE mi.key = 'CRM_CUSTOMERS'
    AND mi.deleted_at IS NULL
),
eligible_targets AS (
  SELECT *
  FROM target_permissions
  WHERE access_level IS NOT NULL
    AND actions IS NOT NULL
)
INSERT INTO public.role_menu_permissions (
  tenant_id,
  role_id,
  menu_item_id,
  access_level,
  actions
)
SELECT
  target.tenant_id,
  target.role_id,
  target.menu_item_id,
  target.access_level,
  target.actions
FROM eligible_targets target
ON CONFLICT (tenant_id, role_id, menu_item_id) DO UPDATE
SET
  access_level = EXCLUDED.access_level,
  actions = EXCLUDED.actions;

COMMIT;
