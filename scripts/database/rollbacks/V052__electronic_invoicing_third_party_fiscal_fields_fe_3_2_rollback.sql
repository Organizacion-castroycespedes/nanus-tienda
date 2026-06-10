BEGIN;

-- Rollback conservador de V052__electronic_invoicing_third_party_fiscal_fields_fe_3_2.sql.
-- Elimina solo columnas/constraints/indices FE-3.2. No toca POS, ventas,
-- pricing, Orders, purchases ni campos fiscales FE anteriores.

DROP INDEX IF EXISTS public.ux_suppliers_tenant_fiscal_identity_fe_3_2;
DROP INDEX IF EXISTS public.ux_customers_tenant_fiscal_identity_fe_3_2;

ALTER TABLE IF EXISTS public.suppliers
  DROP CONSTRAINT IF EXISTS chk_suppliers_dian_metadata_object,
  DROP CONSTRAINT IF EXISTS chk_suppliers_tax_responsibilities_array,
  DROP CONSTRAINT IF EXISTS chk_suppliers_fiscal_data_source,
  DROP CONSTRAINT IF EXISTS chk_suppliers_person_type;

ALTER TABLE IF EXISTS public.customers
  DROP CONSTRAINT IF EXISTS chk_customers_dian_metadata_object,
  DROP CONSTRAINT IF EXISTS chk_customers_tax_responsibilities_array,
  DROP CONSTRAINT IF EXISTS chk_customers_fiscal_data_source,
  DROP CONSTRAINT IF EXISTS chk_customers_person_type;

ALTER TABLE IF EXISTS public.suppliers
  DROP COLUMN IF EXISTS fiscal_data_source,
  DROP COLUMN IF EXISTS dian_metadata,
  DROP COLUMN IF EXISTS is_dian_validated,
  DROP COLUMN IF EXISTS tax_responsibilities,
  DROP COLUMN IF EXISTS tax_regime,
  DROP COLUMN IF EXISTS person_type,
  DROP COLUMN IF EXISTS municipality_code,
  DROP COLUMN IF EXISTS department_code,
  DROP COLUMN IF EXISTS country_code,
  DROP COLUMN IF EXISTS invoice_email,
  DROP COLUMN IF EXISTS trade_name,
  DROP COLUMN IF EXISTS identification_number,
  DROP COLUMN IF EXISTS dian_identification_type;

ALTER TABLE IF EXISTS public.customers
  DROP COLUMN IF EXISTS fiscal_data_source,
  DROP COLUMN IF EXISTS dian_metadata,
  DROP COLUMN IF EXISTS is_dian_validated,
  DROP COLUMN IF EXISTS tax_responsibilities,
  DROP COLUMN IF EXISTS tax_regime,
  DROP COLUMN IF EXISTS person_type,
  DROP COLUMN IF EXISTS municipality_code,
  DROP COLUMN IF EXISTS department_code,
  DROP COLUMN IF EXISTS country_code,
  DROP COLUMN IF EXISTS invoice_email,
  DROP COLUMN IF EXISTS trade_name,
  DROP COLUMN IF EXISTS identification_number,
  DROP COLUMN IF EXISTS dian_identification_type;

COMMIT;
