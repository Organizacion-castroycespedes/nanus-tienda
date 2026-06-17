BEGIN;

WITH role_targets AS (
  SELECT
    mi.tenant_id,
    mi.id AS menu_item_id,
    mi.key AS menu_key,
    r.id AS role_id,
    r.nombre AS role_name,
    CASE
      WHEN r.nombre = 'SUPER_ADMIN' THEN 'WRITE'
      WHEN r.nombre = 'SUPER_USER'
        AND mi.key NOT IN ('CONFIG_MENU', 'ROLES_TENANT_ROLES')
        THEN CASE
          WHEN mi.key = 'DASHBOARD_TENANT_DASHBOARD' THEN 'READ'
          ELSE 'WRITE'
        END
      WHEN r.nombre = 'ADMIN'
        AND mi.key IN (
          'FINANCE',
          'FINANCE_CASH_SESSIONS',
          'FINANCE_CASH_MOVEMENTS'
        )
        THEN 'WRITE'
      WHEN r.nombre = 'ADMIN'
        AND mi.key = 'FINANCE_CASH_REGISTERS'
        THEN 'READ'
      WHEN r.nombre = 'ADMIN'
        AND mi.key IN (
          'DASHBOARD_TENANT_DASHBOARD',
          'CONFIGURACION_TENANT_CONFIGURACION',
          'POS_PERIPHERALS',
          'INVENTORY',
          'INVENTORY_PRODUCTS',
          'INVENTORY_UNITS',
          'INVENTORY_TAXES',
          'INVENTORY_PURCHASES',
          'INVENTORY_SUPPLIERS',
          'INVENTORY_PROMOTIONS',
          'INVENTORY_LOCATIONS',
          'INVENTORY_LOTS',
          'CUSTOMERS',
          'ORDERS',
          'POS'
        )
        THEN CASE
          WHEN mi.key = 'DASHBOARD_TENANT_DASHBOARD' THEN 'READ'
          ELSE 'WRITE'
        END
      WHEN r.nombre = 'USER'
        AND mi.key IN (
          'FINANCE',
          'FINANCE_CASH_SESSIONS',
          'FINANCE_CASH_MOVEMENTS'
        )
        THEN 'READ'
      WHEN r.nombre = 'USER'
        AND mi.key IN (
          'DASHBOARD_TENANT_DASHBOARD',
          'CUSTOMERS',
          'ORDERS',
          'POS'
        )
        THEN CASE
          WHEN mi.key = 'POS' THEN 'WRITE'
          WHEN mi.key = 'CUSTOMERS' THEN 'WRITE'
          ELSE 'READ'
        END
      ELSE NULL
    END AS access_level,
    CASE
      WHEN r.nombre = 'SUPER_ADMIN'
        THEN CASE
          WHEN mi.key = 'INVENTORY_PURCHASES'
            THEN '{"read": true, "create": true, "update": true, "delete": true, "cancel": true, "settle_partial": true}'::jsonb
          WHEN mi.key = 'POS_PERIPHERALS'
            THEN '{"read": true, "manage": true}'::jsonb
          ELSE '{"read": true, "create": true, "update": true, "delete": true}'::jsonb
        END
      WHEN r.nombre = 'SUPER_USER'
        AND mi.key NOT IN ('CONFIG_MENU', 'ROLES_TENANT_ROLES')
        THEN CASE
          WHEN mi.key = 'DASHBOARD_TENANT_DASHBOARD'
            THEN '{"read": true}'::jsonb
          WHEN mi.key = 'INVENTORY_PURCHASES'
            THEN '{"read": true, "create": true, "update": true, "delete": true, "cancel": true, "settle_partial": true}'::jsonb
          WHEN mi.key = 'POS_PERIPHERALS'
            THEN '{"read": true, "manage": true}'::jsonb
          ELSE '{"read": true, "create": true, "update": true, "delete": true}'::jsonb
        END
      WHEN r.nombre = 'ADMIN'
        AND mi.key = 'FINANCE'
        THEN '{"read": true}'::jsonb
      WHEN r.nombre = 'ADMIN'
        AND mi.key = 'FINANCE_CASH_SESSIONS'
        THEN '{"read": true, "create": true, "update": true}'::jsonb
      WHEN r.nombre = 'ADMIN'
        AND mi.key = 'FINANCE_CASH_MOVEMENTS'
        THEN '{"read": true, "create": true}'::jsonb
      WHEN r.nombre = 'ADMIN'
        AND mi.key = 'FINANCE_CASH_REGISTERS'
        THEN '{"read": true}'::jsonb
      WHEN r.nombre = 'ADMIN'
        AND mi.key IN (
          'DASHBOARD_TENANT_DASHBOARD',
          'CONFIGURACION_TENANT_CONFIGURACION',
          'POS_PERIPHERALS',
          'INVENTORY',
          'INVENTORY_PRODUCTS',
          'INVENTORY_UNITS',
          'INVENTORY_TAXES',
          'INVENTORY_PURCHASES',
          'INVENTORY_SUPPLIERS',
          'INVENTORY_PROMOTIONS',
          'INVENTORY_LOCATIONS',
          'INVENTORY_LOTS',
          'CUSTOMERS',
          'ORDERS',
          'POS'
        )
        THEN CASE
          WHEN mi.key = 'DASHBOARD_TENANT_DASHBOARD'
            THEN '{"read": true}'::jsonb
          WHEN mi.key = 'INVENTORY_PURCHASES'
            THEN '{"read": true, "create": true, "update": true, "delete": true, "cancel": true, "settle_partial": true}'::jsonb
          WHEN mi.key = 'POS_PERIPHERALS'
            THEN '{"read": true, "manage": true}'::jsonb
          ELSE '{"read": true, "create": true, "update": true, "delete": true}'::jsonb
        END
      WHEN r.nombre = 'USER'
        AND mi.key = 'FINANCE'
        THEN '{"read": true}'::jsonb
      WHEN r.nombre = 'USER'
        AND mi.key = 'FINANCE_CASH_SESSIONS'
        THEN '{"read": true, "create": true, "update": true}'::jsonb
      WHEN r.nombre = 'USER'
        AND mi.key = 'FINANCE_CASH_MOVEMENTS'
        THEN '{"read": true, "create": true}'::jsonb
      WHEN r.nombre = 'USER'
        AND mi.key IN (
          'DASHBOARD_TENANT_DASHBOARD',
          'CUSTOMERS',
          'ORDERS',
          'POS'
        )
        THEN CASE
          WHEN mi.key = 'POS'
            THEN '{"read": true, "create": true, "update": true}'::jsonb
          WHEN mi.key = 'CUSTOMERS'
            THEN '{"read": true, "create": true, "update": true}'::jsonb
          ELSE '{"read": true}'::jsonb
        END
      ELSE NULL
    END AS actions
  FROM public.menu_items mi
  INNER JOIN public.roles r
    ON r.nombre IN ('SUPER_ADMIN', 'SUPER_USER', 'ADMIN', 'USER')
  WHERE mi.deleted_at IS NULL
),
eligible_targets AS (
  SELECT *
  FROM role_targets
  WHERE access_level IS NOT NULL
    AND actions IS NOT NULL
)
INSERT INTO public.role_menu_permissions (
  tenant_id,
  role_id,
  menu_item_id,
  access_level,
  actions
)
SELECT
  target.tenant_id,
  target.role_id,
  target.menu_item_id,
  target.access_level,
  target.actions
