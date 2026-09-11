CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ================================
-- Electronic billing providers
-- ================================
CREATE TABLE IF NOT EXISTS electronic_billing_providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  provider_type TEXT NOT NULL DEFAULT 'ELECTRONIC_BILLING',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  capabilities JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_electronic_billing_providers_code UNIQUE (code)
);

-- ================================
-- Tenant provider configuration
-- ================================
CREATE TABLE IF NOT EXISTS tenant_electronic_billing_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  provider_id UUID NOT NULL REFERENCES electronic_billing_providers(id) ON DELETE RESTRICT,
  environment TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  base_url TEXT,
  credential_reference TEXT,
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_tenant_electronic_billing_configs_provider_env UNIQUE (tenant_id, provider_id, environment),
  CONSTRAINT uq_tenant_electronic_billing_configs_id_provider UNIQUE (id, provider_id),
  CONSTRAINT chk_tenant_electronic_billing_configs_environment CHECK (environment IN ('TEST', 'HABILITATION', 'PRODUCTION'))
);

-- ================================
-- Electronic documents
-- ================================
CREATE TABLE IF NOT EXISTS electronic_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  provider_id UUID NOT NULL REFERENCES electronic_billing_providers(id) ON DELETE RESTRICT,
  provider_config_id UUID NOT NULL,
  document_type TEXT NOT NULL,
  source_type TEXT NOT NULL,
  source_id UUID,
  external_reference TEXT NOT NULL,
  provider_document_id TEXT,
  prefix TEXT,
  number BIGINT,
  full_number TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING',
  provider_status TEXT,
  provider_status_detail TEXT,
  cufe TEXT,
  cude TEXT,
  currency_code TEXT NOT NULL DEFAULT 'COP',
  subtotal_amount NUMERIC(18, 2) NOT NULL DEFAULT 0,
  discount_amount NUMERIC(18, 2) NOT NULL DEFAULT 0,
  tax_amount NUMERIC(18, 2) NOT NULL DEFAULT 0,
  total_amount NUMERIC(18, 2) NOT NULL DEFAULT 0,
  issue_date DATE,
  issue_time TIME,
  sent_at TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ,
  rejected_at TIMESTAMPTZ,
  last_status_check_at TIMESTAMPTZ,
  last_error_code TEXT,
  last_error_message TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_electronic_documents_idempotency UNIQUE (tenant_id, provider_id, document_type, external_reference),
  CONSTRAINT fk_electronic_documents_provider_config FOREIGN KEY (provider_config_id, provider_id)
    REFERENCES tenant_electronic_billing_configs(id, provider_id) ON DELETE RESTRICT,
  CONSTRAINT chk_electronic_documents_document_type CHECK (document_type IN ('INVOICE', 'CREDIT_NOTE', 'DEBIT_NOTE')),
  CONSTRAINT chk_electronic_documents_source_type CHECK (source_type IN ('SALE', 'RETURN', 'ORDER', 'MANUAL')),
  CONSTRAINT chk_electronic_documents_status CHECK (status IN ('PENDING', 'PROCESSING', 'ACCEPTED', 'REJECTED', 'TECHNICAL_ERROR', 'CANCELLED')),
  CONSTRAINT chk_electronic_documents_amounts CHECK (
    subtotal_amount >= 0
    AND discount_amount >= 0
    AND tax_amount >= 0
    AND total_amount >= 0
  )
);

-- ================================
-- Electronic document lines
-- ================================
CREATE TABLE IF NOT EXISTS electronic_document_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  electronic_document_id UUID NOT NULL REFERENCES electronic_documents(id) ON DELETE CASCADE,
  source_line_type TEXT NOT NULL,
  source_line_id UUID,
  provider_line_id TEXT,
  sku TEXT,
  description TEXT NOT NULL,
  quantity NUMERIC(18, 6) NOT NULL,
  unit_code TEXT,
  unit_price NUMERIC(18, 2) NOT NULL DEFAULT 0,
  discount_amount NUMERIC(18, 2) NOT NULL DEFAULT 0,
  subtotal_amount NUMERIC(18, 2) NOT NULL DEFAULT 0,
  tax_amount NUMERIC(18, 2) NOT NULL DEFAULT 0,
  total_amount NUMERIC(18, 2) NOT NULL DEFAULT 0,
  tax_treatment TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_electronic_document_lines_document_id_id UNIQUE (electronic_document_id, id),
  CONSTRAINT chk_electronic_document_lines_source_line_type CHECK (source_line_type IN ('SALE', 'RETURN', 'ORDER', 'MANUAL')),
  CONSTRAINT chk_electronic_document_lines_quantity CHECK (quantity > 0),
  CONSTRAINT chk_electronic_document_lines_amounts CHECK (
    unit_price >= 0
    AND discount_amount >= 0
    AND subtotal_amount >= 0
    AND tax_amount >= 0
    AND total_amount >= 0
  )
);

-- ================================
-- Electronic document taxes
-- ================================
CREATE TABLE IF NOT EXISTS electronic_document_taxes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  electronic_document_id UUID NOT NULL REFERENCES electronic_documents(id) ON DELETE CASCADE,
  electronic_document_line_id UUID,
  tax_type TEXT NOT NULL,
  tax_code TEXT,
  tax_scheme_id TEXT,
  tax_scheme_name TEXT,
  rate NUMERIC(18, 6) NOT NULL DEFAULT 0,
  taxable_base NUMERIC(18, 2) NOT NULL DEFAULT 0,
  tax_amount NUMERIC(18, 2) NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_electronic_document_taxes_line FOREIGN KEY (electronic_document_id, electronic_document_line_id)
    REFERENCES electronic_document_lines(electronic_document_id, id) ON DELETE CASCADE,
  CONSTRAINT chk_electronic_document_taxes_amounts CHECK (
    rate >= 0
    AND taxable_base >= 0
    AND tax_amount >= 0
  )
);

