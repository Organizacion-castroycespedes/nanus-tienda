BEGIN;

-- MVP-01.2B: required functional catalog seed and final consumer normalization.
-- Idempotent. No external calls. No demo products or inventory fixtures here.

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;

DO $$
BEGIN
  IF to_regclass('public.tenants') IS NULL THEN
    RAISE EXCEPTION 'Required table public.tenants does not exist';
  END IF;

  IF to_regclass('public.customers') IS NULL THEN
    RAISE EXCEPTION 'Required table public.customers does not exist';
  END IF;

  IF to_regclass('public.units') IS NULL THEN
    RAISE EXCEPTION 'Required table public.units does not exist';
  END IF;

  IF to_regclass('public.taxes') IS NULL THEN
    RAISE EXCEPTION 'Required table public.taxes does not exist';
  END IF;
END $$;

ALTER TABLE IF EXISTS public.customers
  ADD COLUMN IF NOT EXISTS is_default boolean NOT NULL DEFAULT false;

ALTER TABLE IF EXISTS public.units
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

ALTER TABLE IF EXISTS public.taxes
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

UPDATE public.customers
SET is_default = false
WHERE is_default IS NULL;

CREATE TEMP TABLE tmp_mvp_01_2b_final_consumer_ranked ON COMMIT DROP AS
WITH candidates AS (
  SELECT
    c.id,
    c.tenant_id,
    c.is_default,
    c.is_final_consumer,
    c.is_active,
    c.created_at,
    c.updated_at,
    ROW_NUMBER() OVER (
      PARTITION BY c.tenant_id
      ORDER BY
        CASE
          WHEN c.is_final_consumer = true AND c.is_active = true THEN 0
          WHEN c.is_default = true THEN 1
          WHEN upper(btrim(c.name)) IN ('CONSUMIDOR FINAL', 'CONSUMIDOR FINAL FE') THEN 2
          ELSE 3
        END,
        c.updated_at DESC NULLS LAST,
        c.created_at ASC NULLS LAST,
        c.id
    ) AS rn
  FROM public.customers c
  WHERE c.is_default = true
     OR (c.is_final_consumer = true AND c.is_active = true)
     OR upper(btrim(c.name)) IN ('CONSUMIDOR FINAL', 'CONSUMIDOR FINAL FE')
);

UPDATE public.customers c
SET
  is_default = false,
  is_final_consumer = false,
  updated_at = now()
FROM tmp_mvp_01_2b_final_consumer_ranked r
WHERE c.id = r.id
  AND r.rn > 1
  AND (c.is_default = true OR c.is_final_consumer = true);

UPDATE public.customers c
SET
  name = COALESCE(NULLIF(btrim(c.name), ''), 'Consumidor Final'),
  is_default = true,
  is_final_consumer = true,
  is_active = true,
  fiscal_status = 'NOT_REQUIRED',
  fiscal_data_source = 'MANUAL',
  is_dian_validated = false,
  tax_responsibilities = COALESCE(c.tax_responsibilities, '[]'::jsonb),
  dian_metadata = COALESCE(c.dian_metadata, '{}'::jsonb),
  document_number_normalized = COALESCE(
    NULLIF(btrim(c.document_number_normalized), ''),
    NULLIF(regexp_replace(upper(btrim(COALESCE(c.document_number, ''))), '[^0-9A-Z]', '', 'g'), '')
  ),
  trade_name = COALESCE(NULLIF(btrim(c.trade_name), ''), NULLIF(btrim(c.name), ''), 'Consumidor Final'),
  updated_at = now()
FROM tmp_mvp_01_2b_final_consumer_ranked r
WHERE c.id = r.id
  AND r.rn = 1;

INSERT INTO public.customers (
  id,
  tenant_id,
  name,
  is_default,
  is_final_consumer,
  is_active,
  fiscal_status,
  fiscal_data_source,
  is_dian_validated,
  tax_responsibilities,
  dian_metadata,
  trade_name,
  created_at,
  updated_at
)
SELECT
  gen_random_uuid(),
  t.id,
  'Consumidor Final',
  true,
  true,
  true,
  'NOT_REQUIRED',
  'MANUAL',
  false,
  '[]'::jsonb,
  '{}'::jsonb,
  'Consumidor Final',
  now(),
  now()
FROM public.tenants t
WHERE COALESCE(t.activo, true) = true
  AND NOT EXISTS (
    SELECT 1
    FROM tmp_mvp_01_2b_final_consumer_ranked r
    WHERE r.tenant_id = t.id
      AND r.rn = 1
  );

CREATE UNIQUE INDEX IF NOT EXISTS ux_customers_tenant_default
  ON public.customers (tenant_id)
  WHERE is_default = true;

CREATE UNIQUE INDEX IF NOT EXISTS ux_customers_tenant_active_final_consumer
  ON public.customers (tenant_id)
  WHERE is_final_consumer = true
    AND is_active = true;

WITH seed_units(name, abbreviation) AS (
  VALUES
    ('Unidad', 'UND'),
    ('Kilogramo', 'KG'),
    ('Litro', 'LT'),
    ('Caja', 'CJ')
)
UPDATE public.units u
SET is_active = true
FROM seed_units seed
WHERE UPPER(u.name) = UPPER(seed.name)
   OR UPPER(u.abbreviation) = UPPER(seed.abbreviation);

WITH active_tenants AS (
  SELECT id
  FROM public.tenants
  WHERE COALESCE(activo, true) = true
),
seed_units(name, abbreviation) AS (
  VALUES
    ('Unidad', 'UND'),
    ('Kilogramo', 'KG'),
    ('Litro', 'LT'),
    ('Caja', 'CJ')
)
INSERT INTO public.units (id, tenant_id, name, abbreviation, is_active)
SELECT
  gen_random_uuid(),
  t.id,
  seed.name,
  seed.abbreviation,
  true
FROM active_tenants t
CROSS JOIN seed_units seed
WHERE NOT EXISTS (
  SELECT 1
  FROM public.units u
  WHERE u.tenant_id = t.id
    AND (
      UPPER(u.name) = UPPER(seed.name)
      OR UPPER(u.abbreviation) = UPPER(seed.abbreviation)
    )
);

WITH seed_taxes(name, rate, is_included) AS (
  VALUES
    ('IVA 19%', 0.19::numeric, true),
    ('Exento', 0::numeric, false)
)
UPDATE public.taxes tx
SET is_active = true
FROM seed_taxes seed
WHERE UPPER(tx.name) = UPPER(seed.name)
   OR (tx.rate = seed.rate AND tx.is_included = seed.is_included);

WITH active_tenants AS (
  SELECT id
  FROM public.tenants
  WHERE COALESCE(activo, true) = true
),
seed_taxes(name, rate, is_included) AS (
  VALUES
    ('IVA 19%', 0.19::numeric, true),
    ('Exento', 0::numeric, false)
)
INSERT INTO public.taxes (id, tenant_id, name, rate, is_included, is_active)
SELECT
  gen_random_uuid(),
  t.id,
  seed.name,
  seed.rate,
  seed.is_included,
  true
FROM active_tenants t
CROSS JOIN seed_taxes seed
WHERE NOT EXISTS (
  SELECT 1
  FROM public.taxes tx
  WHERE tx.tenant_id = t.id
    AND (
      UPPER(tx.name) = UPPER(seed.name)
      OR (tx.rate = seed.rate AND tx.is_included = seed.is_included)
    )
);

COMMIT;
