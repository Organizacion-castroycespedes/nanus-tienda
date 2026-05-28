BEGIN;

ALTER TABLE IF EXISTS public.purchases
  ADD COLUMN IF NOT EXISTS total_pedido NUMERIC(14, 2),
  ADD COLUMN IF NOT EXISTS total_recibido NUMERIC(14, 2),
  ADD COLUMN IF NOT EXISTS total_liquidado NUMERIC(14, 2),
  ADD COLUMN IF NOT EXISTS total_no_recibido NUMERIC(14, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS motivo_liquidacion TEXT,
  ADD COLUMN IF NOT EXISTS liquidado_por UUID,
  ADD COLUMN IF NOT EXISTS liquidado_en TIMESTAMPTZ;

ALTER TABLE IF EXISTS public.purchase_items
  ADD COLUMN IF NOT EXISTS pending_quantity NUMERIC(14, 3),
  ADD COLUMN IF NOT EXISTS received_subtotal NUMERIC(14, 2),
  ADD COLUMN IF NOT EXISTS unreceived_subtotal NUMERIC(14, 2);

ALTER TABLE IF EXISTS public.purchases
  DROP CONSTRAINT IF EXISTS chk_purchases_status;

ALTER TABLE IF EXISTS public.purchases
  ADD CONSTRAINT chk_purchases_status
  CHECK (status IN ('DRAFT', 'PENDING', 'PARTIAL', 'RECEIVED', 'CERRADA_PARCIAL', 'CANCELLED'));

ALTER TABLE IF EXISTS public.purchases
  DROP CONSTRAINT IF EXISTS chk_purchases_total_no_recibido_non_negative;

ALTER TABLE IF EXISTS public.purchases
  ADD CONSTRAINT chk_purchases_total_no_recibido_non_negative
  CHECK (total_no_recibido >= 0);

ALTER TABLE IF EXISTS public.purchases
  DROP CONSTRAINT IF EXISTS chk_purchases_liquidation_totals_non_negative;

ALTER TABLE IF EXISTS public.purchases
  ADD CONSTRAINT chk_purchases_liquidation_totals_non_negative
  CHECK (
    COALESCE(total_pedido, 0) >= 0
    AND COALESCE(total_recibido, 0) >= 0
    AND COALESCE(total_liquidado, 0) >= 0
  );

ALTER TABLE IF EXISTS public.purchase_items
  DROP CONSTRAINT IF EXISTS chk_purchase_items_liquidation_totals_non_negative;

ALTER TABLE IF EXISTS public.purchase_items
  ADD CONSTRAINT chk_purchase_items_liquidation_totals_non_negative
  CHECK (
    COALESCE(pending_quantity, 0) >= 0
    AND COALESCE(received_subtotal, 0) >= 0
    AND COALESCE(unreceived_subtotal, 0) >= 0
  );

DO $$
BEGIN
  IF to_regclass('public.users') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM pg_constraint
       WHERE conname = 'fk_purchases_liquidado_por'
     ) THEN
    ALTER TABLE public.purchases
      ADD CONSTRAINT fk_purchases_liquidado_por
      FOREIGN KEY (liquidado_por)
      REFERENCES public.users(id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_purchases_liquidado_en
  ON public.purchases (tenant_id, liquidado_en DESC)
  WHERE liquidado_en IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_auditoria_eventos_purchase_partial_closed
  ON public.auditoria_eventos (tenant_id, entidad_id, created_at DESC)
  WHERE entidad = 'purchases'
    AND accion = 'PURCHASE_PARTIAL_CLOSED';

COMMIT;
