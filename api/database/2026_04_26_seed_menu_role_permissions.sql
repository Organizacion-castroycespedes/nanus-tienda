-- Assign new menu items to existing roles using role_menu_permissions

-- SUPER_ADMIN -> full access to all new modules
INSERT INTO role_menu_permissions (tenant_id, role_id, menu_item_id, access_level)
SELECT
  mi.tenant_id,
  r.id,
  mi.id,
  'WRITE'
FROM menu_items mi
INNER JOIN roles r
  ON r.nombre = 'SUPER_ADMIN'
WHERE mi.key IN (
    'INVENTORY',
    'INVENTORY_PRODUCTS',
    'INVENTORY_UNITS',
    'INVENTORY_TAXES',
    'POS',
    'FINANCE',
    'CRM_CUSTOMERS'
  )
  AND mi.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM role_menu_permissions rmp
    WHERE rmp.tenant_id = mi.tenant_id
      AND rmp.role_id = r.id
      AND rmp.menu_item_id = mi.id
  );

-- ADMIN -> full access to all new modules
INSERT INTO role_menu_permissions (tenant_id, role_id, menu_item_id, access_level)
SELECT
  mi.tenant_id,
  r.id,
  mi.id,
  'WRITE'
FROM menu_items mi
INNER JOIN roles r
  ON r.nombre = 'ADMIN'
WHERE mi.key IN (
    'INVENTORY',
    'INVENTORY_PRODUCTS',
    'INVENTORY_UNITS',
    'INVENTORY_TAXES',
    'POS',
    'FINANCE',
    'CRM_CUSTOMERS'
  )
  AND mi.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM role_menu_permissions rmp
    WHERE rmp.tenant_id = mi.tenant_id
      AND rmp.role_id = r.id
      AND rmp.menu_item_id = mi.id
  );

-- USER -> restricted access to Inventory and POS only
INSERT INTO role_menu_permissions (tenant_id, role_id, menu_item_id, access_level)
SELECT
  mi.tenant_id,
  r.id,
  mi.id,
  'READ'
FROM menu_items mi
INNER JOIN roles r
  ON r.nombre = 'USER'
WHERE mi.key IN (
    'INVENTORY',
    'INVENTORY_PRODUCTS',
    'INVENTORY_UNITS',
    'INVENTORY_TAXES',
    'POS'
  )
  AND mi.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM role_menu_permissions rmp
    WHERE rmp.tenant_id = mi.tenant_id
      AND rmp.role_id = r.id
      AND rmp.menu_item_id = mi.id
  );
