BEGIN;

INSERT INTO public.tenants (slug, nombre, config, activo)
VALUES ('default', 'Tenant Principal', '{}'::jsonb, true)
ON CONFLICT (slug) DO NOTHING;

WITH tenant_target AS (
  SELECT id
  FROM public.tenants
  WHERE slug = 'default'
  LIMIT 1
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

WITH tenant_target AS (
  SELECT id
  FROM public.tenants
  WHERE slug = 'default'
  LIMIT 1
),
persona_final AS (
  SELECT p.id, p.tenant_id
  FROM public.personas p
  JOIN tenant_target t ON t.id = p.tenant_id
  WHERE lower(p.email_personal) = lower(:'super_admin_email')
  LIMIT 1
)
UPDATE public.users u
SET
  persona_id = pf.id,
  password_hash = crypt(:'super_admin_password', gen_salt('bf')),
  estado = 'ACTIVE'
FROM persona_final pf
WHERE u.tenant_id = pf.tenant_id
  AND lower(u.email) = lower(:'super_admin_email');

INSERT INTO public.persona_tenant_branches (
  persona_id,
  tenant_branch_id,
  tenant_id,
  es_principal
)
SELECT
  p.id,
  b.id,
  p.tenant_id,
  TRUE
FROM public.personas p
JOIN public.tenants t
  ON t.id = p.tenant_id
  AND t.slug = 'default'
JOIN public.tenant_branches b
  ON b.tenant_id = p.tenant_id
  AND b.es_principal = TRUE
WHERE lower(p.email_personal) = lower(:'super_admin_email')
ON CONFLICT (persona_id, tenant_branch_id) DO UPDATE
SET
  tenant_id = EXCLUDED.tenant_id,
  es_principal = TRUE;

INSERT INTO public.terminals (
  tenant_id,
  branch_id,
  name,
  code,
  device_fingerprint,
  is_active
)
SELECT
  b.tenant_id,
  b.id,
  'Terminal 1',
  'TERM-001',
  NULL,
  TRUE
FROM public.tenant_branches b
JOIN public.tenants t
  ON t.id = b.tenant_id
  AND t.slug = 'default'
WHERE b.es_principal = TRUE
  AND NOT EXISTS (
    SELECT 1
    FROM public.terminals term
    WHERE term.tenant_id = b.tenant_id
      AND term.branch_id = b.id
      AND term.code = 'TERM-001'
  );

WITH tenant_branches AS (
  SELECT
    t.id AS tenant_id,
    t.slug AS tenant_slug,
    t.nombre AS tenant_name,
    b.id AS branch_id,
    b.nombre AS branch_name
  FROM public.tenants t
  INNER JOIN public.tenant_branches b
    ON b.tenant_id = t.id
   AND b.es_principal = TRUE
),
seed_users AS (
  SELECT
    tb.tenant_id,
    tb.tenant_slug,
    tb.tenant_name,
    tb.branch_id,
    tb.branch_name,
    seed.role_name,
    seed.nombres,
    seed.apellidos,
    seed.documento_tipo,
    seed.documento_numero_prefix || upper(replace(tb.tenant_slug, '-', '_')) AS documento_numero,
    lower(seed.email_prefix || '+' || tb.tenant_slug || '@manustienda.local') AS email,
    seed.cargo_nombre
  FROM tenant_branches tb
  CROSS JOIN (
    VALUES
      ('SUPER_USER', 'Super', 'User', 'CC', 'SU-', 'super.user', 'SUPER_USER'),
      ('ADMIN', 'Tenant', 'Admin', 'CC', 'AD-', 'admin', 'ADMIN'),
      ('USER', 'Pos', 'User', 'CC', 'US-', 'user', 'USER')
  ) AS seed(
    role_name,
    nombres,
    apellidos,
    documento_tipo,
    documento_numero_prefix,
    email_prefix,
    cargo_nombre
  )
),
upsert_personas AS (
  INSERT INTO public.personas (
    tenant_id,
    nombres,
    apellidos,
    documento_tipo,
    documento_numero,
    email_personal,
    cargo_nombre,
    cargo_descripcion,
    funciones_descripcion
  )
  SELECT
    su.tenant_id,
    su.nombres,
    su.apellidos,
    su.documento_tipo,
    su.documento_numero,
    su.email,
    su.cargo_nombre,
    'Seed automatico FASE 7',
    'Usuario de prueba para perfil ' || su.role_name
  FROM seed_users su
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.personas p
    WHERE p.tenant_id = su.tenant_id
      AND p.documento_numero = su.documento_numero
  )
  RETURNING tenant_id, documento_numero
),
personas_final AS (
  SELECT
    su.tenant_id,
    su.branch_id,
    su.role_name,
    su.email,
    su.documento_numero,
    p.id AS persona_id
  FROM seed_users su
  INNER JOIN public.personas p
    ON p.tenant_id = su.tenant_id
   AND p.documento_numero = su.documento_numero
),
upsert_users AS (
  INSERT INTO public.users (
    tenant_id,
    persona_id,
    email,
    password_hash,
    estado
  )
  SELECT
    pf.tenant_id,
    pf.persona_id,
    pf.email,
    crypt('12345678!', gen_salt('bf')),
    'ACTIVE'
  FROM personas_final pf
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.tenant_id = pf.tenant_id
      AND lower(u.email) = lower(pf.email)
  )
  RETURNING tenant_id, email
),
users_final AS (
  SELECT
    pf.tenant_id,
    pf.branch_id,
    pf.role_name,
    pf.persona_id,
    pf.email,
    u.id AS user_id
  FROM personas_final pf
  INNER JOIN public.users u
    ON u.tenant_id = pf.tenant_id
   AND lower(u.email) = lower(pf.email)
)
INSERT INTO public.user_roles (user_id, role_id, tenant_id)
SELECT
  uf.user_id,
  r.id,
  uf.tenant_id
