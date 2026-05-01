ALTER TABLE sales
  ADD COLUMN IF NOT EXISTS payment_status VARCHAR(16) NOT NULL DEFAULT 'PENDING',
  ADD COLUMN IF NOT EXISTS total_paid NUMERIC(14, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS balance_due NUMERIC(14, 2) NOT NULL DEFAULT 0;

ALTER TABLE purchases
  ADD COLUMN IF NOT EXISTS payment_status VARCHAR(16) NOT NULL DEFAULT 'PENDING',
  ADD COLUMN IF NOT EXISTS total_paid NUMERIC(14, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS balance_due NUMERIC(14, 2) NOT NULL DEFAULT 0;

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS payment_status VARCHAR(16) NOT NULL DEFAULT 'PENDING',
  ADD COLUMN IF NOT EXISTS total_paid NUMERIC(14, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS balance_due NUMERIC(14, 2) NOT NULL DEFAULT 0;

UPDATE sales
SET
  total_paid = GREATEST(total - COALESCE(balance, 0), 0),
  balance_due = GREATEST(COALESCE(balance, 0), 0),
  payment_status = CASE
    WHEN GREATEST(total - COALESCE(balance, 0), 0) <= 0 THEN 'PENDING'
    WHEN GREATEST(total - COALESCE(balance, 0), 0) < total THEN 'PARTIAL'
    WHEN GREATEST(total - COALESCE(balance, 0), 0) = total THEN 'PAID'
    ELSE 'OVERPAID'
  END;

UPDATE purchases
SET
  total_paid = GREATEST(total - COALESCE(balance, 0), 0),
  balance_due = GREATEST(COALESCE(balance, 0), 0),
  payment_status = CASE
    WHEN GREATEST(total - COALESCE(balance, 0), 0) <= 0 THEN 'PENDING'
    WHEN GREATEST(total - COALESCE(balance, 0), 0) < total THEN 'PARTIAL'
    WHEN GREATEST(total - COALESCE(balance, 0), 0) = total THEN 'PAID'
    ELSE 'OVERPAID'
  END;

UPDATE orders
SET
  total_paid = 0,
  balance_due = total,
  payment_status = 'PENDING'
WHERE total_paid = 0
  AND balance_due = 0
  AND payment_status = 'PENDING';

ALTER TABLE sales
  ADD CONSTRAINT sales_payment_status_check
    CHECK (payment_status IN ('PENDING', 'PARTIAL', 'PAID', 'OVERPAID')),
  ADD CONSTRAINT sales_total_paid_non_negative_check
    CHECK (total_paid >= 0),
  ADD CONSTRAINT sales_balance_due_non_negative_check
    CHECK (balance_due >= 0);

ALTER TABLE purchases
  ADD CONSTRAINT purchases_payment_status_check
    CHECK (payment_status IN ('PENDING', 'PARTIAL', 'PAID', 'OVERPAID')),
  ADD CONSTRAINT purchases_total_paid_non_negative_check
    CHECK (total_paid >= 0),
  ADD CONSTRAINT purchases_balance_due_non_negative_check
    CHECK (balance_due >= 0);

ALTER TABLE orders
  ADD CONSTRAINT orders_payment_status_check
    CHECK (payment_status IN ('PENDING', 'PARTIAL', 'PAID', 'OVERPAID')),
  ADD CONSTRAINT orders_total_paid_non_negative_check
    CHECK (total_paid >= 0),
  ADD CONSTRAINT orders_balance_due_non_negative_check
    CHECK (balance_due >= 0);

CREATE INDEX IF NOT EXISTS idx_sales_payment_status
  ON sales (tenant_id, payment_status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_purchases_payment_status
  ON purchases (tenant_id, payment_status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_orders_payment_status
  ON orders (tenant_id, payment_status, created_at DESC);
