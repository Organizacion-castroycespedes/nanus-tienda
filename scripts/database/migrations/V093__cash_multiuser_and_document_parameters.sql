BEGIN;

-- Caja compartida, trazabilidad de venta a sesión de caja y catálogo de parámetros documentales.
-- Aditivo. No crea remisiones ni document_print_jobs. No ejecuta el borrador JSON rechazado.

DO $$
BEGIN
  IF to_regclass('public.cash_registers') IS NULL THEN
    RAISE EXCEPTION 'Required table public.cash_registers does not exist';
  END IF;
  IF to_regclass('public.cash_sessions') IS NULL THEN
    RAISE EXCEPTION 'Required table public.cash_sessions does not exist';
  END IF;
  IF to_regclass('public.sales') IS NULL THEN
    RAISE EXCEPTION 'Required table public.sales does not exist';
  END IF;
  IF to_regclass('public.users') IS NULL THEN
    RAISE EXCEPTION 'Required table public.users does not exist';
  END IF;
  IF to_regclass('public.tenants') IS NULL THEN
    RAISE EXCEPTION 'Required table public.tenants does not exist';
  END IF;
  IF to_regclass('public.tenant_branches') IS NULL THEN
    RAISE EXCEPTION 'Required table public.tenant_branches does not exist';
  END IF;
  IF to_regclass('public.terminals') IS NULL THEN
    RAISE EXCEPTION 'Required table public.terminals does not exist';
  END IF;
END $$;

