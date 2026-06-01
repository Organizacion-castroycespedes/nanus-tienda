BEGIN;

-- FE-2.4B: proveedores fiscales para facturacion electronica futura.
-- Migracion aditiva y compatible con suppliers actual.
-- No crea tabla paralela de proveedores, no toca compras, purchases, POS ni reportes.

DO $$
BEGIN
  IF to_regclass('public.suppliers') IS NULL THEN
    RAISE EXCEPTION 'Required table public.suppliers does not exist';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'suppliers'
      AND column_name = 'tenant_id'
  ) THEN
    RAISE EXCEPTION 'Required column public.suppliers.tenant_id does not exist';
  END IF;
END $$;

ALTER TABLE IF EXISTS public.suppliers
  ADD COLUMN IF NOT EXISTS document_type_code text,
  ADD COLUMN IF NOT EXISTS document_number_normalized text,
  ADD COLUMN IF NOT EXISTS verification_digit text,
  ADD COLUMN IF NOT EXISTS legal_name text,
  ADD COLUMN IF NOT EXISTS fiscal_email text,
  ADD COLUMN IF NOT EXISTS fiscal_status text NOT NULL DEFAULT 'PENDING',
  ADD COLUMN IF NOT EXISTS fiscal_provider text,
  ADD COLUMN IF NOT EXISTS fiscal_last_lookup_at timestamptz,
  ADD COLUMN IF NOT EXISTS fiscal_last_lookup_status text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_suppliers_fiscal_status'
      AND conrelid = 'public.suppliers'::regclass
  ) THEN
    ALTER TABLE public.suppliers
      ADD CONSTRAINT chk_suppliers_fiscal_status
      CHECK (fiscal_status IN ('PENDING', 'VALIDATED', 'FAILED', 'NOT_REQUIRED'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_suppliers_fiscal_last_lookup_status'
      AND conrelid = 'public.suppliers'::regclass
  ) THEN
    ALTER TABLE public.suppliers
      ADD CONSTRAINT chk_suppliers_fiscal_last_lookup_status
      CHECK (
        fiscal_last_lookup_status IS NULL
        OR fiscal_last_lookup_status IN ('PENDING', 'FOUND', 'NOT_FOUND', 'ERROR', 'SKIPPED')
      );
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'suppliers'
      AND column_name = 'document_number'
  ) THEN
    EXECUTE $sql$
      UPDATE public.suppliers
      SET document_number_normalized = NULLIF(
        regexp_replace(upper(trim(document_number)), '[^0-9A-Z]', '', 'g'),
        ''
      )
      WHERE document_number_normalized IS NULL
        AND document_number IS NOT NULL
        AND length(trim(document_number)) > 0
    $sql$;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_suppliers_tenant_document_number_normalized
  ON public.suppliers (tenant_id, document_number_normalized)
  WHERE document_number_normalized IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_suppliers_tenant_fiscal_status
  ON public.suppliers (tenant_id, fiscal_status);

CREATE INDEX IF NOT EXISTS idx_suppliers_tenant_fiscal_last_lookup_at
  ON public.suppliers (tenant_id, fiscal_last_lookup_at DESC)
  WHERE fiscal_last_lookup_at IS NOT NULL;

COMMIT;
