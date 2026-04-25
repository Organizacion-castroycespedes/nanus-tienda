BEGIN;

INSERT INTO public.role_menu_permissions (
  id,
  tenant_id,
  role_id,
  menu_item_id,
  access_level,
  actions,
  created_at
)
SELECT
  p.id,
  t.id AS tenant_id,
  r.id AS role_id,
  mi.id AS menu_item_id,
  p.access_level,
  '{}'::jsonb AS actions,
  p.created_at
FROM public.tenants t
JOIN (
  VALUES
    ('dfb3f58d-35bb-49c0-ad4d-de83e78de89f'::uuid, 'USUARIOS_TENANT_USUARIOS', 'READ',  '2026-02-21 07:13:07.916386-06'::timestamptz),
    ('ef058ee3-21db-4be9-ac11-c639acb96a2c'::uuid, 'CONFIGURACION_TENANT_CONFIGURACION', 'READ', '2026-02-21 07:13:07.916386-06'::timestamptz),
    ('9e598254-a9ba-4bec-9e7e-02d159dbcab0'::uuid, 'ROLES_TENANT_ROLES', 'READ', '2026-02-21 07:13:07.916386-06'::timestamptz),
    ('60d53a64-de32-499b-8329-43f51fe4bdc2'::uuid, 'DASHBOARD_TENANT_DASHBOARD', 'READ', '2026-02-21 07:13:07.916386-06'::timestamptz),
    ('c59e3fa3-f686-4e8c-93ee-5c5adfb25609'::uuid, 'CONFIG_MENU', 'WRITE', '2026-02-21 07:13:59.217301-06'::timestamptz)
) AS p(id, menu_key, access_level, created_at)
  ON true
JOIN public.roles r
  ON r.nombre = 'SUPER_ADMIN'
JOIN public.menu_items mi
  ON mi.tenant_id = t.id
 AND mi.key = p.menu_key
 AND mi.deleted_at IS NULL
ON CONFLICT (tenant_id, role_id, menu_item_id) DO UPDATE
SET
  access_level = EXCLUDED.access_level,
  actions = EXCLUDED.actions;

COMMIT;
