BEGIN;

INSERT INTO public.tenants (slug, nombre, config, activo)
VALUES ('default', 'Tenant Principal', '{}'::jsonb, true)
ON CONFLICT (slug) DO NOTHING;

WITH tenant_target AS (
  SELECT id FROM public.tenants WHERE slug = 'default' LIMIT 1
),
persona_upsert AS (
  INSERT INTO public.personas (
    tenant_id,
    nombres,
    apellidos,
    documento_tipo,
    documento_numero,
    email_personal,
    cargo_nombre
  )
  SELECT
    t.id,
    :'super_admin_first_name',
    :'super_admin_last_name',
    'CC',
    '0000000000',
    :'super_admin_email',
    'SUPER_ADMIN'
  FROM tenant_target t
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.personas p
    WHERE p.tenant_id = t.id
      AND lower(p.email_personal) = lower(:'super_admin_email')
  )
  RETURNING id, tenant_id
),
persona_final AS (
  SELECT id, tenant_id FROM persona_upsert
  UNION ALL
  SELECT p.id, p.tenant_id
  FROM public.personas p
  JOIN tenant_target t ON t.id = p.tenant_id
  WHERE lower(p.email_personal) = lower(:'super_admin_email')
  LIMIT 1
),
user_upsert AS (
  INSERT INTO public.users (tenant_id, persona_id, email, password_hash, estado)
  SELECT
    p.tenant_id,
    p.id,
    lower(:'super_admin_email'),
    crypt(:'super_admin_password', gen_salt('bf')),
    'ACTIVE'
  FROM persona_final p
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.tenant_id = p.tenant_id
      AND lower(u.email) = lower(:'super_admin_email')
  )
  RETURNING id, tenant_id
),
user_final AS (
  SELECT id, tenant_id FROM user_upsert
  UNION ALL
  SELECT u.id, u.tenant_id
  FROM public.users u
  JOIN tenant_target t ON t.id = u.tenant_id
  WHERE lower(u.email) = lower(:'super_admin_email')
  LIMIT 1
)
INSERT INTO public.user_roles (user_id, role_id, tenant_id)
SELECT
  u.id,
  r.id,
  u.tenant_id
FROM user_final u
JOIN public.roles r ON r.nombre = 'SUPER_ADMIN'
ON CONFLICT (user_id, role_id, tenant_id) DO NOTHING;

COMMIT;

