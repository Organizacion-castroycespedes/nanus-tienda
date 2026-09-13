-- V081 Ensure tenants.slug exists and backfill from company name.
-- Idempotent. Safe for VPS via migrate_prd.sh / run_migrations.sh.
-- UUID primary key and all FKs remain unchanged (slug is external only).

-- 1) ALTER: column + uniqueness (no-op if already present)
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS slug text;

-- Backfill any null slug before NOT NULL / UNIQUE constraints
UPDATE public.tenants
SET slug = 'tenant-' || replace(id::text, '-', '')
WHERE slug IS NULL OR BTRIM(slug) = '';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'tenants_slug_key'
      AND conrelid = 'public.tenants'::regclass
  ) THEN
    ALTER TABLE public.tenants
      ADD CONSTRAINT tenants_slug_key UNIQUE (slug);
  END IF;
END $$;

ALTER TABLE public.tenants
  ALTER COLUMN slug SET NOT NULL;

-- 2) UPDATE explícito del tenant seed principal desde razón social
UPDATE public.tenants t
SET slug = 'manustienda-platform-s-a-s'
WHERE t.id = '00000000-0000-0000-0000-000000000001'
  AND lower(t.slug) IN ('default', 'manustienda-platform-s-a-s')
  AND NOT EXISTS (
    SELECT 1
    FROM public.tenants other
    WHERE other.slug = 'manustienda-platform-s-a-s'
      AND other.id <> t.id
  );

-- 3) UPDATE genérico: slugs 'default' o con forma UUID → slug desde razon_social/nombre
WITH source AS (
  SELECT
    t.id,
    t.slug AS current_slug,
    COALESCE(
      NULLIF(BTRIM(td.razon_social), ''),
      NULLIF(BTRIM(t.nombre), ''),
      t.slug
    ) AS source_name
  FROM public.tenants t
  LEFT JOIN public.tenants_detalles td ON td.tenant_id = t.id
  WHERE
    lower(t.slug) = 'default'
    OR t.slug ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    OR t.slug ~* '^tenant-[0-9a-f]{32}$'
),
normalized AS (
  SELECT
    id,
    current_slug,
    NULLIF(
      trim(both '-' from regexp_replace(
        lower(
          translate(
            source_name,
            'ÁÀÄÂáàäâÉÈËÊéèëêÍÌÏÎíìïîÓÒÖÔóòöôÚÙÜÛúùüûÑñÇç',
            'AAAAaaaaEEEEeeeeIIIIiiiiOOOOooooUUUUuuuuNnCc'
          )
        ),
        '[^a-z0-9]+',
        '-',
        'g'
      )),
      ''
    ) AS base_slug
  FROM source
),
with_fallback AS (
  SELECT
    id,
    current_slug,
    COALESCE(NULLIF(left(base_slug, 150), ''), 'tenant') AS base_slug
  FROM normalized
),
safe_base AS (
  SELECT
    id,
    current_slug,
    CASE
      WHEN base_slug IN ('login', 'api', 'auth', '_next', 'static')
        THEN base_slug || '-tenant'
      ELSE base_slug
    END AS base_slug
  FROM with_fallback
),
ranked AS (
  SELECT
    sb.id,
    sb.current_slug,
    sb.base_slug,
    ROW_NUMBER() OVER (PARTITION BY sb.base_slug ORDER BY sb.id) AS rn
  FROM safe_base sb
),
candidates AS (
  SELECT
    r.id,
    r.current_slug,
    CASE
      WHEN r.rn = 1
        AND NOT EXISTS (
          SELECT 1
          FROM public.tenants t
          WHERE t.slug = r.base_slug
            AND t.id <> r.id
        )
      THEN r.base_slug
      ELSE NULL
    END AS preferred_slug,
    r.base_slug,
    r.rn
  FROM ranked r
),
allocated AS (
  SELECT
    c.id,
    c.current_slug,
    COALESCE(
      c.preferred_slug,
      (
        SELECT cand
        FROM generate_series(2, 9999) AS g(n)
        CROSS JOIN LATERAL (
          SELECT left(c.base_slug, greatest(1, 150 - length(g.n::text) - 1))
            || '-'
            || g.n::text AS cand
        ) s
        WHERE NOT EXISTS (
          SELECT 1 FROM public.tenants t WHERE t.slug = s.cand AND t.id <> c.id
        )
        AND NOT EXISTS (
          SELECT 1
          FROM candidates c2
          WHERE c2.id <> c.id
            AND COALESCE(
              c2.preferred_slug,
              c2.base_slug || '-' || c2.rn::text
            ) = s.cand
        )
        LIMIT 1
      ),
      c.base_slug || '-' || c.rn::text
    ) AS next_slug
  FROM candidates c
)
UPDATE public.tenants t
SET slug = a.next_slug
FROM allocated a
WHERE t.id = a.id
  AND t.slug IS DISTINCT FROM a.next_slug;