FROM eligible_targets target
ON CONFLICT (tenant_id, role_id, menu_item_id) DO UPDATE
SET
  access_level = EXCLUDED.access_level,
  actions = EXCLUDED.actions;

WITH allowed_permissions AS (
  SELECT
    mi.tenant_id,
    mi.id AS menu_item_id,
    r.id AS role_id
  FROM public.menu_items mi
  INNER JOIN public.roles r
    ON r.nombre IN ('SUPER_USER', 'ADMIN', 'USER')
  WHERE mi.deleted_at IS NULL
    AND (
      (r.nombre = 'SUPER_USER' AND mi.key NOT IN ('CONFIG_MENU', 'ROLES_TENANT_ROLES'))
      OR (
        r.nombre = 'ADMIN'
        AND mi.key IN (
          'DASHBOARD_TENANT_DASHBOARD',
          'CONFIGURACION_TENANT_CONFIGURACION',
          'POS_PERIPHERALS',
          'INVENTORY',
          'INVENTORY_PRODUCTS',
          'INVENTORY_UNITS',
          'INVENTORY_TAXES',
          'INVENTORY_PURCHASES',
          'INVENTORY_SUPPLIERS',
          'INVENTORY_PROMOTIONS',
          'INVENTORY_LOCATIONS',
          'INVENTORY_LOTS',
          'CUSTOMERS',
          'ORDERS',
          'POS',
          'FINANCE',
          'FINANCE_CASH_SESSIONS',
          'FINANCE_CASH_MOVEMENTS',
          'FINANCE_CASH_REGISTERS'
        )
      )
      OR (
        r.nombre = 'USER'
        AND mi.key IN (
          'DASHBOARD_TENANT_DASHBOARD',
          'CUSTOMERS',
          'ORDERS',
          'POS',
          'FINANCE',
          'FINANCE_CASH_SESSIONS',
          'FINANCE_CASH_MOVEMENTS'
        )
      )
    )
)
DELETE FROM public.role_menu_permissions rmp
USING public.roles r,
      public.menu_items mi
WHERE rmp.role_id = r.id
  AND rmp.menu_item_id = mi.id
  AND r.nombre IN ('SUPER_USER', 'ADMIN', 'USER')
  AND NOT EXISTS (
    SELECT 1
    FROM allowed_permissions ap
    WHERE ap.tenant_id = rmp.tenant_id
      AND ap.role_id = rmp.role_id
      AND ap.menu_item_id = rmp.menu_item_id
  );

COMMIT;
