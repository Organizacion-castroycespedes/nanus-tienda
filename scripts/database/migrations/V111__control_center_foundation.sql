-- V111: MANUS Control Center foundation.
-- OpenSpec: habilitar-plataforma-control-center
-- Crea el esquema control_center, la auditoria administrativa inmutable,
-- los privilegios minimos del rol dedicado y el menu exclusivo del tenant plataforma.
-- Precondicion: el rol NOLOGIN manus_control_center_app existe (docs/runbook-control-center-db-role.md).
-- El runner apply_single_migration.sh es el unico duenio de la frontera transaccional.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'manus_control_center_app'
  ) THEN
    RAISE EXCEPTION 'CONTROL_CENTER_ROLE_MISSING';
  END IF;

  IF to_regclass('public.tenants') IS NULL
    OR to_regclass('public.tenants_detalles') IS NULL
    OR to_regclass('public.tenant_branches') IS NULL
    OR to_regclass('public.pos_terminals') IS NULL
    OR to_regclass('public.taxes') IS NULL
    OR to_regclass('public.menu_items') IS NULL
    OR to_regclass('public.roles') IS NULL
    OR to_regclass('public.role_menu_permissions') IS NULL THEN
    RAISE EXCEPTION 'CONTROL_CENTER_REQUIRED_TABLES_MISSING';
  END IF;
END $$;

CREATE SCHEMA IF NOT EXISTS control_center;

REVOKE ALL ON SCHEMA control_center FROM PUBLIC;
GRANT USAGE ON SCHEMA control_center TO manus_control_center_app;

-- Auditoria administrativa: solo insercion y lectura.
CREATE TABLE IF NOT EXISTS control_center.admin_audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actor_user_id UUID NOT NULL,
  actor_tenant_id UUID NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  before JSONB,
  after JSONB,
  reason TEXT,
  request_id TEXT,
  ip TEXT,
  user_agent TEXT,
  CONSTRAINT chk_cc_audit_action CHECK (btrim(action) <> '' AND char_length(action) <= 120),
  CONSTRAINT chk_cc_audit_entity_type CHECK (btrim(entity_type) <> '' AND char_length(entity_type) <= 120),
  CONSTRAINT chk_cc_audit_reason CHECK (reason IS NULL OR char_length(btrim(reason)) >= 10)
);

CREATE INDEX IF NOT EXISTS idx_cc_audit_occurred_at
  ON control_center.admin_audit_events (occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_cc_audit_entity
  ON control_center.admin_audit_events (entity_type, entity_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_cc_audit_actor
  ON control_center.admin_audit_events (actor_user_id, occurred_at DESC);

CREATE OR REPLACE FUNCTION control_center.prevent_admin_audit_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'CONTROL_CENTER_AUDIT_IMMUTABLE';
END;
$$;

REVOKE ALL ON FUNCTION control_center.prevent_admin_audit_mutation() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_cc_audit_immutable ON control_center.admin_audit_events;
CREATE TRIGGER trg_cc_audit_immutable
  BEFORE UPDATE OR DELETE ON control_center.admin_audit_events
  FOR EACH ROW EXECUTE FUNCTION control_center.prevent_admin_audit_mutation();

DROP TRIGGER IF EXISTS trg_cc_audit_no_truncate ON control_center.admin_audit_events;
CREATE TRIGGER trg_cc_audit_no_truncate
  BEFORE TRUNCATE ON control_center.admin_audit_events
  FOR EACH STATEMENT EXECUTE FUNCTION control_center.prevent_admin_audit_mutation();

REVOKE ALL ON control_center.admin_audit_events FROM PUBLIC;
GRANT SELECT, INSERT ON control_center.admin_audit_events TO manus_control_center_app;

-- Objetos futuros del esquema creados por el duenio de las migraciones.
-- Las tablas inmutables de fases posteriores revocan UPDATE/DELETE explicitamente.
ALTER DEFAULT PRIVILEGES IN SCHEMA control_center
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO manus_control_center_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA control_center
  GRANT USAGE, SELECT ON SEQUENCES TO manus_control_center_app;

-- Lectura minima por columnas de datos operativos. Sin escritura en public.
GRANT USAGE ON SCHEMA public TO manus_control_center_app;
GRANT SELECT (id, slug, nombre, activo, created_at)
  ON public.tenants TO manus_control_center_app;
GRANT SELECT (
  tenant_id, razon_social, nit, dv, tipo_persona, email_corporativo, telefono,
  ciudad, departamento, municipio_id, representante_nombre, representante_email,
  representante_telefono
) ON public.tenants_detalles TO manus_control_center_app;
GRANT SELECT (id, tenant_id, nombre, estado, es_principal)
  ON public.tenant_branches TO manus_control_center_app;
GRANT SELECT (id, tenant_id, branch_id, code, name, active)
  ON public.pos_terminals TO manus_control_center_app;
GRANT SELECT (id, tenant_id, name, rate, is_included, is_active)
  ON public.taxes TO manus_control_center_app;

-- Menu exclusivo del tenant plataforma (seed 004). Otros tenants no reciben el item.
INSERT INTO public.menu_items (
  tenant_id, key, module, label, route, icon, parent_id, sort_order,
  visible, below_main_menu, metadata, created_at, updated_at, deleted_at
)
SELECT
  t.id,
  'CONTROL_CENTER',
  'control-center',
  'Control Center',
  '/{tenant}/control-center',
  'Building2',
  NULL,
  5,
  TRUE,
  FALSE,
  '{"permissionLevel":"WRITE","scope":"PLATFORM_ONLY"}'::jsonb,
  NOW(),
  NOW(),
  NULL
FROM public.tenants t
WHERE t.id = '00000000-0000-0000-0000-000000000001'::uuid
ON CONFLICT (tenant_id, key) WHERE deleted_at IS NULL
DO UPDATE SET
  module = EXCLUDED.module,
  label = EXCLUDED.label,
  route = EXCLUDED.route,
  icon = EXCLUDED.icon,
  sort_order = EXCLUDED.sort_order,
  visible = TRUE,
  below_main_menu = FALSE,
  metadata = COALESCE(public.menu_items.metadata, '{}'::jsonb) || EXCLUDED.metadata,
  updated_at = NOW(),
  deleted_at = NULL;

INSERT INTO public.role_menu_permissions (
  tenant_id, role_id, menu_item_id, access_level, actions
)
SELECT
  menu_item.tenant_id,
  role.id,
  menu_item.id,
  'WRITE',
  '{}'::jsonb
FROM public.menu_items menu_item
INNER JOIN public.roles role ON role.nombre = 'SUPER_ADMIN'
WHERE menu_item.key = 'CONTROL_CENTER'
  AND menu_item.tenant_id = '00000000-0000-0000-0000-000000000001'::uuid
  AND menu_item.deleted_at IS NULL
ON CONFLICT (tenant_id, role_id, menu_item_id)
DO UPDATE SET access_level = 'WRITE', actions = COALESCE(public.role_menu_permissions.actions, '{}'::jsonb);
