BEGIN;

WITH tenant_branches AS (
  SELECT
    t.id AS tenant_id,
    t.slug AS tenant_slug
  FROM public.tenants t
  INNER JOIN public.tenant_branches b
    ON b.tenant_id = t.id
   AND b.es_principal = TRUE
),
seed_users AS (
  SELECT
    tb.tenant_id,
    seed.role_name,
    lower(seed.email_prefix || '+' || tb.tenant_slug || '@manustienda.local') AS email
  FROM tenant_branches tb
  CROSS JOIN (
    VALUES
      ('SUPER_USER', 'super.user'),
      ('ADMIN', 'admin'),
      ('USER', 'user')
  ) AS seed(role_name, email_prefix)
),
users_final AS (
  SELECT
    su.tenant_id,
    su.role_name,
    u.id AS user_id
  FROM seed_users su
  INNER JOIN public.users u
    ON u.tenant_id = su.tenant_id
   AND lower(u.email) = su.email
)
INSERT INTO public.user_roles (
  user_id,
  role_id,
  tenant_id
)
SELECT
  uf.user_id,
  r.id,
  uf.tenant_id
FROM users_final uf
INNER JOIN public.roles r
  ON r.nombre = uf.role_name
ON CONFLICT (user_id, role_id, tenant_id) DO NOTHING;

COMMIT;
