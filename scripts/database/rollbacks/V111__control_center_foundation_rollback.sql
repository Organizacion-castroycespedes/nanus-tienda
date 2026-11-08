-- Rollback de V111__control_center_foundation.sql
-- Solo aplicar si control_center no contiene datos de negocio.
-- Falla de forma segura si existen tablas distintas a admin_audit_events o eventos registrados.

DO $$
DECLARE
  v_foreign_tables INTEGER;
  v_audit_rows BIGINT := 0;
BEGIN
  IF to_regnamespace('control_center') IS NULL THEN
    RETURN;
  END IF;

  SELECT COUNT(*) INTO v_foreign_tables
  FROM pg_catalog.pg_tables
  WHERE schemaname = 'control_center' AND tablename <> 'admin_audit_events';
  IF v_foreign_tables > 0 THEN
    RAISE EXCEPTION 'CONTROL_CENTER_ROLLBACK_BLOCKED_BUSINESS_TABLES';
  END IF;

  IF to_regclass('control_center.admin_audit_events') IS NOT NULL THEN
    EXECUTE 'SELECT COUNT(*) FROM control_center.admin_audit_events' INTO v_audit_rows;
    IF v_audit_rows > 0 THEN
      RAISE EXCEPTION 'CONTROL_CENTER_ROLLBACK_BLOCKED_AUDIT_EVENTS';
    END IF;
  END IF;
END $$;

DELETE FROM public.role_menu_permissions
WHERE menu_item_id IN (
  SELECT id FROM public.menu_items
  WHERE key = 'CONTROL_CENTER' AND tenant_id = '00000000-0000-0000-0000-000000000001'::uuid
);

UPDATE public.menu_items
SET deleted_at = NOW(), visible = FALSE, updated_at = NOW()
WHERE key = 'CONTROL_CENTER'
  AND tenant_id = '00000000-0000-0000-0000-000000000001'::uuid
  AND deleted_at IS NULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'manus_control_center_app') THEN
    REVOKE SELECT ON public.tenants FROM manus_control_center_app;
    REVOKE SELECT ON public.tenants_detalles FROM manus_control_center_app;
    REVOKE SELECT ON public.tenant_branches FROM manus_control_center_app;
    REVOKE SELECT ON public.pos_terminals FROM manus_control_center_app;
    REVOKE SELECT ON public.taxes FROM manus_control_center_app;
  END IF;
END $$;

DROP SCHEMA IF EXISTS control_center CASCADE;
