-- Permiso Dashboard (opción inicial del menú)

INSERT INTO public.permissions (
    role_id,
    tenant_id,
    module,
    route,
    label,
    visible
)
SELECT
    r.id,
    t.id,
    'dashboard',
    '/{tenant}/dashboard',
    'Dashboard',
    true
FROM public.roles r
CROSS JOIN public.tenants t
WHERE r.nombre IN ('SUPER_ADMIN', 'ADMIN', 'USER')
AND NOT EXISTS (
    SELECT 1
    FROM public.permissions p
    WHERE p.module = 'dashboard'
      AND p.role_id = r.id
      AND p.tenant_id = t.id
);
