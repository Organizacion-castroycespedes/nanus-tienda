-- V112: MANUS Control Center, fase 1 (cuentas comerciales, planes versionados y contratos).
-- OpenSpec: crear-control-center-cuentas-contratos
-- Requiere V111 (esquema control_center y rol manus_control_center_app).
-- Sin control transaccional: lo aporta apply_single_migration.sh.

DO $$
BEGIN
  IF to_regnamespace('control_center') IS NULL
    OR to_regclass('control_center.admin_audit_events') IS NULL THEN
    RAISE EXCEPTION 'CONTROL_CENTER_V111_REQUIRED';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'manus_control_center_app') THEN
    RAISE EXCEPTION 'CONTROL_CENTER_ROLE_MISSING';
  END IF;
END $$;

-- Funciones de inmutabilidad -------------------------------------------------

CREATE OR REPLACE FUNCTION control_center.prevent_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'CONTROL_CENTER_IMMUTABLE_ROW %', TG_TABLE_NAME;
END;
$$;

-- Permite solo cerrar la vigencia una vez (columna indicada en TG_ARGV[0]).
CREATE OR REPLACE FUNCTION control_center.allow_close_once()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_column TEXT := TG_ARGV[0];
  v_old JSONB := to_jsonb(OLD);
  v_new JSONB := to_jsonb(NEW);
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'CONTROL_CENTER_IMMUTABLE_ROW %', TG_TABLE_NAME;
  END IF;
  IF (v_old - v_column) IS DISTINCT FROM (v_new - v_column) THEN
    RAISE EXCEPTION 'CONTROL_CENTER_IMMUTABLE_ROW %', TG_TABLE_NAME;
  END IF;
  IF (v_old ->> v_column) IS NOT NULL AND (v_old -> v_column) IS DISTINCT FROM (v_new -> v_column) THEN
    RAISE EXCEPTION 'CONTROL_CENTER_VALIDITY_ALREADY_CLOSED %', TG_TABLE_NAME;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION control_center.prevent_mutation() FROM PUBLIC;
REVOKE ALL ON FUNCTION control_center.allow_close_once() FROM PUBLIC;

-- Cuentas comerciales ----------------------------------------------------------

CREATE TABLE IF NOT EXISTS control_center.commercial_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  legal_name TEXT NOT NULL,
  tax_id_type TEXT NOT NULL,
  tax_id TEXT NOT NULL,
  dv TEXT,
  billing_email TEXT NOT NULL,
  contact_name TEXT,
  contact_phone_e164 TEXT,
  whatsapp_opt_in BOOLEAN NOT NULL DEFAULT FALSE,
  whatsapp_opt_in_at TIMESTAMPTZ,
  address TEXT,
  city TEXT,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID NOT NULL,
  CONSTRAINT chk_cc_accounts_legal_name CHECK (btrim(legal_name) <> ''),
  CONSTRAINT chk_cc_accounts_tax_id_type CHECK (tax_id_type IN ('NIT', 'CC', 'CE', 'PASAPORTE')),
  CONSTRAINT chk_cc_accounts_tax_id CHECK (btrim(tax_id) <> ''),
  CONSTRAINT chk_cc_accounts_status CHECK (status IN ('ACTIVE', 'INACTIVE')),
  CONSTRAINT chk_cc_accounts_phone CHECK (contact_phone_e164 IS NULL OR contact_phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  CONSTRAINT chk_cc_accounts_whatsapp CHECK (
    (whatsapp_opt_in AND whatsapp_opt_in_at IS NOT NULL AND contact_phone_e164 IS NOT NULL)
    OR (NOT whatsapp_opt_in)
  ),
  CONSTRAINT uq_cc_accounts_tax_id UNIQUE (tax_id_type, tax_id)
);

