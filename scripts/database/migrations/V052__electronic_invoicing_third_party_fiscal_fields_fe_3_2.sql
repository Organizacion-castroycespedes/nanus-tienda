BEGIN;

-- FE-3.2: base fiscal minima para customers y suppliers.
-- No consulta DIAN, no usa SOAP, no toca POS, ventas, pricing, Orders ni compras.

DO $$
BEGIN
  IF to_regclass('public.customers') IS NULL THEN
    RAISE EXCEPTION 'Required table public.customers does not exist';
  END IF;

  IF to_regclass('public.suppliers') IS NULL THEN
    RAISE EXCEPTION 'Required table public.suppliers does not exist';
  END IF;
END $$;

ALTER TABLE IF EXISTS public.customers
  ADD COLUMN IF NOT EXISTS dian_identification_type text,
  ADD COLUMN IF NOT EXISTS identification_number text,
  ADD COLUMN IF NOT EXISTS trade_name text,
  ADD COLUMN IF NOT EXISTS invoice_email text,
  ADD COLUMN IF NOT EXISTS country_code text,
  ADD COLUMN IF NOT EXISTS department_code text,
  ADD COLUMN IF NOT EXISTS municipality_code text,
  ADD COLUMN IF NOT EXISTS person_type text,
  ADD COLUMN IF NOT EXISTS tax_regime text,
  ADD COLUMN IF NOT EXISTS tax_responsibilities jsonb,
  ADD COLUMN IF NOT EXISTS is_dian_validated boolean,
  ADD COLUMN IF NOT EXISTS dian_metadata jsonb,
  ADD COLUMN IF NOT EXISTS fiscal_data_source text;

ALTER TABLE IF EXISTS public.suppliers
  ADD COLUMN IF NOT EXISTS dian_identification_type text,
  ADD COLUMN IF NOT EXISTS identification_number text,
  ADD COLUMN IF NOT EXISTS trade_name text,
  ADD COLUMN IF NOT EXISTS invoice_email text,
  ADD COLUMN IF NOT EXISTS country_code text,
  ADD COLUMN IF NOT EXISTS department_code text,
  ADD COLUMN IF NOT EXISTS municipality_code text,
  ADD COLUMN IF NOT EXISTS person_type text,
  ADD COLUMN IF NOT EXISTS tax_regime text,
  ADD COLUMN IF NOT EXISTS tax_responsibilities jsonb,
  ADD COLUMN IF NOT EXISTS is_dian_validated boolean,
  ADD COLUMN IF NOT EXISTS dian_metadata jsonb,
  ADD COLUMN IF NOT EXISTS fiscal_data_source text;

UPDATE public.customers
SET
  document_type_code = COALESCE(
    NULLIF(btrim(document_type_code), ''),
    NULLIF(btrim(dian_identification_type), '')
  ),
  document_number_normalized = COALESCE(
    NULLIF(btrim(document_number_normalized), ''),
    NULLIF(regexp_replace(upper(btrim(COALESCE(identification_number, document_number, ''))), '[^0-9A-Z]', '', 'g'), '')
  ),
  dian_identification_type = COALESCE(
    NULLIF(btrim(dian_identification_type), ''),
    NULLIF(btrim(document_type_code), '')
  ),
  identification_number = COALESCE(
    NULLIF(btrim(identification_number), ''),
    NULLIF(regexp_replace(upper(btrim(COALESCE(document_number_normalized, document_number, ''))), '[^0-9A-Z]', '', 'g'), '')
  ),
  trade_name = COALESCE(NULLIF(btrim(trade_name), ''), NULLIF(btrim(name), '')),
  invoice_email = COALESCE(
    NULLIF(lower(btrim(invoice_email)), ''),
    NULLIF(lower(btrim(fiscal_email)), '')
  ),
  tax_responsibilities = COALESCE(tax_responsibilities, '[]'::jsonb),
  is_dian_validated = COALESCE(is_dian_validated, fiscal_status = 'VALIDATED'),
  dian_metadata = COALESCE(dian_metadata, '{}'::jsonb),
  fiscal_data_source = COALESCE(NULLIF(btrim(fiscal_data_source), ''), 'MANUAL');

