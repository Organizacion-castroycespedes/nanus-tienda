-- Rollback de V112__control_center_accounts_contracts.sql
-- Solo si no hay datos comerciales: falla de forma segura si alguna tabla tiene filas.

DO $$
DECLARE
  v_table TEXT;
  v_rows BIGINT;
BEGIN
  FOREACH v_table IN ARRAY ARRAY[
    'commercial_accounts', 'account_tenants', 'plans', 'plan_price_versions',
    'plan_price_components', 'contracts', 'contract_versions', 'contract_items', 'idempotency_keys'
  ] LOOP
    IF to_regclass('control_center.' || v_table) IS NOT NULL THEN
      EXECUTE format('SELECT COUNT(*) FROM control_center.%I', v_table) INTO v_rows;
      IF v_rows > 0 THEN
        RAISE EXCEPTION 'CONTROL_CENTER_ROLLBACK_BLOCKED_DATA %', v_table;
      END IF;
    END IF;
  END LOOP;
END $$;

DROP TABLE IF EXISTS control_center.idempotency_keys;
ALTER TABLE IF EXISTS control_center.contracts DROP CONSTRAINT IF EXISTS fk_cc_contracts_current_version;
DROP TABLE IF EXISTS control_center.contract_items;
DROP TABLE IF EXISTS control_center.contract_versions;
DROP TABLE IF EXISTS control_center.contracts;
DROP SEQUENCE IF EXISTS control_center.contract_number_seq;
DROP TABLE IF EXISTS control_center.plan_price_components;
DROP TABLE IF EXISTS control_center.plan_price_versions;
DROP TABLE IF EXISTS control_center.plans;
DROP TABLE IF EXISTS control_center.account_tenants;
DROP TABLE IF EXISTS control_center.commercial_accounts;
DROP FUNCTION IF EXISTS control_center.allow_close_once();
DROP FUNCTION IF EXISTS control_center.prevent_mutation();
