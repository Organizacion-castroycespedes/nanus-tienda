BEGIN;

ALTER TABLE IF EXISTS public.purchases
  DROP CONSTRAINT IF EXISTS purchases_status_check;

ALTER TABLE IF EXISTS public.purchases
  DROP CONSTRAINT IF EXISTS chk_purchases_status;

ALTER TABLE IF EXISTS public.purchases
  ADD CONSTRAINT chk_purchases_status
  CHECK (status IN ('DRAFT', 'PENDING', 'PARTIAL', 'RECEIVED', 'CERRADA_PARCIAL', 'CANCELLED'));

COMMIT;
