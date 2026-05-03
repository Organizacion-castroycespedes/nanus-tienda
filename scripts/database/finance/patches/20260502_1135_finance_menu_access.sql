BEGIN;

WITH finance_parent AS (
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
    metadata
  )
  SELECT
    t.id,
    'FINANCE',
    'finance',
    'Finance',
    '/{tenant}/finance',
    'dollar-sign',
    NULL,
    120,
    TRUE,
    FALSE,
    '{}'::jsonb
  FROM public.tenants t
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.menu_items mi
    WHERE mi.tenant_id = t.id
      AND mi.key = 'FINANCE'
      AND mi.deleted_at IS NULL
  )
  RETURNING id, tenant_id
),
all_finance_parent AS (
  SELECT id, tenant_id
  FROM finance_parent
  UNION ALL
  SELECT mi.id, mi.tenant_id
  FROM public.menu_items mi
  WHERE mi.key = 'FINANCE'
    AND mi.deleted_at IS NULL
),
finance_children AS (
  SELECT
    parent.tenant_id,
    seed.key,
    'finance'::text AS module,
    seed.label,
    seed.route,
    seed.icon,
    parent.id AS parent_id,
    seed.sort_order,
    TRUE AS visible,
    FALSE AS below_main_menu,
    '{}'::jsonb AS metadata
  FROM all_finance_parent parent
  CROSS JOIN (
    VALUES
      ('FINANCE_CASH_SESSIONS', 'Caja', '/{tenant}/finance/cash-sessions', 'receipt-text', 121),
      ('FINANCE_CASH_MOVEMENTS', 'Movimientos', '/{tenant}/finance/cash-movements', 'arrow-right-left', 122),
      ('FINANCE_CASH_REGISTERS', 'Cajas', '/{tenant}/finance/cash-registers', 'banknote', 123),
      ('FINANCE_PAYMENT_METHODS', 'Metodos de pago', '/{tenant}/finance/payment-methods', 'credit-card', 124)
  ) AS seed(key, label, route, icon, sort_order)
),
upsert_children AS (
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
    metadata
  )
  SELECT
    child.tenant_id,
    child.key,
    child.module,
    child.label,
    child.route,
    child.icon,
    child.parent_id,
    child.sort_order,
    child.visible,
    child.below_main_menu,
    child.metadata
  FROM finance_children child
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.menu_items mi
    WHERE mi.tenant_id = child.tenant_id
      AND mi.key = child.key
      AND mi.deleted_at IS NULL
  )
  RETURNING id
),
sync_children AS (
  UPDATE public.menu_items mi
  SET
    parent_id = child.parent_id,
    sort_order = child.sort_order,
    visible = TRUE,
    updated_at = NOW()
  FROM finance_children child
  WHERE mi.tenant_id = child.tenant_id
    AND mi.key = child.key
    AND mi.deleted_at IS NULL
    AND (
      mi.parent_id IS DISTINCT FROM child.parent_id
      OR mi.sort_order IS DISTINCT FROM child.sort_order
      OR mi.visible IS DISTINCT FROM TRUE
    )
  RETURNING mi.id
),
permission_targets AS (
  SELECT
    mi.tenant_id,
    mi.id AS menu_item_id,
    mi.key AS menu_key,
    r.id AS role_id,
    r.nombre AS role_name,
    CASE
      WHEN r.nombre IN ('SUPER_ADMIN', 'SUPER_USER') THEN 'WRITE'
      WHEN r.nombre = 'ADMIN' AND mi.key IN (
        'FINANCE',
        'FINANCE_CASH_SESSIONS',
        'FINANCE_CASH_MOVEMENTS'
      ) THEN 'WRITE'
      WHEN r.nombre = 'ADMIN' AND mi.key = 'FINANCE_CASH_REGISTERS' THEN 'READ'
      WHEN r.nombre = 'USER' AND mi.key IN (
        'FINANCE',
        'FINANCE_CASH_SESSIONS',
        'FINANCE_CASH_MOVEMENTS'
      ) THEN 'READ'
      ELSE NULL
    END AS access_level,
    CASE
      WHEN r.nombre IN ('SUPER_ADMIN', 'SUPER_USER') THEN
        '{"read": true, "create": true, "update": true, "delete": true}'::jsonb
      WHEN r.nombre = 'ADMIN' AND mi.key = 'FINANCE' THEN
        '{"read": true}'::jsonb
      WHEN r.nombre = 'ADMIN' AND mi.key = 'FINANCE_CASH_SESSIONS' THEN
        '{"read": true, "create": true, "update": true}'::jsonb
      WHEN r.nombre = 'ADMIN' AND mi.key = 'FINANCE_CASH_MOVEMENTS' THEN
        '{"read": true, "create": true}'::jsonb
      WHEN r.nombre = 'ADMIN' AND mi.key = 'FINANCE_CASH_REGISTERS' THEN
        '{"read": true}'::jsonb
      WHEN r.nombre = 'USER' AND mi.key = 'FINANCE' THEN
        '{"read": true}'::jsonb
      WHEN r.nombre = 'USER' AND mi.key = 'FINANCE_CASH_SESSIONS' THEN
        '{"read": true, "create": true, "update": true}'::jsonb
      WHEN r.nombre = 'USER' AND mi.key = 'FINANCE_CASH_MOVEMENTS' THEN
        '{"read": true, "create": true}'::jsonb
      ELSE NULL
    END AS actions
  FROM public.menu_items mi
  INNER JOIN public.roles r
    ON r.nombre IN ('SUPER_ADMIN', 'SUPER_USER', 'ADMIN', 'USER')
  WHERE mi.key IN (
    'FINANCE',
    'FINANCE_CASH_SESSIONS',
    'FINANCE_CASH_MOVEMENTS',
    'FINANCE_CASH_REGISTERS',
    'FINANCE_PAYMENT_METHODS'
  )
    AND mi.deleted_at IS NULL
),
eligible_permissions AS (
  SELECT *
  FROM permission_targets
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
  permission.tenant_id,
  permission.role_id,
  permission.menu_item_id,
  permission.access_level,
  permission.actions
FROM eligible_permissions permission
ON CONFLICT (tenant_id, role_id, menu_item_id) DO UPDATE
SET
  access_level = EXCLUDED.access_level,
  actions = EXCLUDED.actions;

COMMIT;
