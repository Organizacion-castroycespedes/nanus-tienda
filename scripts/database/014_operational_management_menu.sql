BEGIN;

WITH tenants AS (
  SELECT id AS tenant_id FROM public.tenants
), parent_items AS (
  INSERT INTO public.menu_items (
    id, tenant_id, key, module, label, route, icon, parent_id, sort_order,
    visible, below_main_menu, metadata, created_at, updated_at, deleted_at
  )
  SELECT gen_random_uuid(), tenant_id, 'OPERATIONS', 'operations',
    U&'Gesti\00F3n Operativa', '/{tenant}/operations', 'ClipboardList', NULL, 70,
    true, false, '{}'::jsonb, now(), now(), NULL
  FROM tenants
  ON CONFLICT (tenant_id, key) WHERE deleted_at IS NULL
  DO UPDATE SET module = EXCLUDED.module, label = EXCLUDED.label,
    route = EXCLUDED.route, icon = EXCLUDED.icon, visible = true,
    updated_at = now(), deleted_at = NULL
  RETURNING id, tenant_id
)
INSERT INTO public.menu_items (
  id, tenant_id, key, module, label, route, icon, parent_id, sort_order,
  visible, below_main_menu, metadata, created_at, updated_at, deleted_at
)
SELECT gen_random_uuid(), parent.tenant_id, 'OPERATIONS_SALES', 'operations', 'Ventas',
  '/{tenant}/operations/sales', 'ReceiptText', parent.id, 1, true, false,
  '{}'::jsonb, now(), now(), NULL
FROM parent_items AS parent
ON CONFLICT (tenant_id, key) WHERE deleted_at IS NULL
DO UPDATE SET module = EXCLUDED.module, label = EXCLUDED.label,
  route = EXCLUDED.route, icon = EXCLUDED.icon, parent_id = EXCLUDED.parent_id,
  visible = true, updated_at = now(), deleted_at = NULL;

INSERT INTO public.role_menu_permissions (tenant_id, role_id, menu_item_id, access_level, actions)
SELECT mi.tenant_id, r.id, mi.id, 'READ', '{"read": true}'::jsonb
FROM public.menu_items mi
JOIN public.roles r ON r.nombre IN ('SUPER_ADMIN', 'SUPER_USER', 'ADMIN', 'USER')
WHERE mi.key IN ('OPERATIONS', 'OPERATIONS_SALES') AND mi.deleted_at IS NULL
ON CONFLICT (tenant_id, role_id, menu_item_id) DO UPDATE
SET access_level = 'READ', actions = '{"read": true}'::jsonb;

COMMIT;
