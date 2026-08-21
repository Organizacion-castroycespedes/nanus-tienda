BEGIN;

-- Configuracion de perifericos enlazada a la terminal operativa canonica.
-- Esta migracion es aditiva. No modifica ventas, caja, sesiones POS ni IDs.
-- El unico backfill permitido aqui fue aprobado explicitamente para TERM-001.

DO $$
BEGIN
  IF to_regclass('public.pos_terminals') IS NULL THEN
    RAISE EXCEPTION 'Required table public.pos_terminals does not exist';
  END IF;

  IF to_regclass('public.terminals') IS NULL THEN
    RAISE EXCEPTION 'Required table public.terminals does not exist';
  END IF;
END $$;

ALTER TABLE public.pos_terminals
  ADD COLUMN IF NOT EXISTS operational_terminal_id uuid NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'pos_terminals_operational_terminal_fk'
      AND conrelid = 'public.pos_terminals'::regclass
  ) THEN
    ALTER TABLE public.pos_terminals
      ADD CONSTRAINT pos_terminals_operational_terminal_fk
      FOREIGN KEY (operational_terminal_id)
      REFERENCES public.terminals(id)
      ON DELETE RESTRICT;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_pos_terminals_operational_terminal
  ON public.pos_terminals (operational_terminal_id)
  WHERE operational_terminal_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_pos_terminals_operational_terminal
  ON public.pos_terminals (operational_terminal_id)
  WHERE operational_terminal_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.validate_pos_terminal_operational_terminal_scope()
RETURNS trigger AS $$
DECLARE
  operational_terminal public.terminals%ROWTYPE;
BEGIN
  IF NEW.operational_terminal_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT *
  INTO operational_terminal
  FROM public.terminals
  WHERE id = NEW.operational_terminal_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Operational terminal % does not exist', NEW.operational_terminal_id;
  END IF;

  IF operational_terminal.tenant_id <> NEW.tenant_id
     OR operational_terminal.branch_id <> NEW.branch_id THEN
    RAISE EXCEPTION
      'Operational terminal % must belong to the same tenant and branch as POS terminal %',
      NEW.operational_terminal_id,
      NEW.id;
  END IF;

  IF NOT NEW.active OR NOT operational_terminal.is_active THEN
    RAISE EXCEPTION
      'Only active POS and operational terminals can be linked';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'trg_pos_terminals_operational_terminal_scope'
      AND tgrelid = 'public.pos_terminals'::regclass
      AND NOT tgisinternal
  ) THEN
    CREATE TRIGGER trg_pos_terminals_operational_terminal_scope
    BEFORE INSERT OR UPDATE OF operational_terminal_id, tenant_id, branch_id, active
    ON public.pos_terminals
    FOR EACH ROW
    EXECUTE FUNCTION public.validate_pos_terminal_operational_terminal_scope();
  END IF;
END $$;

-- Approved, one-row bridge only:
-- pos_terminal e186b5bd-4873-49bb-9450-f141570cce80 (local-terminal, HYBRID)
-- -> operational terminal 693921eb-d28d-4c1b-af17-087b589c6467 (TERM-001).
DO $$
DECLARE
  profile public.pos_terminals%ROWTYPE;
  operational_terminal public.terminals%ROWTYPE;
BEGIN
  SELECT *
  INTO profile
  FROM public.pos_terminals
  WHERE id = 'e186b5bd-4873-49bb-9450-f141570cce80'::uuid;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Approved POS terminal profile e186b5bd-4873-49bb-9450-f141570cce80 was not found';
  END IF;

  SELECT *
  INTO operational_terminal
  FROM public.terminals
  WHERE id = '693921eb-d28d-4c1b-af17-087b589c6467'::uuid;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Approved operational terminal 693921eb-d28d-4c1b-af17-087b589c6467 was not found';
  END IF;

  IF profile.code <> 'local-terminal' OR profile.mode <> 'HYBRID' THEN
    RAISE EXCEPTION 'Approved POS terminal profile no longer matches local-terminal/HYBRID';
  END IF;

  IF operational_terminal.code <> 'TERM-001' THEN
    RAISE EXCEPTION 'Approved operational terminal no longer matches TERM-001';
  END IF;

  IF profile.tenant_id <> '00000000-0000-0000-0000-000000000001'::uuid
     OR profile.branch_id <> 'ab41d3da-6686-4de3-9191-875a5a7da5a5'::uuid THEN
    RAISE EXCEPTION 'Approved POS terminal profile no longer matches the approved tenant and branch';
  END IF;

  IF operational_terminal.tenant_id <> '00000000-0000-0000-0000-000000000001'::uuid
     OR operational_terminal.branch_id <> 'ab41d3da-6686-4de3-9191-875a5a7da5a5'::uuid THEN
    RAISE EXCEPTION 'Approved operational terminal no longer matches the approved tenant and branch';
  END IF;

  IF NOT profile.active OR NOT operational_terminal.is_active THEN
    RAISE EXCEPTION 'Approved terminal mapping requires both records to be active';
  END IF;

  IF profile.tenant_id <> operational_terminal.tenant_id
     OR profile.branch_id <> operational_terminal.branch_id THEN
    RAISE EXCEPTION 'Approved terminal mapping does not share tenant and branch';
  END IF;

  IF profile.operational_terminal_id IS NOT NULL
     AND profile.operational_terminal_id <> operational_terminal.id THEN
    RAISE EXCEPTION 'POS terminal profile already links to another operational terminal';
  END IF;

  UPDATE public.pos_terminals
  SET operational_terminal_id = operational_terminal.id
  WHERE id = profile.id
    AND operational_terminal_id IS DISTINCT FROM operational_terminal.id;
END $$;

COMMIT;