-- ============================================================================
-- 1. Asignaciones de usuarios a la caja física
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.cash_register_user_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cash_register_id uuid NOT NULL REFERENCES public.cash_registers(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  assigned_by_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  assigned_at timestamptz NOT NULL DEFAULT NOW(),
  unassigned_by_user_id uuid NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  unassigned_at timestamptz NULL,
  CONSTRAINT cash_register_user_assignments_dates_check CHECK (
    unassigned_at IS NULL OR unassigned_at >= assigned_at
  ),
  CONSTRAINT cash_register_user_assignments_unassign_pair_check CHECK (
    (unassigned_at IS NULL AND unassigned_by_user_id IS NULL)
    OR (unassigned_at IS NOT NULL AND unassigned_by_user_id IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_cash_register_user_assignments_active
  ON public.cash_register_user_assignments (cash_register_id, user_id)
  WHERE unassigned_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_cash_register_user_assignments_register
  ON public.cash_register_user_assignments (cash_register_id)
  WHERE unassigned_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_cash_register_user_assignments_user
  ON public.cash_register_user_assignments (user_id)
  WHERE unassigned_at IS NULL;

CREATE OR REPLACE FUNCTION public.validate_cash_register_user_assignment()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_register public.cash_registers%ROWTYPE;
  v_user_tenant_id uuid;
  v_persona_id uuid;
BEGIN
  SELECT *
  INTO v_register
  FROM public.cash_registers
  WHERE id = NEW.cash_register_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'cash register not found';
  END IF;

  SELECT u.tenant_id, u.persona_id
  INTO v_user_tenant_id, v_persona_id
  FROM public.users AS u
  WHERE u.id = NEW.user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'user not found';
  END IF;

  IF v_user_tenant_id IS DISTINCT FROM v_register.tenant_id THEN
    RAISE EXCEPTION 'user and cash register must belong to the same tenant';
  END IF;

  IF v_persona_id IS NULL THEN
    RAISE EXCEPTION 'user must have a persona linked to the cash register branch';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.persona_tenant_branches AS ptb
    WHERE ptb.persona_id = v_persona_id
      AND ptb.tenant_branch_id = v_register.branch_id
      AND ptb.tenant_id = v_register.tenant_id
  ) THEN
    RAISE EXCEPTION 'user persona must be assigned to the cash register branch';
  END IF;

  IF NEW.assigned_by_user_id IS NOT NULL THEN
    PERFORM 1
    FROM public.users AS assigner
    WHERE assigner.id = NEW.assigned_by_user_id
      AND assigner.tenant_id = v_register.tenant_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'assigned_by_user must belong to the same tenant';
    END IF;
  END IF;

  IF NEW.unassigned_by_user_id IS NOT NULL THEN
    PERFORM 1
    FROM public.users AS unassigner
    WHERE unassigner.id = NEW.unassigned_by_user_id
      AND unassigner.tenant_id = v_register.tenant_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'unassigned_by_user must belong to the same tenant';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cash_register_user_assignments_validate
  ON public.cash_register_user_assignments;
CREATE TRIGGER trg_cash_register_user_assignments_validate
BEFORE INSERT OR UPDATE ON public.cash_register_user_assignments
FOR EACH ROW
EXECUTE FUNCTION public.validate_cash_register_user_assignment();

-- ============================================================================
-- 2. sales.cash_session_id
-- ============================================================================

ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS cash_session_id uuid NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_sales_cash_session'
      AND conrelid = 'public.sales'::regclass
  ) THEN
    ALTER TABLE public.sales
      ADD CONSTRAINT fk_sales_cash_session
      FOREIGN KEY (cash_session_id) REFERENCES public.cash_sessions(id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_sales_cash_session
  ON public.sales (cash_session_id);

CREATE INDEX IF NOT EXISTS idx_sales_tenant_cash_session_created
  ON public.sales (tenant_id, cash_session_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.validate_sales_cash_session_tenant()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_session_tenant_id uuid;
BEGIN
  IF NEW.cash_session_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT session.tenant_id
  INTO v_session_tenant_id
  FROM public.cash_sessions AS session
  WHERE session.id = NEW.cash_session_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'cash session not found';
  END IF;

  IF v_session_tenant_id IS DISTINCT FROM NEW.tenant_id THEN
    RAISE EXCEPTION 'sale and cash session must belong to the same tenant';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sales_cash_session_tenant
  ON public.sales;
CREATE TRIGGER trg_sales_cash_session_tenant
BEFORE INSERT OR UPDATE OF cash_session_id, tenant_id ON public.sales
FOR EACH ROW
EXECUTE FUNCTION public.validate_sales_cash_session_tenant();

UPDATE public.sales AS sale
SET cash_session_id = payment_scope.cash_session_id
FROM (
  SELECT
    payment.tenant_id,
    payment.reference_id AS sale_id,
    MIN(payment.cash_session_id::text)::uuid AS cash_session_id
  FROM public.payments AS payment
  WHERE payment.reference_type = 'SALE'
    AND payment.cash_session_id IS NOT NULL
  GROUP BY payment.tenant_id, payment.reference_id
  HAVING COUNT(DISTINCT payment.cash_session_id) = 1
) AS payment_scope
WHERE sale.id = payment_scope.sale_id
  AND sale.tenant_id = payment_scope.tenant_id
  AND sale.cash_session_id IS NULL;

-- ============================================================================
-- 3. Catálogo parameters + tenant_settings
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.parameters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL,
  value_type text NOT NULL,
  default_value text NOT NULL,
  active boolean NOT NULL DEFAULT TRUE,
  label text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT parameters_code_unique UNIQUE (code),
  CONSTRAINT parameters_code_not_blank CHECK (btrim(code) <> ''),
  CONSTRAINT parameters_label_not_blank CHECK (btrim(label) <> ''),
  CONSTRAINT parameters_value_type_check CHECK (value_type IN ('MODE', 'BOOLEAN')),
  CONSTRAINT parameters_default_value_check CHECK (
    (value_type = 'MODE' AND default_value IN ('DISABLED', 'ON_DEMAND', 'AUTOMATIC'))
    OR (value_type = 'BOOLEAN' AND default_value IN ('true', 'false'))
  )
);

CREATE TABLE IF NOT EXISTS public.tenant_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  branch_id uuid NULL REFERENCES public.tenant_branches(id) ON DELETE CASCADE,
  terminal_id uuid NULL REFERENCES public.terminals(id) ON DELETE CASCADE,
  parameter_id uuid NOT NULL REFERENCES public.parameters(id) ON DELETE RESTRICT,
  value text NOT NULL,
  updated_by_user_id uuid NULL REFERENCES public.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT tenant_settings_scope_check CHECK (
    (branch_id IS NULL AND terminal_id IS NULL)
    OR (branch_id IS NOT NULL AND terminal_id IS NULL)
    OR (branch_id IS NOT NULL AND terminal_id IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_tenant_settings_tenant_parameter
  ON public.tenant_settings (tenant_id, parameter_id)
  WHERE branch_id IS NULL AND terminal_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_tenant_settings_branch_parameter
  ON public.tenant_settings (tenant_id, branch_id, parameter_id)
  WHERE branch_id IS NOT NULL AND terminal_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_tenant_settings_terminal_parameter
  ON public.tenant_settings (tenant_id, branch_id, terminal_id, parameter_id)
  WHERE branch_id IS NOT NULL AND terminal_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tenant_settings_tenant_parameter
  ON public.tenant_settings (tenant_id, parameter_id);

CREATE OR REPLACE FUNCTION public.validate_tenant_setting_value()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_parameter public.parameters%ROWTYPE;
  v_branch_tenant_id uuid;
  v_terminal_tenant_id uuid;
  v_terminal_branch_id uuid;
BEGIN
  SELECT *
  INTO v_parameter
  FROM public.parameters
  WHERE id = NEW.parameter_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'parameter not found';
  END IF;

  IF v_parameter.value_type = 'MODE'
     AND NEW.value NOT IN ('DISABLED', 'ON_DEMAND', 'AUTOMATIC') THEN
    RAISE EXCEPTION 'invalid MODE value for parameter %', v_parameter.code;
  END IF;

  IF v_parameter.value_type = 'BOOLEAN'
     AND NEW.value NOT IN ('true', 'false') THEN
    RAISE EXCEPTION 'invalid BOOLEAN value for parameter %', v_parameter.code;
  END IF;

  IF NEW.branch_id IS NOT NULL THEN
    SELECT branch.tenant_id
    INTO v_branch_tenant_id
    FROM public.tenant_branches AS branch
    WHERE branch.id = NEW.branch_id;

    IF NOT FOUND OR v_branch_tenant_id IS DISTINCT FROM NEW.tenant_id THEN
      RAISE EXCEPTION 'branch must belong to tenant';
    END IF;
  END IF;

  IF NEW.terminal_id IS NOT NULL THEN
    SELECT terminal.tenant_id, terminal.branch_id
    INTO v_terminal_tenant_id, v_terminal_branch_id
    FROM public.terminals AS terminal
    WHERE terminal.id = NEW.terminal_id;

    IF NOT FOUND
       OR v_terminal_tenant_id IS DISTINCT FROM NEW.tenant_id
       OR v_terminal_branch_id IS DISTINCT FROM NEW.branch_id THEN
      RAISE EXCEPTION 'terminal must belong to tenant and branch';
    END IF;
  END IF;

  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_tenant_settings_validate
  ON public.tenant_settings;
CREATE TRIGGER trg_tenant_settings_validate
BEFORE INSERT OR UPDATE ON public.tenant_settings
FOR EACH ROW
EXECUTE FUNCTION public.validate_tenant_setting_value();

INSERT INTO public.parameters (code, value_type, default_value, active, label)
VALUES
  ('PRINT_TICKET', 'MODE', 'ON_DEMAND', TRUE, 'Impresión de ticket de venta'),
  ('PRINT_INVOICE', 'MODE', 'ON_DEMAND', TRUE, 'Impresión de factura electrónica'),
  ('SEND_INVOICE', 'MODE', 'AUTOMATIC', TRUE, 'Envío de factura electrónica'),
  ('GENERATE_INVOICE', 'MODE', 'AUTOMATIC', TRUE, 'Generación de factura electrónica'),
  ('PRINT_REMISSION', 'MODE', 'DISABLED', TRUE, 'Impresión de remisión'),
  ('CONVERT_REMISSION', 'MODE', 'DISABLED', TRUE, 'Conversión a remisión')
ON CONFLICT (code) DO UPDATE
SET
  value_type = EXCLUDED.value_type,
  default_value = EXCLUDED.default_value,
  active = EXCLUDED.active,
  label = EXCLUDED.label,
  updated_at = NOW();

INSERT INTO public.tenant_settings (
  tenant_id,
  branch_id,
  terminal_id,
  parameter_id,
  value,
  updated_by_user_id
)
SELECT
  tenant.id,
  NULL,
  NULL,
  parameter.id,
  CASE
    WHEN COALESCE(tenant.config->>'electronicBillingEnabled', 'true') = 'false'
      THEN 'DISABLED'
    WHEN tenant.config->>'electronicBillingMode' = 'ON_DEMAND'
      THEN 'ON_DEMAND'
    ELSE 'AUTOMATIC'
  END,
  NULL
FROM public.tenants AS tenant
CROSS JOIN public.parameters AS parameter
WHERE parameter.code = 'GENERATE_INVOICE'
  AND NOT EXISTS (
    SELECT 1
    FROM public.tenant_settings AS existing
    WHERE existing.tenant_id = tenant.id
      AND existing.parameter_id = parameter.id
      AND existing.branch_id IS NULL
      AND existing.terminal_id IS NULL
  );

CREATE OR REPLACE FUNCTION public.resolve_parameter_value(
  p_code text,
  p_tenant_id uuid,
  p_branch_id uuid DEFAULT NULL,
  p_terminal_id uuid DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_value text;
BEGIN
  IF p_terminal_id IS NOT NULL THEN
    SELECT setting.value
    INTO v_value
    FROM public.tenant_settings AS setting
    INNER JOIN public.parameters AS parameter
      ON parameter.id = setting.parameter_id
    WHERE parameter.code = p_code
      AND parameter.active = TRUE
      AND setting.tenant_id = p_tenant_id
      AND setting.branch_id = p_branch_id
      AND setting.terminal_id = p_terminal_id
    LIMIT 1;
    IF FOUND THEN
      RETURN v_value;
    END IF;
  END IF;

  IF p_branch_id IS NOT NULL THEN
    SELECT setting.value
    INTO v_value
    FROM public.tenant_settings AS setting
    INNER JOIN public.parameters AS parameter
      ON parameter.id = setting.parameter_id
    WHERE parameter.code = p_code
      AND parameter.active = TRUE
      AND setting.tenant_id = p_tenant_id
      AND setting.branch_id = p_branch_id
      AND setting.terminal_id IS NULL
    LIMIT 1;
    IF FOUND THEN
      RETURN v_value;
    END IF;
  END IF;

  IF p_tenant_id IS NOT NULL THEN
    SELECT setting.value
    INTO v_value
    FROM public.tenant_settings AS setting
    INNER JOIN public.parameters AS parameter
      ON parameter.id = setting.parameter_id
    WHERE parameter.code = p_code
      AND parameter.active = TRUE
      AND setting.tenant_id = p_tenant_id
      AND setting.branch_id IS NULL
      AND setting.terminal_id IS NULL
    LIMIT 1;
    IF FOUND THEN
      RETURN v_value;
    END IF;
  END IF;

  SELECT parameter.default_value
  INTO v_value
  FROM public.parameters AS parameter
  WHERE parameter.code = p_code
    AND parameter.active = TRUE
  LIMIT 1;

  RETURN v_value;
END;
$$;

COMMIT;
