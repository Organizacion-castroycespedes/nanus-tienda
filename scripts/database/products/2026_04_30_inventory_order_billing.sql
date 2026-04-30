ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS billed_quantity NUMERIC(12, 2);

UPDATE order_items
SET billed_quantity = COALESCE(billed_quantity, 0)
WHERE billed_quantity IS NULL;

ALTER TABLE order_items
  ALTER COLUMN billed_quantity SET DEFAULT 0;

ALTER TABLE order_items
  ALTER COLUMN billed_quantity SET NOT NULL;

DO $$
BEGIN
  ALTER TABLE order_items
    DROP CONSTRAINT IF EXISTS chk_order_items_billed_non_negative;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

ALTER TABLE order_items
  ADD CONSTRAINT chk_order_items_billed_non_negative
    CHECK (billed_quantity >= 0);

DO $$
BEGIN
  ALTER TABLE order_items
    DROP CONSTRAINT IF EXISTS chk_order_items_billed_lte_delivered;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

ALTER TABLE order_items
  ADD CONSTRAINT chk_order_items_billed_lte_delivered
    CHECK (billed_quantity <= delivered_quantity);
