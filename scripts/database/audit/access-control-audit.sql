-- Auditoria de control de accesos por rol, tenant, sucursal, menu y permisos.
-- Solo lectura. Este archivo no debe contener cambios de datos o esquema.

-- 1. Roles existentes.
SELECT
  r.id AS role_id,
  r.nombre AS role_name,
  r.descripcion,
  r.created_at
FROM public.roles r
ORDER BY r.nombre;

-- 2. Usuarios por rol.
SELECT
  t.id AS tenant_id,
  t.slug AS tenant_slug,
  u.id AS user_id,
  u.email,
  u.estado AS user_status,
  r.nombre AS role_name,
  p.id AS persona_id,
  p.nombres,
  p.apellidos
FROM public.users u
JOIN public.tenants t ON t.id = u.tenant_id
LEFT JOIN public.user_roles ur ON ur.user_id = u.id AND ur.tenant_id = u.tenant_id
LEFT JOIN public.roles r ON r.id = ur.role_id
LEFT JOIN public.personas p ON p.id = u.persona_id
ORDER BY t.slug, r.nombre NULLS LAST, u.email;

-- 3. Usuarios sin rol.
SELECT
  t.slug AS tenant_slug,
  u.id AS user_id,
  u.email,
  u.estado
FROM public.users u
JOIN public.tenants t ON t.id = u.tenant_id
LEFT JOIN public.user_roles ur ON ur.user_id = u.id AND ur.tenant_id = u.tenant_id
WHERE ur.user_id IS NULL
ORDER BY t.slug, u.email;

-- 4. Usuarios con multiples roles en el mismo tenant.
SELECT
  t.slug AS tenant_slug,
  u.id AS user_id,
  u.email,
  COUNT(DISTINCT ur.role_id) AS role_count,
  STRING_AGG(DISTINCT r.nombre, ', ' ORDER BY r.nombre) AS roles
FROM public.users u
JOIN public.tenants t ON t.id = u.tenant_id
JOIN public.user_roles ur ON ur.user_id = u.id AND ur.tenant_id = u.tenant_id
JOIN public.roles r ON r.id = ur.role_id
GROUP BY t.slug, u.id, u.email
HAVING COUNT(DISTINCT ur.role_id) > 1
ORDER BY t.slug, u.email;

-- 5. Usuarios sin persona.
SELECT
  t.slug AS tenant_slug,
  u.id AS user_id,
  u.email,
  u.estado
FROM public.users u
JOIN public.tenants t ON t.id = u.tenant_id
WHERE u.persona_id IS NULL
ORDER BY t.slug, u.email;

-- 6. Usuarios sin sucursal asignada.
SELECT
  t.slug AS tenant_slug,
  u.id AS user_id,
  u.email,
  r.nombre AS role_name
FROM public.users u
JOIN public.tenants t ON t.id = u.tenant_id
LEFT JOIN public.user_roles ur ON ur.user_id = u.id AND ur.tenant_id = u.tenant_id
LEFT JOIN public.roles r ON r.id = ur.role_id
LEFT JOIN public.personas p ON p.id = u.persona_id
LEFT JOIN public.persona_tenant_branches ptb
  ON ptb.persona_id = p.id
 AND ptb.tenant_id = u.tenant_id
WHERE ptb.persona_id IS NULL
ORDER BY t.slug, r.nombre NULLS LAST, u.email;

-- 7. Tenants y sucursales por usuario.
SELECT
  t.id AS tenant_id,
  t.slug AS tenant_slug,
  u.id AS user_id,
  u.email,
  r.nombre AS role_name,
  tb.id AS branch_id,
  tb.nombre AS branch_name,
  tb.estado AS branch_status,
  ptb.es_principal
FROM public.users u
JOIN public.tenants t ON t.id = u.tenant_id
LEFT JOIN public.user_roles ur ON ur.user_id = u.id AND ur.tenant_id = u.tenant_id
LEFT JOIN public.roles r ON r.id = ur.role_id
LEFT JOIN public.personas p ON p.id = u.persona_id
LEFT JOIN public.persona_tenant_branches ptb
  ON ptb.persona_id = p.id
 AND ptb.tenant_id = u.tenant_id
