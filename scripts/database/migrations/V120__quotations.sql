-- V120: modulo de cotizaciones (cotizacion -> pedido).
-- OpenSpec: implementar-cotizaciones-pedido
-- Tablas nuevas quotations, quotation_items, quotation_sequences y quotation_settings,
-- columna orders.quotation_id, funciones de consecutivo y estado efectivo, menu QUOTATIONS y permisos.
-- No modifica inventory_create_sale_v2, sales, sale_items, stock_movements ni order_items.
-- Sin control transaccional: lo aporta apply_single_migration.sh.

DO $$
BEGIN
  IF to_regclass('public.tenants') IS NULL
    OR to_regclass('public.tenant_branches') IS NULL
    OR to_regclass('public.customers') IS NULL
    OR to_regclass('public.products') IS NULL
    OR to_regclass('public.orders') IS NULL
    OR to_regclass('public.users') IS NULL
    OR to_regclass('public.menu_items') IS NULL
    OR to_regclass('public.roles') IS NULL
    OR to_regclass('public.role_menu_permissions') IS NULL THEN
    RAISE EXCEPTION 'QUOTATIONS_PREREQUISITES_MISSING';
  END IF;
  IF to_regclass('public.quotations') IS NOT NULL THEN
    RAISE EXCEPTION 'QUOTATIONS_V120_ALREADY_APPLIED';
  END IF;
END $$;

CREATE TABLE public.quotations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES public.tenant_branches(id) ON DELETE RESTRICT,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
  code TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
  issue_date DATE NOT NULL,
  validity_days INTEGER NOT NULL,
  valid_until DATE NOT NULL,
  subtotal NUMERIC(14, 2) NOT NULL DEFAULT 0,
  discount_total NUMERIC(14, 2) NOT NULL DEFAULT 0,
  tax_total NUMERIC(14, 2) NOT NULL DEFAULT 0,
  total NUMERIC(14, 2) NOT NULL DEFAULT 0,
  commercial_terms TEXT NULL,
  payment_delivery_terms TEXT NULL,
  warranty_terms TEXT NULL,
  notes TEXT NULL,
  pricing_calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at TIMESTAMPTZ NULL,
  approved_at TIMESTAMPTZ NULL,
  approved_by_user_id UUID NULL REFERENCES public.users(id) ON DELETE SET NULL,
  rejected_at TIMESTAMPTZ NULL,
  rejection_reason TEXT NULL,
  converted_order_id UUID NULL REFERENCES public.orders(id) ON DELETE RESTRICT,
  converted_at TIMESTAMPTZ NULL,
  created_by_user_id UUID NULL REFERENCES public.users(id) ON DELETE SET NULL,
  updated_by_user_id UUID NULL REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_quotations_tenant_code UNIQUE (tenant_id, code),
  CONSTRAINT uq_quotations_converted_order UNIQUE (converted_order_id),
  CONSTRAINT chk_quotations_status
    CHECK (status IN ('DRAFT', 'SENT', 'APPROVED', 'REJECTED', 'CONVERTED')),
  CONSTRAINT chk_quotations_code_not_blank CHECK (length(btrim(code)) > 0),
  CONSTRAINT chk_quotations_validity
    CHECK (validity_days BETWEEN 1 AND 365 AND valid_until >= issue_date),
  CONSTRAINT chk_quotations_amounts
    CHECK (subtotal >= 0 AND discount_total >= 0 AND tax_total >= 0 AND total >= 0),
  CONSTRAINT chk_quotations_converted
    CHECK ((status = 'CONVERTED') = (converted_order_id IS NOT NULL)),
  CONSTRAINT chk_quotations_rejected
    CHECK (status <> 'REJECTED' OR length(btrim(COALESCE(rejection_reason, ''))) > 0)
);

CREATE INDEX idx_quotations_tenant_status_issue
  ON public.quotations (tenant_id, status, issue_date DESC);
CREATE INDEX idx_quotations_tenant_customer
  ON public.quotations (tenant_id, customer_id);
