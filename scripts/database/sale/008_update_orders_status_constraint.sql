DO $$
BEGIN
  ALTER TABLE orders
    DROP CONSTRAINT IF EXISTS chk_orders_status;
END $$;

DO $$
BEGIN
  ALTER TABLE orders
    ADD CONSTRAINT chk_orders_status
      CHECK (status IN ('DRAFT', 'CONFIRMED', 'PARTIAL', 'COMPLETED', 'CANCELLED'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
