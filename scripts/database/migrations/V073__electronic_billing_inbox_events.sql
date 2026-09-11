CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS electronic_billing_inbox_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  schema_version INTEGER NOT NULL,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  correlation_id TEXT NOT NULL,
  source_type TEXT NOT NULL,
  source_id TEXT NOT NULL,
  external_reference TEXT NOT NULL,
  payload_hash TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'RECEIVED',
  electronic_document_id UUID,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  last_error_code TEXT,
  last_error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_electronic_billing_inbox_events_event_id UNIQUE (event_id),
  CONSTRAINT uq_electronic_billing_inbox_events_source UNIQUE (tenant_id, source_type, source_id),
  CONSTRAINT uq_electronic_billing_inbox_events_external_reference UNIQUE (tenant_id, external_reference),
  CONSTRAINT fk_electronic_billing_inbox_events_document FOREIGN KEY (electronic_document_id)
    REFERENCES electronic_documents(id) ON DELETE SET NULL,
  CONSTRAINT chk_electronic_billing_inbox_events_source_type CHECK (source_type IN ('SALE', 'RETURN', 'ORDER', 'MANUAL')),
  CONSTRAINT chk_electronic_billing_inbox_events_status CHECK (status IN ('RECEIVED', 'PROCESSED', 'FAILED')),
  CONSTRAINT chk_electronic_billing_inbox_events_schema_version CHECK (schema_version >= 1)
);

CREATE INDEX IF NOT EXISTS idx_electronic_billing_inbox_events_tenant_status
  ON electronic_billing_inbox_events(tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_electronic_billing_inbox_events_tenant_received_at
  ON electronic_billing_inbox_events(tenant_id, received_at DESC);

CREATE INDEX IF NOT EXISTS idx_electronic_billing_inbox_events_tenant_source
  ON electronic_billing_inbox_events(tenant_id, source_type, source_id);

CREATE INDEX IF NOT EXISTS idx_electronic_billing_inbox_events_tenant_external_reference
  ON electronic_billing_inbox_events(tenant_id, external_reference);
