CREATE TABLE IF NOT EXISTS sale_payment_methods (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  sale_id UUID NOT NULL,
  payment_method VARCHAR(20) NOT NULL,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  reference VARCHAR(255) NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_sale_payment_methods_method
    CHECK (payment_method IN ('CASH', 'CARD', 'TRANSFER', 'OTHER'))
);
