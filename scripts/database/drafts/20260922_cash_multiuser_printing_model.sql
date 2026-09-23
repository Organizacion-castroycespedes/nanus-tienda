-- ============================================================================
-- DISENO PROPUESTO: CAJA MULTIUSUARIO Y CONFIGURACION JERARQUICA
-- Fecha: 2026-09-22
-- Estado: BORRADOR. NO EJECUTAR EN QA/PRD.
-- ============================================================================
--
-- Principios:
--   1. Una caja abierta puede tener varios usuarios operadores.
--   2. Se reutiliza tenants.config como configuracion del tenant.
--   3. La configuracion hereda: GLOBAL -> TENANT -> BRANCH -> TERMINAL.
--   4. La configuracion usa JSONB y admite parametros futuros.
--   5. No se persisten trabajos/eventos de impresion.
--   6. Imprimir un ticket no crea ni modifica una factura electronica.
--
-- Flujo esperado:
--   SALE confirmada -> reporte/ticket -> impresion bajo demanda
--   SALE confirmada -> FE automatica habilitada -> electronic_document
--   electronic_document ACCEPTED -> representacion de factura imprimible
-- ============================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================================
-- 1. INTEGRIDAD MULTITENANT PARA REFERENCIAS COMPUESTAS
-- ============================================================================

CREATE UNIQUE INDEX IF NOT EXISTS uq_users_tenant_id_id
  ON public.users (tenant_id, id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_cash_sessions_tenant_id_id
  ON public.cash_sessions (tenant_id, id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_tenant_branches_tenant_id_id
  ON public.tenant_branches (tenant_id, id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_terminals_tenant_id_id
  ON public.terminals (tenant_id, id);

-- ============================================================================
-- 2. MULTIUSUARIO EN UNA SESION DE CAJA
-- ============================================================================

-- cash_sessions.opened_by_user_id conserva quien abrio la caja.
-- Esta tabla define quienes pueden operar dentro del mismo turno.
CREATE TABLE IF NOT EXISTS public.cash_session_operators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  cash_session_id UUID NOT NULL,
  user_id UUID NOT NULL,
  operator_role VARCHAR(20) NOT NULL DEFAULT 'OPERATOR',
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  left_at TIMESTAMPTZ NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  joined_by_user_id UUID NOT NULL,
  left_by_user_id UUID NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT fk_cash_session_operators_session
    FOREIGN KEY (tenant_id, cash_session_id)
    REFERENCES public.cash_sessions (tenant_id, id)
    ON DELETE CASCADE,

  CONSTRAINT fk_cash_session_operators_user
    FOREIGN KEY (tenant_id, user_id)
    REFERENCES public.users (tenant_id, id)
    ON DELETE RESTRICT,

  CONSTRAINT fk_cash_session_operators_joined_by
    FOREIGN KEY (tenant_id, joined_by_user_id)
    REFERENCES public.users (tenant_id, id)
    ON DELETE RESTRICT,

  CONSTRAINT fk_cash_session_operators_left_by
    FOREIGN KEY (tenant_id, left_by_user_id)
    REFERENCES public.users (tenant_id, id)
    ON DELETE RESTRICT,

  CONSTRAINT cash_session_operators_role_check
    CHECK (operator_role IN ('OPERATOR', 'SUPERVISOR')),

  CONSTRAINT cash_session_operators_state_check
    CHECK (
      (is_active = TRUE AND left_at IS NULL AND left_by_user_id IS NULL)
      OR
      (is_active = FALSE AND left_at IS NOT NULL AND left_by_user_id IS NOT NULL)
    ),

  CONSTRAINT cash_session_operators_dates_check
    CHECK (left_at IS NULL OR left_at >= joined_at)
);

-- Un usuario solo puede tener una membresia activa en el mismo turno.
-- Puede salir y volver a entrar; el historial anterior se conserva.
CREATE UNIQUE INDEX IF NOT EXISTS uq_cash_session_operators_active
  ON public.cash_session_operators (cash_session_id, user_id)
  WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_cash_session_operators_session
  ON public.cash_session_operators (tenant_id, cash_session_id, is_active);

CREATE INDEX IF NOT EXISTS idx_cash_session_operators_user
  ON public.cash_session_operators (tenant_id, user_id, is_active);

-- La sesion POS conserva la membresia concreta usada en la caja.
ALTER TABLE public.pos_user_sessions
  ADD COLUMN IF NOT EXISTS cash_session_operator_id UUID NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_pos_user_sessions_cash_session_operator'
      AND conrelid = 'public.pos_user_sessions'::regclass
  ) THEN
    ALTER TABLE public.pos_user_sessions
      ADD CONSTRAINT fk_pos_user_sessions_cash_session_operator
      FOREIGN KEY (cash_session_operator_id)
      REFERENCES public.cash_session_operators(id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_pos_user_sessions_cash_session_operator
  ON public.pos_user_sessions (cash_session_operator_id);

-- La venta conserva la caja que recibio su impacto financiero.
ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS cash_session_id UUID NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_sales_tenant_cash_session'
      AND conrelid = 'public.sales'::regclass
  ) THEN
    ALTER TABLE public.sales
      ADD CONSTRAINT fk_sales_tenant_cash_session
      FOREIGN KEY (tenant_id, cash_session_id)
      REFERENCES public.cash_sessions (tenant_id, id)
      ON DELETE RESTRICT;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_sales_tenant_cash_session_created
  ON public.sales (tenant_id, cash_session_id, created_at DESC);

-- ============================================================================
-- 3. CONFIGURACION GLOBAL Y HERENCIA POR ALCANCE
-- ============================================================================

-- Un unico documento JSONB contiene los valores globales por defecto.
-- Nuevos modulos o parametros se agregan como namespaces, sin crear tablas.
CREATE TABLE IF NOT EXISTS public.platform_configuration (
  id SMALLINT PRIMARY KEY DEFAULT 1,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  config_version INTEGER NOT NULL DEFAULT 1,
  updated_by_user_id UUID NULL REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT platform_configuration_singleton_check CHECK (id = 1),
  CONSTRAINT platform_configuration_object_check
    CHECK (jsonb_typeof(config) = 'object'),
  CONSTRAINT platform_configuration_version_check
    CHECK (config_version > 0)
);

INSERT INTO public.platform_configuration (id, config, config_version)
VALUES (
  1,
  jsonb_build_object(
    'documents', jsonb_build_object(
      'printing', jsonb_build_object(
        'SALE_TICKET', jsonb_build_object(
          'enabled', true,
          'mode', 'ON_DEMAND',
          'renderer', 'REPORT',
          'target', 'WINDOW',
          'copies', 1
        ),
        'INVOICE', jsonb_build_object(
          'enabled', false,
          'mode', 'ON_DEMAND',
          'renderer', 'REPORT',
          'target', 'WINDOW',
          'requiredStatus', 'ACCEPTED',
          'copies', 1
        ),
        'REMISSION', jsonb_build_object(
          'enabled', false,
          'mode', 'ON_DEMAND',
          'renderer', 'REPORT',
          'target', 'WINDOW',
          'copies', 1
        )
      ),
      'delivery', jsonb_build_object(
        'INVOICE', jsonb_build_object(
          'enabled', false,
          'mode', 'ON_DEMAND',
          'channel', 'EMAIL'
        ),
        'REMISSION', jsonb_build_object(
          'enabled', false,
          'mode', 'ON_DEMAND',
          'channel', 'EMAIL'
        )
      )
    ),
    'electronicBilling', jsonb_build_object(
      'automaticIssue', false
    )
  ),
  1
)
ON CONFLICT (id) DO NOTHING;

-- tenants.config ya existe y se conserva como override del tenant.
UPDATE public.tenants
SET config = '{}'::jsonb
WHERE config IS NULL;

ALTER TABLE public.tenants
  ALTER COLUMN config SET DEFAULT '{}'::jsonb,
  ALTER COLUMN config SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'tenants_config_object_check'
      AND conrelid = 'public.tenants'::regclass
  ) THEN
    ALTER TABLE public.tenants
      ADD CONSTRAINT tenants_config_object_check
      CHECK (jsonb_typeof(config) = 'object');
  END IF;
