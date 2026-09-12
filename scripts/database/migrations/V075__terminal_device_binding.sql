BEGIN;

-- P9.2: cloud identity for an installed Manus runtime and explicit binding history.
-- Additive only. installation_id is an identifier, never a credential.

DO $$
BEGIN
  IF to_regclass('public.terminals') IS NULL THEN
    RAISE EXCEPTION 'Required table public.terminals does not exist';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'terminals_id_tenant_unique'
      AND conrelid = 'public.terminals'::regclass
  ) THEN
    ALTER TABLE public.terminals
      ADD CONSTRAINT terminals_id_tenant_unique UNIQUE (id, tenant_id);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.terminal_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  installation_id text NOT NULL,
  platform text NULL,
  runtime_version text NULL,
  agent_api_version integer NULL,
  registration_status text NOT NULL DEFAULT 'REGISTERED',
  last_seen_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT terminal_devices_installation_unique UNIQUE (installation_id),
  CONSTRAINT terminal_devices_installation_not_blank CHECK (btrim(installation_id) <> ''),
  CONSTRAINT terminal_devices_status_check CHECK (registration_status IN ('REGISTERED', 'BOUND', 'UNBOUND', 'REVOKED')),
  CONSTRAINT terminal_devices_agent_api_version_check CHECK (agent_api_version IS NULL OR agent_api_version > 0)
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'terminal_devices_id_tenant_unique'
      AND conrelid = 'public.terminal_devices'::regclass
  ) THEN
    ALTER TABLE public.terminal_devices
      ADD CONSTRAINT terminal_devices_id_tenant_unique UNIQUE (id, tenant_id);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.terminal_device_bindings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  terminal_id uuid NOT NULL,
  device_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'ACTIVE',
  bound_at timestamptz NOT NULL DEFAULT now(),
  unbound_at timestamptz NULL,
  revoked_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT terminal_device_bindings_status_check CHECK (status IN ('ACTIVE', 'UNBOUND', 'REVOKED')),
  CONSTRAINT terminal_device_bindings_terminal_fk
    FOREIGN KEY (terminal_id, tenant_id) REFERENCES public.terminals(id, tenant_id) ON DELETE CASCADE,
  CONSTRAINT terminal_device_bindings_device_fk
    FOREIGN KEY (device_id, tenant_id) REFERENCES public.terminal_devices(id, tenant_id) ON DELETE CASCADE,
  CONSTRAINT terminal_device_bindings_dates_check CHECK (
    (status = 'ACTIVE' AND unbound_at IS NULL AND revoked_at IS NULL)
    OR (status = 'UNBOUND' AND unbound_at IS NOT NULL AND revoked_at IS NULL)
    OR (status = 'REVOKED' AND revoked_at IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS terminal_device_bindings_active_terminal_unique
  ON public.terminal_device_bindings (terminal_id)
  WHERE status = 'ACTIVE';

CREATE UNIQUE INDEX IF NOT EXISTS terminal_device_bindings_active_device_unique
  ON public.terminal_device_bindings (device_id)
  WHERE status = 'ACTIVE';

CREATE INDEX IF NOT EXISTS terminal_devices_tenant_status_idx
  ON public.terminal_devices (tenant_id, registration_status);

CREATE INDEX IF NOT EXISTS terminal_device_bindings_tenant_idx
  ON public.terminal_device_bindings (tenant_id, created_at DESC);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_terminal_devices_updated_at'
      AND tgrelid = 'public.terminal_devices'::regclass
      AND NOT tgisinternal
  ) THEN
    CREATE TRIGGER trg_terminal_devices_updated_at
    BEFORE UPDATE ON public.terminal_devices
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_timestamp();
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_terminal_device_bindings_updated_at'
      AND tgrelid = 'public.terminal_device_bindings'::regclass
      AND NOT tgisinternal
  ) THEN
    CREATE TRIGGER trg_terminal_device_bindings_updated_at
    BEFORE UPDATE ON public.terminal_device_bindings
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_timestamp();
  END IF;
END $$;

COMMIT;
