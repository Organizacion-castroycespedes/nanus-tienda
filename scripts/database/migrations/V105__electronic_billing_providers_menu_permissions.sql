-- Idempotent provider administration menu. SUPER_ADMIN only.
-- This file is applied by the normal migration process; it does not run here.

DO $$
BEGIN
  IF to_regclass('public.tenants') IS NULL
    OR to_regclass('public.menu_items') IS NULL
    OR to_regclass('public.roles') IS NULL
    OR to_regclass('public.role_menu_permissions') IS NULL THEN
    RAISE EXCEPTION 'Required menu governance tables do not exist';
  END IF;
END $$;

WITH provider_parent AS (
  SELECT tenant_id, id AS parent_id
  FROM public.menu_items
  WHERE key = 'CONFIG_GENERAL' AND deleted_at IS NULL
),
targets AS (
  SELECT t.id AS tenant_id, parent.parent_id
  FROM public.tenants t
  LEFT JOIN provider_parent parent ON parent.tenant_id = t.id
)
INSERT INTO public.menu_items (
  tenant_id, key, module, label, route, icon, parent_id, sort_order,
  visible, below_main_menu, metadata, created_at, updated_at, deleted_at
)
SELECT
  tenant_id,
  'ELECTRONIC_BILLING_PROVIDERS',
  'configuracion',
  'Proveedores de facturación electrónica',
  '/{tenant}/configuracion/facturacion-electronica/proveedores',
  'Receipt',
  parent_id,
  35,
  TRUE,
  FALSE,
  '{"permissionLevel":"WRITE","scope":"GLOBAL_PROVIDER_CATALOG"}'::jsonb,
  NOW(),
  NOW(),
  NULL
FROM targets
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
  updated_at = NOW(),
  deleted_at = NULL;

INSERT INTO public.role_menu_permissions (
  tenant_id, role_id, menu_item_id, access_level, actions
)
SELECT
  menu_item.tenant_id,
  role.id,
  menu_item.id,
  'WRITE',
  '{}'::jsonb
FROM public.menu_items menu_item
INNER JOIN public.roles role ON role.nombre = 'SUPER_ADMIN'
WHERE menu_item.key = 'ELECTRONIC_BILLING_PROVIDERS'
  AND menu_item.deleted_at IS NULL
ON CONFLICT (tenant_id, role_id, menu_item_id)
DO UPDATE SET access_level = 'WRITE', actions = COALESCE(public.role_menu_permissions.actions, '{}'::jsonb);