-- ================================
-- Electronic document references
-- ================================
CREATE TABLE IF NOT EXISTS electronic_document_references (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  electronic_document_id UUID NOT NULL REFERENCES electronic_documents(id) ON DELETE CASCADE,
  referenced_electronic_document_id UUID REFERENCES electronic_documents(id) ON DELETE SET NULL,
  reference_type TEXT NOT NULL,
  provider_referenced_document_id TEXT,
  reference_number TEXT,
  external_reference TEXT,
  reason_code TEXT,
  reason_description TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ================================
-- Electronic document events
-- ================================
CREATE TABLE IF NOT EXISTS electronic_document_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  electronic_document_id UUID NOT NULL REFERENCES electronic_documents(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  status TEXT,
  provider_status TEXT,
  operation TEXT NOT NULL,
  attempt INTEGER NOT NULL DEFAULT 1,
  http_status INTEGER,
  error_code TEXT,
  error_message TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_electronic_document_events_attempt CHECK (attempt > 0)
);

-- ================================
-- Electronic document attachments
-- ================================
CREATE TABLE IF NOT EXISTS electronic_document_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  electronic_document_id UUID NOT NULL REFERENCES electronic_documents(id) ON DELETE CASCADE,
  attachment_type TEXT NOT NULL,
  provider_attachment_id TEXT,
  storage_provider TEXT,
  storage_key TEXT,
  file_name TEXT,
  mime_type TEXT,
  checksum TEXT,
  size_bytes BIGINT,
  status TEXT NOT NULL DEFAULT 'PENDING',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_electronic_document_attachments_size CHECK (size_bytes IS NULL OR size_bytes >= 0)
);

-- ================================
-- Electronic document deliveries
-- ================================
CREATE TABLE IF NOT EXISTS electronic_document_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  electronic_document_id UUID NOT NULL REFERENCES electronic_documents(id) ON DELETE CASCADE,
  delivery_type TEXT NOT NULL,
  destination TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  attempts INTEGER NOT NULL DEFAULT 0,
  last_attempt_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  last_error TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_electronic_document_deliveries_attempts CHECK (attempts >= 0)
);

-- ================================
-- Indexes
-- ================================
CREATE INDEX IF NOT EXISTS idx_electronic_billing_providers_active
  ON electronic_billing_providers(active);

CREATE INDEX IF NOT EXISTS idx_tenant_electronic_billing_configs_tenant
  ON tenant_electronic_billing_configs(tenant_id);

CREATE INDEX IF NOT EXISTS idx_tenant_electronic_billing_configs_provider
  ON tenant_electronic_billing_configs(provider_id);

CREATE INDEX IF NOT EXISTS idx_tenant_electronic_billing_configs_environment
  ON tenant_electronic_billing_configs(environment);

CREATE INDEX IF NOT EXISTS idx_electronic_documents_tenant_created_at
  ON electronic_documents(tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_electronic_documents_tenant_status
  ON electronic_documents(tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_electronic_documents_tenant_provider_status
  ON electronic_documents(tenant_id, provider_status);

CREATE INDEX IF NOT EXISTS idx_electronic_documents_tenant_source
  ON electronic_documents(tenant_id, source_type, source_id);

CREATE INDEX IF NOT EXISTS idx_electronic_documents_tenant_external_reference
  ON electronic_documents(tenant_id, external_reference);

CREATE INDEX IF NOT EXISTS idx_electronic_documents_document_type
  ON electronic_documents(document_type);

CREATE INDEX IF NOT EXISTS idx_electronic_documents_full_number
  ON electronic_documents(full_number);

CREATE UNIQUE INDEX IF NOT EXISTS uq_electronic_documents_provider_document_id
  ON electronic_documents(tenant_id, provider_id, provider_document_id)
  WHERE provider_document_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_electronic_documents_provider_config
  ON electronic_documents(provider_config_id);

CREATE INDEX IF NOT EXISTS idx_electronic_document_lines_document
  ON electronic_document_lines(electronic_document_id);

CREATE INDEX IF NOT EXISTS idx_electronic_document_lines_source
  ON electronic_document_lines(source_line_type, source_line_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_electronic_document_lines_provider_line_id
  ON electronic_document_lines(electronic_document_id, provider_line_id)
  WHERE provider_line_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_electronic_document_taxes_document
  ON electronic_document_taxes(electronic_document_id);

CREATE INDEX IF NOT EXISTS idx_electronic_document_taxes_line
  ON electronic_document_taxes(electronic_document_line_id);

CREATE INDEX IF NOT EXISTS idx_electronic_document_references_document
  ON electronic_document_references(electronic_document_id);

CREATE INDEX IF NOT EXISTS idx_electronic_document_references_referenced
  ON electronic_document_references(referenced_electronic_document_id);

CREATE INDEX IF NOT EXISTS idx_electronic_document_events_document_created_at
  ON electronic_document_events(electronic_document_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_electronic_document_attachments_document
  ON electronic_document_attachments(electronic_document_id);

CREATE INDEX IF NOT EXISTS idx_electronic_document_attachments_type
  ON electronic_document_attachments(attachment_type);

CREATE INDEX IF NOT EXISTS idx_electronic_document_deliveries_document
  ON electronic_document_deliveries(electronic_document_id);

CREATE INDEX IF NOT EXISTS idx_electronic_document_deliveries_type_status
  ON electronic_document_deliveries(delivery_type, status);
