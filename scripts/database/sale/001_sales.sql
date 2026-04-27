CREATE TABLE IF NOT EXISTS sales (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  customer_id UUID NOT NULL,
  order_id UUID NULL,
  type VARCHAR(20) NOT NULL DEFAULT 'CASH',
  status VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
  total NUMERIC(12, 2) NOT NULL CHECK (total >= 0),
  balance NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (balance >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_sales_type
    CHECK (type IN ('CASH', 'CREDIT')),
  CONSTRAINT chk_sales_status
    CHECK (status IN ('DRAFT', 'CONFIRMED', 'CANCELLED')),
  CONSTRAINT chk_sales_balance_by_type
    CHECK (
      (type = 'CASH' AND balance = 0)
      OR (type = 'CREDIT' AND balance = total)
    )
);
