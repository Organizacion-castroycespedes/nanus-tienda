-- V109: product inventory policy and durable purchase-receipt idempotency.
-- Forward-only. Existing products receive the inventoryable default.

ALTER TABLE public.products
  ADD COLUMN is_inventoryable BOOLEAN NOT NULL DEFAULT TRUE;

CREATE TABLE public.purchase_receipt_idempotency (
  tenant_id UUID NOT NULL
    REFERENCES public.tenants(id) ON DELETE CASCADE,
  purchase_id UUID NOT NULL
    REFERENCES public.purchases(id) ON DELETE RESTRICT,
  idempotency_key VARCHAR(128) NOT NULL,
  request_hash CHAR(64) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  result JSONB NULL,
  operation_reference TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ NULL,
  PRIMARY KEY (tenant_id, purchase_id, idempotency_key),
  CONSTRAINT chk_purchase_receipt_idempotency_key_non_empty
    CHECK (length(idempotency_key) > 0),
  CONSTRAINT chk_purchase_receipt_idempotency_request_hash
    CHECK (request_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT chk_purchase_receipt_idempotency_status
    CHECK (status IN ('PENDING', 'COMPLETED', 'FAILED')),
  CONSTRAINT chk_purchase_receipt_idempotency_completed_at
    CHECK (status = 'PENDING' OR completed_at IS NOT NULL)
);

CREATE INDEX idx_purchase_receipt_idempotency_recovery
  ON public.purchase_receipt_idempotency
    (tenant_id, purchase_id, updated_at DESC);
