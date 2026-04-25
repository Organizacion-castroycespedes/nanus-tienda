BEGIN;

INSERT INTO public.roles (nombre, descripcion)
VALUES
  ('SUPER_ADMIN', 'Super administrador del sistema'),
  ('ADMIN', 'Administrador del tenant'),
  ('USER', 'Usuario basico del tenant')
ON CONFLICT (nombre) DO NOTHING;

INSERT INTO public.permissions (role_id, tenant_id, module, route, label, visible)
SELECT r.id, t.id, p.module, p.route, p.label, true
FROM public.roles r
CROSS JOIN public.tenants t
JOIN (
  VALUES
    ('dashboard', '/{tenant}/dashboard', 'Dashboard'),
    ('usuarios', '/{tenant}/usuarios', 'Usuarios'),
    ('roles', '/{tenant}/roles', 'Roles'),
    ('configuracion', '/{tenant}/configuracion', 'Configuracion')
) AS p(module, route, label) ON true
WHERE r.nombre IN ('SUPER_ADMIN', 'ADMIN')
ON CONFLICT (role_id, tenant_id, module, route) DO NOTHING;

INSERT INTO public.permissions (role_id, tenant_id, module, route, label, visible)
SELECT r.id, t.id, 'dashboard', '/{tenant}/dashboard', 'Dashboard', true
FROM public.roles r
CROSS JOIN public.tenants t
WHERE r.nombre = 'USER'
ON CONFLICT (role_id, tenant_id, module, route) DO NOTHING;

COMMIT;