CREATE TABLE IF NOT EXISTS control_center.account_tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES control_center.commercial_accounts(id) ON DELETE RESTRICT,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  linked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  linked_by UUID NOT NULL,
  ended_at TIMESTAMPTZ,
  ended_by UUID,
  end_reason TEXT,
  CONSTRAINT chk_cc_account_tenants_status CHECK (status IN ('ACTIVE', 'ENDED')),
  CONSTRAINT chk_cc_account_tenants_end CHECK (
    (status = 'ACTIVE' AND ended_at IS NULL)
    OR (status = 'ENDED' AND ended_at IS NOT NULL AND char_length(btrim(coalesce(end_reason, ''))) >= 10)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_cc_account_tenants_active_tenant
  ON control_center.account_tenants (tenant_id) WHERE status = 'ACTIVE';
CREATE INDEX IF NOT EXISTS idx_cc_account_tenants_account
  ON control_center.account_tenants (account_id, status);

-- Planes y precios versionados ---------------------------------------------------

CREATE TABLE IF NOT EXISTS control_center.plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID NOT NULL,
  CONSTRAINT chk_cc_plans_code CHECK (code ~ '^[A-Z0-9_]{3,40}$'),
  CONSTRAINT chk_cc_plans_name CHECK (btrim(name) <> ''),
  CONSTRAINT chk_cc_plans_status CHECK (status IN ('ACTIVE', 'RETIRED')),
  CONSTRAINT uq_cc_plans_code UNIQUE (code)
);

CREATE TABLE IF NOT EXISTS control_center.plan_price_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES control_center.plans(id) ON DELETE RESTRICT,
  version_no INTEGER NOT NULL,
  valid_from DATE NOT NULL,
  valid_to DATE,
  currency TEXT NOT NULL DEFAULT 'COP',
  tax_id UUID NOT NULL,
  prices_include_tax BOOLEAN NOT NULL,
  included_pos_terminals INTEGER NOT NULL,
  initial_term_months INTEGER NOT NULL,
  default_trial_months INTEGER NOT NULL DEFAULT 1,
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID NOT NULL,
  CONSTRAINT chk_cc_ppv_version CHECK (version_no > 0),
  CONSTRAINT chk_cc_ppv_validity CHECK (valid_to IS NULL OR valid_to >= valid_from),
  CONSTRAINT chk_cc_ppv_currency CHECK (currency = 'COP'),
  CONSTRAINT chk_cc_ppv_terminals CHECK (included_pos_terminals >= 0),
  CONSTRAINT chk_cc_ppv_term CHECK (initial_term_months BETWEEN 1 AND 60),
  CONSTRAINT chk_cc_ppv_trial CHECK (default_trial_months BETWEEN 0 AND 12),
  CONSTRAINT chk_cc_ppv_reason CHECK (char_length(btrim(reason)) >= 10),
  CONSTRAINT uq_cc_ppv_plan_version UNIQUE (plan_id, version_no)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_cc_ppv_open_version
  ON control_center.plan_price_versions (plan_id) WHERE valid_to IS NULL;

CREATE TABLE IF NOT EXISTS control_center.plan_price_components (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  price_version_id UUID NOT NULL REFERENCES control_center.plan_price_versions(id) ON DELETE RESTRICT,
  component TEXT NOT NULL,
  billing_frequency TEXT NOT NULL,
  amount NUMERIC(18, 2) NOT NULL,
  CONSTRAINT chk_cc_ppc_component CHECK (component IN ('BASE_INITIAL_TERM', 'BASE_RENEWAL', 'EXTRA_POS_TERMINAL', 'CERTIFICATION')),
  CONSTRAINT chk_cc_ppc_frequency CHECK (billing_frequency IN ('MONTHLY', 'ANNUAL')),
  CONSTRAINT chk_cc_ppc_amount CHECK (amount >= 0),
  CONSTRAINT uq_cc_ppc_component UNIQUE (price_version_id, component, billing_frequency)
);

-- Contratos ----------------------------------------------------------------------

CREATE SEQUENCE IF NOT EXISTS control_center.contract_number_seq;

