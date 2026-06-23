ALTER TABLE public.cash_counts
  ADD COLUMN IF NOT EXISTS count_type TEXT NOT NULL DEFAULT 'CLOSING',
  ADD COLUMN IF NOT EXISTS breakdown_json JSONB NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'cash_counts_count_type_check'
      AND conrelid = 'public.cash_counts'::regclass
  ) THEN
    ALTER TABLE public.cash_counts
      ADD CONSTRAINT cash_counts_count_type_check
      CHECK (count_type IN ('AUDIT', 'CLOSING'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_cash_counts_session_type_counted_at
  ON public.cash_counts (tenant_id, cash_session_id, count_type, counted_at DESC);
