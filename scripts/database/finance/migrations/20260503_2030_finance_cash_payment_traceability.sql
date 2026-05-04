ALTER TABLE cash_movements
  ADD COLUMN IF NOT EXISTS payment_id UUID NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'cash_movements_payment_id_fkey'
  ) THEN
    ALTER TABLE cash_movements
      ADD CONSTRAINT cash_movements_payment_id_fkey
      FOREIGN KEY (payment_id)
      REFERENCES payments(id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_cash_movements_payment_id
  ON cash_movements(payment_id)
  WHERE payment_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_cash_movements_payment_once
  ON cash_movements(payment_id)
  WHERE payment_id IS NOT NULL
    AND movement_type = 'PAYMENT';
