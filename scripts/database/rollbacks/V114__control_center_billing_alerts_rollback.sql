-- Rollback de V114__control_center_billing_alerts.sql
-- Solo si no hay alertas ni avisos: falla de forma segura si alguna tabla tiene filas.

DO $$
BEGIN
  IF to_regclass('control_center.billing_alerts') IS NOT NULL
    AND EXISTS (SELECT 1 FROM control_center.billing_alerts) THEN
    RAISE EXCEPTION 'CONTROL_CENTER_ROLLBACK_BLOCKED_DATA billing_alerts';
  END IF;
  IF to_regclass('public.tenant_billing_notices') IS NOT NULL
    AND EXISTS (SELECT 1 FROM public.tenant_billing_notices) THEN
    RAISE EXCEPTION 'CONTROL_CENTER_ROLLBACK_BLOCKED_DATA tenant_billing_notices';
  END IF;
END $$;

DROP TABLE IF EXISTS public.tenant_billing_notices;
DROP TABLE IF EXISTS control_center.billing_alerts;
DROP FUNCTION IF EXISTS control_center.guard_billing_notice();
