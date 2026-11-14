-- Rollback de V116__order_delivery_idempotency.sql
-- La tabla solo guarda respuestas de reintentos; no contiene datos de negocio.
-- Antes de ejecutar, revertir el código que exige Idempotency-Key en POST /orders/:id/deliver.

DROP INDEX IF EXISTS public.idx_order_delivery_idempotency_recovery;
DROP TABLE IF EXISTS public.order_delivery_idempotency;
