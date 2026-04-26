-- Ensure Inventory parent menu exists for every tenant
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
  'INVENTORY',
  'inventory',
  'Inventory',
  '/{tenant}/inventory',
  'box',
  NULL,
  100,
  TRUE,
  FALSE,
  '{}'::jsonb
FROM tenants t
WHERE NOT EXISTS (
  SELECT 1
  FROM menu_items mi
  WHERE mi.tenant_id = t.id
    AND mi.key = 'INVENTORY'
    AND mi.deleted_at IS NULL
);

-- Ensure Inventory children exist and are attached to the Inventory parent
WITH inventory_parent AS (
  SELECT id, tenant_id
  FROM menu_items
  WHERE key = 'INVENTORY'
    AND deleted_at IS NULL
)
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
  parent.tenant_id,
  seed.key,
  'inventory',
  seed.label,
  seed.route,
  seed.icon,
  parent.id,
  seed.sort_order,
  TRUE,
  FALSE,
  '{}'::jsonb
FROM inventory_parent parent
CROSS JOIN (
  VALUES
    ('INVENTORY_PRODUCTS', 'Productos', '/{tenant}/inventory/products', 'box', 101),
    ('INVENTORY_UNITS', 'Unidades', '/{tenant}/inventory/units', 'ruler', 102),
    ('INVENTORY_TAXES', 'Impuestos', '/{tenant}/inventory/taxes', 'calculator', 103)
) AS seed(key, label, route, icon, sort_order)
WHERE NOT EXISTS (
  SELECT 1
  FROM menu_items mi
  WHERE mi.tenant_id = parent.tenant_id
    AND mi.deleted_at IS NULL
    AND (
      mi.key = seed.key
      OR mi.route = seed.route
    )
);

-- Reattach existing Inventory children to the Inventory parent and normalize order
WITH inventory_parent AS (
  SELECT id, tenant_id
  FROM menu_items
  WHERE key = 'INVENTORY'
    AND deleted_at IS NULL
),
inventory_children AS (
  SELECT
    parent.tenant_id,
    parent.id AS parent_id,
    child.id AS child_id,
    seed.sort_order
  FROM inventory_parent parent
  INNER JOIN menu_items child
    ON child.tenant_id = parent.tenant_id
    AND child.deleted_at IS NULL
    AND child.key IN ('INVENTORY_PRODUCTS', 'INVENTORY_UNITS', 'INVENTORY_TAXES')
  INNER JOIN (
    VALUES
      ('INVENTORY_PRODUCTS', 101),
      ('INVENTORY_UNITS', 102),
      ('INVENTORY_TAXES', 103)
  ) AS seed(key, sort_order)
    ON seed.key = child.key
)
UPDATE menu_items mi
SET
  parent_id = inventory_children.parent_id,
  sort_order = inventory_children.sort_order,
  updated_at = NOW()
FROM inventory_children
WHERE mi.id = inventory_children.child_id
  AND (
    mi.parent_id IS DISTINCT FROM inventory_children.parent_id
    OR mi.sort_order IS DISTINCT FROM inventory_children.sort_order
  );

-- Seed SUPER_ADMIN permissions for Inventory parent and children when missing
INSERT INTO role_menu_permissions (tenant_id, role_id, menu_item_id, access_level)
SELECT
  mi.tenant_id,
  r.id,
  mi.id,
  'WRITE'
FROM menu_items mi
INNER JOIN roles r
  ON r.nombre = 'SUPER_ADMIN'
WHERE mi.key IN ('INVENTORY', 'INVENTORY_PRODUCTS', 'INVENTORY_UNITS', 'INVENTORY_TAXES')
  AND mi.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM role_menu_permissions rmp
    WHERE rmp.tenant_id = mi.tenant_id
      AND rmp.role_id = r.id
      AND rmp.menu_item_id = mi.id
  );

-- Seed ADMIN permissions for Inventory parent and children when missing
INSERT INTO role_menu_permissions (tenant_id, role_id, menu_item_id, access_level)
SELECT
  mi.tenant_id,
  r.id,
  mi.id,
  'WRITE'
FROM menu_items mi
INNER JOIN roles r
  ON r.nombre = 'ADMIN'
WHERE mi.key IN ('INVENTORY', 'INVENTORY_PRODUCTS', 'INVENTORY_UNITS', 'INVENTORY_TAXES')
  AND mi.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM role_menu_permissions rmp
    WHERE rmp.tenant_id = mi.tenant_id
      AND rmp.role_id = r.id
      AND rmp.menu_item_id = mi.id
  );
