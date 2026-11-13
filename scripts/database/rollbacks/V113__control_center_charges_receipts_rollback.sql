-- Rollback de V113__control_center_charges_receipts.sql
-- Solo si no hay cargos ni recaudos: falla de forma segura si alguna tabla tiene filas.

DO $$
DECLARE
  v_table TEXT;
  v_rows BIGINT;
BEGIN
  FOREACH v_table IN ARRAY ARRAY[
    'charges', 'charge_lines', 'receipts', 'receipt_allocations', 'billing_runs'
  ] LOOP
    IF to_regclass('control_center.' || v_table) IS NOT NULL THEN
      EXECUTE format('SELECT COUNT(*) FROM control_center.%I', v_table) INTO v_rows;
      IF v_rows > 0 THEN
        RAISE EXCEPTION 'CONTROL_CENTER_ROLLBACK_BLOCKED_DATA %', v_table;
      END IF;
    END IF;
  END LOOP;
END $$;

REVOKE SELECT (id, tenant_id, codigo, nombre, tipo, requires_reference,
  requires_financial_institution, active, sort_order, icon, color)
  ON public.payment_methods FROM manus_control_center_app;
REVOKE SELECT (id, tenant_id, codigo, nombre, nombre_corto, tipo, active, sort_order)
  ON public.financial_institutions FROM manus_control_center_app;

DROP TABLE IF EXISTS control_center.billing_runs;
DROP TABLE IF EXISTS control_center.receipt_allocations;
DROP TABLE IF EXISTS control_center.receipts;
DROP TABLE IF EXISTS control_center.charge_lines;
DROP TABLE IF EXISTS control_center.charges;
DROP SEQUENCE IF EXISTS control_center.receipt_number_seq;
DROP SEQUENCE IF EXISTS control_center.charge_number_seq;
DROP FUNCTION IF EXISTS control_center.check_allocation_balance();
DROP FUNCTION IF EXISTS control_center.check_receipt_balance();
DROP FUNCTION IF EXISTS control_center.check_charge_balance();
DROP FUNCTION IF EXISTS control_center.verify_receipt_balance(UUID);
DROP FUNCTION IF EXISTS control_center.verify_charge_balance(UUID);
DROP FUNCTION IF EXISTS control_center.guard_mutable_columns();
