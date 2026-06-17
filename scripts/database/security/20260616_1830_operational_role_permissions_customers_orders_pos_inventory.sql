-- Hotfix: permisos operativos Clientes/Pedidos/POS sin Inventario admin para USER.
-- Idempotente. Target local/QA controlado, no ejecutar en produccion sin aprobacion.

BEGIN;

WITH target_tenant AS (
  SELECT '00000000-0000-0000-0000-000000000001'::uuid AS tenant_id
),
blocked_user_menu AS (
  SELECT
    rmp.tenant_id,
    rmp.role_id,
    rmp.menu_item_id
  FROM public.role_menu_permissions rmp
  INNER JOIN public.roles r
    ON r.id = rmp.role_id
  INNER JOIN public.menu_items mi
    ON mi.id = rmp.menu_item_id
  INNER JOIN target_tenant tt
    ON tt.tenant_id = rmp.tenant_id
  WHERE r.nombre = 'USER'
    AND mi.deleted_at IS NULL
    AND (
      mi.key = 'INVENTORY'
      OR mi.key LIKE 'INVENTORY\_%' ESCAPE '\'
    )
)
DELETE FROM public.role_menu_permissions rmp
USING blocked_user_menu blocked
WHERE rmp.tenant_id = blocked.tenant_id
  AND rmp.role_id = blocked.role_id
  AND rmp.menu_item_id = blocked.menu_item_id;

WITH target_tenant AS (
  SELECT '00000000-0000-0000-0000-000000000001'::uuid AS tenant_id
),
permission_targets(role_name, menu_key, access_level, actions) AS (
  VALUES
    ('USER', 'CUSTOMERS', 'WRITE', '{"read": true, "create": true, "update": true}'::jsonb),
    ('USER', 'ORDERS', 'WRITE', '{"read": true, "create": true, "update": true}'::jsonb),
    ('USER', 'POS', 'WRITE', '{"read": true, "create": true, "update": true}'::jsonb),
    ('USER', 'FINANCE', 'READ', '{"read": true}'::jsonb),
    ('USER', 'FINANCE_CASH_SESSIONS', 'WRITE', '{"read": true, "create": true, "update": true, "open": true, "close": true}'::jsonb),
    ('USER', 'FINANCE_CASH_MOVEMENTS', 'WRITE', '{"read": true, "create": true}'::jsonb),

    ('ADMIN', 'CUSTOMERS', 'WRITE', '{"read": true, "create": true, "update": true}'::jsonb),
    ('ADMIN', 'ORDERS', 'WRITE', '{"read": true, "create": true, "update": true}'::jsonb),
    ('ADMIN', 'POS', 'WRITE', '{"read": true, "create": true, "update": true}'::jsonb),
    ('ADMIN', 'FINANCE', 'READ', '{"read": true}'::jsonb),
    ('ADMIN', 'FINANCE_CASH_SESSIONS', 'WRITE', '{"read": true, "create": true, "update": true, "open": true, "close": true}'::jsonb),
    ('ADMIN', 'FINANCE_CASH_MOVEMENTS', 'WRITE', '{"read": true, "create": true}'::jsonb),
    ('ADMIN', 'FINANCE_CASH_REGISTERS', 'READ', '{"read": true}'::jsonb),

    ('SUPER_USER', 'CUSTOMERS', 'WRITE', '{"read": true, "create": true, "update": true}'::jsonb),
    ('SUPER_USER', 'ORDERS', 'WRITE', '{"read": true, "create": true, "update": true}'::jsonb),
    ('SUPER_USER', 'POS', 'WRITE', '{"read": true, "create": true, "update": true}'::jsonb)
),
resolved_targets AS (
  SELECT
    tt.tenant_id,
    r.id AS role_id,
    mi.id AS menu_item_id,
    target.access_level,
    target.actions
  FROM permission_targets target
  INNER JOIN public.roles r
    ON r.nombre = target.role_name
  INNER JOIN target_tenant tt
    ON TRUE
  INNER JOIN public.menu_items mi
    ON mi.tenant_id = tt.tenant_id
   AND mi.key = target.menu_key
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

DELETE FROM public.role_menu_permissions rmp
USING public.roles r,
      public.menu_items mi,
      (SELECT '00000000-0000-0000-0000-000000000001'::uuid AS tenant_id) target_tenant
WHERE rmp.role_id = r.id
  AND rmp.menu_item_id = mi.id
  AND rmp.tenant_id = target_tenant.tenant_id
  AND (
    (r.nombre IN ('USER', 'ADMIN', 'SUPER_USER') AND mi.key IN ('CONFIG_ROLES', 'ROLES_TENANT_ROLES'))
    OR (r.nombre IN ('USER', 'ADMIN') AND mi.key IN ('CONFIG_TERMINALS', 'POS_PERIPHERALS'))
  );

COMMIT;
