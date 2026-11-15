-- Rollback de V117__product_serials.sql
-- Falla de forma segura si ya hay series registradas o productos marcados con serie obligatoria.
-- Antes de ejecutar, revertir el código que usa las funciones fnc_product_serials_*.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.product_serials) THEN
    RAISE EXCEPTION 'PRODUCT_SERIALS_ROLLBACK_BLOCKED_DATA product_serials';
  END IF;
  IF EXISTS (SELECT 1 FROM public.products WHERE requires_serial = TRUE) THEN
    RAISE EXCEPTION 'PRODUCT_SERIALS_ROLLBACK_BLOCKED_DATA products.requires_serial';
  END IF;
END $$;

DELETE FROM public.role_menu_permissions rmp
USING public.menu_items mi
WHERE rmp.menu_item_id = mi.id
  AND mi.key = 'INVENTORY_SERIALS';

UPDATE public.menu_items
SET deleted_at = NOW(), updated_at = NOW()
WHERE key = 'INVENTORY_SERIALS'
  AND deleted_at IS NULL;

DROP FUNCTION IF EXISTS public.fnc_product_serials_move_location(UUID, UUID[], UUID, UUID, TEXT);
DROP FUNCTION IF EXISTS public.fnc_product_serials_write_off(UUID, UUID, UUID, UUID[], UUID, UUID, TEXT);
DROP FUNCTION IF EXISTS public.fnc_product_serials_inspect(UUID, UUID, TEXT, TEXT, UUID, UUID);
DROP FUNCTION IF EXISTS public.prc_product_serials_mark_returned(UUID, UUID, BOOLEAN, UUID, TEXT);
DROP FUNCTION IF EXISTS public.fnc_product_serials_assign_order_delivery(UUID, UUID, UUID, JSONB, UUID);
DROP FUNCTION IF EXISTS public.fnc_product_serials_assign_sale(UUID, UUID, UUID, JSONB, UUID);
DROP FUNCTION IF EXISTS public.fnc_product_serials_register(UUID, UUID, UUID, TEXT, UUID, UUID, UUID, JSONB, UUID, UUID);
DROP FUNCTION IF EXISTS public.fnc_product_serials_normalize(TEXT);

DROP TRIGGER IF EXISTS trg_product_serial_events_immutable ON public.product_serial_events;
DROP FUNCTION IF EXISTS public.fnc_product_serial_events_immutable();

DROP TABLE IF EXISTS public.product_serial_events;
DROP TABLE IF EXISTS public.product_serials;

ALTER TABLE public.products DROP CONSTRAINT IF EXISTS chk_products_serial_rules;
ALTER TABLE public.products DROP COLUMN IF EXISTS requires_serial;
