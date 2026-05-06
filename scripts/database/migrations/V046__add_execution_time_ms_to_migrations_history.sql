ALTER TABLE public.migrations_history
  ADD COLUMN IF NOT EXISTS execution_time_ms INTEGER NULL;