UPDATE public.suppliers
SET
  document_type_code = COALESCE(
    NULLIF(btrim(document_type_code), ''),
    NULLIF(btrim(dian_identification_type), '')
  ),
  document_number_normalized = COALESCE(
    NULLIF(btrim(document_number_normalized), ''),
    NULLIF(regexp_replace(upper(btrim(COALESCE(identification_number, document_number, ''))), '[^0-9A-Z]', '', 'g'), '')
  ),
  dian_identification_type = COALESCE(
    NULLIF(btrim(dian_identification_type), ''),
    NULLIF(btrim(document_type_code), '')
  ),
  identification_number = COALESCE(
    NULLIF(btrim(identification_number), ''),
    NULLIF(regexp_replace(upper(btrim(COALESCE(document_number_normalized, document_number, ''))), '[^0-9A-Z]', '', 'g'), '')
  ),
  trade_name = COALESCE(NULLIF(btrim(trade_name), ''), NULLIF(btrim(name), '')),
  invoice_email = COALESCE(
    NULLIF(lower(btrim(invoice_email)), ''),
    NULLIF(lower(btrim(fiscal_email)), '')
  ),
  tax_responsibilities = COALESCE(tax_responsibilities, '[]'::jsonb),
  is_dian_validated = COALESCE(is_dian_validated, fiscal_status = 'VALIDATED'),
  dian_metadata = COALESCE(dian_metadata, '{}'::jsonb),
  fiscal_data_source = COALESCE(
    NULLIF(btrim(fiscal_data_source), ''),
    NULLIF(btrim(fiscal_provider), ''),
    'MANUAL'
  );

ALTER TABLE IF EXISTS public.customers
  ALTER COLUMN tax_responsibilities SET DEFAULT '[]'::jsonb,
  ALTER COLUMN tax_responsibilities SET NOT NULL,
  ALTER COLUMN is_dian_validated SET DEFAULT false,
  ALTER COLUMN is_dian_validated SET NOT NULL,
  ALTER COLUMN dian_metadata SET DEFAULT '{}'::jsonb,
  ALTER COLUMN dian_metadata SET NOT NULL,
  ALTER COLUMN fiscal_data_source SET DEFAULT 'MANUAL',
  ALTER COLUMN fiscal_data_source SET NOT NULL;

