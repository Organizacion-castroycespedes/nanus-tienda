-- Seed core menu modules for all tenants

INSERT INTO menu_items (
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
  metadata
)
SELECT
  t.id,
  seed.key,
  seed.module,
  seed.label,
  seed.route,
  seed.icon,
  NULL,
  seed.sort_order,
  TRUE,
  FALSE,
  '{}'::jsonb
FROM tenants t
CROSS JOIN (
  VALUES
    (
      'INVENTORY_PRODUCTS',
      'inventory',
      'Inventory',
      '/{tenant}/inventory/products',
      'box',
      100
    ),
    (
      'POS',
      'pos',
      'POS',
      '/{tenant}/pos',
      'shopping-cart',
      110
    ),
    (
      'FINANCE',
      'finance',
      'Finance',
      '/{tenant}/finance',
      'dollar-sign',
      120
    ),
    (
      'CRM_CUSTOMERS',
      'crm',
      'CRM',
      '/{tenant}/crm/customers',
      'users',
      130
    )
) AS seed(key, module, label, route, icon, sort_order)
WHERE NOT EXISTS (
  SELECT 1
  FROM menu_items mi
  WHERE mi.tenant_id = t.id
    AND mi.deleted_at IS NULL
    AND (
      mi.key = seed.key
      OR mi.route = seed.route
    )
);

-- Seed SUPER_ADMIN permissions for new menu items when missing
INSERT INTO role_menu_permissions (tenant_id, role_id, menu_item_id, access_level)
SELECT
  t.id,
  r.id,
  mi.id,
  'WRITE'
FROM tenants t
INNER JOIN roles r
  ON r.nombre = 'SUPER_ADMIN'
INNER JOIN menu_items mi
  ON mi.tenant_id = t.id
  AND mi.key IN ('INVENTORY_PRODUCTS', 'POS', 'FINANCE', 'CRM_CUSTOMERS')
  AND mi.deleted_at IS NULL
WHERE NOT EXISTS (
  SELECT 1
  FROM role_menu_permissions rmp
  WHERE rmp.tenant_id = t.id
    AND rmp.role_id = r.id
    AND rmp.menu_item_id = mi.id
);

-- Seed ADMIN permissions for new menu items when missing
INSERT INTO role_menu_permissions (tenant_id, role_id, menu_item_id, access_level)
SELECT
  t.id,
  r.id,
  mi.id,
  'WRITE'
FROM tenants t
INNER JOIN roles r
  ON r.nombre = 'ADMIN'
INNER JOIN menu_items mi
  ON mi.tenant_id = t.id
  AND mi.key IN ('INVENTORY_PRODUCTS', 'POS', 'FINANCE', 'CRM_CUSTOMERS')
  AND mi.deleted_at IS NULL
WHERE NOT EXISTS (
  SELECT 1
  FROM role_menu_permissions rmp
  WHERE rmp.tenant_id = t.id
    AND rmp.role_id = r.id
    AND rmp.menu_item_id = mi.id
);
