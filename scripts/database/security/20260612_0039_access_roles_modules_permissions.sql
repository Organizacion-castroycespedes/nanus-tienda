-- Permisos base por rol y modulo para Manus POS.
-- Idempotente: solo agrega permisos faltantes. No borra ni reduce permisos existentes.

WITH official_matrix(role_name, menu_key, access_level, actions) AS (
  VALUES
    ('SUPER_ADMIN', '*', 'WRITE', '{}'::jsonb),

    ('SUPER_USER', 'DASHBOARD', 'READ', '{}'::jsonb),
    ('SUPER_USER', 'CONFIG_GENERAL', 'WRITE', '{}'::jsonb),
    ('SUPER_USER', 'CONFIG_USUARIOS', 'WRITE', '{}'::jsonb),
    ('SUPER_USER', 'INVENTORY', 'WRITE', '{}'::jsonb),
    ('SUPER_USER', 'INVENTORY_PRODUCTS', 'WRITE', '{}'::jsonb),
    ('SUPER_USER', 'INVENTORY_PURCHASES', 'WRITE', '{"cancel": true, "settle_partial": true}'::jsonb),
    ('SUPER_USER', 'INVENTORY_SUPPLIERS', 'WRITE', '{}'::jsonb),
    ('SUPER_USER', 'INVENTORY_PROMOTIONS', 'WRITE', '{}'::jsonb),
    ('SUPER_USER', 'CUSTOMERS', 'WRITE', '{}'::jsonb),
    ('SUPER_USER', 'CRM_CUSTOMERS', 'WRITE', '{}'::jsonb),
    ('SUPER_USER', 'ORDERS', 'WRITE', '{"cancel": true}'::jsonb),
    ('SUPER_USER', 'POS', 'WRITE', '{"cancel": true}'::jsonb),
    ('SUPER_USER', 'FINANCE', 'WRITE', '{}'::jsonb),
    ('SUPER_USER', 'FINANCE_CASH_SESSIONS', 'WRITE', '{}'::jsonb),
    ('SUPER_USER', 'FINANCE_CASH_MOVEMENTS', 'WRITE', '{}'::jsonb),
    ('SUPER_USER', 'FINANCE_CASH_REGISTERS', 'WRITE', '{}'::jsonb),
    ('SUPER_USER', 'FINANCE_PAYMENT_METHODS', 'WRITE', '{}'::jsonb),
    ('SUPER_USER', 'REPORTS', 'READ', '{}'::jsonb),
    ('SUPER_USER', 'REPORTS_POS', 'READ', '{}'::jsonb),
    ('SUPER_USER', 'REPORTS_CASH', 'READ', '{}'::jsonb),
    ('SUPER_USER', 'REPORTS_PURCHASES', 'READ', '{}'::jsonb),
    ('SUPER_USER', 'REPORTS_ORDERS', 'READ', '{}'::jsonb),
    ('SUPER_USER', 'REPORTS_CUSTOMERS', 'READ', '{}'::jsonb),
    ('SUPER_USER', 'ELECTRONIC_INVOICING_CUSTOMERS', 'WRITE', '{}'::jsonb),
    ('SUPER_USER', 'ELECTRONIC_INVOICING_SUPPLIERS', 'WRITE', '{}'::jsonb),

    ('ADMIN', 'DASHBOARD', 'READ', '{}'::jsonb),
    ('ADMIN', 'INVENTORY', 'WRITE', '{}'::jsonb),
    ('ADMIN', 'INVENTORY_PRODUCTS', 'WRITE', '{}'::jsonb),
    ('ADMIN', 'INVENTORY_PURCHASES', 'WRITE', '{"cancel": true, "settle_partial": true}'::jsonb),
    ('ADMIN', 'INVENTORY_SUPPLIERS', 'WRITE', '{}'::jsonb),
    ('ADMIN', 'INVENTORY_PROMOTIONS', 'WRITE', '{}'::jsonb),
    ('ADMIN', 'CUSTOMERS', 'WRITE', '{}'::jsonb),
    ('ADMIN', 'CRM_CUSTOMERS', 'WRITE', '{}'::jsonb),
    ('ADMIN', 'ORDERS', 'WRITE', '{"cancel": true}'::jsonb),
    ('ADMIN', 'POS', 'WRITE', '{}'::jsonb),
    ('ADMIN', 'FINANCE', 'READ', '{}'::jsonb),
    ('ADMIN', 'FINANCE_CASH_SESSIONS', 'WRITE', '{}'::jsonb),
    ('ADMIN', 'FINANCE_CASH_MOVEMENTS', 'WRITE', '{}'::jsonb),
    ('ADMIN', 'FINANCE_CASH_REGISTERS', 'READ', '{}'::jsonb),
    ('ADMIN', 'REPORTS', 'READ', '{}'::jsonb),
    ('ADMIN', 'REPORTS_POS', 'READ', '{}'::jsonb),
    ('ADMIN', 'REPORTS_CASH', 'READ', '{}'::jsonb),
    ('ADMIN', 'REPORTS_PURCHASES', 'READ', '{}'::jsonb),
    ('ADMIN', 'REPORTS_ORDERS', 'READ', '{}'::jsonb),
    ('ADMIN', 'REPORTS_CUSTOMERS', 'READ', '{}'::jsonb),
    ('ADMIN', 'ELECTRONIC_INVOICING_CUSTOMERS', 'WRITE', '{}'::jsonb),
    ('ADMIN', 'ELECTRONIC_INVOICING_SUPPLIERS', 'WRITE', '{}'::jsonb),

    ('USER', 'DASHBOARD', 'READ', '{}'::jsonb),
    ('USER', 'INVENTORY', 'READ', '{}'::jsonb),
    ('USER', 'INVENTORY_PRODUCTS', 'READ', '{}'::jsonb),
    ('USER', 'INVENTORY_PURCHASES', 'READ', '{}'::jsonb),
    ('USER', 'CUSTOMERS', 'WRITE', '{}'::jsonb),
    ('USER', 'CRM_CUSTOMERS', 'WRITE', '{}'::jsonb),
    ('USER', 'ORDERS', 'WRITE', '{}'::jsonb),
    ('USER', 'POS', 'WRITE', '{}'::jsonb),
    ('USER', 'FINANCE', 'READ', '{}'::jsonb),
    ('USER', 'FINANCE_CASH_SESSIONS', 'WRITE', '{}'::jsonb),
    ('USER', 'FINANCE_CASH_MOVEMENTS', 'WRITE', '{}'::jsonb),
    ('USER', 'ELECTRONIC_INVOICING_CUSTOMERS', 'READ', '{}'::jsonb),
    ('USER', 'ELECTRONIC_INVOICING_SUPPLIERS', 'READ', '{}'::jsonb)
),
target_permissions AS (
  SELECT
    mi.tenant_id,
    r.id AS role_id,
    mi.id AS menu_item_id,
    matrix.access_level,
    matrix.actions
  FROM official_matrix matrix
  JOIN roles r ON r.nombre = matrix.role_name
  JOIN menu_items mi
    ON (matrix.menu_key = '*' OR mi.key = matrix.menu_key)
   AND mi.deleted_at IS NULL
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
FROM target_permissions
ON CONFLICT (tenant_id, role_id, menu_item_id) DO NOTHING;