ALTER TABLE IF EXISTS public.suppliers
  ALTER COLUMN tax_responsibilities SET DEFAULT '[]'::jsonb,
  ALTER COLUMN tax_responsibilities SET NOT NULL,
  ALTER COLUMN is_dian_validated SET DEFAULT false,
  ALTER COLUMN is_dian_validated SET NOT NULL,
  ALTER COLUMN dian_metadata SET DEFAULT '{}'::jsonb,
  ALTER COLUMN dian_metadata SET NOT NULL,
  ALTER COLUMN fiscal_data_source SET DEFAULT 'MANUAL',
  ALTER COLUMN fiscal_data_source SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_customers_person_type'
      AND conrelid = 'public.customers'::regclass
  ) THEN
    ALTER TABLE public.customers
      ADD CONSTRAINT chk_customers_person_type
      CHECK (person_type IS NULL OR person_type IN ('NATURAL', 'JURIDICA', 'UNKNOWN'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_suppliers_person_type'
      AND conrelid = 'public.suppliers'::regclass
  ) THEN
    ALTER TABLE public.suppliers
      ADD CONSTRAINT chk_suppliers_person_type
      CHECK (person_type IS NULL OR person_type IN ('NATURAL', 'JURIDICA', 'UNKNOWN'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_customers_fiscal_data_source'
      AND conrelid = 'public.customers'::regclass
  ) THEN
    ALTER TABLE public.customers
      ADD CONSTRAINT chk_customers_fiscal_data_source
      CHECK (fiscal_data_source IN ('MANUAL', 'MOCK_LOCAL', 'DIAN_DIRECT', 'TECH_PROVIDER', 'RUT', 'UNKNOWN'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_suppliers_fiscal_data_source'
      AND conrelid = 'public.suppliers'::regclass
  ) THEN
    ALTER TABLE public.suppliers
      ADD CONSTRAINT chk_suppliers_fiscal_data_source
      CHECK (fiscal_data_source IN ('MANUAL', 'MOCK_LOCAL', 'DIAN_DIRECT', 'TECH_PROVIDER', 'RUT', 'UNKNOWN'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_customers_tax_responsibilities_array'
      AND conrelid = 'public.customers'::regclass
  ) THEN
    ALTER TABLE public.customers
      ADD CONSTRAINT chk_customers_tax_responsibilities_array
      CHECK (jsonb_typeof(tax_responsibilities) = 'array');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_suppliers_tax_responsibilities_array'
      AND conrelid = 'public.suppliers'::regclass
  ) THEN
    ALTER TABLE public.suppliers
      ADD CONSTRAINT chk_suppliers_tax_responsibilities_array
      CHECK (jsonb_typeof(tax_responsibilities) = 'array');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_customers_dian_metadata_object'
      AND conrelid = 'public.customers'::regclass
  ) THEN
    ALTER TABLE public.customers
      ADD CONSTRAINT chk_customers_dian_metadata_object
      CHECK (jsonb_typeof(dian_metadata) = 'object');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_suppliers_dian_metadata_object'
      AND conrelid = 'public.suppliers'::regclass
  ) THEN
    ALTER TABLE public.suppliers
      ADD CONSTRAINT chk_suppliers_dian_metadata_object
      CHECK (jsonb_typeof(dian_metadata) = 'object');
  END IF;
END $$;

DO $$
DECLARE
  duplicate_count integer;
BEGIN
  SELECT count(*)
  INTO duplicate_count
  FROM (
    SELECT
      tenant_id,
      COALESCE(NULLIF(btrim(dian_identification_type), ''), NULLIF(btrim(document_type_code), '')) AS fiscal_type,
      COALESCE(NULLIF(btrim(identification_number), ''), NULLIF(btrim(document_number_normalized), '')) AS fiscal_number
    FROM public.customers
    WHERE COALESCE(NULLIF(btrim(dian_identification_type), ''), NULLIF(btrim(document_type_code), '')) IS NOT NULL
      AND COALESCE(NULLIF(btrim(identification_number), ''), NULLIF(btrim(document_number_normalized), '')) IS NOT NULL
    GROUP BY 1, 2, 3
    HAVING count(*) > 1
  ) duplicated;

  IF duplicate_count > 0 THEN
    RAISE EXCEPTION 'Duplicate fiscal identity exists in customers for tenant + type + number';
  END IF;

  SELECT count(*)
  INTO duplicate_count
  FROM (
    SELECT
      tenant_id,
      COALESCE(NULLIF(btrim(dian_identification_type), ''), NULLIF(btrim(document_type_code), '')) AS fiscal_type,
      COALESCE(NULLIF(btrim(identification_number), ''), NULLIF(btrim(document_number_normalized), '')) AS fiscal_number
    FROM public.suppliers
    WHERE COALESCE(NULLIF(btrim(dian_identification_type), ''), NULLIF(btrim(document_type_code), '')) IS NOT NULL
      AND COALESCE(NULLIF(btrim(identification_number), ''), NULLIF(btrim(document_number_normalized), '')) IS NOT NULL
    GROUP BY 1, 2, 3
    HAVING count(*) > 1
  ) duplicated;

  IF duplicate_count > 0 THEN
    RAISE EXCEPTION 'Duplicate fiscal identity exists in suppliers for tenant + type + number';
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS ux_customers_tenant_fiscal_identity_fe_3_2
  ON public.customers (
    tenant_id,
    COALESCE(NULLIF(btrim(dian_identification_type), ''), NULLIF(btrim(document_type_code), '')),
    COALESCE(NULLIF(btrim(identification_number), ''), NULLIF(btrim(document_number_normalized), ''))
  )
  WHERE COALESCE(NULLIF(btrim(dian_identification_type), ''), NULLIF(btrim(document_type_code), '')) IS NOT NULL
    AND COALESCE(NULLIF(btrim(identification_number), ''), NULLIF(btrim(document_number_normalized), '')) IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_suppliers_tenant_fiscal_identity_fe_3_2
  ON public.suppliers (
    tenant_id,
    COALESCE(NULLIF(btrim(dian_identification_type), ''), NULLIF(btrim(document_type_code), '')),
    COALESCE(NULLIF(btrim(identification_number), ''), NULLIF(btrim(document_number_normalized), ''))
  )
  WHERE COALESCE(NULLIF(btrim(dian_identification_type), ''), NULLIF(btrim(document_type_code), '')) IS NOT NULL
    AND COALESCE(NULLIF(btrim(identification_number), ''), NULLIF(btrim(document_number_normalized), '')) IS NOT NULL;

COMMIT;
