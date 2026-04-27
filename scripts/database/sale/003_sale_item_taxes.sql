CREATE TABLE IF NOT EXISTS sale_item_taxes (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  sale_item_id UUID NOT NULL,
  tax_id UUID NOT NULL,
  tax_name VARCHAR(255) NOT NULL,
  tax_rate NUMERIC(12, 4) NOT NULL CHECK (tax_rate >= 0),
  tax_amount NUMERIC(12, 2) NOT NULL CHECK (tax_amount >= 0),
  is_included BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
