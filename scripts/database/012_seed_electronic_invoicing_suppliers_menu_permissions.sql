BEGIN;

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
  'ELECTRONIC_INVOICING_SUPPLIERS',
  'electronic-invoicing',
  'Proveedores fiscales',
  '/{tenant}/electronic-invoicing/suppliers',
  'Truck',
  NULL,
  221,
  FALSE,
  FALSE,
  '{"phase": "FE-2.4F", "backendOnly": true}'::jsonb,
  now(),
  now(),
  NULL
FROM public.tenants t
WHERE NOT EXISTS (
  SELECT 1
  FROM public.menu_items mi
  WHERE mi.tenant_id = t.id
    AND mi.deleted_at IS NULL
    AND (
      mi.key = 'ELECTRONIC_INVOICING_SUPPLIERS'
      OR mi.route = '/{tenant}/electronic-invoicing/suppliers'
    )
);

WITH target_permissions AS (
  SELECT
    mi.tenant_id,
    mi.id AS menu_item_id,
    r.id AS role_id,
    r.nombre AS role_name,
    CASE
      WHEN r.nombre IN ('SUPER_ADMIN', 'SUPER_USER', 'ADMIN') THEN 'WRITE'
      WHEN r.nombre = 'USER' THEN 'READ'
      ELSE NULL
    END AS access_level,
    CASE
      WHEN r.nombre IN ('SUPER_ADMIN', 'SUPER_USER', 'ADMIN')
        THEN '{"read": true, "create": true, "update": true, "delete": false}'::jsonb
      WHEN r.nombre = 'USER'
        THEN '{"read": true, "create": false, "update": false, "delete": false}'::jsonb
      ELSE NULL
    END AS actions
  FROM public.menu_items mi
  INNER JOIN public.roles r
    ON r.nombre IN ('SUPER_ADMIN', 'SUPER_USER', 'ADMIN', 'USER')
  WHERE mi.key = 'ELECTRONIC_INVOICING_SUPPLIERS'
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
