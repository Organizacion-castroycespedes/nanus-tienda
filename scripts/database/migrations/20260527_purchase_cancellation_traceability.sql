ALTER TABLE IF EXISTS public.purchases
  ADD COLUMN IF NOT EXISTS motivo_cancelacion text NULL;

ALTER TABLE IF EXISTS public.purchases
  ADD COLUMN IF NOT EXISTS cancelado_por uuid NULL;

ALTER TABLE IF EXISTS public.purchases
  ADD COLUMN IF NOT EXISTS cancelado_en timestamptz NULL;

DO $$
BEGIN
  IF to_regclass('public.users') IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conname = 'fk_purchases_cancelado_por'
    )
  THEN
    ALTER TABLE public.purchases
      ADD CONSTRAINT fk_purchases_cancelado_por
      FOREIGN KEY (cancelado_por)
      REFERENCES public.users(id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_purchases_cancelado_en
  ON public.purchases (tenant_id, cancelado_en DESC)
  WHERE cancelado_en IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_purchases_cancelado_por
  ON public.purchases (tenant_id, cancelado_por)
  WHERE cancelado_por IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_auditoria_eventos_purchase_cancelled
  ON public.auditoria_eventos (tenant_id, entidad_id, created_at DESC)
  WHERE entidad = 'purchases'
    AND accion = 'PURCHASE_CANCELLED';