CREATE INDEX idx_quotations_tenant_valid_until
  ON public.quotations (tenant_id, valid_until);
CREATE INDEX idx_quotations_tenant_branch
  ON public.quotations (tenant_id, branch_id);

CREATE TABLE public.quotation_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  quotation_id UUID NOT NULL REFERENCES public.quotations(id) ON DELETE CASCADE,
  line_number INTEGER NOT NULL,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  product_name TEXT NOT NULL,
  product_code TEXT NULL,
  unit_code TEXT NULL,
  quantity NUMERIC(14, 3) NOT NULL,
  base_unit_price NUMERIC(14, 2) NOT NULL DEFAULT 0,
  final_unit_price NUMERIC(14, 2) NOT NULL DEFAULT 0,
  discount_amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
  discount_percent NUMERIC(7, 4) NOT NULL DEFAULT 0,
  discount_total NUMERIC(14, 2) NOT NULL DEFAULT 0,
  applied_promotion_id UUID NULL,
  applied_promotion_name TEXT NULL,
  tax_id UUID NULL,
  tax_rate NUMERIC(7, 4) NOT NULL DEFAULT 0,
  tax_base NUMERIC(14, 2) NOT NULL DEFAULT 0,
  tax_amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
  line_total NUMERIC(14, 2) NOT NULL DEFAULT 0,
  pricing_snapshot JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_quotation_items_line UNIQUE (quotation_id, line_number),
  CONSTRAINT chk_quotation_items_quantity CHECK (quantity > 0),
  CONSTRAINT chk_quotation_items_line_number CHECK (line_number > 0),
  CONSTRAINT chk_quotation_items_amounts CHECK (
    base_unit_price >= 0 AND final_unit_price >= 0 AND discount_amount >= 0
    AND discount_total >= 0 AND tax_base >= 0 AND tax_amount >= 0 AND line_total >= 0
    AND discount_percent BETWEEN 0 AND 100 AND tax_rate >= 0
  ),
  CONSTRAINT chk_quotation_items_product_name CHECK (length(btrim(product_name)) > 0),
  CONSTRAINT chk_quotation_items_snapshot CHECK (jsonb_typeof(pricing_snapshot) = 'object')
);

CREATE INDEX idx_quotation_items_tenant_product
  ON public.quotation_items (tenant_id, product_id);

CREATE TABLE public.quotation_sequences (
  tenant_id UUID PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
  last_value BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_quotation_sequences_last_value CHECK (last_value >= 0)
);

CREATE TABLE public.quotation_settings (
  tenant_id UUID PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
  default_validity_days INTEGER NOT NULL DEFAULT 15,
  updated_by_user_id UUID NULL REFERENCES public.users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_quotation_settings_validity CHECK (default_validity_days BETWEEN 1 AND 365)
);

ALTER TABLE public.orders
  ADD COLUMN quotation_id UUID NULL REFERENCES public.quotations(id) ON DELETE RESTRICT;

CREATE UNIQUE INDEX uq_orders_quotation_id
  ON public.orders (quotation_id)
  WHERE quotation_id IS NOT NULL;

COMMENT ON TABLE public.quotations IS
  'Cotizaciones de productos del catalogo. EXPIRED no se persiste: ver fnc_quotation_effective_status.';
COMMENT ON COLUMN public.orders.quotation_id IS
  'Cotizacion de origen cuando el pedido se genero por conversion (1 cotizacion -> 1 pedido).';