LEFT JOIN public.tenant_branches tb
  ON tb.id = ptb.tenant_branch_id
 AND tb.tenant_id = ptb.tenant_id
ORDER BY t.slug, u.email, tb.nombre;

-- 8. Menus por rol y permiso efectivo.
SELECT
  t.slug AS tenant_slug,
  r.nombre AS role_name,
  mi.key AS menu_key,
  mi.module,
  mi.label,
  mi.route,
  mi.visible,
  rmp.access_level,
  rmp.actions
FROM public.role_menu_permissions rmp
JOIN public.tenants t ON t.id = rmp.tenant_id
JOIN public.roles r ON r.id = rmp.role_id
JOIN public.menu_items mi ON mi.id = rmp.menu_item_id
ORDER BY t.slug, r.nombre, mi.module, mi.sort_order, mi.label;

-- 9. Modulos sin permisos asociados.
SELECT
  t.slug AS tenant_slug,
  mi.module,
  COUNT(*) AS menu_count
FROM public.menu_items mi
JOIN public.tenants t ON t.id = mi.tenant_id
LEFT JOIN public.role_menu_permissions rmp
  ON rmp.tenant_id = mi.tenant_id
 AND rmp.menu_item_id = mi.id
WHERE mi.deleted_at IS NULL
  AND rmp.menu_item_id IS NULL
GROUP BY t.slug, mi.module
ORDER BY t.slug, mi.module;

-- 10. Menus sin permisos.
SELECT
  t.slug AS tenant_slug,
  mi.id AS menu_item_id,
  mi.key,
  mi.module,
  mi.label,
  mi.route,
  mi.visible
FROM public.menu_items mi
JOIN public.tenants t ON t.id = mi.tenant_id
LEFT JOIN public.role_menu_permissions rmp
  ON rmp.tenant_id = mi.tenant_id
 AND rmp.menu_item_id = mi.id
WHERE mi.deleted_at IS NULL
  AND rmp.menu_item_id IS NULL
ORDER BY t.slug, mi.module, mi.sort_order, mi.label;

-- 11. Roles sin permisos por tenant.
SELECT
  t.slug AS tenant_slug,
  r.id AS role_id,
  r.nombre AS role_name
FROM public.tenants t
CROSS JOIN public.roles r
LEFT JOIN public.role_menu_permissions rmp
  ON rmp.tenant_id = t.id
 AND rmp.role_id = r.id
GROUP BY t.slug, r.id, r.nombre
HAVING COUNT(rmp.menu_item_id) = 0
ORDER BY t.slug, r.nombre;

-- 12. Permisos duplicados potenciales.
SELECT
  tenant_id,
  role_id,
  menu_item_id,
  COUNT(*) AS duplicate_count
FROM public.role_menu_permissions
GROUP BY tenant_id, role_id, menu_item_id
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC;

-- 13. Accesos potencialmente cruzados entre tenants.
SELECT
  ur.user_id,
  u.email,
  u.tenant_id AS user_tenant_id,
  ur.tenant_id AS role_tenant_id,
  ur.role_id
FROM public.user_roles ur
JOIN public.users u ON u.id = ur.user_id
WHERE ur.tenant_id <> u.tenant_id
ORDER BY u.email;

-- 14. Legacy permissions comparadas con menu_items.
SELECT
  t.slug AS tenant_slug,
  r.nombre AS role_name,
  p.module AS legacy_module,
  p.route AS legacy_route,
  p.label AS legacy_label,
  mi.id AS matching_menu_item_id,
  mi.key AS matching_menu_key
FROM public.permissions p
JOIN public.tenants t ON t.id = p.tenant_id
JOIN public.roles r ON r.id = p.role_id
LEFT JOIN public.menu_items mi
  ON mi.tenant_id = p.tenant_id
 AND (mi.route = p.route OR mi.module = p.module)
ORDER BY t.slug, r.nombre, p.module, p.route;
