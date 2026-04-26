CREATE TABLE IF NOT EXISTS order_items (
  id UUID PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id),
  ordered_quantity NUMERIC(12, 2) NOT NULL CHECK (ordered_quantity > 0),
  delivered_quantity NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (delivered_quantity >= 0),
  price NUMERIC(12, 2) NOT NULL CHECK (price >= 0),
  subtotal NUMERIC(12, 2) NOT NULL CHECK (subtotal >= 0),
  CONSTRAINT chk_order_items_delivered_lte_ordered
    CHECK (delivered_quantity <= ordered_quantity)
);

CREATE INDEX IF NOT EXISTS idx_order_items_order
  ON order_items (order_id);

CREATE INDEX IF NOT EXISTS idx_order_items_product
  ON order_items (product_id);
