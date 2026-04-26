CREATE TABLE IF NOT EXISTS units (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  name VARCHAR(150) NOT NULL,
  abbreviation VARCHAR(30) NOT NULL
);

CREATE TABLE IF NOT EXISTS taxes (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  name VARCHAR(150) NOT NULL,
  rate NUMERIC(8, 4) NOT NULL,
  is_included BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  unit_id UUID NOT NULL REFERENCES units(id),
  tax_id UUID NULL REFERENCES taxes(id),
  name VARCHAR(255) NOT NULL,
  description TEXT NULL,
  sku VARCHAR(100) NOT NULL,
  price NUMERIC(12, 2) NOT NULL,
  cost NUMERIC(12, 2) NOT NULL,
  price_with_tax NUMERIC(12, 2) NOT NULL,
  price_without_tax NUMERIC(12, 2) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_products_tenant_id_sku
  ON products (tenant_id, sku);
