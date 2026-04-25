-- Menu management schema and migration
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS menu_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  module TEXT NOT NULL,
  label TEXT NOT NULL,
  route TEXT NOT NULL,
  icon TEXT,
  parent_id UUID REFERENCES menu_items(id) ON DELETE SET NULL,
  sort_order INT NOT NULL DEFAULT 0,
  visible BOOLEAN NOT NULL DEFAULT TRUE,
  below_main_menu BOOLEAN NOT NULL DEFAULT FALSE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

ALTER TABLE menu_items
  ADD COLUMN IF NOT EXISTS below_main_menu BOOLEAN NOT NULL DEFAULT FALSE;

CREATE UNIQUE INDEX IF NOT EXISTS menu_items_tenant_key_unique
  ON menu_items (tenant_id, key)
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS menu_items_tenant_route_unique
  ON menu_items (tenant_id, route)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS menu_items_parent_sort_idx
  ON menu_items (parent_id, sort_order);

CREATE INDEX IF NOT EXISTS menu_items_tenant_idx
  ON menu_items (tenant_id);

CREATE TABLE IF NOT EXISTS role_menu_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  menu_item_id UUID NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
  access_level TEXT NOT NULL CHECK (access_level IN ('READ', 'WRITE')),
  actions JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS role_menu_permissions_unique
  ON role_menu_permissions (tenant_id, role_id, menu_item_id);

CREATE INDEX IF NOT EXISTS role_menu_permissions_role_idx
  ON role_menu_permissions (tenant_id, role_id);

CREATE INDEX IF NOT EXISTS role_menu_permissions_menu_idx
  ON role_menu_permissions (tenant_id, menu_item_id);

CREATE TABLE IF NOT EXISTS security_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id UUID,
  tenant_id UUID,
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id UUID,
  before JSONB,
  after JSONB,
  ip TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS security_audit_logs_tenant_idx
  ON security_audit_logs (tenant_id, created_at DESC);

-- Backfill menu_items from existing permissions
INSERT INTO menu_items (
  tenant_id,
  key,
  module,
  label,
  route,
  visible,
  metadata
)
SELECT DISTINCT
  p.tenant_id,
  regexp_replace(upper(p.module || '_' || p.route), '[^A-Z0-9]+', '_', 'g') AS key,
  p.module,
  p.label,
  p.route,
  COALESCE(p.visible, TRUE) AS visible,
  '{}'::jsonb
FROM permissions p
WHERE NOT EXISTS (
  SELECT 1
  FROM menu_items mi
  WHERE mi.tenant_id = p.tenant_id
    AND mi.route = p.route
    AND mi.deleted_at IS NULL
);

-- Backfill role_menu_permissions from existing permissions
INSERT INTO role_menu_permissions (tenant_id, role_id, menu_item_id, access_level)
SELECT
  p.tenant_id,
  p.role_id,
  mi.id,
  'READ'
FROM permissions p
INNER JOIN menu_items mi
  ON mi.tenant_id = p.tenant_id
  AND mi.route = p.route
  AND mi.deleted_at IS NULL
WHERE NOT EXISTS (
  SELECT 1
  FROM role_menu_permissions rmp
  WHERE rmp.tenant_id = p.tenant_id
    AND rmp.role_id = p.role_id
    AND rmp.menu_item_id = mi.id
);

-- Seed keys for core routes when missing
INSERT INTO menu_items (tenant_id, key, module, label, route, visible, metadata)
SELECT
  t.id,
  'DASHBOARD',
  'dashboard',
  'Dashboard',
  '/{tenant}/dashboard',
  TRUE,
  '{}'::jsonb
FROM tenants t
WHERE NOT EXISTS (
  SELECT 1
  FROM menu_items mi
  WHERE mi.tenant_id = t.id
    AND mi.key = 'DASHBOARD'
    AND mi.deleted_at IS NULL
);

INSERT INTO menu_items (tenant_id, key, module, label, route, visible, metadata)
SELECT
  t.id,
  'CONFIG_USUARIOS',
  'usuarios',
  'Usuarios',
  '/{tenant}/usuarios',
  TRUE,
  '{}'::jsonb
FROM tenants t
WHERE NOT EXISTS (
  SELECT 1
  FROM menu_items mi
  WHERE mi.tenant_id = t.id
    AND mi.key = 'CONFIG_USUARIOS'
    AND mi.deleted_at IS NULL
);

INSERT INTO menu_items (tenant_id, key, module, label, route, visible, metadata)
SELECT
  t.id,
  'CONFIG_ROLES',
  'roles',
  'Roles',
  '/{tenant}/roles',
  TRUE,
  '{}'::jsonb
FROM tenants t
WHERE NOT EXISTS (
  SELECT 1
  FROM menu_items mi
  WHERE mi.tenant_id = t.id
    AND mi.key = 'CONFIG_ROLES'
    AND mi.deleted_at IS NULL
);

INSERT INTO menu_items (tenant_id, key, module, label, route, visible, metadata)
SELECT
  t.id,
  'CONFIG_GENERAL',
  'configuracion',
  'Configuracion',
  '/{tenant}/configuracion',
  TRUE,
  '{}'::jsonb
FROM tenants t
WHERE NOT EXISTS (
  SELECT 1
  FROM menu_items mi
  WHERE mi.tenant_id = t.id
    AND mi.key = 'CONFIG_GENERAL'
    AND mi.deleted_at IS NULL
);

INSERT INTO menu_items (tenant_id, key, module, label, route, visible, metadata)
SELECT
  t.id,
  'CONFIG_MENU',
  'configuracion',
  'Menu',
  '/{tenant}/configuracion/menu',
  TRUE,
  '{}'::jsonb
FROM tenants t
WHERE NOT EXISTS (
  SELECT 1
  FROM menu_items mi
  WHERE mi.tenant_id = t.id
    AND mi.key = 'CONFIG_MENU'
    AND mi.deleted_at IS NULL
);

-- Seed SUPER_ADMIN permissions when missing
INSERT INTO role_menu_permissions (tenant_id, role_id, menu_item_id, access_level)
SELECT
  t.id,
  r.id,
  mi.id,
  'WRITE'
FROM tenants t
CROSS JOIN roles r
INNER JOIN menu_items mi ON mi.tenant_id = t.id
WHERE r.nombre = 'SUPER_ADMIN'
  AND NOT EXISTS (
    SELECT 1
    FROM role_menu_permissions rmp
    WHERE rmp.tenant_id = t.id
      AND rmp.role_id = r.id
      AND rmp.menu_item_id = mi.id
  );