END $$;

-- La sucursal y la terminal solo guardan diferencias frente al nivel superior.
ALTER TABLE public.tenant_branches
  ADD COLUMN IF NOT EXISTS config JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.terminals
  ADD COLUMN IF NOT EXISTS config JSONB NOT NULL DEFAULT '{}'::jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'tenant_branches_config_object_check'
      AND conrelid = 'public.tenant_branches'::regclass
  ) THEN
    ALTER TABLE public.tenant_branches
      ADD CONSTRAINT tenant_branches_config_object_check
      CHECK (jsonb_typeof(config) = 'object');
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'terminals_config_object_check'
      AND conrelid = 'public.terminals'::regclass
  ) THEN
    ALTER TABLE public.terminals
      ADD CONSTRAINT terminals_config_object_check
      CHECK (jsonb_typeof(config) = 'object');
  END IF;
END $$;

-- ============================================================================
-- 4. MEZCLA PROFUNDA DE CONFIGURACION JSONB
-- ============================================================================

-- El operador JSONB || reemplaza objetos completos.
-- Esta funcion mezcla recursivamente para permitir overrides parciales.
CREATE OR REPLACE FUNCTION public.jsonb_deep_merge(
  p_base JSONB,
  p_override JSONB
)
RETURNS JSONB
LANGUAGE SQL
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT CASE
    WHEN jsonb_typeof(COALESCE(p_base, '{}'::jsonb)) <> 'object'
      OR jsonb_typeof(COALESCE(p_override, '{}'::jsonb)) <> 'object'
      THEN COALESCE(p_override, p_base, '{}'::jsonb)
    ELSE COALESCE(
      (
        SELECT jsonb_object_agg(
          key,
          CASE
            WHEN base_value IS NOT NULL
              AND override_value IS NOT NULL
              AND jsonb_typeof(base_value) = 'object'
              AND jsonb_typeof(override_value) = 'object'
              THEN public.jsonb_deep_merge(base_value, override_value)
            ELSE COALESCE(override_value, base_value)
          END
        )
        FROM (
          SELECT
            COALESCE(base_entry.key, override_entry.key) AS key,
            base_entry.value AS base_value,
            override_entry.value AS override_value
          FROM jsonb_each(COALESCE(p_base, '{}'::jsonb)) AS base_entry
          FULL JOIN jsonb_each(COALESCE(p_override, '{}'::jsonb)) AS override_entry
            ON override_entry.key = base_entry.key
        ) AS merged_entries
      ),
      '{}'::jsonb
    )
  END;