CREATE TABLE IF NOT EXISTS control_center.contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_number TEXT NOT NULL,
  account_id UUID NOT NULL REFERENCES control_center.commercial_accounts(id) ON DELETE RESTRICT,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  plan_id UUID NOT NULL REFERENCES control_center.plans(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'DRAFT',
  start_date DATE NOT NULL,
  end_date DATE,
  current_version_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID NOT NULL,
  CONSTRAINT chk_cc_contracts_status CHECK (status IN ('DRAFT', 'ACTIVE', 'ENDED', 'CANCELLED')),
  CONSTRAINT chk_cc_contracts_dates CHECK (end_date IS NULL OR end_date >= start_date),
  CONSTRAINT chk_cc_contracts_ended CHECK (status <> 'ENDED' OR end_date IS NOT NULL),
  CONSTRAINT uq_cc_contracts_number UNIQUE (contract_number)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_cc_contracts_open_per_tenant
  ON control_center.contracts (tenant_id) WHERE status IN ('DRAFT', 'ACTIVE');
CREATE INDEX IF NOT EXISTS idx_cc_contracts_account
  ON control_center.contracts (account_id, status);
CREATE INDEX IF NOT EXISTS idx_cc_contracts_status_created
  ON control_center.contracts (status, created_at DESC);

CREATE TABLE IF NOT EXISTS control_center.contract_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID NOT NULL REFERENCES control_center.contracts(id) ON DELETE RESTRICT,
  version_no INTEGER NOT NULL,
  effective_from DATE NOT NULL,
  effective_to DATE,
  term_phase TEXT NOT NULL,
  billing_frequency TEXT NOT NULL,
  billing_anchor_day INTEGER NOT NULL,
  trial_ends_on DATE,
  proration_policy TEXT NOT NULL DEFAULT 'DAILY',
  tax_id UUID NOT NULL,
  tax_name_snapshot TEXT NOT NULL,
  tax_rate_snapshot NUMERIC(8, 4) NOT NULL,
  prices_include_tax BOOLEAN NOT NULL,
  included_pos_terminals INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'COP',
  source_price_version_id UUID NOT NULL REFERENCES control_center.plan_price_versions(id) ON DELETE RESTRICT,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID NOT NULL,
  CONSTRAINT chk_cc_cv_version CHECK (version_no > 0),
  CONSTRAINT chk_cc_cv_validity CHECK (effective_to IS NULL OR effective_to >= effective_from),
  CONSTRAINT chk_cc_cv_phase CHECK (term_phase IN ('INITIAL', 'RENEWAL')),
  CONSTRAINT chk_cc_cv_frequency CHECK (billing_frequency IN ('MONTHLY', 'ANNUAL')),
  CONSTRAINT chk_cc_cv_anchor CHECK (billing_anchor_day BETWEEN 1 AND 31),
  CONSTRAINT chk_cc_cv_proration CHECK (proration_policy IN ('NONE', 'DAILY')),
  CONSTRAINT chk_cc_cv_tax_rate CHECK (tax_rate_snapshot >= 0 AND tax_rate_snapshot < 1),
  CONSTRAINT chk_cc_cv_terminals CHECK (included_pos_terminals >= 0),
  CONSTRAINT chk_cc_cv_currency CHECK (currency = 'COP'),
  CONSTRAINT uq_cc_cv_contract_version UNIQUE (contract_id, version_no)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_cc_cv_open_version
  ON control_center.contract_versions (contract_id) WHERE effective_to IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_constraint WHERE conname = 'fk_cc_contracts_current_version'
  ) THEN
    ALTER TABLE control_center.contracts
      ADD CONSTRAINT fk_cc_contracts_current_version
      FOREIGN KEY (current_version_id) REFERENCES control_center.contract_versions(id)
      DEFERRABLE INITIALLY DEFERRED;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS control_center.contract_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_version_id UUID NOT NULL REFERENCES control_center.contract_versions(id) ON DELETE RESTRICT,
  item_type TEXT NOT NULL,
  description TEXT NOT NULL,
  quantity NUMERIC(12, 2) NOT NULL,
  unit_amount NUMERIC(18, 2) NOT NULL,
  billing_frequency TEXT NOT NULL,
  discount_amount NUMERIC(18, 2) NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT chk_cc_ci_type CHECK (item_type IN ('BASE', 'EXTRA_POS_TERMINAL', 'CERTIFICATION', 'CUSTOM')),
  CONSTRAINT chk_cc_ci_description CHECK (btrim(description) <> ''),
  CONSTRAINT chk_cc_ci_quantity CHECK (quantity > 0),
  CONSTRAINT chk_cc_ci_unit_amount CHECK (unit_amount >= 0),
  CONSTRAINT chk_cc_ci_frequency CHECK (billing_frequency IN ('MONTHLY', 'ANNUAL', 'ONE_TIME')),
  CONSTRAINT chk_cc_ci_discount CHECK (discount_amount >= 0 AND discount_amount <= quantity * unit_amount)
);

