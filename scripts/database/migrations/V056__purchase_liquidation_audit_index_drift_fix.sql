BEGIN;

CREATE INDEX IF NOT EXISTS idx_auditoria_eventos_purchase_liquidated
  ON public.auditoria_eventos (tenant_id, entidad_id, created_at DESC)
  WHERE entidad = 'purchases'
    AND accion = 'PURCHASE_PARTIAL_CLOSED';

COMMIT;
