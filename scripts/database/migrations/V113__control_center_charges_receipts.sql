-- V113: MANUS Control Center, fase 2 (cargos por periodo, prorrateo, recaudos y cartera).
-- OpenSpec: control-center-cargos-recaudos
-- Requiere V112 (cuentas, planes y contratos).
-- Sin control transaccional: lo aporta apply_single_migration.sh.

DO $$
BEGIN
  IF to_regclass('control_center.contract_versions') IS NULL
    OR to_regclass('control_center.contract_items') IS NULL
    OR to_regclass('control_center.idempotency_keys') IS NULL THEN
    RAISE EXCEPTION 'CONTROL_CENTER_V112_REQUIRED';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'manus_control_center_app') THEN
    RAISE EXCEPTION 'CONTROL_CENTER_ROLE_MISSING';
  END IF;
  IF to_regclass('public.payment_methods') IS NULL OR to_regclass('public.financial_institutions') IS NULL THEN
    RAISE EXCEPTION 'CONTROL_CENTER_PAYMENT_CATALOG_MISSING';
  END IF;
END $$;

-- Funcion de columnas mutables ----------------------------------------------------
-- TG_ARGV lista las unicas columnas que se pueden modificar. Una fila anulada
-- (status = 'VOID') o una aplicacion ya revertida (reversed_at) es definitiva.

CREATE OR REPLACE FUNCTION control_center.guard_mutable_columns()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_old JSONB := to_jsonb(OLD);
  v_new JSONB;
  v_allowed TEXT[] := TG_ARGV;
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'CONTROL_CENTER_IMMUTABLE_ROW %', TG_TABLE_NAME;
  END IF;
  v_new := to_jsonb(NEW);
  IF (v_old ->> 'status') = 'VOID' OR (v_old ->> 'reversed_at') IS NOT NULL THEN
    RAISE EXCEPTION 'CONTROL_CENTER_FINAL_ROW %', TG_TABLE_NAME;
  END IF;
  IF (v_old - v_allowed) IS DISTINCT FROM (v_new - v_allowed) THEN
    RAISE EXCEPTION 'CONTROL_CENTER_IMMUTABLE_ROW %', TG_TABLE_NAME;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION control_center.guard_mutable_columns() FROM PUBLIC;

-- Cargos -----------------------------------------------------------------------------

CREATE SEQUENCE IF NOT EXISTS control_center.charge_number_seq;
CREATE SEQUENCE IF NOT EXISTS control_center.receipt_number_seq;

