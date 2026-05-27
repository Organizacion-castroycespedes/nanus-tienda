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
          'DASHBOARD_TENANT_DASHBOARD',
          'CONFIGURACION_TENANT_CONFIGURACION',
          'INVENTORY',
          'INVENTORY_PRODUCTS',
          'INVENTORY_UNITS',
          'INVENTORY_TAXES',
          'INVENTORY_PURCHASES',
          'INVENTORY_SUPPLIERS',
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
          'DASHBOARD_TENANT_DASHBOARD',
          'INVENTORY',
          'INVENTORY_PRODUCTS',
          'INVENTORY_TAXES',
          'INVENTORY_PURCHASES',
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
            THEN '{"read": true, "create": true, "update": true, "delete": true, "cancel": true}'::jsonb
          ELSE '{"read": true, "create": true, "update": true, "delete": true}'::jsonb
        END
      WHEN r.nombre = 'SUPER_USER'
        AND mi.key NOT IN ('CONFIG_MENU', 'ROLES_TENANT_ROLES')
        THEN CASE
          WHEN mi.key = 'DASHBOARD_TENANT_DASHBOARD'
            THEN '{"read": true}'::jsonb
          WHEN mi.key = 'INVENTORY_PURCHASES'
            THEN '{"read": true, "create": true, "update": true, "delete": true, "cancel": true}'::jsonb
          ELSE '{"read": true, "create": true, "update": true, "delete": true}'::jsonb
        END
      WHEN r.nombre = 'ADMIN'
        AND mi.key IN (
          'DASHBOARD_TENANT_DASHBOARD',
          'CONFIGURACION_TENANT_CONFIGURACION',
          'INVENTORY',
          'INVENTORY_PRODUCTS',
          'INVENTORY_UNITS',
          'INVENTORY_TAXES',
          'INVENTORY_PURCHASES',
          'INVENTORY_SUPPLIERS',
          'CUSTOMERS',
          'ORDERS',
          'POS'
        )
        THEN CASE
          WHEN mi.key = 'DASHBOARD_TENANT_DASHBOARD'
            THEN '{"read": true}'::jsonb
          WHEN mi.key = 'INVENTORY_PURCHASES'
            THEN '{"read": true, "create": true, "update": true, "delete": true, "cancel": true}'::jsonb
          ELSE '{"read": true, "create": true, "update": true, "delete": true}'::jsonb
        END
      WHEN r.nombre = 'USER'
        AND mi.key IN (
          'DASHBOARD_TENANT_DASHBOARD',
          'INVENTORY',
          'INVENTORY_PRODUCTS',
          'INVENTORY_TAXES',
          'INVENTORY_PURCHASES',
          'CUSTOMERS',
          'ORDERS',
          'POS'
        )
        THEN CASE
          WHEN mi.key = 'POS'
            THEN '{"read": true, "create": true, "update": true}'::jsonb
          WHEN mi.key = 'CUSTOMERS'
            THEN '{"read": true, "create": true, "update": true, "delete": true}'::jsonb
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
          'INVENTORY',
          'INVENTORY_PRODUCTS',
          'INVENTORY_UNITS',
          'INVENTORY_TAXES',
          'INVENTORY_PURCHASES',
          'INVENTORY_SUPPLIERS',
          'CUSTOMERS',
          'ORDERS',
          'POS'
        )
      )
      OR (
        r.nombre = 'USER'
        AND mi.key IN (
          'DASHBOARD_TENANT_DASHBOARD',
          'INVENTORY',
          'INVENTORY_PRODUCTS',
          'INVENTORY_TAXES',
          'INVENTORY_PURCHASES',
          'CUSTOMERS',
          'ORDERS',
          'POS'
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