$$;

-- Resuelve y valida el alcance solicitado.
-- Orden de precedencia: terminal > sucursal > tenant > global.
CREATE OR REPLACE FUNCTION public.resolve_operational_configuration(
  p_tenant_id UUID,
  p_branch_id UUID DEFAULT NULL,
  p_terminal_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_global_config JSONB := '{}'::jsonb;
  v_tenant_config JSONB := '{}'::jsonb;
  v_branch_config JSONB := '{}'::jsonb;
  v_terminal_config JSONB := '{}'::jsonb;
  v_result JSONB;
BEGIN
  SELECT COALESCE(config, '{}'::jsonb)
  INTO v_global_config
  FROM public.platform_configuration
  WHERE id = 1;

  SELECT COALESCE(config, '{}'::jsonb)
  INTO v_tenant_config
  FROM public.tenants
  WHERE id = p_tenant_id
    AND activo = TRUE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'tenant not found or inactive';
  END IF;

  IF p_branch_id IS NOT NULL THEN
    SELECT COALESCE(config, '{}'::jsonb)
    INTO v_branch_config
    FROM public.tenant_branches
    WHERE id = p_branch_id
      AND tenant_id = p_tenant_id
      AND estado = 'ACTIVE';

    IF NOT FOUND THEN
      RAISE EXCEPTION 'branch not found, inactive or outside tenant';
    END IF;
  END IF;

  IF p_terminal_id IS NOT NULL THEN
    IF p_branch_id IS NULL THEN
      RAISE EXCEPTION 'branch is required when terminal is provided';
    END IF;

    SELECT COALESCE(config, '{}'::jsonb)
    INTO v_terminal_config
    FROM public.terminals
    WHERE id = p_terminal_id
      AND tenant_id = p_tenant_id
      AND branch_id = p_branch_id
      AND is_active = TRUE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'terminal not found, inactive or outside branch';
    END IF;
  END IF;

  v_result := public.jsonb_deep_merge(v_global_config, v_tenant_config);
  v_result := public.jsonb_deep_merge(v_result, v_branch_config);
  v_result := public.jsonb_deep_merge(v_result, v_terminal_config);

  RETURN v_result;
END;
$$;

COMMIT;

-- ============================================================================
-- EJEMPLOS DE OVERRIDES. NO EJECUTAR COMO PARTE DE LA MIGRACION.
-- ============================================================================
--
-- Tenant habilita FE automatica:
-- UPDATE tenants
-- SET config = jsonb_set(
--   config,
--   '{electronicBilling,automaticIssue}',
--   'true'::jsonb,
--   true
-- )
-- WHERE id = '<tenant-id>'::uuid;
--
-- Sucursal habilita factura y remision bajo demanda:
-- UPDATE tenant_branches
-- SET config = public.jsonb_deep_merge(
--   config,
--   '{
--     "documents": {
--       "printing": {
--         "INVOICE": {"enabled": true},
--         "REMISSION": {"enabled": true}
--       }
--     }
--   }'::jsonb
-- )
-- WHERE tenant_id = '<tenant-id>'::uuid
--   AND id = '<branch-id>'::uuid;
--
-- Terminal cambia solo destino y copias del ticket:
-- UPDATE terminals
-- SET config = public.jsonb_deep_merge(
--   config,
--   '{
--     "documents": {
--       "printing": {
--         "SALE_TICKET": {
--           "target": "WINDOW",
--           "copies": 2
--         }
--       }
--     }
--   }'::jsonb
-- )
-- WHERE tenant_id = '<tenant-id>'::uuid
--   AND branch_id = '<branch-id>'::uuid
--   AND id = '<terminal-id>'::uuid;
--
-- Lectura efectiva:
-- SELECT public.resolve_operational_configuration(
--   '<tenant-id>'::uuid,
--   '<branch-id>'::uuid,
--   '<terminal-id>'::uuid
-- );
