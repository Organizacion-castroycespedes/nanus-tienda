-- Assign action-based permissions for new menu modules using role_menu_permissions.actions

WITH role_targets AS (
  SELECT
    mi.tenant_id,
    mi.id AS menu_item_id,
    mi.key AS menu_key,
    r.id AS role_id,
    r.nombre AS role_name,
    CASE
      WHEN r.nombre IN ('SUPER_ADMIN', 'ADMIN')
        AND mi.key IN (
          'INVENTORY',
          'INVENTORY_PRODUCTS',
          'INVENTORY_UNITS',
          'INVENTORY_TAXES',
          'INVENTORY_PURCHASES',
          'INVENTORY_SUPPLIERS'
        )
        THEN 'WRITE'
      WHEN r.nombre = 'USER'
        AND mi.key IN (
          'INVENTORY',
          'INVENTORY_PRODUCTS',
          'INVENTORY_UNITS',
          'INVENTORY_TAXES',
          'INVENTORY_PURCHASES',
          'INVENTORY_SUPPLIERS'
        )
        THEN 'READ'
      WHEN r.nombre IN ('SUPER_ADMIN', 'ADMIN')
        AND mi.key = 'POS'
        THEN 'WRITE'
      WHEN r.nombre = 'USER'
        AND mi.key = 'POS'
        THEN 'WRITE'
      WHEN r.nombre IN ('SUPER_ADMIN', 'ADMIN')
        AND mi.key = 'FINANCE'
        THEN 'WRITE'
      WHEN r.nombre IN ('SUPER_ADMIN', 'ADMIN')
        AND mi.key IN ('CUSTOMERS', 'ORDERS')
        THEN 'WRITE'
      WHEN r.nombre = 'USER'
        AND mi.key IN ('CUSTOMERS', 'ORDERS')
        THEN 'READ'
      WHEN r.nombre IN ('SUPER_ADMIN', 'ADMIN')
        AND mi.key = 'CRM_CUSTOMERS'
        THEN 'WRITE'
      WHEN r.nombre = 'USER'
        AND mi.key = 'CRM_CUSTOMERS'
        THEN 'WRITE'
      ELSE NULL
    END AS access_level,
    CASE
      WHEN r.nombre IN ('SUPER_ADMIN', 'ADMIN')
        AND mi.key IN (
          'INVENTORY',
          'INVENTORY_PRODUCTS',
          'INVENTORY_UNITS',
          'INVENTORY_TAXES',
          'INVENTORY_PURCHASES',
          'INVENTORY_SUPPLIERS'
        )
        THEN '{"read": true, "create": true, "update": true, "delete": true}'::jsonb
      WHEN r.nombre = 'USER'
        AND mi.key IN (
          'INVENTORY',
          'INVENTORY_PRODUCTS',
          'INVENTORY_UNITS',
          'INVENTORY_TAXES',
          'INVENTORY_PURCHASES',
          'INVENTORY_SUPPLIERS'
        )
        THEN '{"read": true}'::jsonb
      WHEN r.nombre IN ('SUPER_ADMIN', 'ADMIN')
        AND mi.key = 'POS'
        THEN '{"read": true, "create": true, "update": true, "delete": true}'::jsonb
      WHEN r.nombre = 'USER'
        AND mi.key = 'POS'
        THEN '{"read": true, "create": true}'::jsonb
      WHEN r.nombre IN ('SUPER_ADMIN', 'ADMIN')
        AND mi.key = 'FINANCE'
        THEN '{"read": true, "create": true, "update": true, "delete": true}'::jsonb
      WHEN r.nombre IN ('SUPER_ADMIN', 'ADMIN')
        AND mi.key IN ('CUSTOMERS', 'ORDERS')
        THEN '{"read": true, "create": true, "update": true, "delete": true}'::jsonb
      WHEN r.nombre = 'USER'
        AND mi.key IN ('CUSTOMERS', 'ORDERS')
        THEN '{"read": true}'::jsonb
      WHEN r.nombre IN ('SUPER_ADMIN', 'ADMIN')
        AND mi.key = 'CRM_CUSTOMERS'
        THEN '{"read": true, "create": true, "update": true, "delete": true}'::jsonb
      WHEN r.nombre = 'USER'
        AND mi.key = 'CRM_CUSTOMERS'
        THEN '{"read": true, "create": true}'::jsonb
      ELSE NULL
    END AS actions
  FROM menu_items mi
  INNER JOIN roles r
    ON r.nombre IN ('SUPER_ADMIN', 'ADMIN', 'USER')
  WHERE mi.key IN (
    'INVENTORY',
    'INVENTORY_PRODUCTS',
    'INVENTORY_UNITS',
    'INVENTORY_TAXES',
    'INVENTORY_PURCHASES',
    'INVENTORY_SUPPLIERS',
    'CUSTOMERS',
    'ORDERS',
    'POS',
    'FINANCE',
    'CRM_CUSTOMERS'
  )
    AND mi.deleted_at IS NULL
),
eligible_targets AS (
  SELECT *
  FROM role_targets
  WHERE access_level IS NOT NULL
    AND actions IS NOT NULL
)
INSERT INTO role_menu_permissions (
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
FROM eligible_targets target
WHERE NOT EXISTS (
  SELECT 1
  FROM role_menu_permissions rmp
  WHERE rmp.tenant_id = target.tenant_id
    AND rmp.role_id = target.role_id
    AND rmp.menu_item_id = target.menu_item_id
);

WITH role_targets AS (
  SELECT
    mi.tenant_id,
    mi.id AS menu_item_id,
    mi.key AS menu_key,
    r.id AS role_id,
    r.nombre AS role_name,
    CASE
      WHEN r.nombre IN ('SUPER_ADMIN', 'ADMIN')
        AND mi.key IN (
          'INVENTORY',
          'INVENTORY_PRODUCTS',
          'INVENTORY_UNITS',
          'INVENTORY_TAXES',
          'INVENTORY_PURCHASES',
          'INVENTORY_SUPPLIERS'
        )
        THEN 'WRITE'
      WHEN r.nombre = 'USER'
        AND mi.key IN (
          'INVENTORY',
          'INVENTORY_PRODUCTS',
          'INVENTORY_UNITS',
          'INVENTORY_TAXES',
          'INVENTORY_PURCHASES',
          'INVENTORY_SUPPLIERS'
        )
        THEN 'READ'
      WHEN r.nombre IN ('SUPER_ADMIN', 'ADMIN')
        AND mi.key = 'POS'
        THEN 'WRITE'
      WHEN r.nombre = 'USER'
        AND mi.key = 'POS'
        THEN 'WRITE'
      WHEN r.nombre IN ('SUPER_ADMIN', 'ADMIN')
        AND mi.key = 'FINANCE'
        THEN 'WRITE'
      WHEN r.nombre IN ('SUPER_ADMIN', 'ADMIN')
        AND mi.key IN ('CUSTOMERS', 'ORDERS')
        THEN 'WRITE'
      WHEN r.nombre = 'USER'
        AND mi.key IN ('CUSTOMERS', 'ORDERS')
        THEN 'READ'
      WHEN r.nombre IN ('SUPER_ADMIN', 'ADMIN')
        AND mi.key = 'CRM_CUSTOMERS'
        THEN 'WRITE'
      WHEN r.nombre = 'USER'
        AND mi.key = 'CRM_CUSTOMERS'
        THEN 'WRITE'
      ELSE NULL
    END AS access_level,
    CASE
      WHEN r.nombre IN ('SUPER_ADMIN', 'ADMIN')
        AND mi.key IN (
          'INVENTORY',
          'INVENTORY_PRODUCTS',
          'INVENTORY_UNITS',
          'INVENTORY_TAXES',
          'INVENTORY_PURCHASES',
          'INVENTORY_SUPPLIERS'
        )
        THEN '{"read": true, "create": true, "update": true, "delete": true}'::jsonb
      WHEN r.nombre = 'USER'
        AND mi.key IN (
          'INVENTORY',
          'INVENTORY_PRODUCTS',
          'INVENTORY_UNITS',
          'INVENTORY_TAXES',
          'INVENTORY_PURCHASES',
          'INVENTORY_SUPPLIERS'
        )
        THEN '{"read": true}'::jsonb
      WHEN r.nombre IN ('SUPER_ADMIN', 'ADMIN')
        AND mi.key = 'POS'
        THEN '{"read": true, "create": true, "update": true, "delete": true}'::jsonb
      WHEN r.nombre = 'USER'
        AND mi.key = 'POS'
        THEN '{"read": true, "create": true}'::jsonb
      WHEN r.nombre IN ('SUPER_ADMIN', 'ADMIN')
        AND mi.key = 'FINANCE'
        THEN '{"read": true, "create": true, "update": true, "delete": true}'::jsonb
      WHEN r.nombre IN ('SUPER_ADMIN', 'ADMIN')
        AND mi.key IN ('CUSTOMERS', 'ORDERS')
        THEN '{"read": true, "create": true, "update": true, "delete": true}'::jsonb
      WHEN r.nombre = 'USER'
        AND mi.key IN ('CUSTOMERS', 'ORDERS')
        THEN '{"read": true}'::jsonb
      WHEN r.nombre IN ('SUPER_ADMIN', 'ADMIN')
        AND mi.key = 'CRM_CUSTOMERS'
        THEN '{"read": true, "create": true, "update": true, "delete": true}'::jsonb
      WHEN r.nombre = 'USER'
        AND mi.key = 'CRM_CUSTOMERS'
        THEN '{"read": true, "create": true}'::jsonb
      ELSE NULL
    END AS actions
  FROM menu_items mi
  INNER JOIN roles r
    ON r.nombre IN ('SUPER_ADMIN', 'ADMIN', 'USER')
  WHERE mi.key IN (
    'INVENTORY',
    'INVENTORY_PRODUCTS',
    'INVENTORY_UNITS',
    'INVENTORY_TAXES',
    'INVENTORY_PURCHASES',
    'INVENTORY_SUPPLIERS',
    'CUSTOMERS',
    'ORDERS',
    'POS',
    'FINANCE',
    'CRM_CUSTOMERS'
  )
    AND mi.deleted_at IS NULL
),
eligible_targets AS (
  SELECT *
  FROM role_targets
  WHERE access_level IS NOT NULL
    AND actions IS NOT NULL
)
UPDATE role_menu_permissions rmp
SET
  access_level = target.access_level,
  actions = target.actions
FROM eligible_targets target
WHERE rmp.tenant_id = target.tenant_id
  AND rmp.role_id = target.role_id
  AND rmp.menu_item_id = target.menu_item_id
  AND (
    rmp.access_level IS DISTINCT FROM target.access_level
    OR rmp.actions IS DISTINCT FROM target.actions
  );
