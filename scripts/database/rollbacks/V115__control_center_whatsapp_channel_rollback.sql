-- Rollback de V115__control_center_whatsapp_channel.sql
-- Falla de forma segura si ya existen alertas por WhatsApp.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM control_center.billing_alerts WHERE channel = 'WHATSAPP') THEN
    RAISE EXCEPTION 'CONTROL_CENTER_ROLLBACK_BLOCKED_DATA billing_alerts WHATSAPP';
  END IF;
END $$;

ALTER TABLE control_center.billing_alerts DROP CONSTRAINT IF EXISTS chk_cc_ba_channel;
ALTER TABLE control_center.billing_alerts
  ADD CONSTRAINT chk_cc_ba_channel CHECK (channel IN ('DASHBOARD', 'EMAIL'));

REVOKE SELECT (direccion_principal, sitio_web) ON public.tenants_detalles FROM manus_control_center_app;
REVOKE SELECT (id, nombre) ON public.municipios FROM manus_control_center_app;
REVOKE SELECT (config) ON public.tenants FROM manus_control_center_app;
