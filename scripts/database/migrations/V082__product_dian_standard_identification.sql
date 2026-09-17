-- Product master data for DIAN StandardItemIdentification.
-- No historical sale snapshot is changed by this migration.
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS dian_standard_item_scheme_id VARCHAR(3),
  ADD COLUMN IF NOT EXISTS dian_standard_item_code VARCHAR(100);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'products_dian_standard_item_scheme_chk'
  ) THEN
    ALTER TABLE public.products
      ADD CONSTRAINT products_dian_standard_item_scheme_chk
      CHECK (
        dian_standard_item_scheme_id IS NULL
        OR dian_standard_item_scheme_id IN ('001', '010', '020', '999')
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'products_dian_standard_item_pair_chk'
  ) THEN
    ALTER TABLE public.products
      ADD CONSTRAINT products_dian_standard_item_pair_chk
      CHECK (
        (dian_standard_item_scheme_id IS NULL AND dian_standard_item_code IS NULL)
        OR (
          dian_standard_item_scheme_id IS NOT NULL
          AND dian_standard_item_code IS NOT NULL
          AND length(btrim(dian_standard_item_code)) > 0
          AND dian_standard_item_code !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        )
      );
  END IF;
END $$;
