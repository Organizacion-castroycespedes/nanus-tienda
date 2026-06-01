BEGIN;

-- Rollback conservador de 20260604_electronic_invoicing_suppliers_phase_1.sql.
-- ADVERTENCIA: elimina datos fiscales nuevos de suppliers.
-- No toca purchases, compras, POS, suppliers base ni relaciones existentes.

DROP INDEX IF EXISTS public.idx_suppliers_tenant_fiscal_last_lookup_at;
DROP INDEX IF EXISTS public.idx_suppliers_tenant_fiscal_status;
DROP INDEX IF EXISTS public.idx_suppliers_tenant_document_number_normalized;

ALTER TABLE IF EXISTS public.suppliers
  DROP CONSTRAINT IF EXISTS chk_suppliers_fiscal_last_lookup_status,
  DROP CONSTRAINT IF EXISTS chk_suppliers_fiscal_status;

ALTER TABLE IF EXISTS public.suppliers
  DROP COLUMN IF EXISTS fiscal_last_lookup_status,
  DROP COLUMN IF EXISTS fiscal_last_lookup_at,
  DROP COLUMN IF EXISTS fiscal_provider,
  DROP COLUMN IF EXISTS fiscal_status,
  DROP COLUMN IF EXISTS fiscal_email,
  DROP COLUMN IF EXISTS legal_name,
  DROP COLUMN IF EXISTS verification_digit,
  DROP COLUMN IF EXISTS document_number_normalized,
  DROP COLUMN IF EXISTS document_type_code;

COMMIT;
