BEGIN;

-- Phase 6.5: promociones simples por producto/sucursal.
-- No activa promociones en POS ni Orders.

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;

DO $$
BEGIN
  IF to_regclass('public.products') IS NULL THEN
    RAISE EXCEPTION 'Required table public.products does not exist';
  END IF;

  IF to_regclass('public.tenant_branches') IS NULL THEN
    RAISE EXCEPTION 'Required table public.tenant_branches does not exist';
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.promotions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  promotion_type text NOT NULL DEFAULT 'PRODUCT_DISCOUNT',
  discount_type text NOT NULL,
  discount_value numeric(14, 2) NOT NULL,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  priority integer NOT NULL DEFAULT 100,
  is_stackable boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_promotions_name_not_blank CHECK (btrim(name) <> ''),
  CONSTRAINT chk_promotions_promotion_type CHECK (promotion_type IN ('PRODUCT_DISCOUNT')),
  CONSTRAINT chk_promotions_discount_type CHECK (discount_type IN ('PERCENTAGE', 'FIXED_AMOUNT', 'SPECIAL_PRICE')),
  CONSTRAINT chk_promotions_discount_value_non_negative CHECK (discount_value >= 0),
  CONSTRAINT chk_promotions_percentage_range CHECK (discount_type <> 'PERCENTAGE' OR discount_value <= 100),
  CONSTRAINT chk_promotions_valid_range CHECK (ends_at > starts_at),
  CONSTRAINT chk_promotions_priority_non_negative CHECK (priority >= 0)
);

CREATE TABLE IF NOT EXISTS public.promotion_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  promotion_id uuid NOT NULL REFERENCES public.promotions(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_promotion_products_promotion_product UNIQUE (promotion_id, product_id)
);

CREATE TABLE IF NOT EXISTS public.promotion_branches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  promotion_id uuid NOT NULL REFERENCES public.promotions(id) ON DELETE CASCADE,
  branch_id uuid NOT NULL REFERENCES public.tenant_branches(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_promotion_branches_promotion_branch UNIQUE (promotion_id, branch_id)
);

CREATE INDEX IF NOT EXISTS idx_promotions_tenant_active_dates
  ON public.promotions (tenant_id, is_active, starts_at, ends_at);

CREATE INDEX IF NOT EXISTS idx_promotions_tenant_search
  ON public.promotions (tenant_id, lower(name));

CREATE INDEX IF NOT EXISTS idx_promotion_products_tenant_product
  ON public.promotion_products (tenant_id, product_id);

CREATE INDEX IF NOT EXISTS idx_promotion_branches_tenant_branch
  ON public.promotion_branches (tenant_id, branch_id);

COMMIT;
