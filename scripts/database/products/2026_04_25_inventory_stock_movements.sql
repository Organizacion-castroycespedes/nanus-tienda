CREATE TABLE IF NOT EXISTS stock_movements (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  product_id UUID NOT NULL REFERENCES products(id),
  type VARCHAR(3) NOT NULL CHECK (type IN ('IN', 'OUT')),
  quantity NUMERIC(12, 2) NOT NULL CHECK (quantity > 0),
  reference_type VARCHAR(20) NOT NULL CHECK (
    reference_type IN ('PURCHASE', 'SALE', 'ADJUSTMENT')
  ),
  reference_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stock_movements_tenant_product_created
  ON stock_movements (tenant_id, product_id, created_at DESC);
