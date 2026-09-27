BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'pos_terminals_id_tenant_branch_unique'
      AND conrelid = 'public.pos_terminals'::regclass
  ) THEN
    ALTER TABLE public.pos_terminals
      ADD CONSTRAINT pos_terminals_id_tenant_branch_unique
      UNIQUE (id, tenant_id, branch_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'terminals_id_tenant_branch_unique'
      AND conrelid = 'public.terminals'::regclass
  ) THEN
    ALTER TABLE public.terminals
      ADD CONSTRAINT terminals_id_tenant_branch_unique
      UNIQUE (id, tenant_id, branch_id);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.terminal_scale_bindings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  branch_id uuid NOT NULL REFERENCES public.tenant_branches(id) ON DELETE RESTRICT,
  pos_terminal_id uuid NOT NULL,
  operational_terminal_id uuid NOT NULL,
  terminal_device_id uuid NOT NULL,
  logical_scale_id text NOT NULL,
  status text NOT NULL DEFAULT 'PENDING',
  unit_state text NOT NULL DEFAULT 'NOT_VERIFIED',
  verified_at timestamptz NULL,
  last_observed_at timestamptz NULL,
  revoked_at timestamptz NULL,
  created_by text NULL,
  revoked_by text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT terminal_scale_bindings_pos_fk
    FOREIGN KEY (pos_terminal_id, tenant_id, branch_id)
    REFERENCES public.pos_terminals(id, tenant_id, branch_id) ON DELETE CASCADE,
  CONSTRAINT terminal_scale_bindings_terminal_fk
    FOREIGN KEY (operational_terminal_id, tenant_id, branch_id)
    REFERENCES public.terminals(id, tenant_id, branch_id) ON DELETE RESTRICT,
  CONSTRAINT terminal_scale_bindings_device_fk
    FOREIGN KEY (terminal_device_id, tenant_id)
    REFERENCES public.terminal_devices(id, tenant_id) ON DELETE RESTRICT,
  CONSTRAINT terminal_scale_bindings_status_check
    CHECK (status IN ('PENDING', 'AUTHORIZED', 'REVOKED', 'DISABLED')),
  CONSTRAINT terminal_scale_bindings_unit_check
    CHECK (unit_state IN ('NOT_VERIFIED', 'KG_VERIFIED')),
  CONSTRAINT terminal_scale_bindings_id_not_blank
    CHECK (btrim(logical_scale_id) <> ''),
  CONSTRAINT terminal_scale_bindings_revoked_check
    CHECK ((status = 'REVOKED' AND revoked_at IS NOT NULL) OR status <> 'REVOKED')
);

CREATE UNIQUE INDEX IF NOT EXISTS terminal_scale_bindings_active_terminal_unique
  ON public.terminal_scale_bindings (pos_terminal_id)
  WHERE status IN ('PENDING', 'AUTHORIZED');
CREATE UNIQUE INDEX IF NOT EXISTS terminal_scale_bindings_active_scale_unique
  ON public.terminal_scale_bindings (tenant_id, logical_scale_id)
  WHERE status IN ('PENDING', 'AUTHORIZED');
CREATE INDEX IF NOT EXISTS terminal_scale_bindings_tenant_status_idx
  ON public.terminal_scale_bindings (tenant_id, branch_id, status);

DROP TRIGGER IF EXISTS trg_terminal_scale_bindings_updated_at
  ON public.terminal_scale_bindings;
CREATE TRIGGER trg_terminal_scale_bindings_updated_at
BEFORE UPDATE ON public.terminal_scale_bindings
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_timestamp();

COMMIT;
