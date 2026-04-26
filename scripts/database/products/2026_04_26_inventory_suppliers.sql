CREATE TABLE IF NOT EXISTS suppliers (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  name VARCHAR(255) NOT NULL,
  document_number VARCHAR(100) NULL,
  phone VARCHAR(50) NULL,
  email VARCHAR(255) NULL,
  address TEXT NULL,
  departamento_id UUID NULL REFERENCES departamentos(id),
  municipio_id UUID NULL REFERENCES municipios(id),
  ciudad VARCHAR(150) NULL,
  departamento VARCHAR(150) NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_suppliers_tenant_name
  ON suppliers (tenant_id, name);

CREATE INDEX IF NOT EXISTS idx_suppliers_tenant_active
  ON suppliers (tenant_id, is_active);
