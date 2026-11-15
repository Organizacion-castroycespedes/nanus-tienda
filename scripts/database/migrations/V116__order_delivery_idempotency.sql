-- V116: idempotencia durable de la entrega de pedidos (POST /orders/:id/deliver).
-- OpenSpec: idempotencia-entrega-pedidos
-- Requiere orders y purchase_receipt_idempotency (V109, mismo diseño).
-- Sin control transaccional: lo aporta apply_single_migration.sh.

DO $$
BEGIN
  IF to_regclass('public.orders') IS NULL THEN
    RAISE EXCEPTION 'ORDER_DELIVERY_IDEMPOTENCY_ORDERS_REQUIRED';
  END IF;
  IF to_regclass('public.purchase_receipt_idempotency') IS NULL THEN
    RAISE EXCEPTION 'ORDER_DELIVERY_IDEMPOTENCY_V109_REQUIRED';
  END IF;
END $$;

CREATE TABLE public.order_delivery_idempotency (
  tenant_id UUID NOT NULL
    REFERENCES public.tenants(id) ON DELETE CASCADE,
  order_id UUID NOT NULL
    REFERENCES public.orders(id) ON DELETE RESTRICT,
  idempotency_key VARCHAR(128) NOT NULL,
  request_hash CHAR(64) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  result JSONB NULL,
  operation_reference TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ NULL,
  PRIMARY KEY (tenant_id, order_id, idempotency_key),
  CONSTRAINT chk_order_delivery_idempotency_key_non_empty
    CHECK (length(idempotency_key) > 0),
  CONSTRAINT chk_order_delivery_idempotency_request_hash
    CHECK (request_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT chk_order_delivery_idempotency_status
    CHECK (status IN ('PENDING', 'COMPLETED', 'FAILED')),
  CONSTRAINT chk_order_delivery_idempotency_completed_at
    CHECK (status = 'PENDING' OR completed_at IS NOT NULL)
);

CREATE INDEX idx_order_delivery_idempotency_recovery
  ON public.order_delivery_idempotency
    (tenant_id, order_id, updated_at DESC);
