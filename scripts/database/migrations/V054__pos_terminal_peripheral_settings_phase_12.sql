BEGIN;

-- Fase 12 perifericos: configuracion operativa por tenant, sucursal y terminal POS.
-- No conecta hardware real. No guarda secretos ni credenciales.
-- Aplicacion prevista: local/QA. No aplicar en PRD sin aprobacion operativa.

DO $$
BEGIN
  IF to_regclass('public.tenants') IS NULL THEN
    RAISE EXCEPTION 'Required table public.tenants does not exist';
  END IF;

  IF to_regclass('public.tenant_branches') IS NULL THEN
    RAISE EXCEPTION 'Required table public.tenant_branches does not exist';
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.pos_terminals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  branch_id uuid NOT NULL REFERENCES public.tenant_branches(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  description text NULL,
  active boolean NOT NULL DEFAULT true,
  mode text NOT NULL DEFAULT 'MOCK',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pos_terminals_tenant_branch_code_unique UNIQUE (tenant_id, branch_id, code),
  CONSTRAINT pos_terminals_mode_check CHECK (mode IN ('MOCK', 'REAL', 'HYBRID')),
  CONSTRAINT pos_terminals_code_not_blank CHECK (btrim(code) <> ''),
  CONSTRAINT pos_terminals_name_not_blank CHECK (btrim(name) <> '')
);

CREATE TABLE IF NOT EXISTS public.pos_terminal_peripheral_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  terminal_id uuid NOT NULL REFERENCES public.pos_terminals(id) ON DELETE CASCADE,
  printer_device_id text NULL,
  cash_drawer_device_id text NULL,
  scale_device_id text NULL,
  scanner_device_id text NULL,
  enable_print_sale boolean NOT NULL DEFAULT true,
  enable_print_purchase boolean NOT NULL DEFAULT true,
  enable_print_order boolean NOT NULL DEFAULT true,
  enable_open_drawer boolean NOT NULL DEFAULT true,
  enable_scale boolean NOT NULL DEFAULT true,
  enable_scanner boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pos_terminal_peripheral_settings_terminal_unique UNIQUE (terminal_id)
);

CREATE INDEX IF NOT EXISTS idx_pos_terminals_tenant_branch
  ON public.pos_terminals (tenant_id, branch_id);

CREATE INDEX IF NOT EXISTS idx_pos_terminals_tenant_active
  ON public.pos_terminals (tenant_id, active);

CREATE INDEX IF NOT EXISTS idx_pos_terminal_settings_terminal
  ON public.pos_terminal_peripheral_settings (terminal_id);

CREATE OR REPLACE FUNCTION public.set_updated_at_timestamp()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_pos_terminals_updated_at ON public.pos_terminals;
CREATE TRIGGER trg_pos_terminals_updated_at
BEFORE UPDATE ON public.pos_terminals
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at_timestamp();

DROP TRIGGER IF EXISTS trg_pos_terminal_peripheral_settings_updated_at
  ON public.pos_terminal_peripheral_settings;
CREATE TRIGGER trg_pos_terminal_peripheral_settings_updated_at
BEFORE UPDATE ON public.pos_terminal_peripheral_settings
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at_timestamp();

WITH default_branch AS (
  SELECT
    t.id AS tenant_id,
    b.id AS branch_id
  FROM public.tenants t
  INNER JOIN public.tenant_branches b
    ON b.tenant_id = t.id
   AND b.es_principal = true
  WHERE t.id = '00000000-0000-0000-0000-000000000001'::uuid
  LIMIT 1
),
default_terminal AS (
  INSERT INTO public.pos_terminals (
    tenant_id,
    branch_id,
    code,
    name,
    description,
    active,
    mode
  )
  SELECT
    tenant_id,
    branch_id,
    'local-terminal',
    'Terminal MOCK local',
    'Terminal POS MOCK creada por Fase 12 para QA local',
    true,
    'MOCK'
  FROM default_branch
  ON CONFLICT (tenant_id, branch_id, code) DO UPDATE
    SET name = EXCLUDED.name,
        description = EXCLUDED.description,
        active = true,
        mode = 'MOCK'
  RETURNING id
)
INSERT INTO public.pos_terminal_peripheral_settings (
  terminal_id,
  printer_device_id,
  cash_drawer_device_id,
  scale_device_id,
  scanner_device_id,
  enable_print_sale,
  enable_print_purchase,
  enable_print_order,
  enable_open_drawer,
  enable_scale,
  enable_scanner
)
SELECT
  id,
  'mock-printer-001',
  'mock-cashdrawer-001',
  'mock-scale-001',
  'mock-scanner-001',
  true,
  true,
  true,
  true,
  true,
  true
FROM default_terminal
ON CONFLICT (terminal_id) DO UPDATE
  SET printer_device_id = COALESCE(
        public.pos_terminal_peripheral_settings.printer_device_id,
        EXCLUDED.printer_device_id
      ),
      cash_drawer_device_id = COALESCE(
        public.pos_terminal_peripheral_settings.cash_drawer_device_id,
        EXCLUDED.cash_drawer_device_id
      ),
      scale_device_id = COALESCE(
        public.pos_terminal_peripheral_settings.scale_device_id,
        EXCLUDED.scale_device_id
      ),
      scanner_device_id = COALESCE(
        public.pos_terminal_peripheral_settings.scanner_device_id,
        EXCLUDED.scanner_device_id
      );

COMMIT;

