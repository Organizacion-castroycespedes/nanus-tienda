WITH targets AS (
  SELECT
    mi.tenant_id,
    r.id AS role_id,
    mi.id AS menu_item_id,
    r.nombre AS role_name
  FROM public.menu_items mi
  INNER JOIN public.roles r
    ON r.nombre IN ('SUPER_ADMIN', 'SUPER_USER', 'ADMIN')
  WHERE mi.key = 'INVENTORY_PURCHASES'
    AND mi.deleted_at IS NULL
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
  '{"read": true, "create": true, "update": true, "delete": true, "cancel": true}'::jsonb
FROM targets
ON CONFLICT (tenant_id, role_id, menu_item_id)
DO UPDATE SET
  access_level = CASE
    WHEN public.role_menu_permissions.access_level = 'WRITE' THEN 'WRITE'
    ELSE EXCLUDED.access_level
  END,
  actions = COALESCE(public.role_menu_permissions.actions, '{}'::jsonb)
    || '{"cancel": true}'::jsonb;
