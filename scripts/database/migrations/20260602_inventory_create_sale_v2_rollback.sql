-- Rollback Fase 3.12: elimina solo inventory_create_sale_v2.
-- No toca inventory_create_sale v1.
-- No toca inventory_invoice_order.
-- No toca datos, tablas, indices ni triggers.

DROP FUNCTION IF EXISTS public.inventory_create_sale_v2(
  UUID,
  UUID,
  UUID,
  UUID,
  UUID,
  UUID,
  UUID,
  VARCHAR(20),
  JSONB,
  JSONB
);
