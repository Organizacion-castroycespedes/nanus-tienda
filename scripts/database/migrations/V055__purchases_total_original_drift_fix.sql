BEGIN;

ALTER TABLE IF EXISTS public.purchases
  ADD COLUMN IF NOT EXISTS total_original numeric(14, 2);

UPDATE public.purchases
SET total_original = total
WHERE total_original IS NULL
  AND total IS NOT NULL;

COMMIT;
