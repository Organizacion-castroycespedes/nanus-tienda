BEGIN;

-- FE-1: clientes/adquirientes para facturacion electronica futura.
-- Migracion aditiva y compatible con customers actual.
-- No crea tabla paralela de clientes, no siembra catalogos DIAN y no toca ventas/pedidos/POS.

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;

DO $$
BEGIN
  IF to_regclass('public.customers') IS NULL THEN
    RAISE EXCEPTION 'Required table public.customers does not exist';
  END IF;
END $$;

ALTER TABLE IF EXISTS public.customers
  ADD COLUMN IF NOT EXISTS document_type_code text,
  ADD COLUMN IF NOT EXISTS document_number_normalized text,
  ADD COLUMN IF NOT EXISTS verification_digit text,
  ADD COLUMN IF NOT EXISTS legal_name text,
  ADD COLUMN IF NOT EXISTS fiscal_email text,
  ADD COLUMN IF NOT EXISTS is_final_consumer boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS dian_last_lookup_at timestamptz,
  ADD COLUMN IF NOT EXISTS dian_last_lookup_status text,
  ADD COLUMN IF NOT EXISTS fiscal_status text NOT NULL DEFAULT 'PENDING';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_customers_fiscal_status'
      AND conrelid = 'public.customers'::regclass
  ) THEN
    ALTER TABLE public.customers
      ADD CONSTRAINT chk_customers_fiscal_status
      CHECK (fiscal_status IN ('PENDING', 'VALIDATED', 'FAILED', 'NOT_REQUIRED'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_customers_dian_last_lookup_status'
      AND conrelid = 'public.customers'::regclass
  ) THEN
    ALTER TABLE public.customers
      ADD CONSTRAINT chk_customers_dian_last_lookup_status
      CHECK (
        dian_last_lookup_status IS NULL
        OR dian_last_lookup_status IN ('PENDING', 'FOUND', 'NOT_FOUND', 'ERROR', 'SKIPPED')
      );
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'customers'
      AND column_name = 'document_number'
  ) THEN
    EXECUTE $sql$
      UPDATE public.customers
      SET document_number_normalized = NULLIF(
        regexp_replace(upper(trim(document_number)), '[^0-9A-Z]', '', 'g'),
        ''
      )
      WHERE document_number_normalized IS NULL
        AND document_number IS NOT NULL
        AND length(trim(document_number)) > 0
    $sql$;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'customers'
      AND column_name = 'is_default'
  ) THEN
    EXECUTE $sql$
      UPDATE public.customers
      SET is_final_consumer = true,
          fiscal_status = 'NOT_REQUIRED'
      WHERE is_default = true
        AND is_final_consumer = false
    $sql$;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_customers_tenant_document_number_normalized
  ON public.customers (tenant_id, document_number_normalized)
  WHERE document_number_normalized IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_customers_tenant_active_final_consumer
  ON public.customers (tenant_id)
  WHERE is_final_consumer = true
    AND is_active = true;

CREATE TABLE IF NOT EXISTS public.dian_document_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL,
  name text NOT NULL,
  description text,
  country_code text NOT NULL DEFAULT 'CO',
  is_active boolean NOT NULL DEFAULT true,
  valid_from date,
  valid_to date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_dian_document_types_code_non_empty'
      AND conrelid = 'public.dian_document_types'::regclass
  ) THEN
    ALTER TABLE public.dian_document_types
      ADD CONSTRAINT chk_dian_document_types_code_non_empty
      CHECK (length(trim(code)) > 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_dian_document_types_name_non_empty'
      AND conrelid = 'public.dian_document_types'::regclass
  ) THEN
    ALTER TABLE public.dian_document_types
      ADD CONSTRAINT chk_dian_document_types_name_non_empty
      CHECK (length(trim(name)) > 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_dian_document_types_country_code_non_empty'
      AND conrelid = 'public.dian_document_types'::regclass
  ) THEN
    ALTER TABLE public.dian_document_types
      ADD CONSTRAINT chk_dian_document_types_country_code_non_empty
      CHECK (length(trim(country_code)) > 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_dian_document_types_valid_range'
      AND conrelid = 'public.dian_document_types'::regclass
  ) THEN
    ALTER TABLE public.dian_document_types
      ADD CONSTRAINT chk_dian_document_types_valid_range
      CHECK (valid_to IS NULL OR valid_from IS NULL OR valid_to >= valid_from);
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS ux_dian_document_types_country_code_code
  ON public.dian_document_types (country_code, code);

CREATE TABLE IF NOT EXISTS public.dian_acquirer_lookup_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  customer_id uuid,
  provider text NOT NULL,
  document_type_code text,
  document_number text,
  request_hash text,
  lookup_status text NOT NULL,
  status_code text,
  message text,
  response_summary jsonb,
  looked_up_by uuid,
  looked_up_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_dian_acquirer_lookup_logs_provider_non_empty'
      AND conrelid = 'public.dian_acquirer_lookup_logs'::regclass
  ) THEN
    ALTER TABLE public.dian_acquirer_lookup_logs
      ADD CONSTRAINT chk_dian_acquirer_lookup_logs_provider_non_empty
      CHECK (length(trim(provider)) > 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_dian_acquirer_lookup_logs_status'
      AND conrelid = 'public.dian_acquirer_lookup_logs'::regclass
  ) THEN
    ALTER TABLE public.dian_acquirer_lookup_logs
      ADD CONSTRAINT chk_dian_acquirer_lookup_logs_status
      CHECK (lookup_status IN ('FOUND', 'NOT_FOUND', 'ERROR', 'SKIPPED'));
  END IF;

  IF to_regclass('public.tenants') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM pg_constraint
       WHERE conname = 'fk_dian_acquirer_lookup_logs_tenant'
         AND conrelid = 'public.dian_acquirer_lookup_logs'::regclass
     ) THEN
    ALTER TABLE public.dian_acquirer_lookup_logs
      ADD CONSTRAINT fk_dian_acquirer_lookup_logs_tenant
      FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_dian_acquirer_lookup_logs_customer'
      AND conrelid = 'public.dian_acquirer_lookup_logs'::regclass
  ) THEN
    ALTER TABLE public.dian_acquirer_lookup_logs
      ADD CONSTRAINT fk_dian_acquirer_lookup_logs_customer
      FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE SET NULL;
  END IF;

  IF to_regclass('public.users') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM pg_constraint
       WHERE conname = 'fk_dian_acquirer_lookup_logs_looked_up_by'
         AND conrelid = 'public.dian_acquirer_lookup_logs'::regclass
     ) THEN
    ALTER TABLE public.dian_acquirer_lookup_logs
      ADD CONSTRAINT fk_dian_acquirer_lookup_logs_looked_up_by
      FOREIGN KEY (looked_up_by) REFERENCES public.users(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_dian_acquirer_lookup_logs_tenant_customer
  ON public.dian_acquirer_lookup_logs (tenant_id, customer_id)
  WHERE customer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_dian_acquirer_lookup_logs_tenant_looked_up_at
  ON public.dian_acquirer_lookup_logs (tenant_id, looked_up_at DESC);

COMMIT;
