-- V114: MANUS Control Center, fase 3 (alertas de cobro: dashboard del tenant y correo).
-- OpenSpec: control-center-alertas-cobro
-- Requiere V113 (cargos y recaudos).
-- Sin control transaccional: lo aporta apply_single_migration.sh.

DO $$
BEGIN
  IF to_regclass('control_center.charges') IS NULL
    OR to_regprocedure('control_center.guard_mutable_columns()') IS NULL THEN
    RAISE EXCEPTION 'CONTROL_CENTER_V113_REQUIRED';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'manus_control_center_app') THEN
    RAISE EXCEPTION 'CONTROL_CENTER_ROLE_MISSING';
  END IF;
END $$;

-- Bitacora de alertas -----------------------------------------------------------------

CREATE TABLE IF NOT EXISTS control_center.billing_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  charge_id UUID NOT NULL REFERENCES control_center.charges(id) ON DELETE RESTRICT,
  account_id UUID NOT NULL REFERENCES control_center.commercial_accounts(id) ON DELETE RESTRICT,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  stage TEXT NOT NULL,
  channel TEXT NOT NULL,
  trigger_source TEXT NOT NULL,
  status TEXT NOT NULL,
  recipient TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at TIMESTAMPTZ,
  created_by UUID NOT NULL,
  CONSTRAINT chk_cc_ba_stage CHECK (stage IN ('UPCOMING', 'DUE', 'OVERDUE_1', 'OVERDUE_7', 'OVERDUE_15', 'OVERDUE_30')),
  CONSTRAINT chk_cc_ba_channel CHECK (channel IN ('DASHBOARD', 'EMAIL')),
  CONSTRAINT chk_cc_ba_trigger CHECK (trigger_source IN ('WORKER', 'MANUAL')),
  CONSTRAINT chk_cc_ba_status CHECK (status IN ('SENT', 'FAILED', 'SKIPPED')),
  CONSTRAINT chk_cc_ba_attempts CHECK (attempts BETWEEN 0 AND 10),
  CONSTRAINT chk_cc_ba_sent CHECK (status <> 'SENT' OR sent_at IS NOT NULL),
  CONSTRAINT chk_cc_ba_error CHECK (last_error IS NULL OR char_length(last_error) <= 1000)
);

-- Un solo registro automatico por cargo, etapa y canal.
CREATE UNIQUE INDEX IF NOT EXISTS uq_cc_ba_worker
  ON control_center.billing_alerts (charge_id, stage, channel) WHERE trigger_source = 'WORKER';
CREATE INDEX IF NOT EXISTS idx_cc_ba_charge
  ON control_center.billing_alerts (charge_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cc_ba_retry
  ON control_center.billing_alerts (status, attempts) WHERE status = 'FAILED';

DROP TRIGGER IF EXISTS trg_cc_ba_guard ON control_center.billing_alerts;
CREATE TRIGGER trg_cc_ba_guard
  BEFORE UPDATE OR DELETE ON control_center.billing_alerts
  FOR EACH ROW EXECUTE FUNCTION control_center.guard_mutable_columns(
    'status', 'attempts', 'last_error', 'sent_at', 'recipient');

-- Avisos del dashboard del tenant cliente (leidos por la API operativa) ----------------

CREATE TABLE IF NOT EXISTS public.tenant_billing_notices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  charge_id UUID NOT NULL REFERENCES control_center.charges(id) ON DELETE RESTRICT,
  charge_number TEXT NOT NULL,
  stage TEXT NOT NULL,
  due_date DATE NOT NULL,
  balance NUMERIC(18, 2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'COP',
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  CONSTRAINT chk_tbn_stage CHECK (stage IN ('UPCOMING', 'DUE', 'OVERDUE_1', 'OVERDUE_7', 'OVERDUE_15', 'OVERDUE_30')),
  CONSTRAINT chk_tbn_balance CHECK (balance >= 0),
  CONSTRAINT chk_tbn_currency CHECK (currency = 'COP'),
  CONSTRAINT chk_tbn_period CHECK (period_end >= period_start)
);

-- Un solo aviso activo por cargo.
CREATE UNIQUE INDEX IF NOT EXISTS uq_tbn_active_charge
  ON public.tenant_billing_notices (charge_id) WHERE resolved_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_tbn_tenant_active
  ON public.tenant_billing_notices (tenant_id, due_date) WHERE resolved_at IS NULL;

-- Solo cambian etapa, saldo, vencimiento y resolucion; un aviso resuelto es definitivo.
CREATE OR REPLACE FUNCTION control_center.guard_billing_notice()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_allowed TEXT[] := ARRAY['stage', 'balance', 'due_date', 'updated_at', 'resolved_at'];
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'CONTROL_CENTER_IMMUTABLE_ROW %', TG_TABLE_NAME;
  END IF;
  IF OLD.resolved_at IS NOT NULL THEN
    RAISE EXCEPTION 'CONTROL_CENTER_FINAL_ROW %', TG_TABLE_NAME;
  END IF;
  IF (to_jsonb(OLD) - v_allowed) IS DISTINCT FROM (to_jsonb(NEW) - v_allowed) THEN
    RAISE EXCEPTION 'CONTROL_CENTER_IMMUTABLE_ROW %', TG_TABLE_NAME;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION control_center.guard_billing_notice() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_tbn_guard ON public.tenant_billing_notices;
CREATE TRIGGER trg_tbn_guard
  BEFORE UPDATE OR DELETE ON public.tenant_billing_notices
  FOR EACH ROW EXECUTE FUNCTION control_center.guard_billing_notice();

-- Privilegios -----------------------------------------------------------------------------

REVOKE ALL ON control_center.billing_alerts FROM PUBLIC;
REVOKE ALL ON public.tenant_billing_notices FROM PUBLIC;

GRANT SELECT, INSERT, UPDATE ON control_center.billing_alerts TO manus_control_center_app;
GRANT SELECT, INSERT, UPDATE ON public.tenant_billing_notices TO manus_control_center_app;
REVOKE DELETE, TRUNCATE ON control_center.billing_alerts FROM manus_control_center_app;
REVOKE DELETE, TRUNCATE ON public.tenant_billing_notices FROM manus_control_center_app;

-- La API operativa solo lee los avisos. Se concede a los roles runtime que existan.
DO $$
DECLARE
  v_role TEXT;
BEGIN
  FOREACH v_role IN ARRAY ARRAY['manus_user', 'manus_qa_user'] LOOP
    IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = v_role) THEN
      EXECUTE format('GRANT SELECT ON public.tenant_billing_notices TO %I', v_role);
    END IF;
  END LOOP;
END $$;
