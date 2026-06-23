-- V070: Domicilios menu + permisos base.
-- Idempotente, no destructivo, no depende de scripts locales.
-- Objetivo:
-- - Asegurar menu_item DELIVERIES visible para todos los tenants.
-- - Sincronizar permisos de roles USER, ADMIN, SUPER_USER y SUPER_ADMIN.
-- - No eliminar permisos ni roles existentes.

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
  'DELIVERIES',
  'deliveries',
  'Domicilios',
  '/{tenant}/deliveries',
  'Truck',
  NULL,
  240,
  TRUE,
  FALSE,
  '{}'::jsonb,
  NOW(),
  NOW(),
  NULL
FROM public.tenants t
ON CONFLICT (tenant_id, key) WHERE deleted_at IS NULL
DO UPDATE SET
  module = EXCLUDED.module,
  label = EXCLUDED.label,
  route = EXCLUDED.route,
  icon = EXCLUDED.icon,
  sort_order = EXCLUDED.sort_order,
  visible = TRUE,
  below_main_menu = EXCLUDED.below_main_menu,
  metadata = COALESCE(public.menu_items.metadata, '{}'::jsonb) || EXCLUDED.metadata,
  updated_at = NOW(),
  deleted_at = NULL;

WITH role_permissions AS (
  SELECT * FROM (
    VALUES
      (
        'USER',
        'WRITE'::varchar(20),
        '{
          "DELIVERIES_VIEW": true,
          "DELIVERIES_CREATE": true,
          "DELIVERIES_UPDATE": true,
          "DELIVERIES_DISPATCH": true,
          "DELIVERIES_MARK_DELIVERED": true,
          "DELIVERIES_MARK_NOT_DELIVERED": true
        }'::jsonb
      ),
      (
        'ADMIN',
        'WRITE'::varchar(20),
        '{
          "DELIVERIES_VIEW": true,
          "DELIVERIES_CREATE": true,
          "DELIVERIES_UPDATE": true,
          "DELIVERIES_ASSIGN": true,
          "DELIVERIES_DISPATCH": true,
          "DELIVERIES_MARK_DELIVERED": true,
          "DELIVERIES_MARK_NOT_DELIVERED": true,
          "DELIVERIES_CANCEL": true,
          "DELIVERIES_REPORTS": true
        }'::jsonb
      ),
      (
        'SUPER_USER',
        'WRITE'::varchar(20),
        '{
          "DELIVERIES_VIEW": true,
          "DELIVERIES_CREATE": true,
          "DELIVERIES_UPDATE": true,
          "DELIVERIES_ASSIGN": true,
          "DELIVERIES_DISPATCH": true,
          "DELIVERIES_MARK_DELIVERED": true,
          "DELIVERIES_MARK_NOT_DELIVERED": true,
          "DELIVERIES_CANCEL": true,
          "DELIVERIES_REPORTS": true
        }'::jsonb
      ),
      (
        'SUPER_ADMIN',
        'WRITE'::varchar(20),
        '{
          "DELIVERIES_VIEW": true,
          "DELIVERIES_CREATE": true,
          "DELIVERIES_UPDATE": true,
          "DELIVERIES_ASSIGN": true,
          "DELIVERIES_DISPATCH": true,
          "DELIVERIES_MARK_DELIVERED": true,
          "DELIVERIES_MARK_NOT_DELIVERED": true,
          "DELIVERIES_CANCEL": true,
          "DELIVERIES_REPORTS": true
        }'::jsonb
      )
  ) AS x(role_name, access_level, actions)
),
resolved_permissions AS (
  SELECT
    r.id AS role_id,
    mi.tenant_id,
    mi.id AS menu_item_id,
    rp.access_level,
    rp.actions
  FROM role_permissions rp
  INNER JOIN public.roles r
    ON r.nombre = rp.role_name
  INNER JOIN public.menu_items mi
    ON mi.key = 'DELIVERIES'
   AND mi.deleted_at IS NULL
),
permission_targets AS (
  SELECT
    rp.role_id,
    rp.tenant_id,
    rp.menu_item_id,
    rp.access_level,
    rp.actions
  FROM resolved_permissions rp
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
  access_level,
  actions
FROM permission_targets
ON CONFLICT (tenant_id, role_id, menu_item_id) DO UPDATE
SET
  access_level = EXCLUDED.access_level,
  actions = EXCLUDED.actions;

COMMIT;
