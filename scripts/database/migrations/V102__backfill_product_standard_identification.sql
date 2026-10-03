-- V102: Backfill DIAN standard item identification from SKU.
--
-- FactuCore rejects invoice lines without cac:StandardItemIdentification.
-- Products with neither scheme nor code adopt scheme 999 (code adopted by the
-- taxpayer) with their SKU, the same default the product form applies.
-- Existing identifications are never changed. Idempotent.

UPDATE public.products
SET
  dian_standard_item_scheme_id = '999',
  dian_standard_item_code = btrim(sku),
  updated_at = NOW()
WHERE dian_standard_item_scheme_id IS NULL
  AND dian_standard_item_code IS NULL
  AND sku IS NOT NULL
  AND length(btrim(sku)) > 0
  AND btrim(sku) !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
