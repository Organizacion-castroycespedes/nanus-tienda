ALTER TABLE purchases
ADD COLUMN IF NOT EXISTS type VARCHAR(20) NOT NULL DEFAULT 'CASH';

ALTER TABLE purchases
ADD COLUMN IF NOT EXISTS balance NUMERIC(12, 2) NOT NULL DEFAULT 0;

ALTER TABLE purchases
ALTER COLUMN status SET DEFAULT 'DRAFT';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_name = 'purchases'
      AND constraint_name = 'chk_purchases_type'
  ) THEN
    ALTER TABLE purchases
    ADD CONSTRAINT chk_purchases_type
    CHECK (type IN ('CASH', 'CREDIT'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_name = 'purchases'
      AND constraint_name = 'chk_purchases_status'
  ) THEN
    ALTER TABLE purchases
    ADD CONSTRAINT chk_purchases_status
    CHECK (status IN ('DRAFT', 'PENDING', 'PARTIAL', 'RECEIVED', 'CANCELLED'));
  END IF;
END $$;

ALTER TABLE purchases
DROP CONSTRAINT IF EXISTS purchases_status_check;

ALTER TABLE purchases
DROP CONSTRAINT IF EXISTS chk_purchases_status;

ALTER TABLE purchases
ADD CONSTRAINT chk_purchases_status
CHECK (status IN ('DRAFT', 'PENDING', 'PARTIAL', 'RECEIVED', 'CANCELLED'));

ALTER TABLE purchases
DROP CONSTRAINT IF EXISTS chk_purchases_balance_non_negative;

ALTER TABLE purchases
ADD CONSTRAINT chk_purchases_balance_non_negative
CHECK (balance >= 0);
