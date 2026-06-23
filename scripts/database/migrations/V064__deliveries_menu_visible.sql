-- Domicilios menu visibility.
-- Idempotent. Shows only existing DELIVERIES menu items; role grants remain unchanged.

BEGIN;

DO $$
BEGIN
  IF to_regclass('public.menu_items') IS NULL THEN
    RAISE EXCEPTION 'Required table public.menu_items does not exist';
  END IF;
END $$;

UPDATE public.menu_items
SET
  visible = TRUE,
  updated_at = NOW()
WHERE key = 'DELIVERIES'
  AND module = 'deliveries'
  AND deleted_at IS NULL
  AND visible IS DISTINCT FROM TRUE;

COMMIT;
