-- V115: MANUS Control Center, cierre (canal WhatsApp y datos del emisor para el PDF del contrato).
-- OpenSpec: control-center-whatsapp-contrato-pdf
-- Requiere V114 (alertas de cobro).
-- Sin control transaccional: lo aporta apply_single_migration.sh.

DO $$
BEGIN
  IF to_regclass('control_center.billing_alerts') IS NULL THEN
    RAISE EXCEPTION 'CONTROL_CENTER_V114_REQUIRED';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'manus_control_center_app') THEN
    RAISE EXCEPTION 'CONTROL_CENTER_ROLE_MISSING';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tenants_detalles' AND column_name = 'direccion_principal'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tenants_detalles' AND column_name = 'sitio_web'
  ) OR to_regclass('public.municipios') IS NULL THEN
    RAISE EXCEPTION 'CONTROL_CENTER_ISSUER_COLUMNS_MISSING';
  END IF;
END $$;

-- Canal WhatsApp en la bitacora de alertas.
ALTER TABLE control_center.billing_alerts DROP CONSTRAINT IF EXISTS chk_cc_ba_channel;
ALTER TABLE control_center.billing_alerts
  ADD CONSTRAINT chk_cc_ba_channel CHECK (channel IN ('DASHBOARD', 'EMAIL', 'WHATSAPP'));

-- Datos del emisor del contrato (empresa del tenant plataforma): solo lectura por columnas.
GRANT SELECT (direccion_principal, sitio_web) ON public.tenants_detalles TO manus_control_center_app;
GRANT SELECT (id, nombre) ON public.municipios TO manus_control_center_app;
GRANT SELECT (config) ON public.tenants TO manus_control_center_app;
