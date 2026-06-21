-- Fase 6A Domicilios: permisos backend local/QA.
-- Idempotente. No ejecutar en produccion sin aprobacion explicita.
-- No crea frontend, caja, facturacion, pedidos ni reportes avanzados.

BEGIN;

WITH target_tenants AS (
  SELECT id AS tenant_id
  FROM public.tenants
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
  tenant_id,
  'DELIVERIES',
  'deliveries',
  'Domicilios',
  '/{tenant}/deliveries',
  'Truck',
  NULL,
  240,
  FALSE,
  FALSE,
  '{
    "change": "gestionar-domicilios-clientes-pedidos-facturacion-caja",
    "phase": "6A",
    "backendOnly": true,
    "localQaOnly": true
  }'::jsonb,
  now(),
  now(),
  NULL
FROM target_tenants
ON CONFLICT (tenant_id, key) WHERE deleted_at IS NULL
DO UPDATE SET
  module = EXCLUDED.module,
  label = EXCLUDED.label,
  route = EXCLUDED.route,
  icon = EXCLUDED.icon,
  sort_order = EXCLUDED.sort_order,
  visible = FALSE,
  below_main_menu = FALSE,
  metadata = COALESCE(public.menu_items.metadata, '{}'::jsonb) || EXCLUDED.metadata,
  updated_at = now(),
  deleted_at = NULL;

WITH permission_targets(role_name, access_level, actions) AS (
  VALUES
    (
      'USER',
      'WRITE',
      '{
        "DELIVERIES_VIEW": true,
        "DELIVERIES_CREATE": true,
        "DELIVERIES_UPDATE": true,
        "DELIVERIES_DISPATCH": true,
        "DELIVERIES_MARK_DELIVERED": true,
        "DELIVERIES_MARK_NOT_DELIVERED": true
      }'::jsonb
    ),
    (
      'ADMIN',
      'WRITE',
      '{
        "DELIVERIES_VIEW": true,
        "DELIVERIES_CREATE": true,
        "DELIVERIES_UPDATE": true,
        "DELIVERIES_ASSIGN": true,
        "DELIVERIES_DISPATCH": true,
        "DELIVERIES_MARK_DELIVERED": true,
        "DELIVERIES_MARK_NOT_DELIVERED": true,
        "DELIVERIES_CANCEL": true,
        "DELIVERIES_REPORTS": true
      }'::jsonb
    ),
    (
      'SUPER_USER',
      'WRITE',
      '{
        "DELIVERIES_VIEW": true,
        "DELIVERIES_CREATE": true,
        "DELIVERIES_UPDATE": true,
        "DELIVERIES_ASSIGN": true,
        "DELIVERIES_DISPATCH": true,
        "DELIVERIES_MARK_DELIVERED": true,
        "DELIVERIES_MARK_NOT_DELIVERED": true,
        "DELIVERIES_CANCEL": true,
        "DELIVERIES_REPORTS": true
      }'::jsonb
    ),
    (
      'SUPER_ADMIN',
      'WRITE',
      '{
        "DELIVERIES_VIEW": true,
        "DELIVERIES_CREATE": true,
        "DELIVERIES_UPDATE": true,
        "DELIVERIES_ASSIGN": true,
        "DELIVERIES_DISPATCH": true,
        "DELIVERIES_MARK_DELIVERED": true,
        "DELIVERIES_MARK_NOT_DELIVERED": true,
        "DELIVERIES_CANCEL": true,
        "DELIVERIES_REPORTS": true
      }'::jsonb
    )
),
resolved_targets AS (
  SELECT
    mi.tenant_id,
    r.id AS role_id,
    mi.id AS menu_item_id,
    target.access_level,
    target.actions
  FROM permission_targets target
  INNER JOIN public.roles r
    ON r.nombre = target.role_name
  INNER JOIN public.menu_items mi
    ON mi.key = 'DELIVERIES'
   AND mi.deleted_at IS NULL
)
INSERT INTO public.role_menu_permissions (
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
FROM resolved_targets
ON CONFLICT (tenant_id, role_id, menu_item_id) DO UPDATE
SET
  access_level = EXCLUDED.access_level,
  actions = EXCLUDED.actions;

COMMIT;
