BEGIN;

-- Safe additive fields for operational delivery state timestamps.
-- State values remain compatible with existing legacy storage.

DO $$
BEGIN
  IF to_regclass('public.deliveries') IS NULL THEN
    RAISE EXCEPTION 'Required table public.deliveries does not exist';
  END IF;
END $$;

ALTER TABLE public.deliveries
  ADD COLUMN IF NOT EXISTS dispatched_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS failed_at timestamptz NULL;

CREATE INDEX IF NOT EXISTS idx_deliveries_dispatched_at
  ON public.deliveries (dispatched_at);

CREATE INDEX IF NOT EXISTS idx_deliveries_failed_at
  ON public.deliveries (failed_at);

COMMIT;
