BEGIN;

CREATE OR REPLACE FUNCTION public.report_demo()
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_items jsonb;
  v_total numeric(14, 2);
BEGIN
  v_items := jsonb_build_array(
    jsonb_build_object(
      'code', 'ITEM-001',
      'description', 'Producto demo A',
      'quantity', 2,
      'unitPrice', 12500,
      'subtotal', 25000
    ),
    jsonb_build_object(
      'code', 'ITEM-002',
      'description', 'Producto demo B',
      'quantity', 1,
      'unitPrice', 18000,
      'subtotal', 18000
    )
  );

  v_total := 43000;

  RETURN jsonb_build_object(
    'reportTitle', 'Reporte Demo',
    'tenantName', 'Tenant Demo',
    'branchName', 'Sucursal Demo',
    'generatedAt', NOW(),
    'items', v_items,
    'total', v_total
  );
END;
$$;

WITH tenant_targets AS (
  SELECT id
  FROM public.tenants
),
existing_reports AS (
  SELECT tenant_id, id
  FROM public.menu_items
  WHERE key = 'REPORTS'
    AND deleted_at IS NULL
)
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
  tenant.id,
  'REPORTS',
  'reporteria',
  'Reporteria',
  '/{tenant}/reporteria',
  'FileText',
  NULL,
  210,
  TRUE,
  FALSE,
  '{}'::jsonb,
  NOW(),
  NOW(),
  NULL
FROM tenant_targets tenant
LEFT JOIN existing_reports existing
  ON existing.tenant_id = tenant.id
WHERE existing.id IS NULL;

WITH reports_menu AS (
  SELECT tenant_id, id
  FROM public.menu_items
  WHERE key = 'REPORTS'
    AND deleted_at IS NULL
),
role_targets AS (
  SELECT
    reports_menu.tenant_id,
    reports_menu.id AS menu_item_id,
    roles.id AS role_id,
    roles.nombre AS role_name
  FROM reports_menu
  INNER JOIN public.roles roles
    ON roles.nombre IN ('SUPER_ADMIN', 'SUPER_USER', 'ADMIN', 'USER')
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
  'READ',
  '{"read": true}'::jsonb
FROM role_targets target
ON CONFLICT (tenant_id, role_id, menu_item_id) DO UPDATE
SET
  access_level = EXCLUDED.access_level,
  actions = EXCLUDED.actions;

COMMIT;
