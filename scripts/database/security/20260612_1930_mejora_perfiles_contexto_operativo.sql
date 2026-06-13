-- Mejora contexto operativo y permisos por perfil.
-- Idempotente. No ejecutar en produccion sin aprobacion de release.
-- Aplica reglas explicitas del change mejora-contexto-operativo-perfiles:
-- - USER/ADMIN/SUPER_USER pueden operar pedidos, clientes y caja segun scope.
-- - USER puede editar clientes de facturacion electronica basica.
-- - ADMIN no debe tener Configuracion ni Perifericos POS en menu.
-- - ADMIN conserva inventario operativo en lectura.
-- - SUPER_USER conserva gestion tenant, sin permisos globales.

BEGIN;

-- Backend-only permission target for fiscal customer endpoints.
-- It intentionally stays hidden to avoid duplicating the visible /customers menu.
INSERT INTO public.menu_items (
  tenant_id,
  key,
  module,
  label,
  route,
  icon,
  parent_id,
  sort_order,
  visible,
  below_main_menu,
  metadata,
  created_at,
  updated_at,
  deleted_at
)
SELECT
  t.id,
  'ELECTRONIC_INVOICING_CUSTOMERS',
  'electronic-invoicing',
  'Clientes fiscales',
  '/{tenant}/electronic-invoicing/customers',
  'FileText',
  NULL,
  222,
  FALSE,
  FALSE,
  '{"change": "mejora-contexto-operativo-perfiles", "backendOnly": true}'::jsonb,
  now(),
  now(),
  NULL
FROM public.tenants t
WHERE NOT EXISTS (
  SELECT 1
  FROM public.menu_items mi
  WHERE mi.tenant_id = t.id
    AND mi.key = 'ELECTRONIC_INVOICING_CUSTOMERS'
    AND mi.deleted_at IS NULL
);

WITH permission_targets(role_name, menu_key, access_level, actions) AS (
  VALUES
    ('USER', 'ORDERS', 'WRITE', '{"read": true, "create": true, "update": true}'::jsonb),
    ('USER', 'CUSTOMERS', 'WRITE', '{"read": true, "create": true, "update": true}'::jsonb),
    ('USER', 'CRM_CUSTOMERS', 'WRITE', '{"read": true, "create": true, "update": true}'::jsonb),
    ('USER', 'ELECTRONIC_INVOICING_CUSTOMERS', 'WRITE', '{"read": true, "create": true, "update": true}'::jsonb),
    ('USER', 'FINANCE', 'READ', '{"read": true}'::jsonb),
    ('USER', 'FINANCE_CASH_SESSIONS', 'WRITE', '{"read": true, "create": true, "update": true, "open": true, "close": true}'::jsonb),

    ('ADMIN', 'ORDERS', 'WRITE', '{"read": true, "create": true, "update": true}'::jsonb),
    ('ADMIN', 'CUSTOMERS', 'WRITE', '{"read": true, "create": true, "update": true}'::jsonb),
    ('ADMIN', 'CRM_CUSTOMERS', 'WRITE', '{"read": true, "create": true, "update": true}'::jsonb),
    ('ADMIN', 'ELECTRONIC_INVOICING_CUSTOMERS', 'WRITE', '{"read": true, "create": true, "update": true}'::jsonb),
    ('ADMIN', 'FINANCE', 'READ', '{"read": true}'::jsonb),
    ('ADMIN', 'FINANCE_CASH_SESSIONS', 'WRITE', '{"read": true, "create": true, "update": true, "open": true, "close": true}'::jsonb),
    ('ADMIN', 'INVENTORY', 'READ', '{"read": true}'::jsonb),
    ('ADMIN', 'INVENTORY_PRODUCTS', 'READ', '{"read": true}'::jsonb),
    ('ADMIN', 'INVENTORY_PURCHASES', 'READ', '{"read": true}'::jsonb),
    ('ADMIN', 'INVENTORY_UNITS', 'READ', '{"read": true}'::jsonb),
    ('ADMIN', 'INVENTORY_TAXES', 'READ', '{"read": true}'::jsonb),
    ('ADMIN', 'INVENTORY_SUPPLIERS', 'READ', '{"read": true}'::jsonb),
    ('ADMIN', 'INVENTORY_PROMOTIONS', 'READ', '{"read": true}'::jsonb),

    ('SUPER_USER', 'ORDERS', 'WRITE', '{"read": true, "create": true, "update": true}'::jsonb),
    ('SUPER_USER', 'CUSTOMERS', 'WRITE', '{"read": true, "create": true, "update": true}'::jsonb),
    ('SUPER_USER', 'CRM_CUSTOMERS', 'WRITE', '{"read": true, "create": true, "update": true}'::jsonb),
    ('SUPER_USER', 'ELECTRONIC_INVOICING_CUSTOMERS', 'WRITE', '{"read": true, "create": true, "update": true}'::jsonb),
    ('SUPER_USER', 'FINANCE_CASH_SESSIONS', 'WRITE', '{"read": true, "create": true, "update": true, "open": true, "close": true}'::jsonb),
    ('SUPER_USER', 'INVENTORY', 'WRITE', '{"read": true, "create": true, "update": true}'::jsonb),
    ('SUPER_USER', 'INVENTORY_PRODUCTS', 'WRITE', '{"read": true, "create": true, "update": true}'::jsonb),
    ('SUPER_USER', 'INVENTORY_PURCHASES', 'WRITE', '{"read": true, "create": true, "update": true, "cancel": true, "settle_partial": true}'::jsonb),
    ('SUPER_USER', 'INVENTORY_UNITS', 'WRITE', '{"read": true, "create": true, "update": true}'::jsonb),
    ('SUPER_USER', 'INVENTORY_TAXES', 'WRITE', '{"read": true, "create": true, "update": true}'::jsonb),
    ('SUPER_USER', 'INVENTORY_SUPPLIERS', 'WRITE', '{"read": true, "create": true, "update": true}'::jsonb),
    ('SUPER_USER', 'INVENTORY_PROMOTIONS', 'WRITE', '{"read": true, "create": true, "update": true}'::jsonb)
),
resolved_targets AS (
  SELECT
    mi.tenant_id,
    r.id AS role_id,
    mi.id AS menu_item_id,
    target.access_level,
    target.actions
  FROM permission_targets target
  INNER JOIN public.roles r
    ON r.nombre = target.role_name
  INNER JOIN public.menu_items mi
    ON mi.key = target.menu_key
   AND mi.deleted_at IS NULL
)
INSERT INTO public.role_menu_permissions (
  tenant_id,
  role_id,
  menu_item_id,
  access_level,
  actions
)
SELECT
  tenant_id,
  role_id,
  menu_item_id,
  access_level,
  actions
FROM resolved_targets
ON CONFLICT (tenant_id, role_id, menu_item_id) DO UPDATE
SET
  access_level = EXCLUDED.access_level,
  actions = EXCLUDED.actions;

-- Restriccion explicita del change: ADMIN no lista ni entra a Configuracion ni Perifericos POS.
DELETE FROM public.role_menu_permissions rmp
USING public.roles r,
      public.menu_items mi
WHERE rmp.role_id = r.id
  AND rmp.menu_item_id = mi.id
  AND r.nombre = 'ADMIN'
  AND mi.key IN (
    'CONFIG_GENERAL',
    'CONFIGURACION_TENANT_CONFIGURACION',
    'POS_PERIPHERALS'
  );

COMMIT;