CREATE TABLE IF NOT EXISTS control_center.charges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  charge_number TEXT NOT NULL,
  contract_id UUID NOT NULL REFERENCES control_center.contracts(id) ON DELETE RESTRICT,
  account_id UUID NOT NULL REFERENCES control_center.commercial_accounts(id) ON DELETE RESTRICT,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  contract_version_id UUID NOT NULL REFERENCES control_center.contract_versions(id) ON DELETE RESTRICT,
  kind TEXT NOT NULL,
  billing_frequency TEXT NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  issue_date DATE NOT NULL,
  due_date DATE NOT NULL,
  currency TEXT NOT NULL DEFAULT 'COP',
  tax_name_snapshot TEXT NOT NULL,
  tax_rate_snapshot NUMERIC(8, 4) NOT NULL,
  prices_include_tax BOOLEAN NOT NULL,
  subtotal NUMERIC(18, 2) NOT NULL,
  discount_total NUMERIC(18, 2) NOT NULL DEFAULT 0,
  base_amount NUMERIC(18, 2) NOT NULL,
  tax_amount NUMERIC(18, 2) NOT NULL,
  total_amount NUMERIC(18, 2) NOT NULL,
  paid_amount NUMERIC(18, 2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL,
  generation_source TEXT NOT NULL,
  void_reason TEXT,
  voided_at TIMESTAMPTZ,
  voided_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID NOT NULL,
  CONSTRAINT uq_cc_charges_number UNIQUE (charge_number),
  CONSTRAINT chk_cc_charges_kind CHECK (kind IN ('PERIOD', 'PRORATION', 'ONE_TIME')),
  CONSTRAINT chk_cc_charges_frequency CHECK (billing_frequency IN ('MONTHLY', 'ANNUAL', 'ONE_TIME')),
  CONSTRAINT chk_cc_charges_period CHECK (period_end >= period_start),
  CONSTRAINT chk_cc_charges_currency CHECK (currency = 'COP'),
  CONSTRAINT chk_cc_charges_tax_rate CHECK (tax_rate_snapshot >= 0 AND tax_rate_snapshot < 1),
  CONSTRAINT chk_cc_charges_amounts CHECK (
    subtotal >= 0 AND discount_total >= 0 AND base_amount >= 0 AND tax_amount >= 0
    AND total_amount >= 0 AND base_amount + tax_amount = total_amount
  ),
  CONSTRAINT chk_cc_charges_paid CHECK (paid_amount >= 0 AND paid_amount <= total_amount),
  CONSTRAINT chk_cc_charges_status CHECK (
    (status = 'OPEN' AND paid_amount = 0 AND total_amount > 0)
    OR (status = 'PARTIALLY_PAID' AND paid_amount > 0 AND paid_amount < total_amount)
    OR (status = 'PAID' AND paid_amount = total_amount)
    OR (status = 'VOID' AND paid_amount = 0)
  ),
  CONSTRAINT chk_cc_charges_void CHECK (
    (status <> 'VOID' AND void_reason IS NULL AND voided_at IS NULL AND voided_by IS NULL)
    OR (status = 'VOID' AND voided_at IS NOT NULL AND voided_by IS NOT NULL
        AND char_length(btrim(coalesce(void_reason, ''))) >= 10)
  ),
  CONSTRAINT chk_cc_charges_source CHECK (generation_source IN ('WORKER', 'MANUAL', 'AMENDMENT'))
);

-- Un solo cargo vigente por contrato, tipo, frecuencia e inicio de periodo.
CREATE UNIQUE INDEX IF NOT EXISTS uq_cc_charges_period
  ON control_center.charges (contract_id, kind, billing_frequency, period_start)
  WHERE status <> 'VOID' AND kind IN ('PERIOD', 'ONE_TIME');
-- Un solo prorrateo vigente por version de contrato y frecuencia.
CREATE UNIQUE INDEX IF NOT EXISTS uq_cc_charges_proration
  ON control_center.charges (contract_version_id, billing_frequency)
  WHERE status <> 'VOID' AND kind = 'PRORATION';
CREATE INDEX IF NOT EXISTS idx_cc_charges_account_status
  ON control_center.charges (account_id, status, due_date);
CREATE INDEX IF NOT EXISTS idx_cc_charges_contract
  ON control_center.charges (contract_id, period_start);
CREATE INDEX IF NOT EXISTS idx_cc_charges_open_due
  ON control_center.charges (due_date) WHERE status IN ('OPEN', 'PARTIALLY_PAID');

