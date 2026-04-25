BEGIN;

WITH tenant_default AS (
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
  m.id,
  t.id,
  m.key,
  m.module,
  m.label,
  m.route,
  m.icon,
  NULL,
  m.sort_order,
  m.visible,
  m.below_main_menu,
  m.metadata,
  m.created_at,
  m.updated_at,
  NULL
FROM tenant_default t
JOIN (
  VALUES
    (
      '4e1c2260-b64b-4aed-99e1-2fe89017cdc2'::uuid,
      'DASHBOARD_TENANT_DASHBOARD',
      'dashboard',
      'Dashboard',
      '/{tenant}/dashboard',
      NULL::text,
      0,
      true,
      false,
      '{}'::jsonb,
      '2026-02-21 07:13:01.113965-06'::timestamptz,
      '2026-02-21 07:13:01.113965-06'::timestamptz
    ),
    (
      '0574daac-79ea-452e-976d-ca26475b2db7'::uuid,
      'CONFIGURACION_TENANT_CONFIGURACION',
      'configuracion',
      'Configuracion',
      '/{tenant}/configuracion',
      NULL::text,
      0,
      true,
      false,
      '{}'::jsonb,
      '2026-02-21 07:13:01.113965-06'::timestamptz,
      '2026-02-21 07:13:01.113965-06'::timestamptz
    )
) AS m(
  id,
  key,
  module,
  label,
  route,
  icon,
  sort_order,
  visible,
  below_main_menu,
  metadata,
  created_at,
  updated_at
) ON true
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

WITH tenant_default AS (
  SELECT id
  FROM public.tenants
  WHERE slug = 'default'
  LIMIT 1
),
parent_config AS (
  SELECT mi.id, mi.tenant_id
  FROM public.menu_items mi
  JOIN tenant_default t ON t.id = mi.tenant_id
  WHERE mi.key = 'CONFIGURACION_TENANT_CONFIGURACION'
    AND mi.deleted_at IS NULL
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
  m.id,
  p.tenant_id,
  m.key,
  m.module,
  m.label,
  m.route,
  m.icon,
  p.id,
  m.sort_order,
  m.visible,
  m.below_main_menu,
  m.metadata,
  m.created_at,
  m.updated_at,
  NULL
FROM parent_config p
JOIN (
  VALUES
    (
      'b87b443c-8ac0-41f8-b271-8fd5e557d826'::uuid,
      'CONFIG_MENU',
      'configuracion',
      'Menu',
      '/{tenant}/configuracion/menu',
      'Menu',
      0,
      true,
      false,
      '{}'::jsonb,
      '2026-02-21 07:13:51.49869-06'::timestamptz,
      '2026-02-21 07:18:56.452778-06'::timestamptz
    ),
    (
      'fe7e8715-f6ca-43ad-bc21-5d4d507a1fb9'::uuid,
      'ROLES_TENANT_ROLES',
      'roles',
      'Roles',
      '/{tenant}/roles',
      'Users',
      0,
      true,
      false,
      '{}'::jsonb,
      '2026-02-21 07:13:01.113965-06'::timestamptz,
      '2026-02-21 07:19:22.081859-06'::timestamptz
    ),
    (
      'c9388516-4d90-4782-9c59-e5395c0adf08'::uuid,
      'USUARIOS_TENANT_USUARIOS',
      'usuarios',
      'Usuarios',
      '/{tenant}/usuarios',
      'User',
      0,
      true,
      false,
      '{}'::jsonb,
      '2026-02-21 07:13:01.113965-06'::timestamptz,
      '2026-02-21 07:19:35.830178-06'::timestamptz
    )
) AS m(
  id,
  key,
  module,
  label,
  route,
  icon,
  sort_order,
  visible,
  below_main_menu,
  metadata,
  created_at,
  updated_at
) ON true
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

COMMIT;

