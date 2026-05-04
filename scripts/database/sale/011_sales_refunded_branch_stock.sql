ALTER TABLE sales
  DROP CONSTRAINT IF EXISTS chk_sales_status;

ALTER TABLE sales
  ADD CONSTRAINT chk_sales_status
    CHECK (status IN ('DRAFT', 'CONFIRMED', 'CANCELLED', 'REFUNDED'));

CREATE INDEX IF NOT EXISTS idx_sales_tenant_branch_status
  ON sales (tenant_id, branch_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_stock_movements_tenant_branch_product
  ON stock_movements (tenant_id, branch_id, product_id, created_at DESC);
