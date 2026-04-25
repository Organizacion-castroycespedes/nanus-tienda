-- Seed ADMIN permissions for CONFIG_GENERAL menu key
INSERT INTO role_menu_permissions (tenant_id, role_id, menu_item_id, access_level)
SELECT
  t.id,
  r.id,
  mi.id,
  'WRITE'
FROM tenants t
INNER JOIN roles r ON r.nombre = 'ADMIN'
INNER JOIN menu_items mi
  ON mi.tenant_id = t.id
  AND mi.key = 'CONFIG_GENERAL'
  AND mi.deleted_at IS NULL
WHERE NOT EXISTS (
  SELECT 1
  FROM role_menu_permissions rmp
  WHERE rmp.tenant_id = t.id
    AND rmp.role_id = r.id
    AND rmp.menu_item_id = mi.id
);
