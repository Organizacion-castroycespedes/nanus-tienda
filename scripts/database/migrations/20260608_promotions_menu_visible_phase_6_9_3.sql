BEGIN;

UPDATE public.menu_items
SET
  visible = TRUE,
  route = '/{tenant}/inventory/promotions',
  updated_at = NOW()
WHERE key = 'INVENTORY_PROMOTIONS'
  AND deleted_at IS NULL;

COMMIT;
