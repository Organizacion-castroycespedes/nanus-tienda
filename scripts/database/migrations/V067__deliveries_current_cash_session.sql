BEGIN;

-- Scope operativo de domicilios contra la caja actual.
-- Aditivo. No crea pagos, no crea movimientos de caja, no toca fiscal ni inventario.

DO $$
BEGIN
  IF to_regclass('public.deliveries') IS NULL THEN
    RAISE EXCEPTION 'Required table public.deliveries does not exist';
  END IF;

  IF to_regclass('public.cash_sessions') IS NULL THEN
    RAISE EXCEPTION 'Required table public.cash_sessions does not exist';
  END IF;

  IF to_regclass('public.cash_registers') IS NULL THEN
    RAISE EXCEPTION 'Required table public.cash_registers does not exist';
  END IF;
END $$;

ALTER TABLE public.deliveries
  ADD COLUMN IF NOT EXISTS cash_session_id uuid NULL,
  ADD COLUMN IF NOT EXISTS cash_register_id uuid NULL,
  ADD COLUMN IF NOT EXISTS terminal_id uuid NULL,
  ADD COLUMN IF NOT EXISTS cash_impact_amount numeric(14, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cash_impact_recorded_at timestamptz NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_deliveries_cash_session'
      AND conrelid = 'public.deliveries'::regclass
  ) THEN
    ALTER TABLE public.deliveries
      ADD CONSTRAINT fk_deliveries_cash_session
      FOREIGN KEY (cash_session_id) REFERENCES public.cash_sessions(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_deliveries_cash_register'
      AND conrelid = 'public.deliveries'::regclass
  ) THEN
    ALTER TABLE public.deliveries
      ADD CONSTRAINT fk_deliveries_cash_register
      FOREIGN KEY (cash_register_id) REFERENCES public.cash_registers(id) ON DELETE SET NULL;
  END IF;

  IF to_regclass('public.terminals') IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conname = 'fk_deliveries_terminal'
        AND conrelid = 'public.deliveries'::regclass
    ) THEN
    ALTER TABLE public.deliveries
      ADD CONSTRAINT fk_deliveries_terminal
      FOREIGN KEY (terminal_id) REFERENCES public.terminals(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_deliveries_cash_impact_non_negative'
      AND conrelid = 'public.deliveries'::regclass
  ) THEN
    ALTER TABLE public.deliveries
      ADD CONSTRAINT chk_deliveries_cash_impact_non_negative
      CHECK (cash_impact_amount >= 0);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_deliveries_cash_session
  ON public.deliveries (cash_session_id);

CREATE INDEX IF NOT EXISTS idx_deliveries_tenant_cash_session
  ON public.deliveries (tenant_id, cash_session_id);

CREATE INDEX IF NOT EXISTS idx_deliveries_cash_register
  ON public.deliveries (cash_register_id);

CREATE INDEX IF NOT EXISTS idx_deliveries_terminal
  ON public.deliveries (terminal_id);

CREATE INDEX IF NOT EXISTS idx_deliveries_cash_impact_recorded_at
  ON public.deliveries (cash_impact_recorded_at DESC)
  WHERE cash_session_id IS NOT NULL;

COMMIT;
