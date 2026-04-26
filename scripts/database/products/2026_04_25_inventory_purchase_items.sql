CREATE TABLE IF NOT EXISTS purchase_items (
  id UUID PRIMARY KEY,
  purchase_id UUID NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id),
  ordered_quantity NUMERIC(12, 2) NOT NULL CHECK (ordered_quantity > 0),
  received_quantity NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (received_quantity >= 0),
  cost NUMERIC(12, 2) NOT NULL CHECK (cost >= 0),
  subtotal NUMERIC(12, 2) NOT NULL CHECK (subtotal >= 0),
  CONSTRAINT chk_purchase_items_received_lte_ordered
    CHECK (received_quantity <= ordered_quantity)
);

CREATE INDEX IF NOT EXISTS idx_purchase_items_purchase
  ON purchase_items (purchase_id);

CREATE INDEX IF NOT EXISTS idx_purchase_items_product
  ON purchase_items (product_id);