CREATE TABLE IF NOT EXISTS control_center.charge_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  charge_id UUID NOT NULL REFERENCES control_center.charges(id) ON DELETE RESTRICT,
  contract_item_id UUID REFERENCES control_center.contract_items(id) ON DELETE RESTRICT,
  item_type TEXT NOT NULL,
  description TEXT NOT NULL,
  quantity NUMERIC(12, 2) NOT NULL,
  unit_amount NUMERIC(18, 2) NOT NULL,
  discount_amount NUMERIC(18, 2) NOT NULL DEFAULT 0,
  proration_factor NUMERIC(9, 6),
  line_total NUMERIC(18, 2) NOT NULL,
  CONSTRAINT chk_cc_cl_type CHECK (item_type IN ('BASE', 'EXTRA_POS_TERMINAL', 'CERTIFICATION', 'CUSTOM')),
  CONSTRAINT chk_cc_cl_description CHECK (btrim(description) <> ''),
  CONSTRAINT chk_cc_cl_quantity CHECK (quantity > 0),
  CONSTRAINT chk_cc_cl_unit_amount CHECK (unit_amount >= 0),
  CONSTRAINT chk_cc_cl_discount CHECK (discount_amount >= 0),
  CONSTRAINT chk_cc_cl_factor CHECK (proration_factor IS NULL OR (proration_factor > 0 AND proration_factor <= 1)),
  -- Solo las lineas de prorrateo pueden ser negativas (item retirado o rebajado).
  CONSTRAINT chk_cc_cl_total CHECK (line_total >= 0 OR proration_factor IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_cc_charge_lines_charge
  ON control_center.charge_lines (charge_id);

-- Recaudos ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS control_center.receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_number TEXT NOT NULL,
  account_id UUID NOT NULL REFERENCES control_center.commercial_accounts(id) ON DELETE RESTRICT,
  received_on DATE NOT NULL,
  amount NUMERIC(18, 2) NOT NULL,
  allocated_amount NUMERIC(18, 2) NOT NULL DEFAULT 0,
  source TEXT NOT NULL,
  -- Referencia y snapshot del catalogo de MANUS (public.payment_methods y
  -- public.financial_institutions). Sin llave foranea entre esquemas.
  payment_method_id UUID,
  payment_method_code TEXT,
  payment_method_name TEXT,
  financial_institution_id UUID,
  financial_institution_name TEXT,
  reference TEXT,
  notes TEXT,
  attachment_storage_key TEXT,
  attachment_original_name TEXT,
  attachment_mime TEXT,
  attachment_size INTEGER,
  contract_id UUID REFERENCES control_center.contracts(id) ON DELETE RESTRICT,
  source_contract_version_id UUID REFERENCES control_center.contract_versions(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'CONFIRMED',
  void_reason TEXT,
  voided_at TIMESTAMPTZ,
  voided_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID NOT NULL,
  CONSTRAINT uq_cc_receipts_number UNIQUE (receipt_number),
  CONSTRAINT chk_cc_receipts_amount CHECK (amount > 0),
  CONSTRAINT chk_cc_receipts_allocated CHECK (allocated_amount >= 0 AND allocated_amount <= amount),
  CONSTRAINT chk_cc_receipts_source CHECK (
    (source = 'PAYMENT'
      AND payment_method_id IS NOT NULL
      AND btrim(coalesce(payment_method_code, '')) <> ''
      AND btrim(coalesce(payment_method_name, '')) <> ''
      AND source_contract_version_id IS NULL)
    OR (source = 'PRORATION_CREDIT'
      AND payment_method_id IS NULL
      AND financial_institution_id IS NULL
      AND contract_id IS NOT NULL
      AND source_contract_version_id IS NOT NULL
      AND attachment_storage_key IS NULL)
  ),
  CONSTRAINT chk_cc_receipts_institution CHECK (
    (financial_institution_id IS NULL AND financial_institution_name IS NULL)
    OR (financial_institution_id IS NOT NULL AND btrim(coalesce(financial_institution_name, '')) <> '')
  ),
  CONSTRAINT chk_cc_receipts_reference CHECK (reference IS NULL OR (btrim(reference) <> '' AND char_length(reference) <= 120)),
  CONSTRAINT chk_cc_receipts_attachment CHECK (
    (attachment_storage_key IS NULL AND attachment_original_name IS NULL
      AND attachment_mime IS NULL AND attachment_size IS NULL)
    OR (attachment_storage_key IS NOT NULL AND attachment_original_name IS NOT NULL
      AND attachment_mime IN ('application/pdf', 'image/jpeg', 'image/png', 'image/webp')
      AND attachment_size > 0 AND attachment_size <= 10485760)
  ),
  CONSTRAINT chk_cc_receipts_status CHECK (
    (status = 'CONFIRMED' AND void_reason IS NULL AND voided_at IS NULL AND voided_by IS NULL)
    OR (status = 'VOID' AND allocated_amount = 0 AND voided_at IS NOT NULL AND voided_by IS NOT NULL
        AND char_length(btrim(coalesce(void_reason, ''))) >= 10)
  )
);

-- Pago duplicado: misma cuenta, medio y referencia en un recaudo confirmado.
CREATE UNIQUE INDEX IF NOT EXISTS uq_cc_receipts_reference
  ON control_center.receipts (account_id, payment_method_code, upper(btrim(reference)))
  WHERE reference IS NOT NULL AND status = 'CONFIRMED' AND source = 'PAYMENT';
-- Un solo credito de prorrateo vigente por version de contrato.
CREATE UNIQUE INDEX IF NOT EXISTS uq_cc_receipts_proration_credit
  ON control_center.receipts (source_contract_version_id)
  WHERE source = 'PRORATION_CREDIT' AND status = 'CONFIRMED';
CREATE INDEX IF NOT EXISTS idx_cc_receipts_account
  ON control_center.receipts (account_id, status, received_on DESC);

CREATE TABLE IF NOT EXISTS control_center.receipt_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_id UUID NOT NULL REFERENCES control_center.receipts(id) ON DELETE RESTRICT,
  charge_id UUID NOT NULL REFERENCES control_center.charges(id) ON DELETE RESTRICT,
  amount NUMERIC(18, 2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID NOT NULL,
  reversed_at TIMESTAMPTZ,
  reversed_by UUID,
  reversal_reason TEXT,
  CONSTRAINT chk_cc_ra_amount CHECK (amount > 0),
  CONSTRAINT chk_cc_ra_reversal CHECK (
    (reversed_at IS NULL AND reversed_by IS NULL AND reversal_reason IS NULL)
    OR (reversed_at IS NOT NULL AND reversed_by IS NOT NULL
        AND char_length(btrim(coalesce(reversal_reason, ''))) >= 10)
  )
);

CREATE INDEX IF NOT EXISTS idx_cc_ra_receipt
  ON control_center.receipt_allocations (receipt_id) WHERE reversed_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_cc_ra_charge
  ON control_center.receipt_allocations (charge_id) WHERE reversed_at IS NULL;

-- Bitacora de generacion -------------------------------------------------------------

CREATE TABLE IF NOT EXISTS control_center.billing_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger_source TEXT NOT NULL,
  actor_user_id UUID NOT NULL,
  contract_id UUID REFERENCES control_center.contracts(id) ON DELETE RESTRICT,
  run_date DATE NOT NULL,
  lead_days INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'RUNNING',
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  contracts_scanned INTEGER NOT NULL DEFAULT 0,
  charges_created INTEGER NOT NULL DEFAULT 0,
  errors JSONB NOT NULL DEFAULT '[]'::jsonb,
  CONSTRAINT chk_cc_br_trigger CHECK (trigger_source IN ('WORKER', 'MANUAL')),
  CONSTRAINT chk_cc_br_status CHECK (status IN ('RUNNING', 'COMPLETED', 'FAILED')),
  CONSTRAINT chk_cc_br_lead CHECK (lead_days BETWEEN 0 AND 60),
  CONSTRAINT chk_cc_br_counts CHECK (contracts_scanned >= 0 AND charges_created >= 0),
  CONSTRAINT chk_cc_br_finished CHECK (status = 'RUNNING' OR finished_at IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_cc_billing_runs_started
  ON control_center.billing_runs (started_at DESC);

-- Verificacion de saldos (diferida al COMMIT) ---------------------------------------

CREATE OR REPLACE FUNCTION control_center.verify_charge_balance(p_charge_id UUID)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_charge control_center.charges%ROWTYPE;
  v_sum NUMERIC(18, 2);
BEGIN
  SELECT * INTO v_charge FROM control_center.charges WHERE id = p_charge_id;
  IF NOT FOUND THEN
    RETURN;
  END IF;
  SELECT coalesce(sum(amount), 0) INTO v_sum
  FROM control_center.receipt_allocations
  WHERE charge_id = p_charge_id AND reversed_at IS NULL;
  IF v_sum > v_charge.total_amount THEN
    RAISE EXCEPTION 'CONTROL_CENTER_CHARGE_OVERALLOCATED %', v_charge.charge_number;
  END IF;
  IF v_sum <> v_charge.paid_amount THEN
    RAISE EXCEPTION 'CONTROL_CENTER_CHARGE_BALANCE_MISMATCH %', v_charge.charge_number;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION control_center.verify_receipt_balance(p_receipt_id UUID)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_receipt control_center.receipts%ROWTYPE;
  v_sum NUMERIC(18, 2);
BEGIN
  SELECT * INTO v_receipt FROM control_center.receipts WHERE id = p_receipt_id;
  IF NOT FOUND THEN
    RETURN;
  END IF;
  SELECT coalesce(sum(amount), 0) INTO v_sum
  FROM control_center.receipt_allocations
  WHERE receipt_id = p_receipt_id AND reversed_at IS NULL;
  IF v_sum > v_receipt.amount THEN
    RAISE EXCEPTION 'CONTROL_CENTER_RECEIPT_OVERALLOCATED %', v_receipt.receipt_number;
  END IF;
  IF v_sum <> v_receipt.allocated_amount THEN
    RAISE EXCEPTION 'CONTROL_CENTER_RECEIPT_BALANCE_MISMATCH %', v_receipt.receipt_number;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION control_center.check_charge_balance()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM control_center.verify_charge_balance(NEW.id);
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION control_center.check_receipt_balance()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM control_center.verify_receipt_balance(NEW.id);
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION control_center.check_allocation_balance()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_charge_account UUID;
  v_charge_status TEXT;
  v_receipt_account UUID;
  v_receipt_status TEXT;
BEGIN
  SELECT account_id, status INTO v_charge_account, v_charge_status
  FROM control_center.charges WHERE id = NEW.charge_id;
  SELECT account_id, status INTO v_receipt_account, v_receipt_status
  FROM control_center.receipts WHERE id = NEW.receipt_id;
  IF v_charge_account IS DISTINCT FROM v_receipt_account THEN
    RAISE EXCEPTION 'CONTROL_CENTER_ALLOCATION_ACCOUNT_MISMATCH';
  END IF;
  IF NEW.reversed_at IS NULL AND (v_charge_status = 'VOID' OR v_receipt_status = 'VOID') THEN
    RAISE EXCEPTION 'CONTROL_CENTER_ALLOCATION_ON_VOID';
  END IF;
  PERFORM control_center.verify_charge_balance(NEW.charge_id);
  PERFORM control_center.verify_receipt_balance(NEW.receipt_id);
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION control_center.verify_charge_balance(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION control_center.verify_receipt_balance(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION control_center.check_charge_balance() FROM PUBLIC;
REVOKE ALL ON FUNCTION control_center.check_receipt_balance() FROM PUBLIC;
REVOKE ALL ON FUNCTION control_center.check_allocation_balance() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION control_center.verify_charge_balance(UUID) TO manus_control_center_app;
GRANT EXECUTE ON FUNCTION control_center.verify_receipt_balance(UUID) TO manus_control_center_app;
GRANT EXECUTE ON FUNCTION control_center.check_charge_balance() TO manus_control_center_app;
GRANT EXECUTE ON FUNCTION control_center.check_receipt_balance() TO manus_control_center_app;
GRANT EXECUTE ON FUNCTION control_center.check_allocation_balance() TO manus_control_center_app;
GRANT EXECUTE ON FUNCTION control_center.guard_mutable_columns() TO manus_control_center_app;

-- Triggers ---------------------------------------------------------------------------

DROP TRIGGER IF EXISTS trg_cc_charges_guard ON control_center.charges;
CREATE TRIGGER trg_cc_charges_guard
  BEFORE UPDATE OR DELETE ON control_center.charges
  FOR EACH ROW EXECUTE FUNCTION control_center.guard_mutable_columns(
    'paid_amount', 'status', 'void_reason', 'voided_at', 'voided_by', 'updated_at', 'updated_by');

DROP TRIGGER IF EXISTS trg_cc_charge_lines_immutable ON control_center.charge_lines;
CREATE TRIGGER trg_cc_charge_lines_immutable
  BEFORE UPDATE OR DELETE ON control_center.charge_lines
  FOR EACH ROW EXECUTE FUNCTION control_center.prevent_mutation();

DROP TRIGGER IF EXISTS trg_cc_receipts_guard ON control_center.receipts;
CREATE TRIGGER trg_cc_receipts_guard
  BEFORE UPDATE OR DELETE ON control_center.receipts
  FOR EACH ROW EXECUTE FUNCTION control_center.guard_mutable_columns(
    'allocated_amount', 'status', 'void_reason', 'voided_at', 'voided_by', 'updated_at', 'updated_by');

DROP TRIGGER IF EXISTS trg_cc_ra_guard ON control_center.receipt_allocations;
CREATE TRIGGER trg_cc_ra_guard
  BEFORE UPDATE OR DELETE ON control_center.receipt_allocations
  FOR EACH ROW EXECUTE FUNCTION control_center.guard_mutable_columns(
    'reversed_at', 'reversed_by', 'reversal_reason');

DROP TRIGGER IF EXISTS trg_cc_charges_balance ON control_center.charges;
CREATE CONSTRAINT TRIGGER trg_cc_charges_balance
  AFTER INSERT OR UPDATE ON control_center.charges
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION control_center.check_charge_balance();

DROP TRIGGER IF EXISTS trg_cc_receipts_balance ON control_center.receipts;
CREATE CONSTRAINT TRIGGER trg_cc_receipts_balance
  AFTER INSERT OR UPDATE ON control_center.receipts
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION control_center.check_receipt_balance();

DROP TRIGGER IF EXISTS trg_cc_ra_balance ON control_center.receipt_allocations;
CREATE CONSTRAINT TRIGGER trg_cc_ra_balance
  AFTER INSERT OR UPDATE ON control_center.receipt_allocations
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION control_center.check_allocation_balance();

-- Privilegios explicitos del rol dedicado ----------------------------------------

REVOKE ALL ON control_center.charges, control_center.charge_lines, control_center.receipts,
  control_center.receipt_allocations, control_center.billing_runs FROM PUBLIC;

GRANT SELECT, INSERT, UPDATE ON control_center.charges TO manus_control_center_app;
GRANT SELECT, INSERT ON control_center.charge_lines TO manus_control_center_app;
GRANT SELECT, INSERT, UPDATE ON control_center.receipts TO manus_control_center_app;
GRANT SELECT, INSERT, UPDATE ON control_center.receipt_allocations TO manus_control_center_app;
GRANT SELECT, INSERT, UPDATE ON control_center.billing_runs TO manus_control_center_app;
REVOKE DELETE, TRUNCATE ON control_center.charges, control_center.charge_lines, control_center.receipts,
  control_center.receipt_allocations, control_center.billing_runs FROM manus_control_center_app;
REVOKE UPDATE ON control_center.charge_lines FROM manus_control_center_app;
GRANT USAGE, SELECT ON SEQUENCE control_center.charge_number_seq TO manus_control_center_app;
GRANT USAGE, SELECT ON SEQUENCE control_center.receipt_number_seq TO manus_control_center_app;

-- Catalogo de medios de pago de MANUS: solo lectura por columnas.
GRANT SELECT (id, tenant_id, codigo, nombre, tipo, requires_reference,
  requires_financial_institution, active, sort_order, icon, color)
  ON public.payment_methods TO manus_control_center_app;
GRANT SELECT (id, tenant_id, codigo, nombre, nombre_corto, tipo, active, sort_order)
  ON public.financial_institutions TO manus_control_center_app;
