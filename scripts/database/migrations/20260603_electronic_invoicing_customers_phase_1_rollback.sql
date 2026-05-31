BEGIN;

-- Rollback conservador de 20260603_electronic_invoicing_customers_phase_1.sql.
-- ADVERTENCIA: elimina logs DIAN/proveedor, catalogo DIAN y datos fiscales nuevos en customers.
-- No toca ventas, pedidos, POS, orders, sales ni funciones SQL criticas.

DROP TABLE IF EXISTS public.dian_acquirer_lookup_logs CASCADE;
DROP TABLE IF EXISTS public.dian_document_types CASCADE;

DROP INDEX IF EXISTS public.ux_customers_tenant_active_final_consumer;
DROP INDEX IF EXISTS public.idx_customers_tenant_document_number_normalized;

ALTER TABLE IF EXISTS public.customers
  DROP CONSTRAINT IF EXISTS chk_customers_dian_last_lookup_status,
  DROP CONSTRAINT IF EXISTS chk_customers_fiscal_status;

ALTER TABLE IF EXISTS public.customers
  DROP COLUMN IF EXISTS fiscal_status,
  DROP COLUMN IF EXISTS dian_last_lookup_status,
  DROP COLUMN IF EXISTS dian_last_lookup_at,
  DROP COLUMN IF EXISTS is_final_consumer,
  DROP COLUMN IF EXISTS fiscal_email,
  DROP COLUMN IF EXISTS legal_name,
  DROP COLUMN IF EXISTS verification_digit,
  DROP COLUMN IF EXISTS document_number_normalized,
  DROP COLUMN IF EXISTS document_type_code;

COMMIT;