CREATE INDEX IF NOT EXISTS idx_cc_contract_items_version
  ON control_center.contract_items (contract_version_id);

CREATE TABLE IF NOT EXISTS control_center.idempotency_keys (
  scope TEXT NOT NULL,
  key TEXT NOT NULL,
  resource_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID NOT NULL,
  CONSTRAINT chk_cc_idem_key CHECK (char_length(key) BETWEEN 8 AND 120),
  PRIMARY KEY (scope, key)
);

-- Triggers de inmutabilidad ------------------------------------------------------

DROP TRIGGER IF EXISTS trg_cc_ppc_immutable ON control_center.plan_price_components;
CREATE TRIGGER trg_cc_ppc_immutable
  BEFORE UPDATE OR DELETE ON control_center.plan_price_components
  FOR EACH ROW EXECUTE FUNCTION control_center.prevent_mutation();

DROP TRIGGER IF EXISTS trg_cc_ci_immutable ON control_center.contract_items;
CREATE TRIGGER trg_cc_ci_immutable
  BEFORE UPDATE OR DELETE ON control_center.contract_items
  FOR EACH ROW EXECUTE FUNCTION control_center.prevent_mutation();

DROP TRIGGER IF EXISTS trg_cc_ppv_close_once ON control_center.plan_price_versions;
CREATE TRIGGER trg_cc_ppv_close_once
  BEFORE UPDATE OR DELETE ON control_center.plan_price_versions
  FOR EACH ROW EXECUTE FUNCTION control_center.allow_close_once('valid_to');

DROP TRIGGER IF EXISTS trg_cc_cv_close_once ON control_center.contract_versions;
CREATE TRIGGER trg_cc_cv_close_once
  BEFORE UPDATE OR DELETE ON control_center.contract_versions
  FOR EACH ROW EXECUTE FUNCTION control_center.allow_close_once('effective_to');

-- Privilegios explicitos del rol dedicado ----------------------------------------

REVOKE ALL ON control_center.commercial_accounts, control_center.account_tenants,
  control_center.plans, control_center.plan_price_versions, control_center.plan_price_components,
  control_center.contracts, control_center.contract_versions, control_center.contract_items,
  control_center.idempotency_keys FROM PUBLIC;

GRANT SELECT, INSERT, UPDATE ON control_center.commercial_accounts TO manus_control_center_app;
GRANT SELECT, INSERT, UPDATE ON control_center.account_tenants TO manus_control_center_app;
GRANT SELECT, INSERT, UPDATE ON control_center.plans TO manus_control_center_app;
GRANT SELECT, INSERT, UPDATE ON control_center.plan_price_versions TO manus_control_center_app;
GRANT SELECT, INSERT ON control_center.plan_price_components TO manus_control_center_app;
GRANT SELECT, INSERT, UPDATE ON control_center.contracts TO manus_control_center_app;
GRANT SELECT, INSERT, UPDATE ON control_center.contract_versions TO manus_control_center_app;
GRANT SELECT, INSERT ON control_center.contract_items TO manus_control_center_app;
GRANT SELECT, INSERT ON control_center.idempotency_keys TO manus_control_center_app;
REVOKE DELETE, TRUNCATE ON control_center.commercial_accounts, control_center.account_tenants,
  control_center.plans, control_center.plan_price_versions, control_center.plan_price_components,
  control_center.contracts, control_center.contract_versions, control_center.contract_items,
  control_center.idempotency_keys FROM manus_control_center_app;
REVOKE UPDATE ON control_center.plan_price_components, control_center.contract_items,
  control_center.idempotency_keys FROM manus_control_center_app;
GRANT USAGE, SELECT ON SEQUENCE control_center.contract_number_seq TO manus_control_center_app;
