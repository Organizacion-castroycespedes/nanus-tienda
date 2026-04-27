DO $$
BEGIN
  ALTER TABLE sales
    DROP CONSTRAINT IF EXISTS chk_sales_balance_by_type;
END $$;

DO $$
BEGIN
  ALTER TABLE sales
    ADD CONSTRAINT chk_sales_balance_by_type
      CHECK (
        (type = 'CASH' AND balance = 0)
        OR (type = 'CREDIT' AND balance >= 0 AND balance <= total)
      );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
