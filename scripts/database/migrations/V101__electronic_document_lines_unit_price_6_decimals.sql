-- V101: Keep six decimals in electronic billing line unit price.
--
-- The invoice line base is derived from the charged line amount, so it is not
-- always a multiple of the quantity. DIAN PriceAmount (FBB02) accepts up to six
-- decimals and FAV06 requires LineExtensionAmount = PriceAmount x BaseQuantity.
-- Widening the scale keeps every stored value. Idempotent.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'electronic_document_lines'
      AND column_name = 'unit_price'
      AND numeric_scale IS DISTINCT FROM 6
  ) THEN
    ALTER TABLE public.electronic_document_lines
      ALTER COLUMN unit_price TYPE NUMERIC(18, 6);
  END IF;
END $$;
