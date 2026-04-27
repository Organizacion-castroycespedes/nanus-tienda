CREATE TABLE IF NOT EXISTS sale_items (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  sale_id UUID NOT NULL,
  product_id UUID NOT NULL,
  order_item_id UUID NULL,
  quantity NUMERIC(12, 2) NOT NULL CHECK (quantity > 0),
  price NUMERIC(12, 2) NOT NULL CHECK (price >= 0),
  price_without_tax NUMERIC(12, 2) NOT NULL CHECK (price_without_tax >= 0),
  tax_total NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (tax_total >= 0),
  subtotal NUMERIC(12, 2) NOT NULL CHECK (subtotal >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_sale_items_subtotal_matches
    CHECK (subtotal = price * quantity)
);