-- Consecutivo COT-000001 por tenant; se llama dentro de la transaccion de creacion.
CREATE OR REPLACE FUNCTION public.fnc_quotation_next_code(p_tenant_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  v_next BIGINT;
BEGIN
  IF p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'QUOTATION_SEQUENCE_TENANT_REQUIRED';
  END IF;

  INSERT INTO public.quotation_sequences AS seq (tenant_id, last_value, updated_at)
  VALUES (p_tenant_id, 1, NOW())
  ON CONFLICT (tenant_id) DO UPDATE
    SET last_value = seq.last_value + 1,
        updated_at = NOW()
  RETURNING last_value INTO v_next;

  RETURN 'COT-' || lpad(v_next::TEXT, 6, '0');
END;
$$;

-- Estado efectivo: EXPIRED cuando una cotizacion abierta paso su vigencia (fecha de America/Bogota).
CREATE OR REPLACE FUNCTION public.fnc_quotation_effective_status(
  p_status TEXT,
  p_valid_until DATE,
  p_today DATE DEFAULT (NOW() AT TIME ZONE 'America/Bogota')::DATE
)
RETURNS TEXT
LANGUAGE sql
STABLE
AS $$
  SELECT CASE
    WHEN p_status IN ('DRAFT', 'SENT', 'APPROVED') AND p_valid_until < p_today THEN 'EXPIRED'
    ELSE p_status
  END;
$$;

-- Menu QUOTATIONS (junto a Pedidos) para todos los tenants.
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
  t.id,
  'QUOTATIONS',
  'quotations',
  'Cotizaciones',
  '/{tenant}/quotations',
  'file-text',
  NULL,
  145,
  TRUE,
  FALSE,
  '{}'::jsonb,
  NOW(),
  NOW(),
  NULL
FROM public.tenants t
ON CONFLICT (tenant_id, key) WHERE deleted_at IS NULL
DO UPDATE SET
  module = EXCLUDED.module,
  label = EXCLUDED.label,
  route = EXCLUDED.route,
  icon = EXCLUDED.icon,
  sort_order = EXCLUDED.sort_order,
  visible = TRUE,
  below_main_menu = EXCLUDED.below_main_menu,
  metadata = COALESCE(public.menu_items.metadata, '{}'::jsonb) || EXCLUDED.metadata,
  updated_at = NOW(),
  deleted_at = NULL;

WITH role_permissions AS (
  SELECT * FROM (
    VALUES
      (
        'USER',
        'WRITE'::varchar(20),
        '{
          "QUOTATIONS_VIEW": true,
          "QUOTATIONS_CREATE": true,
          "QUOTATIONS_UPDATE": true
        }'::jsonb
      ),
      (
        'ADMIN',
        'WRITE'::varchar(20),
        '{
          "QUOTATIONS_VIEW": true,
          "QUOTATIONS_CREATE": true,
          "QUOTATIONS_UPDATE": true,
          "QUOTATIONS_APPROVE": true,
          "QUOTATIONS_CONVERT": true,
          "QUOTATIONS_SETTINGS": true
        }'::jsonb
      ),
      (
        'SUPER_USER',
        'WRITE'::varchar(20),
        '{
          "QUOTATIONS_VIEW": true,
          "QUOTATIONS_CREATE": true,
          "QUOTATIONS_UPDATE": true,
          "QUOTATIONS_APPROVE": true,
          "QUOTATIONS_CONVERT": true,
          "QUOTATIONS_SETTINGS": true
        }'::jsonb
      ),
      (
        'SUPER_ADMIN',
        'WRITE'::varchar(20),
        '{
          "QUOTATIONS_VIEW": true,
          "QUOTATIONS_CREATE": true,
          "QUOTATIONS_UPDATE": true,
          "QUOTATIONS_APPROVE": true,
          "QUOTATIONS_CONVERT": true,
          "QUOTATIONS_SETTINGS": true
        }'::jsonb
      )
  ) AS x(role_name, access_level, actions)
)
INSERT INTO public.role_menu_permissions (
  tenant_id,
  role_id,
  menu_item_id,
  access_level,
  actions
)
SELECT
  mi.tenant_id,
  r.id,
  mi.id,
  rp.access_level,
  rp.actions
FROM role_permissions rp
INNER JOIN public.roles r
  ON r.nombre = rp.role_name
INNER JOIN public.menu_items mi
  ON mi.key = 'QUOTATIONS'
 AND mi.deleted_at IS NULL
ON CONFLICT (tenant_id, role_id, menu_item_id) DO UPDATE
SET
  access_level = EXCLUDED.access_level,
  actions = EXCLUDED.actions;
