ALTER TABLE purchase_items
  ADD COLUMN IF NOT EXISTS ordered_quantity NUMERIC(12, 2);

ALTER TABLE purchase_items
  ADD COLUMN IF NOT EXISTS received_quantity NUMERIC(12, 2) NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'purchase_items'
      AND column_name = 'quantity'
  ) THEN
    EXECUTE '
      UPDATE purchase_items
      SET ordered_quantity = quantity
      WHERE ordered_quantity IS NULL
    ';
  END IF;
END $$;

ALTER TABLE purchase_items
  ALTER COLUMN ordered_quantity SET NOT NULL;

DO $$
BEGIN
  ALTER TABLE purchase_items
    ADD CONSTRAINT chk_purchase_items_ordered_quantity_positive
      CHECK (ordered_quantity > 0);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE purchase_items
    ADD CONSTRAINT chk_purchase_items_received_quantity_non_negative
      CHECK (received_quantity >= 0);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE purchase_items
    ADD CONSTRAINT chk_purchase_items_received_lte_ordered
      CHECK (received_quantity <= ordered_quantity);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