FROM users_final uf
  INNER JOIN public.roles r
  ON r.nombre = uf.role_name
ON CONFLICT (user_id, role_id, tenant_id) DO NOTHING;

WITH tenant_branches AS (
  SELECT
    t.id AS tenant_id,
    t.slug AS tenant_slug,
    b.id AS branch_id
  FROM public.tenants t
  INNER JOIN public.tenant_branches b
    ON b.tenant_id = t.id
   AND b.es_principal = TRUE
),
seed_users AS (
  SELECT
    tb.tenant_id,
    lower(seed.email_prefix || '+' || tb.tenant_slug || '@manustienda.local') AS email,
    seed.documento_numero_prefix || upper(replace(tb.tenant_slug, '-', '_')) AS documento_numero
  FROM tenant_branches tb
  CROSS JOIN (
    VALUES
      ('super.user', 'SU-'),
      ('admin', 'AD-'),
      ('user', 'US-')
  ) AS seed(email_prefix, documento_numero_prefix)
),
personas_final AS (
  SELECT
    su.tenant_id,
    su.email,
    p.id AS persona_id
  FROM seed_users su
  INNER JOIN public.personas p
    ON p.tenant_id = su.tenant_id
   AND p.documento_numero = su.documento_numero
)
UPDATE public.users u
SET
  persona_id = pf.persona_id,
  password_hash = crypt('12345678!', gen_salt('bf')),
  estado = 'ACTIVE'
FROM personas_final pf
WHERE u.tenant_id = pf.tenant_id
  AND lower(u.email) = lower(pf.email);

WITH tenant_branches AS (
  SELECT
    t.id AS tenant_id,
    t.slug AS tenant_slug,
    b.id AS branch_id
  FROM public.tenants t
  INNER JOIN public.tenant_branches b
    ON b.tenant_id = t.id
   AND b.es_principal = TRUE
),
seed_users AS (
  SELECT
    tb.tenant_id,
    tb.branch_id,
    seed.documento_numero_prefix || upper(replace(tb.tenant_slug, '-', '_')) AS documento_numero
  FROM tenant_branches tb
  CROSS JOIN (
    VALUES
      ('SU-'),
      ('AD-'),
      ('US-')
  ) AS seed(documento_numero_prefix)
)
INSERT INTO public.persona_tenant_branches (
  persona_id,
  tenant_branch_id,
  tenant_id,
  es_principal
)
SELECT
  p.id,
  su.branch_id,
  su.tenant_id,
  TRUE
FROM seed_users su
INNER JOIN public.personas p
  ON p.tenant_id = su.tenant_id
 AND p.documento_numero = su.documento_numero
ON CONFLICT (persona_id, tenant_branch_id) DO UPDATE
SET
  tenant_id = EXCLUDED.tenant_id,
  es_principal = TRUE;

COMMIT;
