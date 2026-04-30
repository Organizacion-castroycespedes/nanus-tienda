BEGIN;

INSERT INTO public.roles (nombre, descripcion)
VALUES
  ('SUPER_ADMIN', 'Super administrador del sistema'),
  ('SUPER_USER', 'Usuario corporativo con acceso global operativo'),
  ('ADMIN', 'Administrador operativo del tenant'),
  ('USER', 'Usuario operativo con acceso limitado')
ON CONFLICT (nombre) DO UPDATE
SET descripcion = EXCLUDED.descripcion;

WITH role_route_matrix AS (
  SELECT *
  FROM (
    VALUES
      ('SUPER_ADMIN', 'dashboard', '/{tenant}/dashboard', 'Dashboard'),
      ('SUPER_ADMIN', 'usuarios', '/{tenant}/usuarios', 'Usuarios'),
      ('SUPER_ADMIN', 'roles', '/{tenant}/roles', 'Roles'),
      ('SUPER_ADMIN', 'configuracion', '/{tenant}/configuracion', 'Configuracion'),
      ('SUPER_USER', 'dashboard', '/{tenant}/dashboard', 'Dashboard'),
      ('SUPER_USER', 'usuarios', '/{tenant}/usuarios', 'Usuarios'),
      ('SUPER_USER', 'configuracion', '/{tenant}/configuracion', 'Configuracion'),
      ('ADMIN', 'dashboard', '/{tenant}/dashboard', 'Dashboard'),
      ('ADMIN', 'configuracion', '/{tenant}/configuracion', 'Configuracion'),
      ('USER', 'dashboard', '/{tenant}/dashboard', 'Dashboard')
  ) AS seed(role_name, module, route, label)
)
INSERT INTO public.permissions (role_id, tenant_id, module, route, label, visible)
SELECT
  r.id,
  t.id,
  seed.module,
  seed.route,
  seed.label,
  TRUE
FROM role_route_matrix seed
INNER JOIN public.roles r
  ON r.nombre = seed.role_name
CROSS JOIN public.tenants t
ON CONFLICT (role_id, tenant_id, module, route) DO UPDATE
SET
  label = EXCLUDED.label,
  visible = EXCLUDED.visible;

COMMIT;
