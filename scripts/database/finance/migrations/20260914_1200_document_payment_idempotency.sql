CREATE TABLE IF NOT EXISTS document_payment_operations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  operation_key UUID NOT NULL,
  request_fingerprint CHAR(64) NOT NULL,
  reference_type VARCHAR(30) NOT NULL,
  reference_id UUID NOT NULL,
  payment_ids UUID[] NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ NULL,
  CONSTRAINT document_payment_operations_status_check CHECK (status IN ('PENDING', 'COMPLETED')),
  CONSTRAINT document_payment_operations_reference_type_check CHECK (reference_type IN ('PURCHASE', 'SALES_ORDER')),
  CONSTRAINT uq_document_payment_operations_tenant_key UNIQUE (tenant_id, operation_key)
);

CREATE INDEX IF NOT EXISTS idx_document_payment_operations_reference
  ON document_payment_operations(tenant_id, reference_type, reference_id);
