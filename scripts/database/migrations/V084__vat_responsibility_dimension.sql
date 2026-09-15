ALTER TABLE public.tenants_detalles
  ADD COLUMN IF NOT EXISTS vat_responsibility text NOT NULL DEFAULT 'UNKNOWN';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_tenants_detalles_vat_responsibility'
      AND conrelid = 'public.tenants_detalles'::regclass
  ) THEN
    ALTER TABLE public.tenants_detalles
      ADD CONSTRAINT chk_tenants_detalles_vat_responsibility
      CHECK (vat_responsibility IN ('RESPONSIBLE', 'NOT_RESPONSIBLE', 'UNKNOWN'));
  END IF;
END $$;
