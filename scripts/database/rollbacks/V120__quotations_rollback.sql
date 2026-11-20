-- Rollback de V120__quotations.sql
-- Falla de forma segura si existen cotizaciones o pedidos generados desde una cotizacion.
-- Revertir antes el codigo del modulo de cotizaciones (API, reporteria y web).

DO $$
BEGIN
  IF to_regclass('public.quotations') IS NULL THEN
    RETURN;
  END IF;
  IF EXISTS (SELECT 1 FROM public.quotations) THEN
    RAISE EXCEPTION 'QUOTATIONS_ROLLBACK_BLOCKED_DATA quotations';
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'quotation_id'
  ) AND EXISTS (SELECT 1 FROM public.orders WHERE quotation_id IS NOT NULL) THEN
    RAISE EXCEPTION 'QUOTATIONS_ROLLBACK_BLOCKED_DATA orders.quotation_id';
  END IF;
END $$;

DELETE FROM public.role_menu_permissions
WHERE menu_item_id IN (
  SELECT id FROM public.menu_items WHERE key = 'QUOTATIONS'
);

UPDATE public.menu_items
SET deleted_at = NOW(), visible = FALSE, updated_at = NOW()
WHERE key = 'QUOTATIONS'
  AND deleted_at IS NULL;

DROP FUNCTION IF EXISTS public.fnc_quotation_effective_status(TEXT, DATE, DATE);
DROP FUNCTION IF EXISTS public.fnc_quotation_next_code(UUID);

DROP INDEX IF EXISTS public.uq_orders_quotation_id;
ALTER TABLE public.orders DROP COLUMN IF EXISTS quotation_id;

DROP TABLE IF EXISTS public.quotation_settings;
DROP TABLE IF EXISTS public.quotation_sequences;
DROP TABLE IF EXISTS public.quotation_items;
DROP TABLE IF EXISTS public.quotations;
