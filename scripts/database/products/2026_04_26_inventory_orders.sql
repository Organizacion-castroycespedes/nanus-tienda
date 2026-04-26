CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  customer_id UUID NOT NULL REFERENCES customers(id),
  type VARCHAR(20) NOT NULL DEFAULT 'CASH',
  status VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
  total NUMERIC(12, 2) NOT NULL CHECK (total >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_orders_type
    CHECK (type IN ('CASH', 'CREDIT')),
  CONSTRAINT chk_orders_status
    CHECK (status IN ('DRAFT', 'CONFIRMED', 'CANCELLED'))
);

CREATE INDEX IF NOT EXISTS idx_orders_tenant_status_created
  ON orders (tenant_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_orders_tenant_customer
  ON orders (tenant_id, customer_id);
