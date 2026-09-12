-- =============================================================================
-- Bundle VPS: tax model multi-tax + alcohol seeds (idempotente)
-- Incluye: V077, V078, V079, V080 + seed taxes + migrate 11 alcohol + Excel
-- Uso:
--   psql -h HOST -U USER -d DB -v ON_ERROR_STOP=1 \
--     -f scripts/database/products/2026_09_12_vps_tax_model_alcohol_bundle.sql
-- Notas:
--   * Seguro re-ejecutar en gran parte (IF NOT EXISTS / ON CONFLICT / upserts).
--   * Registra versions en migrations_history al final (ON CONFLICT DO NOTHING).
--   * Excel seed crea productos XLS-* en tenant default; comenta esa seccion si no aplica.
-- =============================================================================

-- >>> BEGIN SECTION: migrations/V077__tax_model_extension.sql
-- V077 tax model extension (safe additive)
-- PostgreSQL 16+
--
-- Scope:
--   * Tax dictionaries and dated rates.
--   * Multiple tax assignments per product through UUID relationships.
--   * Fiscal data required to calculate alcoholic beverage taxes.
--
-- Compatibility:
--   * Does NOT alter purchases, inventory lots, sales, sale_item_taxes,
--     electronic documents or current sales/pricing functions.
--   * products.tax_id remains the POS/Pricing bridge (percentage tax).
--   * Existing taxes are classified by name/rate (not QA-only UUIDs).
--   * Extra fiscal seeds (IVA 5%, ICL, beer, ADV) use gen_random_uuid()
--     per tenant so taxes.id PK stays unique globally.

-- [bundle] skipped outer BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Tax dictionaries
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.tax_categories (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    code character varying(40) NOT NULL UNIQUE,
    name character varying(120) NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.tax_types (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    tax_category_id uuid NOT NULL
        REFERENCES public.tax_categories(id) ON DELETE RESTRICT,
    code character varying(60) NOT NULL UNIQUE,
    name character varying(150) NOT NULL,
    dian_code character varying(10),
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_tax_types_dian_code
    ON public.tax_types (dian_code)
    WHERE dian_code IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.tax_calculation_methods (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    code character varying(60) NOT NULL UNIQUE,
    name character varying(150) NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.tax_base_types (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    code character varying(80) NOT NULL UNIQUE,
    name character varying(150) NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.tax_product_categories (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    code character varying(60) NOT NULL UNIQUE,
    name character varying(150) NOT NULL,
    is_alcoholic_beverage boolean DEFAULT false NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

INSERT INTO public.tax_categories (id, code, name)
VALUES
    ('10000000-0000-0000-0000-000000000001', 'VAT', 'IVA'),
    ('10000000-0000-0000-0000-000000000002', 'CONSUMPTION', 'Impuesto al consumo')
ON CONFLICT (code) DO UPDATE
SET name = EXCLUDED.name,
    is_active = true;

INSERT INTO public.tax_types
    (id, tax_category_id, code, name, dian_code)
VALUES
    ('11000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'VAT', 'IVA', '01'),
    ('11000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000002', 'NATIONAL_CONSUMPTION', 'Impuesto nacional al consumo', '04'),
    ('11000000-0000-0000-0000-000000000030', '10000000-0000-0000-0000-000000000002', 'BEER_CONSUMPTION', 'Impuesto al consumo de cervezas y refajos', '30'),
    ('11000000-0000-0000-0000-000000000032', '10000000-0000-0000-0000-000000000002', 'LIQUOR_CONSUMPTION', 'Impuesto al consumo de licores', '32'),
    ('11000000-0000-0000-0000-000000000036', '10000000-0000-0000-0000-000000000002', 'AD_VALOREM', 'Impuesto ad valórem', '36')
ON CONFLICT (code) DO UPDATE
SET tax_category_id = EXCLUDED.tax_category_id,
    name = EXCLUDED.name,
    dian_code = EXCLUDED.dian_code,
    is_active = true;

INSERT INTO public.tax_calculation_methods (id, code, name)
VALUES
    ('12000000-0000-0000-0000-000000000001', 'PERCENTAGE', 'Porcentaje'),
    ('12000000-0000-0000-0000-000000000002', 'FIXED_AMOUNT', 'Valor fijo'),
    ('12000000-0000-0000-0000-000000000003', 'PER_ALCOHOL_DEGREE_VOLUME', 'Por grado alcoholímetro y volumen')
ON CONFLICT (code) DO UPDATE
SET name = EXCLUDED.name,
    is_active = true;

INSERT INTO public.tax_base_types (id, code, name)
VALUES
    ('13000000-0000-0000-0000-000000000001', 'SALE_PRICE', 'Precio de venta'),
    ('13000000-0000-0000-0000-000000000002', 'SALE_PRICE_EXCLUDING_CONSUMPTION', 'Precio de venta sin consumo'),
    ('13000000-0000-0000-0000-000000000003', 'DANE_CERTIFIED_RETAIL_PRICE', 'Precio certificado DANE'),
    ('13000000-0000-0000-0000-000000000004', 'ALCOHOL_DEGREE_VOLUME', 'Grado alcoholímetro y volumen'),
    ('13000000-0000-0000-0000-000000000005', 'RETAILER_PRICE_EXCLUDING_CONSUMPTION', 'Precio minorista sin consumo'),
    ('13000000-0000-0000-0000-000000000006', 'CUSTOMS_VALUE_WITH_MARGIN', 'Valor en aduana con margen')
ON CONFLICT (code) DO UPDATE
SET name = EXCLUDED.name,
    is_active = true;

INSERT INTO public.tax_product_categories
    (id, code, name, is_alcoholic_beverage)
VALUES
    ('16000000-0000-0000-0000-000000000001', 'GENERAL', 'Producto general', false),
    ('16000000-0000-0000-0000-000000000010', 'DISTILLED_LIQUOR', 'Licor destilado', true),
    ('16000000-0000-0000-0000-000000000011', 'LIQUOR_APERITIF', 'Aperitivo de licor', true),
    ('16000000-0000-0000-0000-000000000012', 'WINE', 'Vino', true),
    ('16000000-0000-0000-0000-000000000013', 'WINE_APERITIF', 'Aperitivo de vino', true),
    ('16000000-0000-0000-0000-000000000014', 'BEER', 'Cerveza', true),
    ('16000000-0000-0000-0000-000000000015', 'SIPHON', 'Sifón', true),
    ('16000000-0000-0000-0000-000000000016', 'BEER_MIXTURE', 'Refajo / mezcla de cerveza', true)
ON CONFLICT (code) DO UPDATE
SET name = EXCLUDED.name,
    is_alcoholic_beverage = EXCLUDED.is_alcoholic_beverage,
    is_active = true;

-- -----------------------------------------------------------------------------
-- 2. Extend taxes + composite uniqueness for FK pairs
-- -----------------------------------------------------------------------------

ALTER TABLE public.taxes
    ADD COLUMN IF NOT EXISTS tax_type_id uuid
        REFERENCES public.tax_types(id) ON DELETE RESTRICT,
    ADD COLUMN IF NOT EXISTS calculation_method_id uuid
        REFERENCES public.tax_calculation_methods(id) ON DELETE RESTRICT,
    ADD COLUMN IF NOT EXISTS tax_base_type_id uuid
        REFERENCES public.tax_base_types(id) ON DELETE RESTRICT;

CREATE UNIQUE INDEX IF NOT EXISTS uq_taxes_tenant_id_id
    ON public.taxes (tenant_id, id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_products_tenant_id_id
    ON public.products (tenant_id, id);

-- Classify existing taxes by data (name/rate), not QA-only UUIDs.
UPDATE public.taxes
SET tax_type_id = '11000000-0000-0000-0000-000000000001',
    calculation_method_id = '12000000-0000-0000-0000-000000000001',
    tax_base_type_id = '13000000-0000-0000-0000-000000000001'
WHERE tax_type_id IS NULL
  AND calculation_method_id IS NULL
  AND tax_base_type_id IS NULL
  AND (
    rate = 0.19
    OR UPPER(BTRIM(name)) LIKE '%IVA%19%'
    OR UPPER(BTRIM(name)) IN ('IVA', 'IVA 19%', 'IVA19%', 'IVA 19')
  );

UPDATE public.taxes
SET tax_type_id = '11000000-0000-0000-0000-000000000001',
    calculation_method_id = '12000000-0000-0000-0000-000000000001',
    tax_base_type_id = '13000000-0000-0000-0000-000000000001'
WHERE tax_type_id IS NULL
  AND calculation_method_id IS NULL
  AND tax_base_type_id IS NULL
  AND rate = 0
  AND (
    UPPER(BTRIM(name)) LIKE '%EXENT%'
    OR UPPER(BTRIM(name)) IN ('EXENTO', 'EXENTA', 'EXENT')
  );

UPDATE public.taxes
SET tax_type_id = '11000000-0000-0000-0000-000000000001',
    calculation_method_id = '12000000-0000-0000-0000-000000000001',
    tax_base_type_id = '13000000-0000-0000-0000-000000000001'
WHERE tax_type_id IS NULL
  AND calculation_method_id IS NULL
  AND tax_base_type_id IS NULL
  AND rate = 0.05
  AND UPPER(BTRIM(name)) LIKE '%IVA%5%';

-- Fallback for remaining percentage taxes still unclassified.
UPDATE public.taxes
SET tax_type_id = COALESCE(tax_type_id, '11000000-0000-0000-0000-000000000001'),
    calculation_method_id = COALESCE(calculation_method_id, '12000000-0000-0000-0000-000000000001'),
    tax_base_type_id = COALESCE(tax_base_type_id, '13000000-0000-0000-0000-000000000001')
WHERE calculation_method_id IS NULL
  AND rate >= 0;

-- -----------------------------------------------------------------------------
-- 3. Dated tax rates
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.tax_rates (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    tax_id uuid NOT NULL,
    tax_product_category_id uuid
        REFERENCES public.tax_product_categories(id) ON DELETE RESTRICT,
    calculation_method_id uuid NOT NULL
        REFERENCES public.tax_calculation_methods(id) ON DELETE RESTRICT,
    tax_base_type_id uuid NOT NULL
        REFERENCES public.tax_base_types(id) ON DELETE RESTRICT,
    percentage_rate numeric(12,8),
    fixed_amount numeric(18,4),
    base_quantity numeric(18,6),
    base_unit_code character varying(20),
    effective_from date NOT NULL,
    effective_to date,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT fk_tax_rates_tenant_tax
        FOREIGN KEY (tenant_id, tax_id)
        REFERENCES public.taxes(tenant_id, id) ON DELETE CASCADE,
    CONSTRAINT chk_tax_rates_percentage
        CHECK (percentage_rate IS NULL OR percentage_rate BETWEEN 0 AND 1),
    CONSTRAINT chk_tax_rates_fixed_amount
        CHECK (fixed_amount IS NULL OR fixed_amount >= 0),
    CONSTRAINT chk_tax_rates_base_quantity
        CHECK (base_quantity IS NULL OR base_quantity > 0),
    CONSTRAINT chk_tax_rates_validity
        CHECK (effective_to IS NULL OR effective_to >= effective_from),
    CONSTRAINT uq_tax_rates_scope UNIQUE NULLS NOT DISTINCT
        (tenant_id, tax_id, tax_product_category_id, effective_from)
);

INSERT INTO public.tax_rates
    (tenant_id, tax_id, calculation_method_id, tax_base_type_id,
     percentage_rate, effective_from)
SELECT tax.tenant_id,
       tax.id,
       tax.calculation_method_id,
       tax.tax_base_type_id,
       tax.rate,
       DATE '2000-01-01'
FROM public.taxes AS tax
JOIN public.tax_calculation_methods AS method
  ON method.id = tax.calculation_method_id
WHERE method.code = 'PERCENTAGE'
  AND tax.calculation_method_id IS NOT NULL
  AND tax.tax_base_type_id IS NOT NULL
ON CONFLICT ON CONSTRAINT uq_tax_rates_scope DO NOTHING;

-- -----------------------------------------------------------------------------
-- 4. Product fiscal data and product-to-tax relation
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.product_tax_profiles (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    product_id uuid NOT NULL,
    tax_product_category_id uuid NOT NULL
        REFERENCES public.tax_product_categories(id) ON DELETE RESTRICT,
    alcohol_degree numeric(6,3),
    net_volume_ml numeric(14,3),
    dane_certified_retail_price numeric(18,2),
    dane_price_effective_from date,
    dane_price_effective_to date,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT fk_product_tax_profiles_tenant_product
        FOREIGN KEY (tenant_id, product_id)
        REFERENCES public.products(tenant_id, id) ON DELETE CASCADE,
    CONSTRAINT uq_product_tax_profiles_product UNIQUE (tenant_id, product_id),
    CONSTRAINT chk_product_tax_profiles_alcohol_degree
        CHECK (alcohol_degree IS NULL OR alcohol_degree BETWEEN 0 AND 100),
    CONSTRAINT chk_product_tax_profiles_net_volume
        CHECK (net_volume_ml IS NULL OR net_volume_ml > 0),
    CONSTRAINT chk_product_tax_profiles_dane_price
        CHECK (dane_certified_retail_price IS NULL OR dane_certified_retail_price >= 0),
    CONSTRAINT chk_product_tax_profiles_dane_validity
        CHECK (dane_price_effective_to IS NULL OR dane_price_effective_from IS NULL
               OR dane_price_effective_to >= dane_price_effective_from)
);

CREATE TABLE IF NOT EXISTS public.product_taxes (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    product_id uuid NOT NULL,
    tax_id uuid NOT NULL,
    calculation_order smallint DEFAULT 100 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT fk_product_taxes_tenant_product
        FOREIGN KEY (tenant_id, product_id)
        REFERENCES public.products(tenant_id, id) ON DELETE CASCADE,
    CONSTRAINT fk_product_taxes_tenant_tax
        FOREIGN KEY (tenant_id, tax_id)
        REFERENCES public.taxes(tenant_id, id) ON DELETE RESTRICT,
    CONSTRAINT uq_product_taxes_product_tax UNIQUE (tenant_id, product_id, tax_id),
    CONSTRAINT chk_product_taxes_order CHECK (calculation_order > 0)
);

CREATE INDEX IF NOT EXISTS idx_product_taxes_lookup
    ON public.product_taxes (tenant_id, product_id, is_active, calculation_order);

INSERT INTO public.product_taxes
    (tenant_id, product_id, tax_id, calculation_order)
SELECT product.tenant_id, product.id, product.tax_id, 100
FROM public.products AS product
JOIN public.taxes AS tax
  ON tax.tenant_id = product.tenant_id
 AND tax.id = product.tax_id
WHERE product.tax_id IS NOT NULL
ON CONFLICT (tenant_id, product_id, tax_id) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 5. Per-tenant fiscal catalog seeds (new UUIDs each tenant)
-- -----------------------------------------------------------------------------

WITH seed_defs AS (
    SELECT *
    FROM (
        VALUES
            (
                'IVA 5%'::character varying,
                0.0500::numeric,
                true,
                '11000000-0000-0000-0000-000000000001'::uuid,
                '12000000-0000-0000-0000-000000000001'::uuid,
                '13000000-0000-0000-0000-000000000002'::uuid,
                'IVA_5'::text
            ),
            (
                'Impuesto al consumo de cervezas y refajos'::character varying,
                0.0000::numeric,
                true,
                '11000000-0000-0000-0000-000000000030'::uuid,
                '12000000-0000-0000-0000-000000000001'::uuid,
                '13000000-0000-0000-0000-000000000005'::uuid,
                'BEER'::text
            ),
            (
                'Impuesto al consumo de licores'::character varying,
                0.0000::numeric,
                true,
                '11000000-0000-0000-0000-000000000032'::uuid,
                '12000000-0000-0000-0000-000000000003'::uuid,
                '13000000-0000-0000-0000-000000000004'::uuid,
                'ICL'::text
            ),
            (
                'Impuesto ad valórem'::character varying,
                0.0000::numeric,
                true,
                '11000000-0000-0000-0000-000000000036'::uuid,
                '12000000-0000-0000-0000-000000000001'::uuid,
                '13000000-0000-0000-0000-000000000003'::uuid,
                'ADV'::text
            )
    ) AS defs(name, rate, is_included, tax_type_id, calculation_method_id, tax_base_type_id, seed_key)
),
inserted AS (
    INSERT INTO public.taxes
        (id, tenant_id, name, rate, is_included, is_active,
         tax_type_id, calculation_method_id, tax_base_type_id)
    SELECT
        gen_random_uuid(),
        tenant.id,
        seed.name,
        seed.rate,
        seed.is_included,
        true,
        seed.tax_type_id,
        seed.calculation_method_id,
        seed.tax_base_type_id
    FROM public.tenants AS tenant
    CROSS JOIN seed_defs AS seed
    WHERE NOT EXISTS (
        SELECT 1
        FROM public.taxes AS existing
        WHERE existing.tenant_id = tenant.id
          AND UPPER(BTRIM(existing.name)) = UPPER(BTRIM(seed.name))
    )
    RETURNING id, tenant_id, name, rate, calculation_method_id, tax_base_type_id
)
INSERT INTO public.tax_rates
    (tenant_id, tax_id, calculation_method_id, tax_base_type_id,
     percentage_rate, effective_from)
SELECT inserted.tenant_id,
       inserted.id,
       inserted.calculation_method_id,
       inserted.tax_base_type_id,
       inserted.rate,
       DATE '2000-01-01'
FROM inserted
JOIN public.tax_calculation_methods AS method
  ON method.id = inserted.calculation_method_id
WHERE method.code = 'PERCENTAGE'
ON CONFLICT ON CONSTRAINT uq_tax_rates_scope DO NOTHING;

-- ICL fixed amounts by liquor category (2026 window).
INSERT INTO public.tax_rates
    (tenant_id, tax_id, tax_product_category_id, calculation_method_id,
     tax_base_type_id, fixed_amount, base_quantity, base_unit_code,
     effective_from, effective_to)
SELECT tax.tenant_id,
       tax.id,
       product_category.id,
       tax.calculation_method_id,
       tax.tax_base_type_id,
       rule.fixed_amount,
       750,
       'ML',
       DATE '2026-01-01',
       DATE '2026-12-31'
FROM public.taxes AS tax
JOIN public.tax_types AS tax_type
  ON tax_type.id = tax.tax_type_id
 AND tax_type.code = 'LIQUOR_CONSUMPTION'
CROSS JOIN (
    VALUES
        ('16000000-0000-0000-0000-000000000010'::uuid, 360.0000::numeric),
        ('16000000-0000-0000-0000-000000000011'::uuid, 360.0000::numeric),
        ('16000000-0000-0000-0000-000000000012'::uuid, 243.0000::numeric),
        ('16000000-0000-0000-0000-000000000013'::uuid, 243.0000::numeric)
) AS rule(product_category_id, fixed_amount)
JOIN public.tax_product_categories AS product_category
  ON product_category.id = rule.product_category_id
ON CONFLICT ON CONSTRAINT uq_tax_rates_scope DO UPDATE
SET fixed_amount = EXCLUDED.fixed_amount,
    effective_to = EXCLUDED.effective_to,
    is_active = true,
    updated_at = now();

-- ADV percentages by liquor category (2026 window).
INSERT INTO public.tax_rates
    (tenant_id, tax_id, tax_product_category_id, calculation_method_id,
     tax_base_type_id, percentage_rate, effective_from, effective_to)
SELECT tax.tenant_id,
       tax.id,
       product_category.id,
       tax.calculation_method_id,
       tax.tax_base_type_id,
       rule.percentage_rate,
       DATE '2026-01-01',
       DATE '2026-12-31'
FROM public.taxes AS tax
JOIN public.tax_types AS tax_type
  ON tax_type.id = tax.tax_type_id
 AND tax_type.code = 'AD_VALOREM'
CROSS JOIN (
    VALUES
        ('16000000-0000-0000-0000-000000000010'::uuid, 0.25000000::numeric),
        ('16000000-0000-0000-0000-000000000011'::uuid, 0.25000000::numeric),
        ('16000000-0000-0000-0000-000000000012'::uuid, 0.20000000::numeric),
        ('16000000-0000-0000-0000-000000000013'::uuid, 0.20000000::numeric)
) AS rule(product_category_id, percentage_rate)
JOIN public.tax_product_categories AS product_category
  ON product_category.id = rule.product_category_id
ON CONFLICT ON CONSTRAINT uq_tax_rates_scope DO UPDATE
SET percentage_rate = EXCLUDED.percentage_rate,
    effective_to = EXCLUDED.effective_to,
    is_active = true,
    updated_at = now();

-- Beer consumption percentages.
INSERT INTO public.tax_rates
    (tenant_id, tax_id, tax_product_category_id, calculation_method_id,
     tax_base_type_id, percentage_rate, effective_from)
SELECT tax.tenant_id,
       tax.id,
       product_category.id,
       tax.calculation_method_id,
       tax.tax_base_type_id,
       rule.percentage_rate,
       DATE '1996-01-01'
FROM public.taxes AS tax
JOIN public.tax_types AS tax_type
  ON tax_type.id = tax.tax_type_id
 AND tax_type.code = 'BEER_CONSUMPTION'
CROSS JOIN (
    VALUES
        ('16000000-0000-0000-0000-000000000014'::uuid, 0.48000000::numeric),
        ('16000000-0000-0000-0000-000000000015'::uuid, 0.48000000::numeric),
        ('16000000-0000-0000-0000-000000000016'::uuid, 0.20000000::numeric)
) AS rule(product_category_id, percentage_rate)
JOIN public.tax_product_categories AS product_category
  ON product_category.id = rule.product_category_id
ON CONFLICT ON CONSTRAINT uq_tax_rates_scope DO UPDATE
SET percentage_rate = EXCLUDED.percentage_rate,
    is_active = true,
    updated_at = now();

-- -----------------------------------------------------------------------------
-- 6. Application-role permissions
-- -----------------------------------------------------------------------------

DO $migration$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'manus_user') THEN
        EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE '
            || 'public.tax_categories, public.tax_types, public.tax_calculation_methods, '
            || 'public.tax_base_types, public.tax_product_categories, public.tax_rates, '
            || 'public.product_tax_profiles, public.product_taxes TO manus_user';
    END IF;
END
$migration$;

-- [bundle] skipped outer COMMIT;
-- <<< END SECTION: migrations/V077__tax_model_extension.sql

-- >>> BEGIN SECTION: migrations/V078__sale_item_taxes_multi_tax_snapshot.sql
﻿-- V078 multi-tax snapshot enrichment
-- Adds fiscal detail columns, order_item_taxes, and multi-tax inserts in inventory_create_sale_v2.
-- PostgreSQL 16+

ALTER TABLE public.sale_item_taxes
  ADD COLUMN IF NOT EXISTS tax_base NUMERIC(14, 2),
  ADD COLUMN IF NOT EXISTS dian_code VARCHAR(10),
  ADD COLUMN IF NOT EXISTS tax_type_code VARCHAR(60),
  ADD COLUMN IF NOT EXISTS calculation_method_code VARCHAR(60);

CREATE TABLE IF NOT EXISTS public.order_item_taxes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  order_item_id UUID NOT NULL,
  tax_id UUID NOT NULL,
  tax_name VARCHAR(255) NOT NULL,
  tax_rate NUMERIC(12, 4) NOT NULL DEFAULT 0 CHECK (tax_rate >= 0),
  tax_base NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (tax_base >= 0),
  tax_amount NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (tax_amount >= 0),
  dian_code VARCHAR(10),
  tax_type_code VARCHAR(60),
  calculation_method_code VARCHAR(60),
  calculation_order SMALLINT NOT NULL DEFAULT 100 CHECK (calculation_order > 0),
  is_included BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_order_item_taxes_item_tax UNIQUE (tenant_id, order_item_id, tax_id)
);

CREATE INDEX IF NOT EXISTS idx_order_item_taxes_lookup
  ON public.order_item_taxes (tenant_id, order_item_id, calculation_order);

DO $grant$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'manus_user') THEN
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.order_item_taxes TO manus_user';
  END IF;
END
$grant$;

CREATE OR REPLACE FUNCTION public.inventory_create_sale_v2(
  p_tenant_id UUID,
  p_branch_id UUID,
  p_terminal_id UUID,
  p_user_id UUID,
  p_pos_session_id UUID,
  p_customer_id UUID,
  p_order_id UUID,
  p_type VARCHAR(20),
  p_items JSONB,
  p_payment_methods JSONB DEFAULT '[]'::JSONB
)
RETURNS TABLE (
  id UUID,
  tenant_id UUID,
  customer_id UUID,
  order_id UUID,
  type VARCHAR(20),
  status VARCHAR(20),
  total NUMERIC(12, 2),
  balance NUMERIC(12, 2),
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_sale_id UUID := gen_random_uuid();
  v_now TIMESTAMPTZ := NOW();
  v_total NUMERIC(12, 2) := 0;
  v_balance NUMERIC(12, 2) := 0;
  v_balance_due NUMERIC(12, 2) := 0;
  v_total_paid NUMERIC(12, 2) := 0;
  v_payment_total NUMERIC(12, 2) := 0;
  v_item RECORD;
  v_product RECORD;
  v_payment_method RECORD;
  v_order_item RECORD;
  v_lot_balance RECORD;
  v_sale_item_id UUID;
  v_stock_movement_id UUID;
  v_price NUMERIC(12, 2);
  v_quantity NUMERIC(12, 2);
  v_tax_rate NUMERIC(12, 4);
  v_price_without_tax NUMERIC(12, 2);
  v_tax_total NUMERIC(12, 2);
  v_subtotal NUMERIC(12, 2);
  v_available_stock NUMERIC(12, 2);
  v_stock_before NUMERIC(12, 2);
  v_remaining_lot_quantity NUMERIC(14, 2);
  v_quantity_from_lot NUMERIC(14, 2);
  v_order_items_total INTEGER := 0;
  v_order_items_zero_delivered INTEGER := 0;
  v_order_items_completed INTEGER := 0;
  v_is_pos_pricing_snapshot BOOLEAN := FALSE;
  v_base_unit_price NUMERIC(14, 2);
  v_final_unit_price NUMERIC(14, 2);
  v_discount_amount NUMERIC(14, 2);
  v_discount_percent NUMERIC(8, 4);
  v_discount_total NUMERIC(14, 2);
  v_tax_base NUMERIC(14, 2);
  v_tax_amount NUMERIC(14, 2);
  v_pricing_snapshot JSONB;
  v_pricing_calculated_at TIMESTAMPTZ;
  v_applied_promotion_id UUID;
  v_applied_promotion_name TEXT;
  v_pos_tax_id UUID;
  v_pos_tax_rate NUMERIC(12, 4);
  v_pos_tax_name TEXT;
  v_pos_tax_is_included BOOLEAN;
BEGIN
  IF p_type NOT IN ('CASH', 'CREDIT') THEN
    RAISE EXCEPTION 'type is invalid';
  END IF;

  IF p_branch_id IS NULL THEN
    RAISE EXCEPTION 'branch_id is required';
  END IF;

  IF p_terminal_id IS NULL THEN
    RAISE EXCEPTION 'terminal_id is required';
  END IF;

  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'user_id is required';
  END IF;

  IF p_pos_session_id IS NULL THEN
    RAISE EXCEPTION 'pos_session_id is required';
  END IF;

  IF p_items IS NULL
    OR jsonb_typeof(p_items) <> 'array'
    OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'sale items are required';
  END IF;

  IF p_payment_methods IS NOT NULL
    AND jsonb_typeof(p_payment_methods) <> 'array' THEN
    RAISE EXCEPTION 'payment methods must be an array';
  END IF;

  PERFORM 1
  FROM tenant_branches tb
  WHERE tb.id = p_branch_id
    AND tb.tenant_id = p_tenant_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'branch not found for tenant';
  END IF;

  PERFORM 1
  FROM terminals t
  WHERE t.id = p_terminal_id
    AND t.tenant_id = p_tenant_id
    AND t.branch_id = p_branch_id
    AND t.is_active = TRUE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'terminal not found for tenant and branch';
  END IF;

  PERFORM 1
  FROM users u
  WHERE u.id = p_user_id
    AND u.tenant_id = p_tenant_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'user not found for tenant';
  END IF;

  PERFORM 1
  FROM pos_user_sessions pus
  WHERE pus.id = p_pos_session_id
    AND pus.tenant_id = p_tenant_id
    AND pus.branch_id = p_branch_id
    AND pus.terminal_id = p_terminal_id
    AND pus.user_id = p_user_id
    AND pus.is_active = TRUE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'pos session not found for context';
  END IF;

  PERFORM 1
  FROM customers c
  WHERE c.id = p_customer_id
    AND c.tenant_id = p_tenant_id
    AND c.is_active = TRUE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'customer not found for tenant';
  END IF;

  IF p_order_id IS NOT NULL THEN
    PERFORM 1
    FROM orders o
    WHERE o.id = p_order_id
      AND o.tenant_id = p_tenant_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'order not found for tenant';
    END IF;
  END IF;

  INSERT INTO sales (
    id,
    tenant_id,
    branch_id,
    terminal_id,
    user_id,
    pos_session_id,
    customer_id,
    order_id,
    type,
    status,
    total,
    balance,
    payment_status,
    total_paid,
    balance_due,
    created_at
  ) VALUES (
    v_sale_id,
    p_tenant_id,
    p_branch_id,
    p_terminal_id,
    p_user_id,
    p_pos_session_id,
    p_customer_id,
    p_order_id,
    p_type,
    'DRAFT',
    0,
    0,
    'PENDING',
    0,
    0,
    v_now
  );

  FOR v_item IN
    SELECT
      item.product_id::UUID AS product_id,
      item.quantity::NUMERIC(12, 2) AS quantity,
      item.price::NUMERIC(14, 2) AS price,
      item.subtotal::NUMERIC(14, 2) AS subtotal,
      CASE
        WHEN item.order_item_id IS NULL OR BTRIM(item.order_item_id) = '' THEN NULL
        ELSE item.order_item_id::UUID
      END AS order_item_id,
      item.price_without_tax::NUMERIC(14, 2) AS price_without_tax,
      item.tax_total::NUMERIC(14, 2) AS tax_total,
      item.base_unit_price::NUMERIC(14, 2) AS base_unit_price,
      item.final_unit_price::NUMERIC(14, 2) AS final_unit_price,
      item.discount_amount::NUMERIC(14, 2) AS discount_amount,
      item.discount_percent::NUMERIC(8, 4) AS discount_percent,
      item.discount_total::NUMERIC(14, 2) AS discount_total,
      CASE
        WHEN item.applied_promotion_id IS NULL
          OR BTRIM(item.applied_promotion_id) = '' THEN NULL
        ELSE item.applied_promotion_id::UUID
      END AS applied_promotion_id,
      NULLIF(BTRIM(item.applied_promotion_name), '') AS applied_promotion_name,
      CASE
        WHEN item.tax_id IS NULL OR BTRIM(item.tax_id) = '' THEN NULL
        ELSE item.tax_id::UUID
      END AS tax_id,
      item.tax_rate::NUMERIC(12, 4) AS tax_rate,
      item.tax_base::NUMERIC(14, 2) AS tax_base,
      item.tax_amount::NUMERIC(14, 2) AS tax_amount,
      item.line_total::NUMERIC(14, 2) AS line_total,
      item.pricing_snapshot AS pricing_snapshot,
      item.pricing_calculated_at::TIMESTAMPTZ AS pricing_calculated_at,
      NULLIF(BTRIM(item.pricing_source), '')::VARCHAR(40) AS pricing_source,
      COALESCE(item.taxes, '[]'::JSONB) AS taxes
    FROM jsonb_to_recordset(p_items) AS item(
      product_id TEXT,
      quantity NUMERIC,
      price NUMERIC,
      subtotal NUMERIC,
      order_item_id TEXT,
      price_without_tax NUMERIC,
      tax_total NUMERIC,
      base_unit_price NUMERIC,
      final_unit_price NUMERIC,
      discount_amount NUMERIC,
      discount_percent NUMERIC,
      discount_total NUMERIC,
      applied_promotion_id TEXT,
      applied_promotion_name TEXT,
      tax_id TEXT,
      tax_rate NUMERIC,
      tax_base NUMERIC,
      tax_amount NUMERIC,
      line_total NUMERIC,
      pricing_snapshot JSONB,
      pricing_calculated_at TIMESTAMPTZ,
      pricing_source TEXT,
      taxes JSONB
    )
  LOOP
    IF v_item.product_id IS NULL THEN
      RAISE EXCEPTION 'productId is required';
    END IF;

    IF v_item.quantity IS NULL OR v_item.quantity <= 0 THEN
      RAISE EXCEPTION 'quantity must be a positive number';
    END IF;

    v_quantity := ROUND(v_item.quantity, 2);
    v_is_pos_pricing_snapshot := COALESCE(v_item.pricing_source, '') = 'POS_PRICING_SERVICE';

    IF NOT v_is_pos_pricing_snapshot
      AND (v_item.price IS NULL OR v_item.price < 0) THEN
      RAISE EXCEPTION 'price must be a non-negative number';
    END IF;

    SELECT
      p.id,
      p.tax_id,
      p.requires_lot,
      p.requires_expiration,
      t.name AS tax_name,
      COALESCE(t.rate, 0) AS tax_rate,
      COALESCE(t.is_included, FALSE) AS tax_is_included
    INTO v_product
    FROM products p
    LEFT JOIN taxes t
      ON t.id = p.tax_id
     AND t.tenant_id = p.tenant_id
    WHERE p.id = v_item.product_id
      AND p.tenant_id = p_tenant_id
      AND p.is_active = TRUE
    LIMIT 1;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'product not found for tenant';
    END IF;

    IF v_item.order_item_id IS NOT NULL THEN
      IF p_order_id IS NULL THEN
        RAISE EXCEPTION 'order_id is required when order_item_id is provided';
      END IF;

      SELECT
        oi.id,
        oi.order_id,
        oi.ordered_quantity,
        oi.delivered_quantity
      INTO v_order_item
      FROM order_items oi
      INNER JOIN orders o
        ON o.id = oi.order_id
      WHERE oi.id = v_item.order_item_id
        AND oi.order_id = p_order_id
        AND o.tenant_id = p_tenant_id
      FOR UPDATE OF oi;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'order item not found for order and tenant';
      END IF;

      IF v_quantity > (v_order_item.ordered_quantity - v_order_item.delivered_quantity) THEN
        RAISE EXCEPTION 'sale quantity exceeds pending quantity for order item %', v_item.order_item_id;
      END IF;
    ELSIF p_order_id IS NOT NULL THEN
      RAISE EXCEPTION 'order_item_id is required for sale items linked to an order';
    END IF;

    SELECT
      COALESCE(SUM(sm.quantity) FILTER (WHERE sm.type = 'IN'), 0)
      - COALESCE(SUM(sm.quantity) FILTER (WHERE sm.type = 'OUT'), 0)
    INTO v_available_stock
    FROM stock_movements sm
    WHERE sm.product_id = v_item.product_id
      AND sm.tenant_id = p_tenant_id
      AND sm.branch_id = p_branch_id;

    IF COALESCE(v_available_stock, 0) < v_quantity THEN
      RAISE EXCEPTION 'insufficient stock for product %', v_item.product_id;
    END IF;

    IF COALESCE(v_product.requires_lot, FALSE) THEN
      IF EXISTS (
        SELECT 1
        FROM inventory_lot_balances balance
        WHERE balance.tenant_id = p_tenant_id
          AND balance.branch_id = p_branch_id
          AND balance.product_id = v_item.product_id
          AND (
            balance.quantity_on_hand < 0
            OR balance.quantity_reserved < 0
            OR balance.quantity_reserved > balance.quantity_on_hand
          )
        LIMIT 1
      ) THEN
        RAISE EXCEPTION 'invalid lot balance reservation for product %', v_item.product_id;
      END IF;

      IF COALESCE(v_product.requires_expiration, FALSE)
        AND EXISTS (
          SELECT 1
          FROM inventory_lot_balances balance
          INNER JOIN inventory_lots lot
            ON lot.id = balance.lot_id
           AND lot.tenant_id = balance.tenant_id
           AND lot.branch_id = balance.branch_id
           AND lot.product_id = balance.product_id
          WHERE balance.tenant_id = p_tenant_id
            AND balance.branch_id = p_branch_id
            AND balance.product_id = v_item.product_id
            AND balance.quantity_available > 0
            AND lot.status = 'ACTIVE'
            AND lot.expiration_date IS NULL
          LIMIT 1
        ) THEN
        RAISE EXCEPTION 'expiration date is required for lot-controlled product %', v_item.product_id;
      END IF;
    END IF;

    v_sale_item_id := gen_random_uuid();

    IF v_is_pos_pricing_snapshot THEN
      IF v_item.final_unit_price IS NULL OR v_item.final_unit_price < 0 THEN
        RAISE EXCEPTION 'final_unit_price is required for POS pricing snapshot and must be non-negative';
      END IF;

      IF v_item.line_total IS NULL OR v_item.line_total < 0 THEN
        RAISE EXCEPTION 'line_total is required for POS pricing snapshot and must be non-negative';
      END IF;

      IF v_item.price_without_tax IS NULL OR v_item.price_without_tax < 0 THEN
        RAISE EXCEPTION 'price_without_tax is required for POS pricing snapshot and must be non-negative';
      END IF;

      IF v_item.tax_base IS NULL OR v_item.tax_base < 0 THEN
        RAISE EXCEPTION 'tax_base is required for POS pricing snapshot and must be non-negative';
      END IF;

      IF v_item.pricing_calculated_at IS NULL THEN
        RAISE EXCEPTION 'pricing_calculated_at is required for POS pricing snapshot';
      END IF;

      IF v_item.pricing_snapshot IS NULL THEN
        RAISE EXCEPTION 'pricing_snapshot is required for POS pricing snapshot';
      END IF;

      v_final_unit_price := ROUND(v_item.final_unit_price, 2);
      v_base_unit_price := CASE
        WHEN v_item.base_unit_price IS NULL THEN NULL
        ELSE ROUND(v_item.base_unit_price, 2)
      END;
      v_price := v_final_unit_price;
      v_price_without_tax := ROUND(v_item.price_without_tax, 2);
      v_tax_amount := ROUND(COALESCE(v_item.tax_amount, v_item.tax_total, 0), 2);
      v_tax_total := v_tax_amount;
      v_tax_base := ROUND(v_item.tax_base, 2);
      v_subtotal := ROUND(v_item.line_total, 2);
      v_discount_amount := ROUND(COALESCE(v_item.discount_amount, 0), 2);
      v_discount_percent := ROUND(COALESCE(v_item.discount_percent, 0), 4);
      v_discount_total := ROUND(COALESCE(v_item.discount_total, 0), 2);
      v_applied_promotion_id := v_item.applied_promotion_id;
      v_applied_promotion_name := v_item.applied_promotion_name;
      v_pos_tax_id := v_item.tax_id;
      v_pos_tax_rate := ROUND(COALESCE(v_item.tax_rate, 0), 4);
      v_pricing_snapshot := v_item.pricing_snapshot;
      v_pricing_calculated_at := v_item.pricing_calculated_at;

      IF v_base_unit_price IS NOT NULL AND v_base_unit_price < 0 THEN
        RAISE EXCEPTION 'base_unit_price must be non-negative for POS pricing snapshot';
      END IF;

      IF v_discount_amount < 0 THEN
        RAISE EXCEPTION 'discount_amount must be non-negative for POS pricing snapshot';
      END IF;

      IF v_discount_percent < 0 OR v_discount_percent > 100 THEN
        RAISE EXCEPTION 'discount_percent must be between 0 and 100 for POS pricing snapshot';
      END IF;

      IF v_discount_total < 0 THEN
        RAISE EXCEPTION 'discount_total must be non-negative for POS pricing snapshot';
      END IF;

      IF v_tax_amount < 0 THEN
        RAISE EXCEPTION 'tax_amount must be non-negative for POS pricing snapshot';
      END IF;

      IF v_pos_tax_rate < 0 THEN
        RAISE EXCEPTION 'tax_rate must be non-negative for POS pricing snapshot';
      END IF;

      IF v_tax_amount > 0 AND v_pos_tax_id IS NULL THEN
        RAISE EXCEPTION 'tax_id is required when POS pricing snapshot tax_amount is positive';
      END IF;

      v_total := ROUND(v_total + v_subtotal, 2);

      INSERT INTO sale_items (
        id,
        tenant_id,
        sale_id,
        product_id,
        order_item_id,
        quantity,
        price,
        price_without_tax,
        tax_total,
        subtotal,
        base_unit_price,
        final_unit_price,
        discount_amount,
        discount_percent,
        discount_total,
        applied_promotion_id,
        applied_promotion_name,
        tax_base,
        tax_amount,
        line_total,
        pricing_snapshot,
        pricing_calculated_at,
        pricing_source,
        created_at
      ) VALUES (
        v_sale_item_id,
        p_tenant_id,
        v_sale_id,
        v_item.product_id,
        v_item.order_item_id,
        v_quantity,
        v_price,
        v_price_without_tax,
        v_tax_total,
        v_subtotal,
        v_base_unit_price,
        v_final_unit_price,
        v_discount_amount,
        v_discount_percent,
        v_discount_total,
        v_applied_promotion_id,
        v_applied_promotion_name,
        v_tax_base,
        v_tax_amount,
        v_subtotal,
        v_pricing_snapshot,
        v_pricing_calculated_at,
        'POS_PRICING_SERVICE',
        v_now
      );

      IF jsonb_typeof(v_item.taxes) = 'array' AND jsonb_array_length(v_item.taxes) > 0 THEN
        INSERT INTO sale_item_taxes (
          id,
          tenant_id,
          sale_item_id,
          tax_id,
          tax_name,
          tax_rate,
          tax_amount,
          is_included,
          created_at,
          tax_base,
          dian_code,
          tax_type_code,
          calculation_method_code
        )
        SELECT
          gen_random_uuid(),
          p_tenant_id,
          v_sale_item_id,
          tax_row.tax_id,
          COALESCE(NULLIF(BTRIM(tax_row.tax_name), ''), COALESCE(t.name, 'POS_PRICING_SERVICE_TAX')),
          ROUND(COALESCE(tax_row.tax_rate, 0), 4),
          ROUND(COALESCE(tax_row.tax_amount, 0), 2),
          COALESCE(tax_row.is_included, t.is_included, TRUE),
          v_now,
          ROUND(COALESCE(tax_row.tax_base, 0), 2),
          NULLIF(BTRIM(tax_row.dian_code), ''),
          NULLIF(BTRIM(tax_row.tax_type_code), ''),
          NULLIF(BTRIM(tax_row.calculation_method_code), '')
        FROM jsonb_to_recordset(v_item.taxes) AS tax_row(
          tax_id UUID,
          tax_name TEXT,
          tax_rate NUMERIC,
          tax_base NUMERIC,
          tax_amount NUMERIC,
          is_included BOOLEAN,
          dian_code TEXT,
          tax_type_code TEXT,
          calculation_method_code TEXT
        )
        LEFT JOIN taxes AS t
          ON t.id = tax_row.tax_id
         AND t.tenant_id = p_tenant_id
        WHERE tax_row.tax_id IS NOT NULL;
      ELSIF v_pos_tax_id IS NOT NULL THEN
        v_pos_tax_name := NULL;
        v_pos_tax_is_included := TRUE;

        SELECT
          t.name,
          COALESCE(t.is_included, TRUE)
        INTO
          v_pos_tax_name,
          v_pos_tax_is_included
        FROM taxes AS t
        WHERE t.id = v_pos_tax_id
          AND t.tenant_id = p_tenant_id
        LIMIT 1;

        IF NOT FOUND THEN
          RAISE EXCEPTION 'tax_id from POS pricing snapshot not found for tenant';
        END IF;

        INSERT INTO sale_item_taxes (
          id,
          tenant_id,
          sale_item_id,
          tax_id,
          tax_name,
          tax_rate,
          tax_amount,
          is_included,
          created_at,
          tax_base,
          dian_code,
          tax_type_code,
          calculation_method_code
        ) VALUES (
          gen_random_uuid(),
          p_tenant_id,
          v_sale_item_id,
          v_pos_tax_id,
          COALESCE(NULLIF(BTRIM(v_pos_tax_name), ''), 'POS_PRICING_SERVICE_TAX'),
          v_pos_tax_rate,
          v_tax_amount,
          COALESCE(v_pos_tax_is_included, TRUE),
          v_now,
          v_tax_base,
          NULL,
          NULL,
          NULL
        );
      END IF;
    ELSE
      v_price := ROUND(v_item.price, 2);
      v_tax_rate := COALESCE(v_product.tax_rate, 0);

      IF v_tax_rate > 0 THEN
        v_price_without_tax := ROUND(v_price / (1 + v_tax_rate), 2);
        v_tax_total := ROUND((v_price - v_price_without_tax) * v_quantity, 2);
      ELSE
        v_price_without_tax := v_price;
        v_tax_total := 0;
      END IF;

      v_subtotal := ROUND(v_price * v_quantity, 2);
      v_total := ROUND(v_total + v_subtotal, 2);

      INSERT INTO sale_items (
        id,
        tenant_id,
        sale_id,
        product_id,
        order_item_id,
        quantity,
        price,
        price_without_tax,
        tax_total,
        subtotal,
        created_at
      ) VALUES (
        v_sale_item_id,
        p_tenant_id,
        v_sale_id,
        v_item.product_id,
        v_item.order_item_id,
        v_quantity,
        v_price,
        v_price_without_tax,
        v_tax_total,
        v_subtotal,
        v_now
      );

      IF v_product.tax_id IS NOT NULL AND v_product.tax_name IS NOT NULL THEN
        INSERT INTO sale_item_taxes (
          id,
          tenant_id,
          sale_item_id,
          tax_id,
          tax_name,
          tax_rate,
          tax_amount,
          is_included,
          created_at,
          tax_base,
          dian_code,
          tax_type_code,
          calculation_method_code
        ) VALUES (
          gen_random_uuid(),
          p_tenant_id,
          v_sale_item_id,
          v_product.tax_id,
          v_product.tax_name,
          v_tax_rate,
          v_tax_total,
          COALESCE(v_product.tax_is_included, FALSE),
          v_now,
          ROUND(v_price_without_tax * v_quantity, 2),
          NULL,
          NULL,
          NULL
        );
      END IF;
    END IF;

    v_stock_before := COALESCE(v_available_stock, 0);

    INSERT INTO stock_movements (
      id,
      tenant_id,
      product_id,
      type,
      quantity,
      reference_type,
      reference_id,
      created_at,
      branch_id,
      terminal_id,
      pos_session_code,
      user_id,
      reference_table,
      stock_before,
      stock_after
    ) VALUES (
      gen_random_uuid(),
      p_tenant_id,
      v_item.product_id,
      'OUT',
      v_quantity,
      'SALE',
      v_sale_id,
      v_now,
      p_branch_id,
      p_terminal_id,
      p_pos_session_id::text,
      p_user_id,
      'sales',
      v_stock_before,
      ROUND(v_stock_before - v_quantity, 2)
    )
    RETURNING stock_movements.id INTO v_stock_movement_id;

    IF COALESCE(v_product.requires_lot, FALSE) THEN
      v_remaining_lot_quantity := v_quantity;

      FOR v_lot_balance IN
        SELECT
          balance.id AS balance_id,
          balance.lot_id,
          balance.location_id,
          balance.quantity_available,
          lot.lot_code,
          lot.expiration_date,
          lot.received_at
        FROM inventory_lot_balances balance
        INNER JOIN inventory_lots lot
          ON lot.id = balance.lot_id
         AND lot.tenant_id = balance.tenant_id
         AND lot.branch_id = balance.branch_id
         AND lot.product_id = balance.product_id
        WHERE balance.tenant_id = p_tenant_id
          AND balance.branch_id = p_branch_id
          AND balance.product_id = v_item.product_id
          AND balance.quantity_available > 0
          AND lot.status = 'ACTIVE'
          AND (
            lot.expiration_date IS NULL
            OR lot.expiration_date >= CURRENT_DATE
          )
          AND (
            COALESCE(v_product.requires_expiration, FALSE) = FALSE
            OR lot.expiration_date IS NOT NULL
          )
        ORDER BY
          lot.expiration_date ASC NULLS LAST,
          lot.received_at ASC,
          lot.lot_code ASC,
          lot.id ASC
        FOR UPDATE OF balance
      LOOP
        EXIT WHEN v_remaining_lot_quantity <= 0;

        v_quantity_from_lot := ROUND(
          LEAST(v_remaining_lot_quantity, v_lot_balance.quantity_available),
          2
        );

        IF v_quantity_from_lot <= 0 THEN
          CONTINUE;
        END IF;

        UPDATE inventory_lot_balances AS ilb
        SET
          quantity_on_hand = ilb.quantity_on_hand - v_quantity_from_lot,
          last_movement_at = v_now,
          updated_at = v_now
        WHERE ilb.id = v_lot_balance.balance_id
          AND ilb.tenant_id = p_tenant_id
          AND ilb.branch_id = p_branch_id
          AND ilb.product_id = v_item.product_id
          AND ilb.lot_id = v_lot_balance.lot_id
          AND ilb.quantity_available >= v_quantity_from_lot;

        IF NOT FOUND THEN
          RAISE EXCEPTION 'insufficient FEFO lot stock for product %', v_item.product_id;
        END IF;

        INSERT INTO stock_movement_lots (
          id,
          tenant_id,
          stock_movement_id,
          product_id,
          lot_id,
          location_id,
          quantity,
          created_at
        ) VALUES (
          gen_random_uuid(),
          p_tenant_id,
          v_stock_movement_id,
          v_item.product_id,
          v_lot_balance.lot_id,
          v_lot_balance.location_id,
          v_quantity_from_lot,
          v_now
        );

        v_remaining_lot_quantity := ROUND(
          v_remaining_lot_quantity - v_quantity_from_lot,
          2
        );
      END LOOP;

      IF v_remaining_lot_quantity > 0 THEN
        RAISE EXCEPTION 'insufficient FEFO lot stock for product %', v_item.product_id;
      END IF;
    END IF;

    IF v_item.order_item_id IS NOT NULL THEN
      UPDATE order_items AS oi_update
      SET
        delivered_quantity = oi_update.delivered_quantity + v_quantity,
        billed_quantity = COALESCE(oi_update.billed_quantity, 0) + v_quantity
      WHERE oi_update.id = v_item.order_item_id
        AND oi_update.order_id = p_order_id;
    END IF;
  END LOOP;

  FOR v_payment_method IN
    SELECT
      payment.payment_method::VARCHAR(20) AS payment_method,
      payment.amount::NUMERIC(12, 2) AS amount,
      NULLIF(BTRIM(payment.reference), '') AS reference
    FROM jsonb_to_recordset(COALESCE(p_payment_methods, '[]'::JSONB)) AS payment(
      payment_method TEXT,
      amount NUMERIC,
      reference TEXT
    )
  LOOP
    IF v_payment_method.payment_method NOT IN ('CASH', 'CARD', 'TRANSFER', 'OTHER') THEN
      RAISE EXCEPTION 'paymentMethod is invalid';
    END IF;

    IF v_payment_method.amount IS NULL OR v_payment_method.amount <= 0 THEN
      RAISE EXCEPTION 'amount must be a positive number';
    END IF;

    v_payment_total := ROUND(v_payment_total + ROUND(v_payment_method.amount, 2), 2);

    INSERT INTO sale_payment_methods (
      id,
      tenant_id,
      sale_id,
      payment_method,
      amount,
      reference,
      created_at
    ) VALUES (
      gen_random_uuid(),
      p_tenant_id,
      v_sale_id,
      v_payment_method.payment_method,
      ROUND(v_payment_method.amount, 2),
      v_payment_method.reference,
      v_now
    );
  END LOOP;

  IF p_type = 'CASH' THEN
    IF COALESCE(jsonb_array_length(COALESCE(p_payment_methods, '[]'::JSONB)), 0) = 0 THEN
      RAISE EXCEPTION 'payment methods are required for cash sales';
    END IF;

    IF v_payment_total <> v_total THEN
      RAISE EXCEPTION 'payment methods total must equal sale total for cash sales';
    END IF;

    v_balance := 0;
    v_total_paid := v_total;
  ELSE
    v_total_paid := LEAST(v_total, v_payment_total);
    v_balance := GREATEST(v_total - v_total_paid, 0);
  END IF;

  IF v_balance < 0 THEN
    RAISE EXCEPTION 'balance cannot be negative';
  END IF;

  v_balance_due := v_balance;

  UPDATE sales AS s
  SET
    total = v_total,
    balance = v_balance,
    total_paid = v_total_paid,
    balance_due = v_balance_due,
    payment_status = CASE
      WHEN v_total_paid <= 0 THEN 'PENDING'
      WHEN v_total_paid < v_total THEN 'PARTIAL'
      WHEN v_total_paid = v_total THEN 'PAID'
      ELSE 'OVERPAID'
    END
  WHERE s.id = v_sale_id
    AND s.tenant_id = p_tenant_id;

  IF p_order_id IS NOT NULL THEN
    SELECT
      COUNT(*)::INTEGER,
      COUNT(*) FILTER (WHERE oi.delivered_quantity = 0)::INTEGER,
      COUNT(*) FILTER (WHERE oi.delivered_quantity >= oi.ordered_quantity)::INTEGER
    INTO
      v_order_items_total,
      v_order_items_zero_delivered,
      v_order_items_completed
    FROM order_items oi
    WHERE oi.order_id = p_order_id;

    UPDATE orders AS o_update
    SET status = CASE
      WHEN v_order_items_total = 0 THEN 'CONFIRMED'
      WHEN v_order_items_zero_delivered = v_order_items_total THEN 'CONFIRMED'
      WHEN v_order_items_completed = v_order_items_total THEN 'COMPLETED'
      ELSE 'PARTIAL'
    END
    WHERE o_update.id = p_order_id
      AND o_update.tenant_id = p_tenant_id;
  END IF;

  RETURN QUERY
  SELECT
    s.id,
    s.tenant_id,
    s.customer_id,
    s.order_id,
    s.type,
    s.status,
    s.total,
    s.balance,
    s.created_at
  FROM sales s
  WHERE s.id = v_sale_id
    AND s.tenant_id = p_tenant_id;
END;
$$;

-- <<< END SECTION: migrations/V078__sale_item_taxes_multi_tax_snapshot.sql

-- >>> BEGIN SECTION: migrations/V079__tax_model_prc_fnc_routines.sql
-- V079 tax model prc_/fnc_ routines (VPS)
-- Encapsulates multi-tax fiscal SQL so Nest/reporteria do not run
-- direct INSERT/UPDATE/DELETE/SELECT against tax tables.
-- PostgreSQL 16+
-- Depends on: V077 (tax dictionaries), V078 (sale_item_taxes cols, order_item_taxes)

-- ---------------------------------------------------------------------------
-- Mutations (prc_*)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.prc_replace_order_item_taxes(
  p_tenant_id UUID,
  p_order_id UUID,
  p_taxes JSONB DEFAULT '[]'::JSONB
)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
  v_tax JSONB;
BEGIN
  DELETE FROM public.order_item_taxes
  WHERE tenant_id = p_tenant_id
    AND order_item_id IN (
      SELECT id
      FROM public.order_items
      WHERE order_id = p_order_id
    );

  IF p_taxes IS NULL OR jsonb_typeof(p_taxes) <> 'array' THEN
    RETURN TRUE;
  END IF;

  FOR v_tax IN
    SELECT value
    FROM jsonb_array_elements(p_taxes)
  LOOP
    INSERT INTO public.order_item_taxes (
      id,
      tenant_id,
      order_item_id,
      tax_id,
      tax_name,
      tax_rate,
      tax_base,
      tax_amount,
      dian_code,
      tax_type_code,
      calculation_method_code,
      calculation_order,
      is_included,
      created_at
    ) VALUES (
      gen_random_uuid(),
      p_tenant_id,
      (v_tax ->> 'order_item_id')::UUID,
      (v_tax ->> 'tax_id')::UUID,
      COALESCE(NULLIF(BTRIM(v_tax ->> 'tax_name'), ''), 'TAX'),
      COALESCE((v_tax ->> 'tax_rate')::NUMERIC, 0),
      COALESCE((v_tax ->> 'tax_base')::NUMERIC, 0),
      COALESCE((v_tax ->> 'tax_amount')::NUMERIC, 0),
      NULLIF(BTRIM(v_tax ->> 'dian_code'), ''),
      NULLIF(BTRIM(v_tax ->> 'tax_type_code'), ''),
      NULLIF(BTRIM(v_tax ->> 'calculation_method_code'), ''),
      COALESCE((v_tax ->> 'calculation_order')::SMALLINT, 100),
      COALESCE((v_tax ->> 'is_included')::BOOLEAN, FALSE),
      NOW()
    );
  END LOOP;

  RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION public.prc_sync_sale_item_taxes_from_order(
  p_tenant_id UUID,
  p_sale_id UUID,
  p_order_id UUID DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
  v_sale_item RECORD;
  v_order_tax RECORD;
  v_ordered_qty NUMERIC(14, 4);
  v_sale_qty NUMERIC(14, 4);
  v_ratio NUMERIC(18, 8);
  v_remaining_base NUMERIC(14, 2);
  v_remaining_amount NUMERIC(14, 2);
  v_prorated_base NUMERIC(14, 2);
  v_prorated_amount NUMERIC(14, 2);
  v_tax_count INT;
  v_tax_index INT;
BEGIN
  FOR v_sale_item IN
    SELECT
      si.id,
      si.order_item_id,
      si.quantity,
      si.tax_base,
      si.tax_amount
    FROM public.sale_items AS si
    WHERE si.sale_id = p_sale_id
      AND si.tenant_id = p_tenant_id
      AND si.order_item_id IS NOT NULL
    ORDER BY si.created_at ASC, si.id ASC
  LOOP
    SELECT COUNT(*)::INT
    INTO v_tax_count
    FROM public.order_item_taxes
    WHERE tenant_id = p_tenant_id
      AND order_item_id = v_sale_item.order_item_id;

    IF v_tax_count = 0 THEN
      CONTINUE;
    END IF;

    SELECT oi.ordered_quantity
    INTO v_ordered_qty
    FROM public.order_items AS oi
    WHERE oi.id = v_sale_item.order_item_id;

    IF v_ordered_qty IS NULL OR v_ordered_qty <= 0 THEN
      CONTINUE;
    END IF;

    DELETE FROM public.sale_item_taxes
    WHERE tenant_id = p_tenant_id
      AND sale_item_id = v_sale_item.id;

    v_sale_qty := COALESCE(v_sale_item.quantity, 0);
    v_ratio := v_sale_qty / v_ordered_qty;
    v_remaining_base := ROUND(COALESCE(v_sale_item.tax_base, 0), 2);
    v_remaining_amount := ROUND(COALESCE(v_sale_item.tax_amount, 0), 2);
    v_tax_index := 0;

    FOR v_order_tax IN
      SELECT
        tax_id,
        tax_name,
        tax_rate,
        tax_base,
        tax_amount,
        is_included,
        dian_code,
        tax_type_code,
        calculation_method_code
      FROM public.order_item_taxes
      WHERE tenant_id = p_tenant_id
        AND order_item_id = v_sale_item.order_item_id
      ORDER BY calculation_order ASC, created_at ASC, id ASC
    LOOP
      v_tax_index := v_tax_index + 1;
      IF v_tax_index = v_tax_count THEN
        v_prorated_base := v_remaining_base;
        v_prorated_amount := v_remaining_amount;
      ELSE
        v_prorated_base := ROUND(COALESCE(v_order_tax.tax_base, 0) * v_ratio, 2);
        v_prorated_amount := ROUND(COALESCE(v_order_tax.tax_amount, 0) * v_ratio, 2);
      END IF;

      v_remaining_base := ROUND(v_remaining_base - v_prorated_base, 2);
      v_remaining_amount := ROUND(v_remaining_amount - v_prorated_amount, 2);

      INSERT INTO public.sale_item_taxes (
        id,
        tenant_id,
        sale_item_id,
        tax_id,
        tax_name,
        tax_rate,
        tax_amount,
        is_included,
        created_at,
        tax_base,
        dian_code,
        tax_type_code,
        calculation_method_code
      ) VALUES (
        gen_random_uuid(),
        p_tenant_id,
        v_sale_item.id,
        v_order_tax.tax_id,
        v_order_tax.tax_name,
        v_order_tax.tax_rate,
        GREATEST(v_prorated_amount, 0),
        COALESCE(v_order_tax.is_included, FALSE),
        NOW(),
        GREATEST(v_prorated_base, 0),
        v_order_tax.dian_code,
        v_order_tax.tax_type_code,
        v_order_tax.calculation_method_code
      );
    END LOOP;
  END LOOP;

  RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION public.prc_replace_product_taxes(
  p_tenant_id UUID,
  p_product_id UUID,
  p_taxes JSONB DEFAULT '[]'::JSONB
)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
  v_tax JSONB;
BEGIN
  DELETE FROM public.product_taxes
  WHERE tenant_id = p_tenant_id
    AND product_id = p_product_id;

  IF p_taxes IS NULL OR jsonb_typeof(p_taxes) <> 'array' THEN
    RETURN TRUE;
  END IF;

  FOR v_tax IN
    SELECT value
    FROM jsonb_array_elements(p_taxes)
  LOOP
    INSERT INTO public.product_taxes (
      tenant_id,
      product_id,
      tax_id,
      calculation_order,
      is_active
    ) VALUES (
      p_tenant_id,
      p_product_id,
      (v_tax ->> 'tax_id')::UUID,
      COALESCE((v_tax ->> 'calculation_order')::SMALLINT, 100),
      TRUE
    );
  END LOOP;

  RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION public.prc_upsert_product_tax_profile(
  p_tenant_id UUID,
  p_product_id UUID,
  p_profile JSONB
)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.product_tax_profiles (
    tenant_id,
    product_id,
    tax_product_category_id,
    alcohol_degree,
    net_volume_ml,
    dane_certified_retail_price,
    dane_price_effective_from,
    dane_price_effective_to
  ) VALUES (
    p_tenant_id,
    p_product_id,
    (p_profile ->> 'tax_product_category_id')::UUID,
    NULLIF(p_profile ->> 'alcohol_degree', '')::NUMERIC,
    NULLIF(p_profile ->> 'net_volume_ml', '')::NUMERIC,
    NULLIF(p_profile ->> 'dane_certified_retail_price', '')::NUMERIC,
    NULLIF(p_profile ->> 'dane_price_effective_from', '')::DATE,
    NULLIF(p_profile ->> 'dane_price_effective_to', '')::DATE
  )
  ON CONFLICT (tenant_id, product_id) DO UPDATE
  SET
    tax_product_category_id = EXCLUDED.tax_product_category_id,
    alcohol_degree = EXCLUDED.alcohol_degree,
    net_volume_ml = EXCLUDED.net_volume_ml,
    dane_certified_retail_price = EXCLUDED.dane_certified_retail_price,
    dane_price_effective_from = EXCLUDED.dane_price_effective_from,
    dane_price_effective_to = EXCLUDED.dane_price_effective_to,
    updated_at = now();

  RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION public.prc_delete_product_tax_profile(
  p_tenant_id UUID,
  p_product_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
BEGIN
  DELETE FROM public.product_tax_profiles
  WHERE tenant_id = p_tenant_id
    AND product_id = p_product_id;
  RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION public.prc_upsert_tax_rate(
  p_tenant_id UUID,
  p_tax_id UUID,
  p_calculation_method_id UUID,
  p_tax_base_type_id UUID,
  p_effective_from DATE,
  p_tax_product_category_id UUID DEFAULT NULL,
  p_percentage_rate NUMERIC DEFAULT NULL,
  p_fixed_amount NUMERIC DEFAULT NULL,
  p_base_quantity NUMERIC DEFAULT NULL,
  p_base_unit_code VARCHAR DEFAULT NULL,
  p_effective_to DATE DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.tax_rates (
    tenant_id,
    tax_id,
    tax_product_category_id,
    calculation_method_id,
    tax_base_type_id,
    percentage_rate,
    fixed_amount,
    base_quantity,
    base_unit_code,
    effective_from,
    effective_to,
    is_active
  ) VALUES (
    p_tenant_id,
    p_tax_id,
    p_tax_product_category_id,
    p_calculation_method_id,
    p_tax_base_type_id,
    p_percentage_rate,
    p_fixed_amount,
    p_base_quantity,
    p_base_unit_code,
    p_effective_from,
    p_effective_to,
    TRUE
  )
  ON CONFLICT ON CONSTRAINT uq_tax_rates_scope DO UPDATE
  SET
    calculation_method_id = EXCLUDED.calculation_method_id,
    tax_base_type_id = EXCLUDED.tax_base_type_id,
    percentage_rate = EXCLUDED.percentage_rate,
    fixed_amount = EXCLUDED.fixed_amount,
    base_quantity = EXCLUDED.base_quantity,
    base_unit_code = EXCLUDED.base_unit_code,
    effective_to = EXCLUDED.effective_to,
    is_active = TRUE,
    updated_at = now();

  RETURN TRUE;
END;
$$;

-- ---------------------------------------------------------------------------
-- Reads (fnc_*)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.fnc_list_sale_item_taxes(
  p_tenant_id UUID,
  p_sale_id UUID
)
RETURNS TABLE (
  id UUID,
  tenant_id UUID,
  sale_item_id UUID,
  tax_id UUID,
  tax_name VARCHAR,
  tax_rate NUMERIC,
  tax_base NUMERIC,
  tax_amount NUMERIC,
  is_included BOOLEAN,
  dian_code VARCHAR,
  tax_type_code VARCHAR,
  calculation_method_code VARCHAR,
  created_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    sit.id,
    sit.tenant_id,
    sit.sale_item_id,
    sit.tax_id,
    sit.tax_name,
    sit.tax_rate,
    sit.tax_base,
    sit.tax_amount,
    sit.is_included,
    sit.dian_code,
    sit.tax_type_code,
    sit.calculation_method_code,
    sit.created_at
  FROM public.sale_item_taxes AS sit
  WHERE sit.tenant_id = p_tenant_id
    AND sit.sale_item_id IN (
      SELECT si.id
      FROM public.sale_items AS si
      WHERE si.sale_id = p_sale_id
        AND si.tenant_id = p_tenant_id
    )
  ORDER BY sit.sale_item_id ASC, sit.created_at ASC, sit.id ASC;
$$;

CREATE OR REPLACE FUNCTION public.fnc_list_order_item_taxes(
  p_tenant_id UUID,
  p_order_id UUID
)
RETURNS TABLE (
  order_item_id UUID,
  tax_id UUID,
  tax_name VARCHAR,
  tax_rate NUMERIC,
  tax_base NUMERIC,
  tax_amount NUMERIC,
  is_included BOOLEAN,
  dian_code VARCHAR,
  tax_type_code VARCHAR,
  calculation_method_code VARCHAR,
  calculation_order SMALLINT,
  created_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    oit.order_item_id,
    oit.tax_id,
    oit.tax_name,
    oit.tax_rate,
    oit.tax_base,
    oit.tax_amount,
    oit.is_included,
    oit.dian_code,
    oit.tax_type_code,
    oit.calculation_method_code,
    oit.calculation_order,
    oit.created_at
  FROM public.order_item_taxes AS oit
  WHERE oit.tenant_id = p_tenant_id
    AND oit.order_item_id IN (
      SELECT oi.id
      FROM public.order_items AS oi
      WHERE oi.order_id = p_order_id
    )
  ORDER BY oit.order_item_id ASC, oit.calculation_order ASC, oit.created_at ASC, oit.id ASC;
$$;

CREATE OR REPLACE FUNCTION public.fnc_list_product_taxes(
  p_tenant_id UUID,
  p_product_id UUID
)
RETURNS TABLE (
  id UUID,
  tax_id UUID,
  calculation_order SMALLINT,
  is_active BOOLEAN,
  tax_name VARCHAR,
  tax_rate NUMERIC,
  is_included BOOLEAN,
  calculation_method_code VARCHAR,
  tax_type_code VARCHAR,
  tax_type_dian_code VARCHAR
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    pt.id,
    pt.tax_id,
    pt.calculation_order,
    pt.is_active,
    t.name AS tax_name,
    t.rate AS tax_rate,
    t.is_included,
    cm.code AS calculation_method_code,
    tt.code AS tax_type_code,
    tt.dian_code AS tax_type_dian_code
  FROM public.product_taxes AS pt
  LEFT JOIN public.taxes AS t
    ON t.id = pt.tax_id
   AND t.tenant_id = pt.tenant_id
  LEFT JOIN public.tax_calculation_methods AS cm
    ON cm.id = t.calculation_method_id
  LEFT JOIN public.tax_types AS tt
    ON tt.id = t.tax_type_id
  WHERE pt.tenant_id = p_tenant_id
    AND pt.product_id = p_product_id
  ORDER BY pt.calculation_order ASC, pt.created_at ASC;
$$;

CREATE OR REPLACE FUNCTION public.fnc_get_product_tax_profile(
  p_tenant_id UUID,
  p_product_id UUID
)
RETURNS TABLE (
  tax_product_category_id UUID,
  tax_product_category_code VARCHAR,
  is_alcoholic_beverage BOOLEAN,
  alcohol_degree NUMERIC,
  net_volume_ml NUMERIC,
  dane_certified_retail_price NUMERIC,
  dane_price_effective_from DATE,
  dane_price_effective_to DATE
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    ptp.tax_product_category_id,
    tpc.code AS tax_product_category_code,
    tpc.is_alcoholic_beverage,
    ptp.alcohol_degree,
    ptp.net_volume_ml,
    ptp.dane_certified_retail_price,
    ptp.dane_price_effective_from,
    ptp.dane_price_effective_to
  FROM public.product_tax_profiles AS ptp
  JOIN public.tax_product_categories AS tpc
    ON tpc.id = ptp.tax_product_category_id
  WHERE ptp.tenant_id = p_tenant_id
    AND ptp.product_id = p_product_id
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.fnc_list_product_taxes_for_pricing(
  p_tenant_id UUID,
  p_product_id UUID,
  p_as_of DATE
)
RETURNS TABLE (
  tax_id UUID,
  tax_name VARCHAR,
  dian_code VARCHAR,
  tax_type_code VARCHAR,
  calculation_method_code VARCHAR,
  tax_base_type_code VARCHAR,
  calculation_order SMALLINT,
  is_included BOOLEAN,
  tax_rate NUMERIC,
  percentage_rate NUMERIC,
  fixed_amount NUMERIC,
  base_quantity NUMERIC,
  base_unit_code VARCHAR
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    pt.tax_id,
    t.name AS tax_name,
    tt.dian_code,
    tt.code AS tax_type_code,
    cm.code AS calculation_method_code,
    bt.code AS tax_base_type_code,
    pt.calculation_order,
    COALESCE(t.is_included, FALSE) AS is_included,
    COALESCE(t.rate, 0) AS tax_rate,
    tr.percentage_rate,
    tr.fixed_amount,
    tr.base_quantity,
    tr.base_unit_code
  FROM public.product_taxes AS pt
  LEFT JOIN public.taxes AS t
    ON t.id = pt.tax_id
   AND t.tenant_id = pt.tenant_id
  LEFT JOIN public.tax_types AS tt
    ON tt.id = t.tax_type_id
  LEFT JOIN public.tax_calculation_methods AS cm
    ON cm.id = t.calculation_method_id
  LEFT JOIN public.tax_base_types AS bt
    ON bt.id = t.tax_base_type_id
  LEFT JOIN public.product_tax_profiles AS ptp
    ON ptp.tenant_id = pt.tenant_id
   AND ptp.product_id = pt.product_id
  LEFT JOIN LATERAL (
    SELECT
      tr_inner.percentage_rate,
      tr_inner.fixed_amount,
      tr_inner.base_quantity,
      tr_inner.base_unit_code
    FROM public.tax_rates AS tr_inner
    WHERE tr_inner.tenant_id = pt.tenant_id
      AND tr_inner.tax_id = pt.tax_id
      AND (
        tr_inner.tax_product_category_id = ptp.tax_product_category_id
        OR tr_inner.tax_product_category_id IS NULL
      )
      AND tr_inner.effective_from <= p_as_of
      AND (tr_inner.effective_to IS NULL OR tr_inner.effective_to >= p_as_of)
      AND tr_inner.is_active = TRUE
    ORDER BY
      CASE
        WHEN tr_inner.tax_product_category_id = ptp.tax_product_category_id THEN 0
        ELSE 1
      END ASC,
      tr_inner.effective_from DESC,
      tr_inner.effective_to DESC NULLS LAST
    LIMIT 1
  ) AS tr ON TRUE
  WHERE pt.tenant_id = p_tenant_id
    AND pt.product_id = p_product_id
    AND pt.is_active = TRUE
  ORDER BY pt.calculation_order ASC, pt.created_at ASC;
$$;

CREATE OR REPLACE FUNCTION public.fnc_list_tax_catalogs()
RETURNS JSONB
LANGUAGE sql
STABLE
AS $$
  SELECT jsonb_build_object(
    'taxTypes',
    COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', tt.id,
          'code', tt.code,
          'name', tt.name,
          'isActive', tt.is_active,
          'dianCode', tt.dian_code,
          'taxCategoryId', tt.tax_category_id
        )
        ORDER BY tt.code ASC
      )
      FROM public.tax_types AS tt
      WHERE tt.is_active = TRUE
    ), '[]'::JSONB),
    'calculationMethods',
    COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', cm.id,
          'code', cm.code,
          'name', cm.name,
          'isActive', cm.is_active
        )
        ORDER BY cm.code ASC
      )
      FROM public.tax_calculation_methods AS cm
      WHERE cm.is_active = TRUE
    ), '[]'::JSONB),
    'baseTypes',
    COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', bt.id,
          'code', bt.code,
          'name', bt.name,
          'isActive', bt.is_active
        )
        ORDER BY bt.code ASC
      )
      FROM public.tax_base_types AS bt
      WHERE bt.is_active = TRUE
    ), '[]'::JSONB),
    'productCategories',
    COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', pc.id,
          'code', pc.code,
          'name', pc.name,
          'isActive', pc.is_active,
          'isAlcoholicBeverage', pc.is_alcoholic_beverage
        )
        ORDER BY pc.code ASC
      )
      FROM public.tax_product_categories AS pc
      WHERE pc.is_active = TRUE
    ), '[]'::JSONB)
  );
$$;

CREATE OR REPLACE FUNCTION public.fnc_report_pos_sale_tax_breakdown(
  p_tenant_id UUID,
  p_sale_id UUID,
  p_role TEXT DEFAULT NULL,
  p_branch_id UUID DEFAULT NULL
)
RETURNS TABLE (
  label TEXT,
  "dianCode" TEXT,
  "taxTypeCode" TEXT,
  "taxBase" NUMERIC,
  "taxAmount" NUMERIC
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    COALESCE(NULLIF(BTRIM(taxes.tax_name), ''), 'Impuesto') AS label,
    COALESCE(taxes.dian_code, '') AS "dianCode",
    COALESCE(taxes.tax_type_code, '') AS "taxTypeCode",
    SUM(COALESCE(taxes.tax_base, 0)) AS "taxBase",
    SUM(COALESCE(taxes.tax_amount, 0)) AS "taxAmount"
  FROM public.sale_item_taxes AS taxes
  INNER JOIN public.sale_items AS items
          ON items.id = taxes.sale_item_id
         AND items.tenant_id = taxes.tenant_id
  INNER JOIN public.sales AS sale
          ON sale.id = items.sale_id
         AND sale.tenant_id = items.tenant_id
  WHERE sale.id = p_sale_id
    AND sale.tenant_id = p_tenant_id
    AND (
      COALESCE(p_role, '') = 'SUPER_ADMIN'
      OR p_branch_id IS NULL
      OR sale.branch_id = p_branch_id
    )
  GROUP BY
    COALESCE(taxes.tax_type_code, ''),
    COALESCE(NULLIF(BTRIM(taxes.tax_name), ''), 'Impuesto'),
    COALESCE(taxes.dian_code, '')
  ORDER BY
    COALESCE(NULLIF(BTRIM(taxes.tax_name), ''), 'Impuesto') ASC,
    COALESCE(taxes.dian_code, '') ASC,
    COALESCE(taxes.tax_type_code, '') ASC;
$$;

DO $grant$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'manus_user') THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.prc_replace_order_item_taxes(UUID, UUID, JSONB) TO manus_user';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.prc_sync_sale_item_taxes_from_order(UUID, UUID, UUID) TO manus_user';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.prc_replace_product_taxes(UUID, UUID, JSONB) TO manus_user';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.prc_upsert_product_tax_profile(UUID, UUID, JSONB) TO manus_user';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.prc_delete_product_tax_profile(UUID, UUID) TO manus_user';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.prc_upsert_tax_rate(UUID, UUID, UUID, UUID, DATE, UUID, NUMERIC, NUMERIC, NUMERIC, VARCHAR, DATE) TO manus_user';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.fnc_list_sale_item_taxes(UUID, UUID) TO manus_user';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.fnc_list_order_item_taxes(UUID, UUID) TO manus_user';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.fnc_list_product_taxes(UUID, UUID) TO manus_user';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.fnc_get_product_tax_profile(UUID, UUID) TO manus_user';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.fnc_list_product_taxes_for_pricing(UUID, UUID, DATE) TO manus_user';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.fnc_list_tax_catalogs() TO manus_user';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.fnc_report_pos_sale_tax_breakdown(UUID, UUID, TEXT, UUID) TO manus_user';
  END IF;
END
$grant$;
-- <<< END SECTION: migrations/V079__tax_model_prc_fnc_routines.sql

-- >>> BEGIN SECTION: migrations/V080__tax_dictionaries_es_names.sql
-- V080 Spanish display names for tax dictionaries (codes/dian_code unchanged).
-- Idempotent. Safe for VPS via migrate_prd.sh.

UPDATE public.tax_categories SET name = 'IVA', is_active = true WHERE code = 'VAT';
UPDATE public.tax_categories SET name = 'Impuesto al consumo', is_active = true WHERE code = 'CONSUMPTION';

UPDATE public.tax_types SET name = 'IVA', is_active = true WHERE code = 'VAT';
UPDATE public.tax_types SET name = 'Impuesto nacional al consumo', is_active = true WHERE code = 'NATIONAL_CONSUMPTION';
UPDATE public.tax_types SET name = 'Impuesto al consumo de cervezas y refajos', is_active = true WHERE code = 'BEER_CONSUMPTION';
UPDATE public.tax_types SET name = 'Impuesto al consumo de licores', is_active = true WHERE code = 'LIQUOR_CONSUMPTION';
UPDATE public.tax_types SET name = 'Impuesto ad valórem', is_active = true WHERE code = 'AD_VALOREM';

-- Tenant tax display name (POS / ticket / FE breakdown).
UPDATE public.taxes t
SET name = 'Impuesto ad valórem'
FROM public.tax_types tt
WHERE t.tax_type_id = tt.id
  AND tt.code = 'AD_VALOREM'
  AND UPPER(BTRIM(t.name)) IN (UPPER('Ad valórem'), UPPER('Impuesto ad valórem'), 'AD_VALOREM');

UPDATE public.tax_calculation_methods SET name = 'Porcentaje', is_active = true WHERE code = 'PERCENTAGE';
UPDATE public.tax_calculation_methods SET name = 'Valor fijo', is_active = true WHERE code = 'FIXED_AMOUNT';
UPDATE public.tax_calculation_methods SET name = 'Por grado alcoholímetro y volumen', is_active = true WHERE code = 'PER_ALCOHOL_DEGREE_VOLUME';

UPDATE public.tax_base_types SET name = 'Precio de venta', is_active = true WHERE code = 'SALE_PRICE';
UPDATE public.tax_base_types SET name = 'Precio de venta sin consumo', is_active = true WHERE code = 'SALE_PRICE_EXCLUDING_CONSUMPTION';
UPDATE public.tax_base_types SET name = 'Precio certificado DANE', is_active = true WHERE code = 'DANE_CERTIFIED_RETAIL_PRICE';
UPDATE public.tax_base_types SET name = 'Grado alcoholímetro y volumen', is_active = true WHERE code = 'ALCOHOL_DEGREE_VOLUME';
UPDATE public.tax_base_types SET name = 'Precio minorista sin consumo', is_active = true WHERE code = 'RETAILER_PRICE_EXCLUDING_CONSUMPTION';
UPDATE public.tax_base_types SET name = 'Valor en aduana con margen', is_active = true WHERE code = 'CUSTOMS_VALUE_WITH_MARGIN';

UPDATE public.tax_product_categories SET name = 'Producto general', is_active = true WHERE code = 'GENERAL';
UPDATE public.tax_product_categories SET name = 'Licor destilado', is_active = true WHERE code = 'DISTILLED_LIQUOR';
UPDATE public.tax_product_categories SET name = 'Aperitivo de licor', is_active = true WHERE code = 'LIQUOR_APERITIF';
UPDATE public.tax_product_categories SET name = 'Vino', is_active = true WHERE code = 'WINE';
UPDATE public.tax_product_categories SET name = 'Aperitivo de vino', is_active = true WHERE code = 'WINE_APERITIF';
UPDATE public.tax_product_categories SET name = 'Cerveza', is_active = true WHERE code = 'BEER';
UPDATE public.tax_product_categories SET name = 'Sifón', is_active = true WHERE code = 'SIPHON';
UPDATE public.tax_product_categories SET name = 'Refajo / mezcla de cerveza', is_active = true WHERE code = 'BEER_MIXTURE';
-- <<< END SECTION: migrations/V080__tax_dictionaries_es_names.sql

-- >>> BEGIN SECTION: products/2026_09_12_seed_inventory_taxes_and_tax_model.sql
-- VPS/local idempotent seed: base taxes + tax-model catalog rates (post V077).
-- Safe to re-run. Requires tenants table. Tax dictionaries come from V077 migration.

WITH default_tenant AS (
  SELECT id
  FROM tenants
  WHERE id = '00000000-0000-0000-0000-000000000001'
     OR slug = 'default'
  ORDER BY CASE WHEN id = '00000000-0000-0000-0000-000000000001' THEN 0 ELSE 1 END
  LIMIT 1
)
INSERT INTO taxes (id, tenant_id, name, rate, is_included, is_active)
SELECT seed.id, tenant.id, seed.name, seed.rate, seed.is_included, true
FROM default_tenant tenant
CROSS JOIN (
  VALUES
    ('20000000-0000-0000-0000-000000000001'::uuid, 'IVA 19%', 0.19::numeric, TRUE),
    ('20000000-0000-0000-0000-000000000002'::uuid, 'Exento', 0::numeric, FALSE)
) AS seed(id, name, rate, is_included)
WHERE NOT EXISTS (
  SELECT 1
  FROM taxes t
  WHERE t.tenant_id = tenant.id
    AND (
      t.id = seed.id
      OR UPPER(BTRIM(t.name)) = UPPER(BTRIM(seed.name))
    )
);

-- Classify existing percentage taxes when V077 columns exist.
DO $seed$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'taxes'
      AND column_name = 'tax_type_id'
  ) AND to_regclass('public.tax_types') IS NOT NULL THEN
    UPDATE public.taxes
    SET tax_type_id = COALESCE(tax_type_id, '11000000-0000-0000-0000-000000000001'),
        calculation_method_id = COALESCE(calculation_method_id, '12000000-0000-0000-0000-000000000001'),
        tax_base_type_id = COALESCE(tax_base_type_id, '13000000-0000-0000-0000-000000000001')
    WHERE (
      rate = 0.19
      OR UPPER(BTRIM(name)) LIKE '%IVA%19%'
      OR UPPER(BTRIM(name)) IN ('IVA', 'IVA 19%', 'EXENTO', 'EXENTA')
      OR rate = 0
    );
  END IF;
END
$seed$;

-- Per-tenant fiscal seeds when dictionaries exist (IVA 5%, beer, ICL, ADV).
DO $seed$
BEGIN
  IF to_regclass('public.tax_types') IS NULL
     OR to_regclass('public.tax_rates') IS NULL THEN
    RAISE NOTICE 'tax model dictionaries missing; skip extended fiscal seed';
    RETURN;
  END IF;

  WITH seed_defs AS (
    SELECT *
    FROM (
      VALUES
        ('IVA 5%'::character varying, 0.0500::numeric, true,
         '11000000-0000-0000-0000-000000000001'::uuid,
         '12000000-0000-0000-0000-000000000001'::uuid,
         '13000000-0000-0000-0000-000000000002'::uuid),
        ('Impuesto al consumo de cervezas y refajos'::character varying, 0.0000::numeric, true,
         '11000000-0000-0000-0000-000000000030'::uuid,
         '12000000-0000-0000-0000-000000000001'::uuid,
         '13000000-0000-0000-0000-000000000005'::uuid),
        ('Impuesto al consumo de licores'::character varying, 0.0000::numeric, true,
         '11000000-0000-0000-0000-000000000032'::uuid,
         '12000000-0000-0000-0000-000000000003'::uuid,
         '13000000-0000-0000-0000-000000000004'::uuid),
        ('Impuesto ad valórem'::character varying, 0.0000::numeric, true,
         '11000000-0000-0000-0000-000000000036'::uuid,
         '12000000-0000-0000-0000-000000000001'::uuid,
         '13000000-0000-0000-0000-000000000003'::uuid)
    ) AS defs(name, rate, is_included, tax_type_id, calculation_method_id, tax_base_type_id)
  ),
  inserted AS (
    INSERT INTO public.taxes
      (id, tenant_id, name, rate, is_included, is_active,
       tax_type_id, calculation_method_id, tax_base_type_id)
    SELECT
      gen_random_uuid(),
      tenant.id,
      seed.name,
      seed.rate,
      seed.is_included,
      true,
      seed.tax_type_id,
      seed.calculation_method_id,
      seed.tax_base_type_id
    FROM public.tenants AS tenant
    CROSS JOIN seed_defs AS seed
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.taxes AS existing
      WHERE existing.tenant_id = tenant.id
        AND (
          UPPER(BTRIM(existing.name)) = UPPER(BTRIM(seed.name))
          OR existing.tax_type_id = seed.tax_type_id
        )
    )
    RETURNING id, tenant_id, name, rate, calculation_method_id, tax_base_type_id
  )
  INSERT INTO public.tax_rates
    (tenant_id, tax_id, calculation_method_id, tax_base_type_id,
     percentage_rate, effective_from)
  SELECT inserted.tenant_id,
         inserted.id,
         inserted.calculation_method_id,
         inserted.tax_base_type_id,
         inserted.rate,
         DATE '2000-01-01'
  FROM inserted
  JOIN public.tax_calculation_methods AS method
    ON method.id = inserted.calculation_method_id
  WHERE method.code = 'PERCENTAGE'
  ON CONFLICT ON CONSTRAINT uq_tax_rates_scope DO NOTHING;

  -- ICL fixed amounts 2026
  INSERT INTO public.tax_rates
    (tenant_id, tax_id, tax_product_category_id, calculation_method_id,
     tax_base_type_id, fixed_amount, base_quantity, base_unit_code,
     effective_from, effective_to)
  SELECT tax.tenant_id, tax.id, product_category.id,
         tax.calculation_method_id, tax.tax_base_type_id,
         rule.fixed_amount, 750, 'ML', DATE '2026-01-01', DATE '2026-12-31'
  FROM public.taxes AS tax
  JOIN public.tax_types AS tax_type
    ON tax_type.id = tax.tax_type_id
   AND tax_type.code = 'LIQUOR_CONSUMPTION'
  CROSS JOIN (
    VALUES
      ('16000000-0000-0000-0000-000000000010'::uuid, 360.0000::numeric),
      ('16000000-0000-0000-0000-000000000011'::uuid, 360.0000::numeric),
      ('16000000-0000-0000-0000-000000000012'::uuid, 243.0000::numeric),
      ('16000000-0000-0000-0000-000000000013'::uuid, 243.0000::numeric)
  ) AS rule(product_category_id, fixed_amount)
  JOIN public.tax_product_categories AS product_category
    ON product_category.id = rule.product_category_id
  ON CONFLICT ON CONSTRAINT uq_tax_rates_scope DO UPDATE
  SET fixed_amount = EXCLUDED.fixed_amount,
      effective_to = EXCLUDED.effective_to,
      is_active = true,
      updated_at = now();

  -- ADV percentages 2026
  INSERT INTO public.tax_rates
    (tenant_id, tax_id, tax_product_category_id, calculation_method_id,
     tax_base_type_id, percentage_rate, effective_from, effective_to)
  SELECT tax.tenant_id, tax.id, product_category.id,
         tax.calculation_method_id, tax.tax_base_type_id,
         rule.percentage_rate, DATE '2026-01-01', DATE '2026-12-31'
  FROM public.taxes AS tax
  JOIN public.tax_types AS tax_type
    ON tax_type.id = tax.tax_type_id
   AND tax_type.code = 'AD_VALOREM'
  CROSS JOIN (
    VALUES
      ('16000000-0000-0000-0000-000000000010'::uuid, 0.25000000::numeric),
      ('16000000-0000-0000-0000-000000000011'::uuid, 0.25000000::numeric),
      ('16000000-0000-0000-0000-000000000012'::uuid, 0.20000000::numeric),
      ('16000000-0000-0000-0000-000000000013'::uuid, 0.20000000::numeric)
  ) AS rule(product_category_id, percentage_rate)
  JOIN public.tax_product_categories AS product_category
    ON product_category.id = rule.product_category_id
  ON CONFLICT ON CONSTRAINT uq_tax_rates_scope DO UPDATE
  SET percentage_rate = EXCLUDED.percentage_rate,
      effective_to = EXCLUDED.effective_to,
      is_active = true,
      updated_at = now();

  -- Beer consumption
  INSERT INTO public.tax_rates
    (tenant_id, tax_id, tax_product_category_id, calculation_method_id,
     tax_base_type_id, percentage_rate, effective_from)
  SELECT tax.tenant_id, tax.id, product_category.id,
         tax.calculation_method_id, tax.tax_base_type_id,
         rule.percentage_rate, DATE '1996-01-01'
  FROM public.taxes AS tax
  JOIN public.tax_types AS tax_type
    ON tax_type.id = tax.tax_type_id
   AND tax_type.code = 'BEER_CONSUMPTION'
  CROSS JOIN (
    VALUES
      ('16000000-0000-0000-0000-000000000014'::uuid, 0.48000000::numeric),
      ('16000000-0000-0000-0000-000000000015'::uuid, 0.48000000::numeric),
      ('16000000-0000-0000-0000-000000000016'::uuid, 0.20000000::numeric)
  ) AS rule(product_category_id, percentage_rate)
  JOIN public.tax_product_categories AS product_category
    ON product_category.id = rule.product_category_id
  ON CONFLICT ON CONSTRAINT uq_tax_rates_scope DO UPDATE
  SET percentage_rate = EXCLUDED.percentage_rate,
      is_active = true,
      updated_at = now();
END
$seed$;

-- Backfill product_taxes bridge when table exists.
DO $seed$
BEGIN
  IF to_regclass('public.product_taxes') IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.product_taxes
    (tenant_id, product_id, tax_id, calculation_order)
  SELECT product.tenant_id, product.id, product.tax_id, 100
  FROM public.products AS product
  JOIN public.taxes AS tax
    ON tax.tenant_id = product.tenant_id
   AND tax.id = product.tax_id
  WHERE product.tax_id IS NOT NULL
  ON CONFLICT (tenant_id, product_id, tax_id) DO NOTHING;
END
$seed$;
-- <<< END SECTION: products/2026_09_12_seed_inventory_taxes_and_tax_model.sql

-- >>> BEGIN SECTION: products/2026_09_12_migrate_existing_alcohol_products.sql
-- Migrate existing Manus QA alcohol products: product_taxes + product_tax_profiles.
-- Idempotent. Tenant default. DANE provisional = products.price (edit later in UI).
-- Depends on: V077/V078/V079 tax model + fiscal tax seeds.

DO $migrate$
DECLARE
  v_tenant UUID := '00000000-0000-0000-0000-000000000001';
  v_iva19 UUID;
  v_iva5 UUID;
  v_icl UUID;
  v_adv UUID;
  v_beer UUID;
  v_cat_liquor UUID := '16000000-0000-0000-0000-000000000010'; -- DISTILLED_LIQUOR
  v_cat_beer UUID := '16000000-0000-0000-0000-000000000014'; -- BEER
  r RECORD;
BEGIN
  SELECT id INTO v_iva19 FROM taxes WHERE tenant_id = v_tenant AND UPPER(BTRIM(name)) = 'IVA 19%' LIMIT 1;
  SELECT id INTO v_iva5 FROM taxes WHERE tenant_id = v_tenant AND UPPER(BTRIM(name)) = 'IVA 5%' LIMIT 1;
  SELECT id INTO v_icl FROM taxes WHERE tenant_id = v_tenant AND UPPER(BTRIM(name)) = UPPER('Impuesto al consumo de licores') LIMIT 1;
  SELECT id INTO v_adv
  FROM taxes t
  JOIN tax_types tt ON tt.id = t.tax_type_id
  WHERE t.tenant_id = v_tenant AND tt.code = 'AD_VALOREM'
  LIMIT 1;
  SELECT id INTO v_beer FROM taxes WHERE tenant_id = v_tenant AND UPPER(BTRIM(name)) = UPPER('Impuesto al consumo de cervezas y refajos') LIMIT 1;

  IF v_iva19 IS NULL OR v_iva5 IS NULL OR v_icl IS NULL OR v_adv IS NULL OR v_beer IS NULL THEN
    RAISE EXCEPTION 'Missing required tenant taxes (IVA19/IVA5/ICL/ADV/Beer)';
  END IF;

  -- Liquors: ICL + ADV + IVA5
  FOR r IN
    SELECT *
    FROM (
      VALUES
        ('d78dfd34-5147-4991-bf4d-6d6e4d6652ff'::uuid, 40.000::numeric, 750.000::numeric),
        ('23d4d786-170e-4718-b933-10b64465180f'::uuid, 29.000::numeric, 1050.000::numeric),
        ('18ba7701-4a74-4d03-a732-c892faa6f98c'::uuid, 29.000::numeric, 1000.000::numeric),
        ('aaccc304-371a-4fb0-9f1a-d37cbb1c08f5'::uuid, 29.000::numeric, 750.000::numeric),
        ('dfea3472-ceb1-43ae-a740-16233d535111'::uuid, 29.000::numeric, 375.000::numeric)
    ) AS x(product_id, alcohol_degree, net_volume_ml)
  LOOP
    IF NOT EXISTS (SELECT 1 FROM products WHERE id = r.product_id AND tenant_id = v_tenant) THEN
      CONTINUE;
    END IF;

    PERFORM public.prc_replace_product_taxes(
      v_tenant,
      r.product_id,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_icl, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_adv, 'calculation_order', 20),
        jsonb_build_object('tax_id', v_iva5, 'calculation_order', 100)
      )
    );

    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant,
      r.product_id,
      jsonb_build_object(
        'tax_product_category_id', v_cat_liquor,
        'alcohol_degree', r.alcohol_degree,
        'net_volume_ml', r.net_volume_ml,
        'dane_certified_retail_price', (
          SELECT price FROM products WHERE id = r.product_id AND tenant_id = v_tenant
        ),
        'dane_price_effective_from', CURRENT_DATE::text,
        'dane_price_effective_to', NULL
      )
    );

    UPDATE products
    SET tax_id = v_iva5,
        updated_at = NOW()
    WHERE id = r.product_id
      AND tenant_id = v_tenant;
  END LOOP;

  -- Beers: beer consumption + IVA19
  FOR r IN
    SELECT *
    FROM (
      VALUES
        ('8943add0-19ff-4cca-9382-a1f89a27da09'::uuid, 4.200::numeric, 330.000::numeric),
        ('3721daf5-00ed-47ae-95f3-8c482a75a311'::uuid, 5.000::numeric, 310.000::numeric),
        ('a42669b5-1866-4168-9a17-75739dd8df16'::uuid, 5.000::numeric, 330.000::numeric),
        ('07efd873-16b8-4e73-b72a-06321d7e8b49'::uuid, 4.700::numeric, 330.000::numeric),
        ('e50a7126-0881-499a-9577-a367beb64e4b'::uuid, 4.500::numeric, 210.000::numeric),
        ('b6b831c5-17be-4419-8a08-f147f6b55572'::uuid, 4.000::numeric, 330.000::numeric)
    ) AS x(product_id, alcohol_degree, net_volume_ml)
  LOOP
    IF NOT EXISTS (SELECT 1 FROM products WHERE id = r.product_id AND tenant_id = v_tenant) THEN
      CONTINUE;
    END IF;

    PERFORM public.prc_replace_product_taxes(
      v_tenant,
      r.product_id,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_beer, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_iva19, 'calculation_order', 100)
      )
    );

    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant,
      r.product_id,
      jsonb_build_object(
        'tax_product_category_id', v_cat_beer,
        'alcohol_degree', r.alcohol_degree,
        'net_volume_ml', r.net_volume_ml,
        'dane_certified_retail_price', NULL,
        'dane_price_effective_from', NULL,
        'dane_price_effective_to', NULL
      )
    );

    UPDATE products
    SET tax_id = v_iva19,
        updated_at = NOW()
    WHERE id = r.product_id
      AND tenant_id = v_tenant;
  END LOOP;
END
$migrate$;
-- <<< END SECTION: products/2026_09_12_migrate_existing_alcohol_products.sql

-- >>> BEGIN SECTION: products/2026_09_12_migrate_alcohol_from_excel.sql
-- Auto-generated from inventory Excel. Do not hand-edit.
-- DANE provisional = sale price for liquors.
DO $excel$
DECLARE
  v_tenant UUID := '00000000-0000-0000-0000-000000000001';
  v_iva19 UUID;
  v_iva5 UUID;
  v_icl UUID;
  v_adv UUID;
  v_beer UUID;
  v_product UUID;
  v_matched UUID;
BEGIN
  SELECT id INTO v_iva19 FROM taxes WHERE tenant_id = v_tenant AND UPPER(BTRIM(name)) = 'IVA 19%' LIMIT 1;
  SELECT id INTO v_iva5 FROM taxes WHERE tenant_id = v_tenant AND UPPER(BTRIM(name)) = 'IVA 5%' LIMIT 1;
  SELECT id INTO v_icl FROM taxes WHERE tenant_id = v_tenant AND UPPER(BTRIM(name)) = UPPER('Impuesto al consumo de licores') LIMIT 1;
  SELECT t.id INTO v_adv
  FROM taxes t
  JOIN tax_types tt ON tt.id = t.tax_type_id
  WHERE t.tenant_id = v_tenant AND tt.code = 'AD_VALOREM'
  LIMIT 1;
  SELECT id INTO v_beer FROM taxes WHERE tenant_id = v_tenant AND UPPER(BTRIM(name)) = UPPER('Impuesto al consumo de cervezas y refajos') LIMIT 1;
  IF v_iva19 IS NULL OR v_iva5 IS NULL OR v_icl IS NULL OR v_adv IS NULL OR v_beer IS NULL THEN
    RAISE EXCEPTION 'Missing required tenant taxes';
  END IF;

  -- LIQUOR 5000267024233 / WHISKY JOHNNIE WALKER BLACK BOTELLA 700ML
  v_product := NULL;
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-5000267024233'))
      OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('WHISKY JOHNNIE WALKER BLACK BOTELLA 700ML'))
      OR UPPER(BTRIM(p.name)) LIKE '%' || UPPER(BTRIM('WHISKY JOHNNIE WALKER BLACK BOTELLA 700ML')) || '%')
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    v_product := v_matched;
  ELSIF NOT EXISTS (
    SELECT 1 FROM products
    WHERE tenant_id = v_tenant AND UPPER(BTRIM(sku)) = UPPER(BTRIM('XLS-5000267024233'))
  ) THEN
    v_product := '78df2afa-ccfb-54f4-a312-a51fa7a3c3a2'::uuid;
    INSERT INTO products (
      id, tenant_id, unit_id, tax_id, name, description, sku, price, cost,
      price_with_tax, price_without_tax, is_active, requires_lot,
      operational_status, sale_type, measurement_unit,
      category_id, subcategory_id, created_at, updated_at
    ) VALUES (
      v_product, v_tenant, '10000000-0000-0000-0000-000000000001'::uuid, v_iva5, 'WHISKY JOHNNIE WALKER BLACK BOTELLA 700ML', 'WHISKY JOHNNIE WALKER BLACK BOTELLA 700ML', 'XLS-5000267024233',
      162800.00, 130260.00,
      162800.00, 162800.00, TRUE, FALSE,
      'ACTIVE', 'UNIT', 'UND',
      'd62a28a9-32ac-4df5-ad91-142c14b0edd8'::uuid, '7fd6dac4-6a98-4cda-822f-332ff15c791e'::uuid, NOW(), NOW()
    );
  END IF;
  IF v_product IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_product,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_icl, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_adv, 'calculation_order', 20),
        jsonb_build_object('tax_id', v_iva5, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_product,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000010'::uuid,
        'alcohol_degree', 40.000,
        'net_volume_ml', 700.000,
        'dane_certified_retail_price', 162800.00,
        'dane_price_effective_from', CURRENT_DATE::text,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva5, updated_at = NOW()
    WHERE id = v_product AND tenant_id = v_tenant;
  END IF;

  -- LIQUOR 50196388 / WHISKY BUCHANANS DE LUXE 750ml
  v_product := NULL;
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-50196388'))
      OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('WHISKY BUCHANANS DE LUXE 750ml'))
      OR UPPER(BTRIM(p.name)) LIKE '%' || UPPER(BTRIM('WHISKY BUCHANANS DE LUXE 750ml')) || '%')
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    v_product := v_matched;
  ELSIF NOT EXISTS (
    SELECT 1 FROM products
    WHERE tenant_id = v_tenant AND UPPER(BTRIM(sku)) = UPPER(BTRIM('XLS-50196388'))
  ) THEN
    v_product := '67335538-be74-5f60-adcc-b0cb740f5a20'::uuid;
    INSERT INTO products (
      id, tenant_id, unit_id, tax_id, name, description, sku, price, cost,
      price_with_tax, price_without_tax, is_active, requires_lot,
      operational_status, sale_type, measurement_unit,
      category_id, subcategory_id, created_at, updated_at
    ) VALUES (
      v_product, v_tenant, '10000000-0000-0000-0000-000000000001'::uuid, v_iva5, 'WHISKY BUCHANANS DE LUXE 750ml', 'WHISKY BUCHANANS DE LUXE 750ml', 'XLS-50196388',
      180867.00, 144694.00,
      180867.00, 180867.00, TRUE, FALSE,
      'ACTIVE', 'UNIT', 'UND',
      'd62a28a9-32ac-4df5-ad91-142c14b0edd8'::uuid, '7fd6dac4-6a98-4cda-822f-332ff15c791e'::uuid, NOW(), NOW()
    );
  END IF;
  IF v_product IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_product,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_icl, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_adv, 'calculation_order', 20),
        jsonb_build_object('tax_id', v_iva5, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_product,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000010'::uuid,
        'alcohol_degree', 40.000,
        'net_volume_ml', 750.000,
        'dane_certified_retail_price', 180867.00,
        'dane_price_effective_from', CURRENT_DATE::text,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva5, updated_at = NOW()
    WHERE id = v_product AND tenant_id = v_tenant;
  END IF;

  -- LIQUOR 7707096297583 / WODKA SMIRNOFF TAMARINDO 750ML
  v_product := NULL;
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-7707096297583'))
      OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('WODKA SMIRNOFF TAMARINDO 750ML'))
      OR UPPER(BTRIM(p.name)) LIKE '%' || UPPER(BTRIM('WODKA SMIRNOFF TAMARINDO 750ML')) || '%')
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    v_product := v_matched;
  ELSIF NOT EXISTS (
    SELECT 1 FROM products
    WHERE tenant_id = v_tenant AND UPPER(BTRIM(sku)) = UPPER(BTRIM('XLS-7707096297583'))
  ) THEN
    v_product := '34e00185-a9c3-5352-8479-feae0f60031f'::uuid;
    INSERT INTO products (
      id, tenant_id, unit_id, tax_id, name, description, sku, price, cost,
      price_with_tax, price_without_tax, is_active, requires_lot,
      operational_status, sale_type, measurement_unit,
      category_id, subcategory_id, created_at, updated_at
    ) VALUES (
      v_product, v_tenant, '10000000-0000-0000-0000-000000000001'::uuid, v_iva5, 'WODKA SMIRNOFF TAMARINDO 750ML', 'WODKA SMIRNOFF TAMARINDO 750ML', 'XLS-7707096297583',
      53000.00, 42195.00,
      53000.00, 53000.00, TRUE, FALSE,
      'ACTIVE', 'UNIT', 'UND',
      'd62a28a9-32ac-4df5-ad91-142c14b0edd8'::uuid, '59469cae-477c-4263-b086-3883c987a82b'::uuid, NOW(), NOW()
    );
  END IF;
  IF v_product IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_product,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_icl, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_adv, 'calculation_order', 20),
        jsonb_build_object('tax_id', v_iva5, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_product,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000010'::uuid,
        'alcohol_degree', 29.000,
        'net_volume_ml', 750.000,
        'dane_certified_retail_price', 53000.00,
        'dane_price_effective_from', CURRENT_DATE::text,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva5, updated_at = NOW()
    WHERE id = v_product AND tenant_id = v_tenant;
  END IF;

  -- LIQUOR 50196364 / WHISKY BUCHANANS DE LUXE 1000
  v_product := NULL;
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-50196364'))
      OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('WHISKY BUCHANANS DE LUXE 1000'))
      OR UPPER(BTRIM(p.name)) LIKE '%' || UPPER(BTRIM('WHISKY BUCHANANS DE LUXE 1000')) || '%')
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    v_product := v_matched;
  ELSIF NOT EXISTS (
    SELECT 1 FROM products
    WHERE tenant_id = v_tenant AND UPPER(BTRIM(sku)) = UPPER(BTRIM('XLS-50196364'))
  ) THEN
    v_product := '010d8be4-8b62-5b48-b0fd-e4b3fa29a249'::uuid;
    INSERT INTO products (
      id, tenant_id, unit_id, tax_id, name, description, sku, price, cost,
      price_with_tax, price_without_tax, is_active, requires_lot,
      operational_status, sale_type, measurement_unit,
      category_id, subcategory_id, created_at, updated_at
    ) VALUES (
      v_product, v_tenant, '10000000-0000-0000-0000-000000000001'::uuid, v_iva5, 'WHISKY BUCHANANS DE LUXE 1000', 'WHISKY BUCHANANS DE LUXE 1000', 'XLS-50196364',
      229238.00, 183391.00,
      229238.00, 229238.00, TRUE, FALSE,
      'ACTIVE', 'UNIT', 'UND',
      'd62a28a9-32ac-4df5-ad91-142c14b0edd8'::uuid, '7fd6dac4-6a98-4cda-822f-332ff15c791e'::uuid, NOW(), NOW()
    );
  END IF;
  IF v_product IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_product,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_icl, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_adv, 'calculation_order', 20),
        jsonb_build_object('tax_id', v_iva5, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_product,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000010'::uuid,
        'alcohol_degree', 40.000,
        'net_volume_ml', 1000.000,
        'dane_certified_retail_price', 229238.00,
        'dane_price_effective_from', CURRENT_DATE::text,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva5, updated_at = NOW()
    WHERE id = v_product AND tenant_id = v_tenant;
  END IF;

  -- LIQUOR I-17816551480 / WHISKY JOHNNIE WALKER RED LABEL BOTELLA 1OOOML
  v_product := NULL;
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-I-17816551480'))
      OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('WHISKY JOHNNIE WALKER RED LABEL BOTELLA 1OOOML'))
      OR UPPER(BTRIM(p.name)) LIKE '%' || UPPER(BTRIM('WHISKY JOHNNIE WALKER RED LABEL BOTELLA 1OOOML')) || '%')
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    v_product := v_matched;
  ELSIF NOT EXISTS (
    SELECT 1 FROM products
    WHERE tenant_id = v_tenant AND UPPER(BTRIM(sku)) = UPPER(BTRIM('XLS-I-17816551480'))
  ) THEN
    v_product := 'ffac6174-0854-53a1-85d2-a78bf75ce9a4'::uuid;
    INSERT INTO products (
      id, tenant_id, unit_id, tax_id, name, description, sku, price, cost,
      price_with_tax, price_without_tax, is_active, requires_lot,
      operational_status, sale_type, measurement_unit,
      category_id, subcategory_id, created_at, updated_at
    ) VALUES (
      v_product, v_tenant, '10000000-0000-0000-0000-000000000001'::uuid, v_iva5, 'WHISKY JOHNNIE WALKER RED LABEL BOTELLA 1OOOML', 'WHISKY JOHNNIE WALKER RED LABEL BOTELLA 1OOOML', 'XLS-I-17816551480',
      99700.00, 79737.00,
      99700.00, 99700.00, TRUE, FALSE,
      'ACTIVE', 'UNIT', 'UND',
      'd62a28a9-32ac-4df5-ad91-142c14b0edd8'::uuid, '7fd6dac4-6a98-4cda-822f-332ff15c791e'::uuid, NOW(), NOW()
    );
  END IF;
  IF v_product IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_product,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_icl, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_adv, 'calculation_order', 20),
        jsonb_build_object('tax_id', v_iva5, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_product,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000010'::uuid,
        'alcohol_degree', 40.000,
        'net_volume_ml', 750.000,
        'dane_certified_retail_price', 99700.00,
        'dane_price_effective_from', CURRENT_DATE::text,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva5, updated_at = NOW()
    WHERE id = v_product AND tenant_id = v_tenant;
  END IF;

  -- LIQUOR 5000281005034 / WHISKY OLD PARR 12 AÑOS 500ML
  v_product := NULL;
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-5000281005034'))
      OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('WHISKY OLD PARR 12 AÑOS 500ML'))
      OR UPPER(BTRIM(p.name)) LIKE '%' || UPPER(BTRIM('WHISKY OLD PARR 12 AÑOS 500ML')) || '%')
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    v_product := v_matched;
  ELSIF NOT EXISTS (
    SELECT 1 FROM products
    WHERE tenant_id = v_tenant AND UPPER(BTRIM(sku)) = UPPER(BTRIM('XLS-5000281005034'))
  ) THEN
    v_product := '7335a2e1-59d8-51c1-86c3-0ce83c39f917'::uuid;
    INSERT INTO products (
      id, tenant_id, unit_id, tax_id, name, description, sku, price, cost,
      price_with_tax, price_without_tax, is_active, requires_lot,
      operational_status, sale_type, measurement_unit,
      category_id, subcategory_id, created_at, updated_at
    ) VALUES (
      v_product, v_tenant, '10000000-0000-0000-0000-000000000001'::uuid, v_iva5, 'WHISKY OLD PARR 12 AÑOS 500ML', 'WHISKY OLD PARR 12 AÑOS 500ML', 'XLS-5000281005034',
      116200.00, 93011.00,
      116200.00, 116200.00, TRUE, FALSE,
      'ACTIVE', 'UNIT', 'UND',
      'd62a28a9-32ac-4df5-ad91-142c14b0edd8'::uuid, '7fd6dac4-6a98-4cda-822f-332ff15c791e'::uuid, NOW(), NOW()
    );
  END IF;
  IF v_product IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_product,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_icl, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_adv, 'calculation_order', 20),
        jsonb_build_object('tax_id', v_iva5, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_product,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000010'::uuid,
        'alcohol_degree', 40.000,
        'net_volume_ml', 500.000,
        'dane_certified_retail_price', 116200.00,
        'dane_price_effective_from', CURRENT_DATE::text,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva5, updated_at = NOW()
    WHERE id = v_product AND tenant_id = v_tenant;
  END IF;

  -- LIQUOR 5000281004020 / WHISKY OLD PARR 12 AÑOS 1000ML
  v_product := NULL;
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-5000281004020'))
      OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('WHISKY OLD PARR 12 AÑOS 1000ML'))
      OR UPPER(BTRIM(p.name)) LIKE '%' || UPPER(BTRIM('WHISKY OLD PARR 12 AÑOS 1000ML')) || '%')
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    v_product := v_matched;
  ELSIF NOT EXISTS (
    SELECT 1 FROM products
    WHERE tenant_id = v_tenant AND UPPER(BTRIM(sku)) = UPPER(BTRIM('XLS-5000281004020'))
  ) THEN
    v_product := '60965809-b0cb-5a47-9266-562096a5615d'::uuid;
    INSERT INTO products (
      id, tenant_id, unit_id, tax_id, name, description, sku, price, cost,
      price_with_tax, price_without_tax, is_active, requires_lot,
      operational_status, sale_type, measurement_unit,
      category_id, subcategory_id, created_at, updated_at
    ) VALUES (
      v_product, v_tenant, '10000000-0000-0000-0000-000000000001'::uuid, v_iva5, 'WHISKY OLD PARR 12 AÑOS 1000ML', 'WHISKY OLD PARR 12 AÑOS 1000ML', 'XLS-5000281004020',
      200400.00, 160347.00,
      200400.00, 200400.00, TRUE, FALSE,
      'ACTIVE', 'UNIT', 'UND',
      'd62a28a9-32ac-4df5-ad91-142c14b0edd8'::uuid, '7fd6dac4-6a98-4cda-822f-332ff15c791e'::uuid, NOW(), NOW()
    );
  END IF;
  IF v_product IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_product,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_icl, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_adv, 'calculation_order', 20),
        jsonb_build_object('tax_id', v_iva5, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_product,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000010'::uuid,
        'alcohol_degree', 40.000,
        'net_volume_ml', 1000.000,
        'dane_certified_retail_price', 200400.00,
        'dane_price_effective_from', CURRENT_DATE::text,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva5, updated_at = NOW()
    WHERE id = v_product AND tenant_id = v_tenant;
  END IF;

  -- LIQUOR 5000281003160 / WHISKY OLD PARR 750ML
  v_product := NULL;
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-5000281003160'))
      OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('WHISKY OLD PARR 750ML'))
      OR UPPER(BTRIM(p.name)) LIKE '%' || UPPER(BTRIM('WHISKY OLD PARR 750ML')) || '%')
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    v_product := v_matched;
  ELSIF NOT EXISTS (
    SELECT 1 FROM products
    WHERE tenant_id = v_tenant AND UPPER(BTRIM(sku)) = UPPER(BTRIM('XLS-5000281003160'))
  ) THEN
    v_product := '98088425-7775-5415-8919-ae871937323e'::uuid;
    INSERT INTO products (
      id, tenant_id, unit_id, tax_id, name, description, sku, price, cost,
      price_with_tax, price_without_tax, is_active, requires_lot,
      operational_status, sale_type, measurement_unit,
      category_id, subcategory_id, created_at, updated_at
    ) VALUES (
      v_product, v_tenant, '10000000-0000-0000-0000-000000000001'::uuid, v_iva5, 'WHISKY OLD PARR 750ML', 'WHISKY OLD PARR 750ML', 'XLS-5000281003160',
      159900.00, 127912.00,
      159900.00, 159900.00, TRUE, FALSE,
      'ACTIVE', 'UNIT', 'UND',
      'd62a28a9-32ac-4df5-ad91-142c14b0edd8'::uuid, '7fd6dac4-6a98-4cda-822f-332ff15c791e'::uuid, NOW(), NOW()
    );
  END IF;
  IF v_product IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_product,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_icl, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_adv, 'calculation_order', 20),
        jsonb_build_object('tax_id', v_iva5, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_product,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000010'::uuid,
        'alcohol_degree', 40.000,
        'net_volume_ml', 750.000,
        'dane_certified_retail_price', 159900.00,
        'dane_price_effective_from', CURRENT_DATE::text,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva5, updated_at = NOW()
    WHERE id = v_product AND tenant_id = v_tenant;
  END IF;

  -- LIQUOR 5000267014609 / WHISKY JOHNNIE WALKER RED LABEL 375ML
  v_product := NULL;
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-5000267014609'))
      OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('WHISKY JOHNNIE WALKER RED LABEL 375ML'))
      OR UPPER(BTRIM(p.name)) LIKE '%' || UPPER(BTRIM('WHISKY JOHNNIE WALKER RED LABEL 375ML')) || '%')
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    v_product := v_matched;
  ELSIF NOT EXISTS (
    SELECT 1 FROM products
    WHERE tenant_id = v_tenant AND UPPER(BTRIM(sku)) = UPPER(BTRIM('XLS-5000267014609'))
  ) THEN
    v_product := 'e1cb1676-1f15-5b76-9585-5037b927c2f2'::uuid;
    INSERT INTO products (
      id, tenant_id, unit_id, tax_id, name, description, sku, price, cost,
      price_with_tax, price_without_tax, is_active, requires_lot,
      operational_status, sale_type, measurement_unit,
      category_id, subcategory_id, created_at, updated_at
    ) VALUES (
      v_product, v_tenant, '10000000-0000-0000-0000-000000000001'::uuid, v_iva5, 'WHISKY JOHNNIE WALKER RED LABEL 375ML', 'WHISKY JOHNNIE WALKER RED LABEL 375ML', 'XLS-5000267014609',
      50866.00, 40693.00,
      50866.00, 50866.00, TRUE, FALSE,
      'ACTIVE', 'UNIT', 'UND',
      'd62a28a9-32ac-4df5-ad91-142c14b0edd8'::uuid, '7fd6dac4-6a98-4cda-822f-332ff15c791e'::uuid, NOW(), NOW()
    );
  END IF;
  IF v_product IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_product,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_icl, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_adv, 'calculation_order', 20),
        jsonb_build_object('tax_id', v_iva5, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_product,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000010'::uuid,
        'alcohol_degree', 40.000,
        'net_volume_ml', 375.000,
        'dane_certified_retail_price', 50866.00,
        'dane_price_effective_from', CURRENT_DATE::text,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva5, updated_at = NOW()
    WHERE id = v_product AND tenant_id = v_tenant;
  END IF;

  -- LIQUOR 5410316948999 / SMIRNOFF ICE GREEN APPLE BOTELLA 275ML
  v_product := NULL;
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-5410316948999'))
      OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('SMIRNOFF ICE GREEN APPLE BOTELLA 275ML'))
      OR UPPER(BTRIM(p.name)) LIKE '%' || UPPER(BTRIM('SMIRNOFF ICE GREEN APPLE BOTELLA 275ML')) || '%')
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    v_product := v_matched;
  ELSIF NOT EXISTS (
    SELECT 1 FROM products
    WHERE tenant_id = v_tenant AND UPPER(BTRIM(sku)) = UPPER(BTRIM('XLS-5410316948999'))
  ) THEN
    v_product := 'e328c070-3642-50ac-a458-105768b44045'::uuid;
    INSERT INTO products (
      id, tenant_id, unit_id, tax_id, name, description, sku, price, cost,
      price_with_tax, price_without_tax, is_active, requires_lot,
      operational_status, sale_type, measurement_unit,
      category_id, subcategory_id, created_at, updated_at
    ) VALUES (
      v_product, v_tenant, '10000000-0000-0000-0000-000000000001'::uuid, v_iva5, 'SMIRNOFF ICE GREEN APPLE BOTELLA 275ML', 'SMIRNOFF ICE GREEN APPLE BOTELLA 275ML', 'XLS-5410316948999',
      8500.00, 5218.00,
      8500.00, 8500.00, TRUE, FALSE,
      'ACTIVE', 'UNIT', 'UND',
      'd62a28a9-32ac-4df5-ad91-142c14b0edd8'::uuid, '59469cae-477c-4263-b086-3883c987a82b'::uuid, NOW(), NOW()
    );
  END IF;
  IF v_product IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_product,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_icl, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_adv, 'calculation_order', 20),
        jsonb_build_object('tax_id', v_iva5, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_product,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000010'::uuid,
        'alcohol_degree', 29.000,
        'net_volume_ml', 275.000,
        'dane_certified_retail_price', 8500.00,
        'dane_price_effective_from', CURRENT_DATE::text,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva5, updated_at = NOW()
    WHERE id = v_product AND tenant_id = v_tenant;
  END IF;

  -- LIQUOR 5000196003774 / WHISKY BUCHANANS MASTER 750ML
  v_product := NULL;
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-5000196003774'))
      OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('WHISKY BUCHANANS MASTER 750ML'))
      OR UPPER(BTRIM(p.name)) LIKE '%' || UPPER(BTRIM('WHISKY BUCHANANS MASTER 750ML')) || '%')
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    v_product := v_matched;
  ELSIF NOT EXISTS (
    SELECT 1 FROM products
    WHERE tenant_id = v_tenant AND UPPER(BTRIM(sku)) = UPPER(BTRIM('XLS-5000196003774'))
  ) THEN
    v_product := 'd9436678-426f-591c-93a1-f4e2e180ee40'::uuid;
    INSERT INTO products (
      id, tenant_id, unit_id, tax_id, name, description, sku, price, cost,
      price_with_tax, price_without_tax, is_active, requires_lot,
      operational_status, sale_type, measurement_unit,
      category_id, subcategory_id, created_at, updated_at
    ) VALUES (
      v_product, v_tenant, '10000000-0000-0000-0000-000000000001'::uuid, v_iva5, 'WHISKY BUCHANANS MASTER 750ML', 'WHISKY BUCHANANS MASTER 750ML', 'XLS-5000196003774',
      210200.00, 168173.00,
      210200.00, 210200.00, TRUE, FALSE,
      'ACTIVE', 'UNIT', 'UND',
      'd62a28a9-32ac-4df5-ad91-142c14b0edd8'::uuid, '7fd6dac4-6a98-4cda-822f-332ff15c791e'::uuid, NOW(), NOW()
    );
  END IF;
  IF v_product IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_product,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_icl, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_adv, 'calculation_order', 20),
        jsonb_build_object('tax_id', v_iva5, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_product,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000010'::uuid,
        'alcohol_degree', 40.000,
        'net_volume_ml', 750.000,
        'dane_certified_retail_price', 210200.00,
        'dane_price_effective_from', CURRENT_DATE::text,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva5, updated_at = NOW()
    WHERE id = v_product AND tenant_id = v_tenant;
  END IF;

  -- LIQUOR 5011013100156 / Crema de whisky baileys 700ml
  v_product := NULL;
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-5011013100156'))
      OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('Crema de whisky baileys 700ml'))
      OR UPPER(BTRIM(p.name)) LIKE '%' || UPPER(BTRIM('Crema de whisky baileys 700ml')) || '%')
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    v_product := v_matched;
  ELSIF NOT EXISTS (
    SELECT 1 FROM products
    WHERE tenant_id = v_tenant AND UPPER(BTRIM(sku)) = UPPER(BTRIM('XLS-5011013100156'))
  ) THEN
    v_product := '528120b8-5fbd-5f94-923e-ad3ce5162e08'::uuid;
    INSERT INTO products (
      id, tenant_id, unit_id, tax_id, name, description, sku, price, cost,
      price_with_tax, price_without_tax, is_active, requires_lot,
      operational_status, sale_type, measurement_unit,
      category_id, subcategory_id, created_at, updated_at
    ) VALUES (
      v_product, v_tenant, '10000000-0000-0000-0000-000000000001'::uuid, v_iva5, 'Crema de whisky baileys 700ml', 'Crema de whisky baileys 700ml', 'XLS-5011013100156',
      90500.00, 72382.00,
      90500.00, 90500.00, TRUE, FALSE,
      'ACTIVE', 'UNIT', 'UND',
      'd62a28a9-32ac-4df5-ad91-142c14b0edd8'::uuid, '7fd6dac4-6a98-4cda-822f-332ff15c791e'::uuid, NOW(), NOW()
    );
  END IF;
  IF v_product IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_product,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_icl, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_adv, 'calculation_order', 20),
        jsonb_build_object('tax_id', v_iva5, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_product,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000010'::uuid,
        'alcohol_degree', 40.000,
        'net_volume_ml', 700.000,
        'dane_certified_retail_price', 90500.00,
        'dane_price_effective_from', CURRENT_DATE::text,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva5, updated_at = NOW()
    WHERE id = v_product AND tenant_id = v_tenant;
  END IF;

  -- LIQUOR 50196135 / whisky black white botella 700ml
  v_product := NULL;
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-50196135'))
      OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('whisky black white botella 700ml'))
      OR UPPER(BTRIM(p.name)) LIKE '%' || UPPER(BTRIM('whisky black white botella 700ml')) || '%')
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    v_product := v_matched;
  ELSIF NOT EXISTS (
    SELECT 1 FROM products
    WHERE tenant_id = v_tenant AND UPPER(BTRIM(sku)) = UPPER(BTRIM('XLS-50196135'))
  ) THEN
    v_product := 'd54ed37c-de84-5b39-b85d-db6ddca7044d'::uuid;
    INSERT INTO products (
      id, tenant_id, unit_id, tax_id, name, description, sku, price, cost,
      price_with_tax, price_without_tax, is_active, requires_lot,
      operational_status, sale_type, measurement_unit,
      category_id, subcategory_id, created_at, updated_at
    ) VALUES (
      v_product, v_tenant, '10000000-0000-0000-0000-000000000001'::uuid, v_iva5, 'whisky black white botella 700ml', 'whisky black white botella 700ml', 'XLS-50196135',
      61200.00, 48927.00,
      61200.00, 61200.00, TRUE, FALSE,
      'ACTIVE', 'UNIT', 'UND',
      'd62a28a9-32ac-4df5-ad91-142c14b0edd8'::uuid, '7fd6dac4-6a98-4cda-822f-332ff15c791e'::uuid, NOW(), NOW()
    );
  END IF;
  IF v_product IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_product,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_icl, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_adv, 'calculation_order', 20),
        jsonb_build_object('tax_id', v_iva5, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_product,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000010'::uuid,
        'alcohol_degree', 40.000,
        'net_volume_ml', 700.000,
        'dane_certified_retail_price', 61200.00,
        'dane_price_effective_from', CURRENT_DATE::text,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva5, updated_at = NOW()
    WHERE id = v_product AND tenant_id = v_tenant;
  END IF;

  -- LIQUOR 50196166 / whisky black white botella 375ml
  v_product := NULL;
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-50196166'))
      OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('whisky black white botella 375ml'))
      OR UPPER(BTRIM(p.name)) LIKE '%' || UPPER(BTRIM('whisky black white botella 375ml')) || '%')
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    v_product := v_matched;
  ELSIF NOT EXISTS (
    SELECT 1 FROM products
    WHERE tenant_id = v_tenant AND UPPER(BTRIM(sku)) = UPPER(BTRIM('XLS-50196166'))
  ) THEN
    v_product := 'cfedcd71-9688-562b-ae65-0b37bd1f83fc'::uuid;
    INSERT INTO products (
      id, tenant_id, unit_id, tax_id, name, description, sku, price, cost,
      price_with_tax, price_without_tax, is_active, requires_lot,
      operational_status, sale_type, measurement_unit,
      category_id, subcategory_id, created_at, updated_at
    ) VALUES (
      v_product, v_tenant, '10000000-0000-0000-0000-000000000001'::uuid, v_iva5, 'whisky black white botella 375ml', 'whisky black white botella 375ml', 'XLS-50196166',
      33200.00, 26478.00,
      33200.00, 33200.00, TRUE, FALSE,
      'ACTIVE', 'UNIT', 'UND',
      'd62a28a9-32ac-4df5-ad91-142c14b0edd8'::uuid, '7fd6dac4-6a98-4cda-822f-332ff15c791e'::uuid, NOW(), NOW()
    );
  END IF;
  IF v_product IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_product,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_icl, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_adv, 'calculation_order', 20),
        jsonb_build_object('tax_id', v_iva5, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_product,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000010'::uuid,
        'alcohol_degree', 40.000,
        'net_volume_ml', 375.000,
        'dane_certified_retail_price', 33200.00,
        'dane_price_effective_from', CURRENT_DATE::text,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva5, updated_at = NOW()
    WHERE id = v_product AND tenant_id = v_tenant;
  END IF;

  -- LIQUOR 7707096271682 / wodka smirnoff lulo 750ml
  v_product := NULL;
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-7707096271682'))
      OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('wodka smirnoff lulo 750ml'))
      OR UPPER(BTRIM(p.name)) LIKE '%' || UPPER(BTRIM('wodka smirnoff lulo 750ml')) || '%')
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    v_product := v_matched;
  ELSIF NOT EXISTS (
    SELECT 1 FROM products
    WHERE tenant_id = v_tenant AND UPPER(BTRIM(sku)) = UPPER(BTRIM('XLS-7707096271682'))
  ) THEN
    v_product := 'a122771c-61e3-5206-b506-9b81cc091478'::uuid;
    INSERT INTO products (
      id, tenant_id, unit_id, tax_id, name, description, sku, price, cost,
      price_with_tax, price_without_tax, is_active, requires_lot,
      operational_status, sale_type, measurement_unit,
      category_id, subcategory_id, created_at, updated_at
    ) VALUES (
      v_product, v_tenant, '10000000-0000-0000-0000-000000000001'::uuid, v_iva5, 'wodka smirnoff lulo 750ml', 'wodka smirnoff lulo 750ml', 'XLS-7707096271682',
      52353.00, 39900.00,
      52353.00, 52353.00, TRUE, FALSE,
      'ACTIVE', 'UNIT', 'UND',
      'd62a28a9-32ac-4df5-ad91-142c14b0edd8'::uuid, '59469cae-477c-4263-b086-3883c987a82b'::uuid, NOW(), NOW()
    );
  END IF;
  IF v_product IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_product,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_icl, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_adv, 'calculation_order', 20),
        jsonb_build_object('tax_id', v_iva5, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_product,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000010'::uuid,
        'alcohol_degree', 29.000,
        'net_volume_ml', 750.000,
        'dane_certified_retail_price', 52353.00,
        'dane_price_effective_from', CURRENT_DATE::text,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva5, updated_at = NOW()
    WHERE id = v_product AND tenant_id = v_tenant;
  END IF;

  -- LIQUOR 5000267014203 / whisky johnnie walker red label botella 700ml
  v_product := NULL;
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-5000267014203'))
      OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('whisky johnnie walker red label botella 700ml'))
      OR UPPER(BTRIM(p.name)) LIKE '%' || UPPER(BTRIM('whisky johnnie walker red label botella 700ml')) || '%')
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    v_product := v_matched;
  ELSIF NOT EXISTS (
    SELECT 1 FROM products
    WHERE tenant_id = v_tenant AND UPPER(BTRIM(sku)) = UPPER(BTRIM('XLS-5000267014203'))
  ) THEN
    v_product := 'e17dd830-6e6c-5c6f-88d6-b0a372e0f526'::uuid;
    INSERT INTO products (
      id, tenant_id, unit_id, tax_id, name, description, sku, price, cost,
      price_with_tax, price_without_tax, is_active, requires_lot,
      operational_status, sale_type, measurement_unit,
      category_id, subcategory_id, created_at, updated_at
    ) VALUES (
      v_product, v_tenant, '10000000-0000-0000-0000-000000000001'::uuid, v_iva5, 'whisky johnnie walker red label botella 700ml', 'whisky johnnie walker red label botella 700ml', 'XLS-5000267014203',
      77000.00, 61564.00,
      77000.00, 77000.00, TRUE, FALSE,
      'ACTIVE', 'UNIT', 'UND',
      'd62a28a9-32ac-4df5-ad91-142c14b0edd8'::uuid, '7fd6dac4-6a98-4cda-822f-332ff15c791e'::uuid, NOW(), NOW()
    );
  END IF;
  IF v_product IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_product,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_icl, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_adv, 'calculation_order', 20),
        jsonb_build_object('tax_id', v_iva5, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_product,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000010'::uuid,
        'alcohol_degree', 40.000,
        'net_volume_ml', 700.000,
        'dane_certified_retail_price', 77000.00,
        'dane_price_effective_from', CURRENT_DATE::text,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva5, updated_at = NOW()
    WHERE id = v_product AND tenant_id = v_tenant;
  END IF;

  -- LIQUOR 5410316983693 / smirnoff ice red botella 275ml
  v_product := NULL;
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-5410316983693'))
      OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('smirnoff ice red botella 275ml'))
      OR UPPER(BTRIM(p.name)) LIKE '%' || UPPER(BTRIM('smirnoff ice red botella 275ml')) || '%')
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    v_product := v_matched;
  ELSIF NOT EXISTS (
    SELECT 1 FROM products
    WHERE tenant_id = v_tenant AND UPPER(BTRIM(sku)) = UPPER(BTRIM('XLS-5410316983693'))
  ) THEN
    v_product := 'd08ca35e-848e-538c-934d-177353211068'::uuid;
    INSERT INTO products (
      id, tenant_id, unit_id, tax_id, name, description, sku, price, cost,
      price_with_tax, price_without_tax, is_active, requires_lot,
      operational_status, sale_type, measurement_unit,
      category_id, subcategory_id, created_at, updated_at
    ) VALUES (
      v_product, v_tenant, '10000000-0000-0000-0000-000000000001'::uuid, v_iva5, 'smirnoff ice red botella 275ml', 'smirnoff ice red botella 275ml', 'XLS-5410316983693',
      8500.00, 5217.00,
      8500.00, 8500.00, TRUE, FALSE,
      'ACTIVE', 'UNIT', 'UND',
      'd62a28a9-32ac-4df5-ad91-142c14b0edd8'::uuid, '59469cae-477c-4263-b086-3883c987a82b'::uuid, NOW(), NOW()
    );
  END IF;
  IF v_product IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_product,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_icl, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_adv, 'calculation_order', 20),
        jsonb_build_object('tax_id', v_iva5, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_product,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000010'::uuid,
        'alcohol_degree', 29.000,
        'net_volume_ml', 275.000,
        'dane_certified_retail_price', 8500.00,
        'dane_price_effective_from', CURRENT_DATE::text,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva5, updated_at = NOW()
    WHERE id = v_product AND tenant_id = v_tenant;
  END IF;

  -- LIQUOR 5410316945981 / smirnoff ice green apple lata 250ml
  v_product := NULL;
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-5410316945981'))
      OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('smirnoff ice green apple lata 250ml'))
      OR UPPER(BTRIM(p.name)) LIKE '%' || UPPER(BTRIM('smirnoff ice green apple lata 250ml')) || '%')
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    v_product := v_matched;
  ELSIF NOT EXISTS (
    SELECT 1 FROM products
    WHERE tenant_id = v_tenant AND UPPER(BTRIM(sku)) = UPPER(BTRIM('XLS-5410316945981'))
  ) THEN
    v_product := '792673dd-7146-5b6f-be86-78e1dac665cc'::uuid;
    INSERT INTO products (
      id, tenant_id, unit_id, tax_id, name, description, sku, price, cost,
      price_with_tax, price_without_tax, is_active, requires_lot,
      operational_status, sale_type, measurement_unit,
      category_id, subcategory_id, created_at, updated_at
    ) VALUES (
      v_product, v_tenant, '10000000-0000-0000-0000-000000000001'::uuid, v_iva5, 'smirnoff ice green apple lata 250ml', 'smirnoff ice green apple lata 250ml', 'XLS-5410316945981',
      7500.00, 5217.00,
      7500.00, 7500.00, TRUE, FALSE,
      'ACTIVE', 'UNIT', 'UND',
      'd62a28a9-32ac-4df5-ad91-142c14b0edd8'::uuid, '59469cae-477c-4263-b086-3883c987a82b'::uuid, NOW(), NOW()
    );
  END IF;
  IF v_product IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_product,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_icl, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_adv, 'calculation_order', 20),
        jsonb_build_object('tax_id', v_iva5, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_product,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000010'::uuid,
        'alcohol_degree', 29.000,
        'net_volume_ml', 250.000,
        'dane_certified_retail_price', 7500.00,
        'dane_price_effective_from', CURRENT_DATE::text,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva5, updated_at = NOW()
    WHERE id = v_product AND tenant_id = v_tenant;
  END IF;

  -- LIQUOR 7702049001675 / aguardiente antioqueño verde tetra 1050
  v_product := NULL;
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-7702049001675'))
      OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('aguardiente antioqueño verde tetra 1050'))
      OR UPPER(BTRIM(p.name)) LIKE '%' || UPPER(BTRIM('aguardiente antioqueño verde tetra 1050')) || '%')
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    v_product := v_matched;
  ELSIF NOT EXISTS (
    SELECT 1 FROM products
    WHERE tenant_id = v_tenant AND UPPER(BTRIM(sku)) = UPPER(BTRIM('XLS-7702049001675'))
  ) THEN
    v_product := '5b8e9ddb-26f3-5f05-a586-a4ebb7f33baf'::uuid;
    INSERT INTO products (
      id, tenant_id, unit_id, tax_id, name, description, sku, price, cost,
      price_with_tax, price_without_tax, is_active, requires_lot,
      operational_status, sale_type, measurement_unit,
      category_id, subcategory_id, created_at, updated_at
    ) VALUES (
      v_product, v_tenant, '10000000-0000-0000-0000-000000000001'::uuid, v_iva5, 'aguardiente antioqueño verde tetra 1050', 'aguardiente antioqueño verde tetra 1050', 'XLS-7702049001675',
      67200.00, 53750.00,
      67200.00, 67200.00, TRUE, FALSE,
      'ACTIVE', 'UNIT', 'UND',
      'd62a28a9-32ac-4df5-ad91-142c14b0edd8'::uuid, '59469cae-477c-4263-b086-3883c987a82b'::uuid, NOW(), NOW()
    );
  END IF;
  IF v_product IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_product,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_icl, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_adv, 'calculation_order', 20),
        jsonb_build_object('tax_id', v_iva5, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_product,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000010'::uuid,
        'alcohol_degree', 29.000,
        'net_volume_ml', 1050.000,
        'dane_certified_retail_price', 67200.00,
        'dane_price_effective_from', CURRENT_DATE::text,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva5, updated_at = NOW()
    WHERE id = v_product AND tenant_id = v_tenant;
  END IF;

  -- LIQUOR 7702049001514 / Aguardiente antioqueño sin azucar azul 1050 ml
  v_product := NULL;
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-7702049001514'))
      OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('Aguardiente antioqueño sin azucar azul 1050 ml'))
      OR UPPER(BTRIM(p.name)) LIKE '%' || UPPER(BTRIM('Aguardiente antioqueño sin azucar azul 1050 ml')) || '%')
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    v_product := v_matched;
  ELSIF NOT EXISTS (
    SELECT 1 FROM products
    WHERE tenant_id = v_tenant AND UPPER(BTRIM(sku)) = UPPER(BTRIM('XLS-7702049001514'))
  ) THEN
    v_product := 'f9dc9ef3-8d46-5b5d-9863-c4b972b7a1fe'::uuid;
    INSERT INTO products (
      id, tenant_id, unit_id, tax_id, name, description, sku, price, cost,
      price_with_tax, price_without_tax, is_active, requires_lot,
      operational_status, sale_type, measurement_unit,
      category_id, subcategory_id, created_at, updated_at
    ) VALUES (
      v_product, v_tenant, '10000000-0000-0000-0000-000000000001'::uuid, v_iva5, 'Aguardiente antioqueño sin azucar azul 1050 ml', 'Aguardiente antioqueño sin azucar azul 1050 ml', 'XLS-7702049001514',
      71800.00, 57500.00,
      71800.00, 71800.00, TRUE, FALSE,
      'ACTIVE', 'UNIT', 'UND',
      'd62a28a9-32ac-4df5-ad91-142c14b0edd8'::uuid, '59469cae-477c-4263-b086-3883c987a82b'::uuid, NOW(), NOW()
    );
  END IF;
  IF v_product IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_product,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_icl, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_adv, 'calculation_order', 20),
        jsonb_build_object('tax_id', v_iva5, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_product,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000010'::uuid,
        'alcohol_degree', 29.000,
        'net_volume_ml', 1050.000,
        'dane_certified_retail_price', 71800.00,
        'dane_price_effective_from', CURRENT_DATE::text,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva5, updated_at = NOW()
    WHERE id = v_product AND tenant_id = v_tenant;
  END IF;

  -- LIQUOR 7702049000548 / Aguardiente antioqueño sin azucar 375 ml
  v_product := NULL;
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-7702049000548'))
      OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('Aguardiente antioqueño sin azucar 375 ml'))
      OR UPPER(BTRIM(p.name)) LIKE '%' || UPPER(BTRIM('Aguardiente antioqueño sin azucar 375 ml')) || '%')
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    v_product := v_matched;
  ELSIF NOT EXISTS (
    SELECT 1 FROM products
    WHERE tenant_id = v_tenant AND UPPER(BTRIM(sku)) = UPPER(BTRIM('XLS-7702049000548'))
  ) THEN
    v_product := '908262f4-69c1-59ce-9302-fdc8895d06fc'::uuid;
    INSERT INTO products (
      id, tenant_id, unit_id, tax_id, name, description, sku, price, cost,
      price_with_tax, price_without_tax, is_active, requires_lot,
      operational_status, sale_type, measurement_unit,
      category_id, subcategory_id, created_at, updated_at
    ) VALUES (
      v_product, v_tenant, '10000000-0000-0000-0000-000000000001'::uuid, v_iva5, 'Aguardiente antioqueño sin azucar 375 ml', 'Aguardiente antioqueño sin azucar 375 ml', 'XLS-7702049000548',
      31900.00, 25500.00,
      31900.00, 31900.00, TRUE, FALSE,
      'ACTIVE', 'UNIT', 'UND',
      'd62a28a9-32ac-4df5-ad91-142c14b0edd8'::uuid, '59469cae-477c-4263-b086-3883c987a82b'::uuid, NOW(), NOW()
    );
  END IF;
  IF v_product IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_product,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_icl, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_adv, 'calculation_order', 20),
        jsonb_build_object('tax_id', v_iva5, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_product,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000010'::uuid,
        'alcohol_degree', 29.000,
        'net_volume_ml', 375.000,
        'dane_certified_retail_price', 31900.00,
        'dane_price_effective_from', CURRENT_DATE::text,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva5, updated_at = NOW()
    WHERE id = v_product AND tenant_id = v_tenant;
  END IF;

  -- LIQUOR 7702049001750 / Aguardiente antioqueño verde 1750ml
  v_product := NULL;
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-7702049001750'))
      OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('Aguardiente antioqueño verde 1750ml'))
      OR UPPER(BTRIM(p.name)) LIKE '%' || UPPER(BTRIM('Aguardiente antioqueño verde 1750ml')) || '%')
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    v_product := v_matched;
  ELSIF NOT EXISTS (
    SELECT 1 FROM products
    WHERE tenant_id = v_tenant AND UPPER(BTRIM(sku)) = UPPER(BTRIM('XLS-7702049001750'))
  ) THEN
    v_product := 'a73d21c8-74de-520d-b18d-4a14f88cdc6e'::uuid;
    INSERT INTO products (
      id, tenant_id, unit_id, tax_id, name, description, sku, price, cost,
      price_with_tax, price_without_tax, is_active, requires_lot,
      operational_status, sale_type, measurement_unit,
      category_id, subcategory_id, created_at, updated_at
    ) VALUES (
      v_product, v_tenant, '10000000-0000-0000-0000-000000000001'::uuid, v_iva5, 'Aguardiente antioqueño verde 1750ml', 'Aguardiente antioqueño verde 1750ml', 'XLS-7702049001750',
      116000.00, 93200.00,
      116000.00, 116000.00, TRUE, FALSE,
      'ACTIVE', 'UNIT', 'UND',
      'd62a28a9-32ac-4df5-ad91-142c14b0edd8'::uuid, '59469cae-477c-4263-b086-3883c987a82b'::uuid, NOW(), NOW()
    );
  END IF;
  IF v_product IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_product,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_icl, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_adv, 'calculation_order', 20),
        jsonb_build_object('tax_id', v_iva5, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_product,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000010'::uuid,
        'alcohol_degree', 29.000,
        'net_volume_ml', 1750.000,
        'dane_certified_retail_price', 116000.00,
        'dane_price_effective_from', CURRENT_DATE::text,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva5, updated_at = NOW()
    WHERE id = v_product AND tenant_id = v_tenant;
  END IF;

  -- LIQUOR 7702049001637 / Aguardiente antioqueño verde 375 ml
  v_product := NULL;
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-7702049001637'))
      OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('Aguardiente antioqueño verde 375 ml'))
      OR UPPER(BTRIM(p.name)) LIKE '%' || UPPER(BTRIM('Aguardiente antioqueño verde 375 ml')) || '%')
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    v_product := v_matched;
  ELSIF NOT EXISTS (
    SELECT 1 FROM products
    WHERE tenant_id = v_tenant AND UPPER(BTRIM(sku)) = UPPER(BTRIM('XLS-7702049001637'))
  ) THEN
    v_product := 'd5cb0d2e-8729-53bc-9714-8f6fcebdf9dc'::uuid;
    INSERT INTO products (
      id, tenant_id, unit_id, tax_id, name, description, sku, price, cost,
      price_with_tax, price_without_tax, is_active, requires_lot,
      operational_status, sale_type, measurement_unit,
      category_id, subcategory_id, created_at, updated_at
    ) VALUES (
      v_product, v_tenant, '10000000-0000-0000-0000-000000000001'::uuid, v_iva5, 'Aguardiente antioqueño verde 375 ml', 'Aguardiente antioqueño verde 375 ml', 'XLS-7702049001637',
      28500.00, 23500.00,
      28500.00, 28500.00, TRUE, FALSE,
      'ACTIVE', 'UNIT', 'UND',
      'd62a28a9-32ac-4df5-ad91-142c14b0edd8'::uuid, '59469cae-477c-4263-b086-3883c987a82b'::uuid, NOW(), NOW()
    );
  END IF;
  IF v_product IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_product,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_icl, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_adv, 'calculation_order', 20),
        jsonb_build_object('tax_id', v_iva5, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_product,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000010'::uuid,
        'alcohol_degree', 29.000,
        'net_volume_ml', 375.000,
        'dane_certified_retail_price', 28500.00,
        'dane_price_effective_from', CURRENT_DATE::text,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva5, updated_at = NOW()
    WHERE id = v_product AND tenant_id = v_tenant;
  END IF;

  -- LIQUOR 7702049100576 / Ron medellin 3 años 750ml
  v_product := NULL;
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-7702049100576'))
      OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('Ron medellin 3 años 750ml'))
      OR UPPER(BTRIM(p.name)) LIKE '%' || UPPER(BTRIM('Ron medellin 3 años 750ml')) || '%')
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    v_product := v_matched;
  ELSIF NOT EXISTS (
    SELECT 1 FROM products
    WHERE tenant_id = v_tenant AND UPPER(BTRIM(sku)) = UPPER(BTRIM('XLS-7702049100576'))
  ) THEN
    v_product := '822d8f45-cc4d-5561-904f-1fadcc41a75f'::uuid;
    INSERT INTO products (
      id, tenant_id, unit_id, tax_id, name, description, sku, price, cost,
      price_with_tax, price_without_tax, is_active, requires_lot,
      operational_status, sale_type, measurement_unit,
      category_id, subcategory_id, created_at, updated_at
    ) VALUES (
      v_product, v_tenant, '10000000-0000-0000-0000-000000000001'::uuid, v_iva5, 'Ron medellin 3 años 750ml', 'Ron medellin 3 años 750ml', 'XLS-7702049100576',
      62700.00, 52100.00,
      62700.00, 62700.00, TRUE, FALSE,
      'ACTIVE', 'UNIT', 'UND',
      'd62a28a9-32ac-4df5-ad91-142c14b0edd8'::uuid, '59469cae-477c-4263-b086-3883c987a82b'::uuid, NOW(), NOW()
    );
  END IF;
  IF v_product IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_product,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_icl, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_adv, 'calculation_order', 20),
        jsonb_build_object('tax_id', v_iva5, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_product,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000010'::uuid,
        'alcohol_degree', 35.000,
        'net_volume_ml', 750.000,
        'dane_certified_retail_price', 62700.00,
        'dane_price_effective_from', CURRENT_DATE::text,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva5, updated_at = NOW()
    WHERE id = v_product AND tenant_id = v_tenant;
  END IF;

  -- LIQUOR I-17817175040 / Ron medellin 8 años 750
  v_product := NULL;
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-I-17817175040'))
      OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('Ron medellin 8 años 750'))
      OR UPPER(BTRIM(p.name)) LIKE '%' || UPPER(BTRIM('Ron medellin 8 años 750')) || '%')
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    v_product := v_matched;
  ELSIF NOT EXISTS (
    SELECT 1 FROM products
    WHERE tenant_id = v_tenant AND UPPER(BTRIM(sku)) = UPPER(BTRIM('XLS-I-17817175040'))
  ) THEN
    v_product := 'a7ce30e2-9e25-582b-b8a9-1798fb403125'::uuid;
    INSERT INTO products (
      id, tenant_id, unit_id, tax_id, name, description, sku, price, cost,
      price_with_tax, price_without_tax, is_active, requires_lot,
      operational_status, sale_type, measurement_unit,
      category_id, subcategory_id, created_at, updated_at
    ) VALUES (
      v_product, v_tenant, '10000000-0000-0000-0000-000000000001'::uuid, v_iva5, 'Ron medellin 8 años 750', 'Ron medellin 8 años 750', 'XLS-I-17817175040',
      102300.00, 81800.00,
      102300.00, 102300.00, TRUE, FALSE,
      'ACTIVE', 'UNIT', 'UND',
      'd62a28a9-32ac-4df5-ad91-142c14b0edd8'::uuid, '59469cae-477c-4263-b086-3883c987a82b'::uuid, NOW(), NOW()
    );
  END IF;
  IF v_product IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_product,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_icl, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_adv, 'calculation_order', 20),
        jsonb_build_object('tax_id', v_iva5, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_product,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000010'::uuid,
        'alcohol_degree', 35.000,
        'net_volume_ml', 750.000,
        'dane_certified_retail_price', 102300.00,
        'dane_price_effective_from', CURRENT_DATE::text,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva5, updated_at = NOW()
    WHERE id = v_product AND tenant_id = v_tenant;
  END IF;

  -- LIQUOR 7702049001644 / Aguardiente antioqueño verde 750ml
  v_product := NULL;
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-7702049001644'))
      OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('Aguardiente antioqueño verde 750ml'))
      OR UPPER(BTRIM(p.name)) LIKE '%' || UPPER(BTRIM('Aguardiente antioqueño verde 750ml')) || '%')
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    v_product := v_matched;
  ELSIF NOT EXISTS (
    SELECT 1 FROM products
    WHERE tenant_id = v_tenant AND UPPER(BTRIM(sku)) = UPPER(BTRIM('XLS-7702049001644'))
  ) THEN
    v_product := '0ebce76b-9737-572a-97dd-a34470fb4de0'::uuid;
    INSERT INTO products (
      id, tenant_id, unit_id, tax_id, name, description, sku, price, cost,
      price_with_tax, price_without_tax, is_active, requires_lot,
      operational_status, sale_type, measurement_unit,
      category_id, subcategory_id, created_at, updated_at
    ) VALUES (
      v_product, v_tenant, '10000000-0000-0000-0000-000000000001'::uuid, v_iva5, 'Aguardiente antioqueño verde 750ml', 'Aguardiente antioqueño verde 750ml', 'XLS-7702049001644',
      59500.00, 43600.00,
      59500.00, 59500.00, TRUE, FALSE,
      'ACTIVE', 'UNIT', 'UND',
      'd62a28a9-32ac-4df5-ad91-142c14b0edd8'::uuid, '59469cae-477c-4263-b086-3883c987a82b'::uuid, NOW(), NOW()
    );
  END IF;
  IF v_product IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_product,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_icl, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_adv, 'calculation_order', 20),
        jsonb_build_object('tax_id', v_iva5, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_product,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000010'::uuid,
        'alcohol_degree', 29.000,
        'net_volume_ml', 750.000,
        'dane_certified_retail_price', 59500.00,
        'dane_price_effective_from', CURRENT_DATE::text,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva5, updated_at = NOW()
    WHERE id = v_product AND tenant_id = v_tenant;
  END IF;

  -- LIQUOR 7702049101191 / RON MEDELLIN DORADO 375ML
  v_product := NULL;
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-7702049101191'))
      OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('RON MEDELLIN DORADO 375ML'))
      OR UPPER(BTRIM(p.name)) LIKE '%' || UPPER(BTRIM('RON MEDELLIN DORADO 375ML')) || '%')
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    v_product := v_matched;
  ELSIF NOT EXISTS (
    SELECT 1 FROM products
    WHERE tenant_id = v_tenant AND UPPER(BTRIM(sku)) = UPPER(BTRIM('XLS-7702049101191'))
  ) THEN
    v_product := '25b0939e-9e57-5a7d-8099-2f681712b70e'::uuid;
    INSERT INTO products (
      id, tenant_id, unit_id, tax_id, name, description, sku, price, cost,
      price_with_tax, price_without_tax, is_active, requires_lot,
      operational_status, sale_type, measurement_unit,
      category_id, subcategory_id, created_at, updated_at
    ) VALUES (
      v_product, v_tenant, '10000000-0000-0000-0000-000000000001'::uuid, v_iva5, 'RON MEDELLIN DORADO 375ML', 'RON MEDELLIN DORADO 375ML', 'XLS-7702049101191',
      32000.00, 25600.00,
      32000.00, 32000.00, TRUE, FALSE,
      'ACTIVE', 'UNIT', 'UND',
      'd62a28a9-32ac-4df5-ad91-142c14b0edd8'::uuid, '59469cae-477c-4263-b086-3883c987a82b'::uuid, NOW(), NOW()
    );
  END IF;
  IF v_product IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_product,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_icl, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_adv, 'calculation_order', 20),
        jsonb_build_object('tax_id', v_iva5, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_product,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000010'::uuid,
        'alcohol_degree', 35.000,
        'net_volume_ml', 375.000,
        'dane_certified_retail_price', 32000.00,
        'dane_price_effective_from', CURRENT_DATE::text,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva5, updated_at = NOW()
    WHERE id = v_product AND tenant_id = v_tenant;
  END IF;

  -- LIQUOR 7702049000531 / Aguardiente antioqueño azul 750ml
  v_product := NULL;
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-7702049000531'))
      OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('Aguardiente antioqueño azul 750ml'))
      OR UPPER(BTRIM(p.name)) LIKE '%' || UPPER(BTRIM('Aguardiente antioqueño azul 750ml')) || '%')
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    v_product := v_matched;
  ELSIF NOT EXISTS (
    SELECT 1 FROM products
    WHERE tenant_id = v_tenant AND UPPER(BTRIM(sku)) = UPPER(BTRIM('XLS-7702049000531'))
  ) THEN
    v_product := '2b1d5d7d-f916-57b8-9f1e-d566809a9519'::uuid;
    INSERT INTO products (
      id, tenant_id, unit_id, tax_id, name, description, sku, price, cost,
      price_with_tax, price_without_tax, is_active, requires_lot,
      operational_status, sale_type, measurement_unit,
      category_id, subcategory_id, created_at, updated_at
    ) VALUES (
      v_product, v_tenant, '10000000-0000-0000-0000-000000000001'::uuid, v_iva5, 'Aguardiente antioqueño azul 750ml', 'Aguardiente antioqueño azul 750ml', 'XLS-7702049000531',
      61000.00, 48900.00,
      61000.00, 61000.00, TRUE, FALSE,
      'ACTIVE', 'UNIT', 'UND',
      'd62a28a9-32ac-4df5-ad91-142c14b0edd8'::uuid, '59469cae-477c-4263-b086-3883c987a82b'::uuid, NOW(), NOW()
    );
  END IF;
  IF v_product IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_product,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_icl, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_adv, 'calculation_order', 20),
        jsonb_build_object('tax_id', v_iva5, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_product,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000010'::uuid,
        'alcohol_degree', 29.000,
        'net_volume_ml', 750.000,
        'dane_certified_retail_price', 61000.00,
        'dane_price_effective_from', CURRENT_DATE::text,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva5, updated_at = NOW()
    WHERE id = v_product AND tenant_id = v_tenant;
  END IF;

  -- LIQUOR 7702168278477 / Aguardiente amarillo 750ml
  v_product := NULL;
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-7702168278477'))
      OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('Aguardiente amarillo 750ml'))
      OR UPPER(BTRIM(p.name)) LIKE '%' || UPPER(BTRIM('Aguardiente amarillo 750ml')) || '%')
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    v_product := v_matched;
  ELSIF NOT EXISTS (
    SELECT 1 FROM products
    WHERE tenant_id = v_tenant AND UPPER(BTRIM(sku)) = UPPER(BTRIM('XLS-7702168278477'))
  ) THEN
    v_product := '5959bd90-f0c0-55f9-9109-e2f8529cf9c0'::uuid;
    INSERT INTO products (
      id, tenant_id, unit_id, tax_id, name, description, sku, price, cost,
      price_with_tax, price_without_tax, is_active, requires_lot,
      operational_status, sale_type, measurement_unit,
      category_id, subcategory_id, created_at, updated_at
    ) VALUES (
      v_product, v_tenant, '10000000-0000-0000-0000-000000000001'::uuid, v_iva5, 'Aguardiente amarillo 750ml', 'Aguardiente amarillo 750ml', 'XLS-7702168278477',
      55000.00, 48774.00,
      55000.00, 55000.00, TRUE, FALSE,
      'ACTIVE', 'UNIT', 'UND',
      'd62a28a9-32ac-4df5-ad91-142c14b0edd8'::uuid, '59469cae-477c-4263-b086-3883c987a82b'::uuid, NOW(), NOW()
    );
  END IF;
  IF v_product IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_product,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_icl, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_adv, 'calculation_order', 20),
        jsonb_build_object('tax_id', v_iva5, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_product,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000010'::uuid,
        'alcohol_degree', 29.000,
        'net_volume_ml', 750.000,
        'dane_certified_retail_price', 55000.00,
        'dane_price_effective_from', CURRENT_DATE::text,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva5, updated_at = NOW()
    WHERE id = v_product AND tenant_id = v_tenant;
  END IF;

  -- LIQUOR 7702168420135 / Aguardiente amarrillo tetra 1000ml
  v_product := NULL;
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-7702168420135'))
      OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('Aguardiente amarrillo tetra 1000ml'))
      OR UPPER(BTRIM(p.name)) LIKE '%' || UPPER(BTRIM('Aguardiente amarrillo tetra 1000ml')) || '%')
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    v_product := v_matched;
  ELSIF NOT EXISTS (
    SELECT 1 FROM products
    WHERE tenant_id = v_tenant AND UPPER(BTRIM(sku)) = UPPER(BTRIM('XLS-7702168420135'))
  ) THEN
    v_product := 'a08b5449-d3af-5abf-8739-b6b6cfe44c7f'::uuid;
    INSERT INTO products (
      id, tenant_id, unit_id, tax_id, name, description, sku, price, cost,
      price_with_tax, price_without_tax, is_active, requires_lot,
      operational_status, sale_type, measurement_unit,
      category_id, subcategory_id, created_at, updated_at
    ) VALUES (
      v_product, v_tenant, '10000000-0000-0000-0000-000000000001'::uuid, v_iva5, 'Aguardiente amarrillo tetra 1000ml', 'Aguardiente amarrillo tetra 1000ml', 'XLS-7702168420135',
      60000.00, 52643.00,
      60000.00, 60000.00, TRUE, FALSE,
      'ACTIVE', 'UNIT', 'UND',
      'd62a28a9-32ac-4df5-ad91-142c14b0edd8'::uuid, '59469cae-477c-4263-b086-3883c987a82b'::uuid, NOW(), NOW()
    );
  END IF;
  IF v_product IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_product,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_icl, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_adv, 'calculation_order', 20),
        jsonb_build_object('tax_id', v_iva5, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_product,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000010'::uuid,
        'alcohol_degree', 29.000,
        'net_volume_ml', 1000.000,
        'dane_certified_retail_price', 60000.00,
        'dane_price_effective_from', CURRENT_DATE::text,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva5, updated_at = NOW()
    WHERE id = v_product AND tenant_id = v_tenant;
  END IF;

  -- LIQUOR 7702168594300 / Aguardiente amarillo 375ml
  v_product := NULL;
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-7702168594300'))
      OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('Aguardiente amarillo 375ml'))
      OR UPPER(BTRIM(p.name)) LIKE '%' || UPPER(BTRIM('Aguardiente amarillo 375ml')) || '%')
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    v_product := v_matched;
  ELSIF NOT EXISTS (
    SELECT 1 FROM products
    WHERE tenant_id = v_tenant AND UPPER(BTRIM(sku)) = UPPER(BTRIM('XLS-7702168594300'))
  ) THEN
    v_product := '74c79101-f97a-5ad6-b196-5e0fd8945a4f'::uuid;
    INSERT INTO products (
      id, tenant_id, unit_id, tax_id, name, description, sku, price, cost,
      price_with_tax, price_without_tax, is_active, requires_lot,
      operational_status, sale_type, measurement_unit,
      category_id, subcategory_id, created_at, updated_at
    ) VALUES (
      v_product, v_tenant, '10000000-0000-0000-0000-000000000001'::uuid, v_iva5, 'Aguardiente amarillo 375ml', 'Aguardiente amarillo 375ml', 'XLS-7702168594300',
      30000.00, 25600.00,
      30000.00, 30000.00, TRUE, FALSE,
      'ACTIVE', 'UNIT', 'UND',
      'd62a28a9-32ac-4df5-ad91-142c14b0edd8'::uuid, '59469cae-477c-4263-b086-3883c987a82b'::uuid, NOW(), NOW()
    );
  END IF;
  IF v_product IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_product,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_icl, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_adv, 'calculation_order', 20),
        jsonb_build_object('tax_id', v_iva5, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_product,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000010'::uuid,
        'alcohol_degree', 29.000,
        'net_volume_ml', 375.000,
        'dane_certified_retail_price', 30000.00,
        'dane_price_effective_from', CURRENT_DATE::text,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva5, updated_at = NOW()
    WHERE id = v_product AND tenant_id = v_tenant;
  END IF;

  -- LIQUOR 7702168364231 / Ron esencial 750ml
  v_product := NULL;
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-7702168364231'))
      OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('Ron esencial 750ml'))
      OR UPPER(BTRIM(p.name)) LIKE '%' || UPPER(BTRIM('Ron esencial 750ml')) || '%')
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    v_product := v_matched;
  ELSIF NOT EXISTS (
    SELECT 1 FROM products
    WHERE tenant_id = v_tenant AND UPPER(BTRIM(sku)) = UPPER(BTRIM('XLS-7702168364231'))
  ) THEN
    v_product := '07533ba3-059d-594d-a765-4cf961737a51'::uuid;
    INSERT INTO products (
      id, tenant_id, unit_id, tax_id, name, description, sku, price, cost,
      price_with_tax, price_without_tax, is_active, requires_lot,
      operational_status, sale_type, measurement_unit,
      category_id, subcategory_id, created_at, updated_at
    ) VALUES (
      v_product, v_tenant, '10000000-0000-0000-0000-000000000001'::uuid, v_iva5, 'Ron esencial 750ml', 'Ron esencial 750ml', 'XLS-7702168364231',
      48000.00, 38500.00,
      48000.00, 48000.00, TRUE, FALSE,
      'ACTIVE', 'UNIT', 'UND',
      'd62a28a9-32ac-4df5-ad91-142c14b0edd8'::uuid, '59469cae-477c-4263-b086-3883c987a82b'::uuid, NOW(), NOW()
    );
  END IF;
  IF v_product IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_product,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_icl, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_adv, 'calculation_order', 20),
        jsonb_build_object('tax_id', v_iva5, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_product,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000010'::uuid,
        'alcohol_degree', 35.000,
        'net_volume_ml', 750.000,
        'dane_certified_retail_price', 48000.00,
        'dane_price_effective_from', CURRENT_DATE::text,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva5, updated_at = NOW()
    WHERE id = v_product AND tenant_id = v_tenant;
  END IF;

  -- LIQUOR 7702168217308 / Ron viejo de calda 750ml
  v_product := NULL;
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-7702168217308'))
      OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('Ron viejo de calda 750ml'))
      OR UPPER(BTRIM(p.name)) LIKE '%' || UPPER(BTRIM('Ron viejo de calda 750ml')) || '%')
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    v_product := v_matched;
  ELSIF NOT EXISTS (
    SELECT 1 FROM products
    WHERE tenant_id = v_tenant AND UPPER(BTRIM(sku)) = UPPER(BTRIM('XLS-7702168217308'))
  ) THEN
    v_product := '4ae3c840-a341-595f-9ae5-42e07d2a218a'::uuid;
    INSERT INTO products (
      id, tenant_id, unit_id, tax_id, name, description, sku, price, cost,
      price_with_tax, price_without_tax, is_active, requires_lot,
      operational_status, sale_type, measurement_unit,
      category_id, subcategory_id, created_at, updated_at
    ) VALUES (
      v_product, v_tenant, '10000000-0000-0000-0000-000000000001'::uuid, v_iva5, 'Ron viejo de calda 750ml', 'Ron viejo de calda 750ml', 'XLS-7702168217308',
      63000.00, 50800.00,
      63000.00, 63000.00, TRUE, FALSE,
      'ACTIVE', 'UNIT', 'UND',
      'd62a28a9-32ac-4df5-ad91-142c14b0edd8'::uuid, '59469cae-477c-4263-b086-3883c987a82b'::uuid, NOW(), NOW()
    );
  END IF;
  IF v_product IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_product,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_icl, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_adv, 'calculation_order', 20),
        jsonb_build_object('tax_id', v_iva5, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_product,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000010'::uuid,
        'alcohol_degree', 35.000,
        'net_volume_ml', 750.000,
        'dane_certified_retail_price', 63000.00,
        'dane_price_effective_from', CURRENT_DATE::text,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva5, updated_at = NOW()
    WHERE id = v_product AND tenant_id = v_tenant;
  END IF;

  -- LIQUOR 7702168214000 / Ron viejo de calda 375ml
  v_product := NULL;
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-7702168214000'))
      OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('Ron viejo de calda 375ml'))
      OR UPPER(BTRIM(p.name)) LIKE '%' || UPPER(BTRIM('Ron viejo de calda 375ml')) || '%')
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    v_product := v_matched;
  ELSIF NOT EXISTS (
    SELECT 1 FROM products
    WHERE tenant_id = v_tenant AND UPPER(BTRIM(sku)) = UPPER(BTRIM('XLS-7702168214000'))
  ) THEN
    v_product := 'b074e93b-9a4d-58c6-884a-5d8382bd9836'::uuid;
    INSERT INTO products (
      id, tenant_id, unit_id, tax_id, name, description, sku, price, cost,
      price_with_tax, price_without_tax, is_active, requires_lot,
      operational_status, sale_type, measurement_unit,
      category_id, subcategory_id, created_at, updated_at
    ) VALUES (
      v_product, v_tenant, '10000000-0000-0000-0000-000000000001'::uuid, v_iva5, 'Ron viejo de calda 375ml', 'Ron viejo de calda 375ml', 'XLS-7702168214000',
      32600.00, 26054.00,
      32600.00, 32600.00, TRUE, FALSE,
      'ACTIVE', 'UNIT', 'UND',
      'd62a28a9-32ac-4df5-ad91-142c14b0edd8'::uuid, '59469cae-477c-4263-b086-3883c987a82b'::uuid, NOW(), NOW()
    );
  END IF;
  IF v_product IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_product,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_icl, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_adv, 'calculation_order', 20),
        jsonb_build_object('tax_id', v_iva5, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_product,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000010'::uuid,
        'alcohol_degree', 35.000,
        'net_volume_ml', 375.000,
        'dane_certified_retail_price', 32600.00,
        'dane_price_effective_from', CURRENT_DATE::text,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva5, updated_at = NOW()
    WHERE id = v_product AND tenant_id = v_tenant;
  END IF;

  -- LIQUOR 7702168239201 / Ron juan cruz 750ml
  v_product := NULL;
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-7702168239201'))
      OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('Ron juan cruz 750ml'))
      OR UPPER(BTRIM(p.name)) LIKE '%' || UPPER(BTRIM('Ron juan cruz 750ml')) || '%')
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    v_product := v_matched;
  ELSIF NOT EXISTS (
    SELECT 1 FROM products
    WHERE tenant_id = v_tenant AND UPPER(BTRIM(sku)) = UPPER(BTRIM('XLS-7702168239201'))
  ) THEN
    v_product := '3e1bb420-6aa5-5784-be4a-a7d901049640'::uuid;
    INSERT INTO products (
      id, tenant_id, unit_id, tax_id, name, description, sku, price, cost,
      price_with_tax, price_without_tax, is_active, requires_lot,
      operational_status, sale_type, measurement_unit,
      category_id, subcategory_id, created_at, updated_at
    ) VALUES (
      v_product, v_tenant, '10000000-0000-0000-0000-000000000001'::uuid, v_iva5, 'Ron juan cruz 750ml', 'Ron juan cruz 750ml', 'XLS-7702168239201',
      82400.00, 65658.00,
      82400.00, 82400.00, TRUE, FALSE,
      'ACTIVE', 'UNIT', 'UND',
      'd62a28a9-32ac-4df5-ad91-142c14b0edd8'::uuid, '59469cae-477c-4263-b086-3883c987a82b'::uuid, NOW(), NOW()
    );
  END IF;
  IF v_product IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_product,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_icl, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_adv, 'calculation_order', 20),
        jsonb_build_object('tax_id', v_iva5, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_product,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000010'::uuid,
        'alcohol_degree', 35.000,
        'net_volume_ml', 750.000,
        'dane_certified_retail_price', 82400.00,
        'dane_price_effective_from', CURRENT_DATE::text,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva5, updated_at = NOW()
    WHERE id = v_product AND tenant_id = v_tenant;
  END IF;

  -- LIQUOR 7702168117400 / Aguardiente cristal xs verde
  v_product := NULL;
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-7702168117400'))
      OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('Aguardiente cristal xs verde'))
      OR UPPER(BTRIM(p.name)) LIKE '%' || UPPER(BTRIM('Aguardiente cristal xs verde')) || '%')
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    v_product := v_matched;
  ELSIF NOT EXISTS (
    SELECT 1 FROM products
    WHERE tenant_id = v_tenant AND UPPER(BTRIM(sku)) = UPPER(BTRIM('XLS-7702168117400'))
  ) THEN
    v_product := '5b619296-2fc0-56f8-abd5-bbb6a38eb272'::uuid;
    INSERT INTO products (
      id, tenant_id, unit_id, tax_id, name, description, sku, price, cost,
      price_with_tax, price_without_tax, is_active, requires_lot,
      operational_status, sale_type, measurement_unit,
      category_id, subcategory_id, created_at, updated_at
    ) VALUES (
      v_product, v_tenant, '10000000-0000-0000-0000-000000000001'::uuid, v_iva5, 'Aguardiente cristal xs verde', 'Aguardiente cristal xs verde', 'XLS-7702168117400',
      44900.00, 36000.00,
      44900.00, 44900.00, TRUE, FALSE,
      'ACTIVE', 'UNIT', 'UND',
      'd62a28a9-32ac-4df5-ad91-142c14b0edd8'::uuid, '59469cae-477c-4263-b086-3883c987a82b'::uuid, NOW(), NOW()
    );
  END IF;
  IF v_product IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_product,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_icl, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_adv, 'calculation_order', 20),
        jsonb_build_object('tax_id', v_iva5, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_product,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000010'::uuid,
        'alcohol_degree', 29.000,
        'net_volume_ml', 750.000,
        'dane_certified_retail_price', 44900.00,
        'dane_price_effective_from', CURRENT_DATE::text,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva5, updated_at = NOW()
    WHERE id = v_product AND tenant_id = v_tenant;
  END IF;

  -- LIQUOR 7702354958190 / Los cuates tequila margarita limon 269ml unida
  v_product := NULL;
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-7702354958190'))
      OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('Los cuates tequila margarita limon 269ml unida'))
      OR UPPER(BTRIM(p.name)) LIKE '%' || UPPER(BTRIM('Los cuates tequila margarita limon 269ml unida')) || '%')
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    v_product := v_matched;
  ELSIF NOT EXISTS (
    SELECT 1 FROM products
    WHERE tenant_id = v_tenant AND UPPER(BTRIM(sku)) = UPPER(BTRIM('XLS-7702354958190'))
  ) THEN
    v_product := '6470032a-ee13-56ae-a73e-c542b63cb487'::uuid;
    INSERT INTO products (
      id, tenant_id, unit_id, tax_id, name, description, sku, price, cost,
      price_with_tax, price_without_tax, is_active, requires_lot,
      operational_status, sale_type, measurement_unit,
      category_id, subcategory_id, created_at, updated_at
    ) VALUES (
      v_product, v_tenant, '10000000-0000-0000-0000-000000000001'::uuid, v_iva5, 'Los cuates tequila margarita limon 269ml unida', 'Los cuates tequila margarita limon 269ml unida', 'XLS-7702354958190',
      5000.00, 4100.00,
      5000.00, 5000.00, TRUE, FALSE,
      'ACTIVE', 'UNIT', 'UND',
      'd62a28a9-32ac-4df5-ad91-142c14b0edd8'::uuid, '59469cae-477c-4263-b086-3883c987a82b'::uuid, NOW(), NOW()
    );
  END IF;
  IF v_product IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_product,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_icl, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_adv, 'calculation_order', 20),
        jsonb_build_object('tax_id', v_iva5, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_product,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000010'::uuid,
        'alcohol_degree', 29.000,
        'net_volume_ml', 269.000,
        'dane_certified_retail_price', 5000.00,
        'dane_price_effective_from', CURRENT_DATE::text,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva5, updated_at = NOW()
    WHERE id = v_product AND tenant_id = v_tenant;
  END IF;

  -- LIQUOR 7501035010109 / Tequila jose cuervo reposdo 750ml
  v_product := NULL;
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-7501035010109'))
      OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('Tequila jose cuervo reposdo 750ml'))
      OR UPPER(BTRIM(p.name)) LIKE '%' || UPPER(BTRIM('Tequila jose cuervo reposdo 750ml')) || '%')
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    v_product := v_matched;
  ELSIF NOT EXISTS (
    SELECT 1 FROM products
    WHERE tenant_id = v_tenant AND UPPER(BTRIM(sku)) = UPPER(BTRIM('XLS-7501035010109'))
  ) THEN
    v_product := 'c3c8052a-bf02-59dd-b6aa-4060f52f0c71'::uuid;
    INSERT INTO products (
      id, tenant_id, unit_id, tax_id, name, description, sku, price, cost,
      price_with_tax, price_without_tax, is_active, requires_lot,
      operational_status, sale_type, measurement_unit,
      category_id, subcategory_id, created_at, updated_at
    ) VALUES (
      v_product, v_tenant, '10000000-0000-0000-0000-000000000001'::uuid, v_iva5, 'Tequila jose cuervo reposdo 750ml', 'Tequila jose cuervo reposdo 750ml', 'XLS-7501035010109',
      94800.00, 75839.00,
      94800.00, 94800.00, TRUE, FALSE,
      'ACTIVE', 'UNIT', 'UND',
      'd62a28a9-32ac-4df5-ad91-142c14b0edd8'::uuid, '59469cae-477c-4263-b086-3883c987a82b'::uuid, NOW(), NOW()
    );
  END IF;
  IF v_product IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_product,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_icl, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_adv, 'calculation_order', 20),
        jsonb_build_object('tax_id', v_iva5, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_product,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000010'::uuid,
        'alcohol_degree', 29.000,
        'net_volume_ml', 750.000,
        'dane_certified_retail_price', 94800.00,
        'dane_price_effective_from', CURRENT_DATE::text,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva5, updated_at = NOW()
    WHERE id = v_product AND tenant_id = v_tenant;
  END IF;

  -- LIQUOR 7501035011335 / Tequila jose cuervo silver 750ml
  v_product := NULL;
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-7501035011335'))
      OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('Tequila jose cuervo silver 750ml'))
      OR UPPER(BTRIM(p.name)) LIKE '%' || UPPER(BTRIM('Tequila jose cuervo silver 750ml')) || '%')
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    v_product := v_matched;
  ELSIF NOT EXISTS (
    SELECT 1 FROM products
    WHERE tenant_id = v_tenant AND UPPER(BTRIM(sku)) = UPPER(BTRIM('XLS-7501035011335'))
  ) THEN
    v_product := 'e4bcfd1c-4403-53d0-a6ec-12710642e8bf'::uuid;
    INSERT INTO products (
      id, tenant_id, unit_id, tax_id, name, description, sku, price, cost,
      price_with_tax, price_without_tax, is_active, requires_lot,
      operational_status, sale_type, measurement_unit,
      category_id, subcategory_id, created_at, updated_at
    ) VALUES (
      v_product, v_tenant, '10000000-0000-0000-0000-000000000001'::uuid, v_iva5, 'Tequila jose cuervo silver 750ml', 'Tequila jose cuervo silver 750ml', 'XLS-7501035011335',
      101500.00, 81170.00,
      101500.00, 101500.00, TRUE, FALSE,
      'ACTIVE', 'UNIT', 'UND',
      'd62a28a9-32ac-4df5-ad91-142c14b0edd8'::uuid, '59469cae-477c-4263-b086-3883c987a82b'::uuid, NOW(), NOW()
    );
  END IF;
  IF v_product IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_product,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_icl, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_adv, 'calculation_order', 20),
        jsonb_build_object('tax_id', v_iva5, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_product,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000010'::uuid,
        'alcohol_degree', 29.000,
        'net_volume_ml', 750.000,
        'dane_certified_retail_price', 101500.00,
        'dane_price_effective_from', CURRENT_DATE::text,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva5, updated_at = NOW()
    WHERE id = v_product AND tenant_id = v_tenant;
  END IF;

  -- LIQUOR 7501035013230 / Tequila reserva silver 1800 750ml
  v_product := NULL;
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-7501035013230'))
      OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('Tequila reserva silver 1800 750ml'))
      OR UPPER(BTRIM(p.name)) LIKE '%' || UPPER(BTRIM('Tequila reserva silver 1800 750ml')) || '%')
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    v_product := v_matched;
  ELSIF NOT EXISTS (
    SELECT 1 FROM products
    WHERE tenant_id = v_tenant AND UPPER(BTRIM(sku)) = UPPER(BTRIM('XLS-7501035013230'))
  ) THEN
    v_product := 'd98ac956-e604-599a-95d3-dc2b521665d6'::uuid;
    INSERT INTO products (
      id, tenant_id, unit_id, tax_id, name, description, sku, price, cost,
      price_with_tax, price_without_tax, is_active, requires_lot,
      operational_status, sale_type, measurement_unit,
      category_id, subcategory_id, created_at, updated_at
    ) VALUES (
      v_product, v_tenant, '10000000-0000-0000-0000-000000000001'::uuid, v_iva5, 'Tequila reserva silver 1800 750ml', 'Tequila reserva silver 1800 750ml', 'XLS-7501035013230',
      230000.00, 184080.00,
      230000.00, 230000.00, TRUE, FALSE,
      'ACTIVE', 'UNIT', 'UND',
      'd62a28a9-32ac-4df5-ad91-142c14b0edd8'::uuid, '59469cae-477c-4263-b086-3883c987a82b'::uuid, NOW(), NOW()
    );
  END IF;
  IF v_product IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_product,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_icl, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_adv, 'calculation_order', 20),
        jsonb_build_object('tax_id', v_iva5, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_product,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000010'::uuid,
        'alcohol_degree', 29.000,
        'net_volume_ml', 750.000,
        'dane_certified_retail_price', 230000.00,
        'dane_price_effective_from', CURRENT_DATE::text,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva5, updated_at = NOW()
    WHERE id = v_product AND tenant_id = v_tenant;
  END IF;

  -- LIQUOR 082184090473 / Whisky jack daniel  tennessee sour mash 700ml
  v_product := NULL;
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-082184090473'))
      OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('Whisky jack daniel  tennessee sour mash 700ml'))
      OR UPPER(BTRIM(p.name)) LIKE '%' || UPPER(BTRIM('Whisky jack daniel  tennessee sour mash 700ml')) || '%')
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    v_product := v_matched;
  ELSIF NOT EXISTS (
    SELECT 1 FROM products
    WHERE tenant_id = v_tenant AND UPPER(BTRIM(sku)) = UPPER(BTRIM('XLS-082184090473'))
  ) THEN
    v_product := 'b273b143-cab7-5eb2-b8e4-e138d0b8f396'::uuid;
    INSERT INTO products (
      id, tenant_id, unit_id, tax_id, name, description, sku, price, cost,
      price_with_tax, price_without_tax, is_active, requires_lot,
      operational_status, sale_type, measurement_unit,
      category_id, subcategory_id, created_at, updated_at
    ) VALUES (
      v_product, v_tenant, '10000000-0000-0000-0000-000000000001'::uuid, v_iva5, 'Whisky jack daniel  tennessee sour mash 700ml', 'Whisky jack daniel  tennessee sour mash 700ml', 'XLS-082184090473',
      130000.00, 104064.00,
      130000.00, 130000.00, TRUE, FALSE,
      'ACTIVE', 'UNIT', 'UND',
      'd62a28a9-32ac-4df5-ad91-142c14b0edd8'::uuid, '7fd6dac4-6a98-4cda-822f-332ff15c791e'::uuid, NOW(), NOW()
    );
  END IF;
  IF v_product IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_product,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_icl, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_adv, 'calculation_order', 20),
        jsonb_build_object('tax_id', v_iva5, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_product,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000010'::uuid,
        'alcohol_degree', 40.000,
        'net_volume_ml', 700.000,
        'dane_certified_retail_price', 130000.00,
        'dane_price_effective_from', CURRENT_DATE::text,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva5, updated_at = NOW()
    WHERE id = v_product AND tenant_id = v_tenant;
  END IF;

  -- LIQUOR 5099873001370 / Whisky jack daniel honey 700ml
  v_product := NULL;
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-5099873001370'))
      OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('Whisky jack daniel honey 700ml'))
      OR UPPER(BTRIM(p.name)) LIKE '%' || UPPER(BTRIM('Whisky jack daniel honey 700ml')) || '%')
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    v_product := v_matched;
  ELSIF NOT EXISTS (
    SELECT 1 FROM products
    WHERE tenant_id = v_tenant AND UPPER(BTRIM(sku)) = UPPER(BTRIM('XLS-5099873001370'))
  ) THEN
    v_product := '15d75856-bf6a-5e30-8f3a-69ad9b15108e'::uuid;
    INSERT INTO products (
      id, tenant_id, unit_id, tax_id, name, description, sku, price, cost,
      price_with_tax, price_without_tax, is_active, requires_lot,
      operational_status, sale_type, measurement_unit,
      category_id, subcategory_id, created_at, updated_at
    ) VALUES (
      v_product, v_tenant, '10000000-0000-0000-0000-000000000001'::uuid, v_iva5, 'Whisky jack daniel honey 700ml', 'Whisky jack daniel honey 700ml', 'XLS-5099873001370',
      130000.00, 104209.00,
      130000.00, 130000.00, TRUE, FALSE,
      'ACTIVE', 'UNIT', 'UND',
      'd62a28a9-32ac-4df5-ad91-142c14b0edd8'::uuid, '7fd6dac4-6a98-4cda-822f-332ff15c791e'::uuid, NOW(), NOW()
    );
  END IF;
  IF v_product IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_product,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_icl, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_adv, 'calculation_order', 20),
        jsonb_build_object('tax_id', v_iva5, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_product,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000010'::uuid,
        'alcohol_degree', 40.000,
        'net_volume_ml', 700.000,
        'dane_certified_retail_price', 130000.00,
        'dane_price_effective_from', CURRENT_DATE::text,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva5, updated_at = NOW()
    WHERE id = v_product AND tenant_id = v_tenant;
  END IF;

  -- LIQUOR 5010314700003 / Whisky the famous grouse 700ml
  v_product := NULL;
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-5010314700003'))
      OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('Whisky the famous grouse 700ml'))
      OR UPPER(BTRIM(p.name)) LIKE '%' || UPPER(BTRIM('Whisky the famous grouse 700ml')) || '%')
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    v_product := v_matched;
  ELSIF NOT EXISTS (
    SELECT 1 FROM products
    WHERE tenant_id = v_tenant AND UPPER(BTRIM(sku)) = UPPER(BTRIM('XLS-5010314700003'))
  ) THEN
    v_product := 'b42e11ac-0bba-5c6e-a449-77735a1a836a'::uuid;
    INSERT INTO products (
      id, tenant_id, unit_id, tax_id, name, description, sku, price, cost,
      price_with_tax, price_without_tax, is_active, requires_lot,
      operational_status, sale_type, measurement_unit,
      category_id, subcategory_id, created_at, updated_at
    ) VALUES (
      v_product, v_tenant, '10000000-0000-0000-0000-000000000001'::uuid, v_iva5, 'Whisky the famous grouse 700ml', 'Whisky the famous grouse 700ml', 'XLS-5010314700003',
      79000.00, 63233.00,
      79000.00, 79000.00, TRUE, FALSE,
      'ACTIVE', 'UNIT', 'UND',
      'd62a28a9-32ac-4df5-ad91-142c14b0edd8'::uuid, '7fd6dac4-6a98-4cda-822f-332ff15c791e'::uuid, NOW(), NOW()
    );
  END IF;
  IF v_product IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_product,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_icl, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_adv, 'calculation_order', 20),
        jsonb_build_object('tax_id', v_iva5, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_product,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000010'::uuid,
        'alcohol_degree', 40.000,
        'net_volume_ml', 700.000,
        'dane_certified_retail_price', 79000.00,
        'dane_price_effective_from', CURRENT_DATE::text,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva5, updated_at = NOW()
    WHERE id = v_product AND tenant_id = v_tenant;
  END IF;

  -- LIQUOR I-17824271250 / Ron bacardi mojito 750ml
  v_product := NULL;
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-I-17824271250'))
      OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('Ron bacardi mojito 750ml'))
      OR UPPER(BTRIM(p.name)) LIKE '%' || UPPER(BTRIM('Ron bacardi mojito 750ml')) || '%')
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    v_product := v_matched;
  ELSIF NOT EXISTS (
    SELECT 1 FROM products
    WHERE tenant_id = v_tenant AND UPPER(BTRIM(sku)) = UPPER(BTRIM('XLS-I-17824271250'))
  ) THEN
    v_product := 'b93aaf10-9a97-5977-8f9d-ad9b604e76b9'::uuid;
    INSERT INTO products (
      id, tenant_id, unit_id, tax_id, name, description, sku, price, cost,
      price_with_tax, price_without_tax, is_active, requires_lot,
      operational_status, sale_type, measurement_unit,
      category_id, subcategory_id, created_at, updated_at
    ) VALUES (
      v_product, v_tenant, '10000000-0000-0000-0000-000000000001'::uuid, v_iva5, 'Ron bacardi mojito 750ml', 'Ron bacardi mojito 750ml', 'XLS-I-17824271250',
      52000.00, 40989.00,
      52000.00, 52000.00, TRUE, FALSE,
      'ACTIVE', 'UNIT', 'UND',
      'd62a28a9-32ac-4df5-ad91-142c14b0edd8'::uuid, '59469cae-477c-4263-b086-3883c987a82b'::uuid, NOW(), NOW()
    );
  END IF;
  IF v_product IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_product,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_icl, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_adv, 'calculation_order', 20),
        jsonb_build_object('tax_id', v_iva5, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_product,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000010'::uuid,
        'alcohol_degree', 35.000,
        'net_volume_ml', 750.000,
        'dane_certified_retail_price', 52000.00,
        'dane_price_effective_from', CURRENT_DATE::text,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva5, updated_at = NOW()
    WHERE id = v_product AND tenant_id = v_tenant;
  END IF;

  -- LIQUOR 7610113024942 / Ron bacardi carta blanca superior 700ml
  v_product := NULL;
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-7610113024942'))
      OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('Ron bacardi carta blanca superior 700ml'))
      OR UPPER(BTRIM(p.name)) LIKE '%' || UPPER(BTRIM('Ron bacardi carta blanca superior 700ml')) || '%')
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    v_product := v_matched;
  ELSIF NOT EXISTS (
    SELECT 1 FROM products
    WHERE tenant_id = v_tenant AND UPPER(BTRIM(sku)) = UPPER(BTRIM('XLS-7610113024942'))
  ) THEN
    v_product := '924a8526-df1d-5bed-b245-169ca8c60f8b'::uuid;
    INSERT INTO products (
      id, tenant_id, unit_id, tax_id, name, description, sku, price, cost,
      price_with_tax, price_without_tax, is_active, requires_lot,
      operational_status, sale_type, measurement_unit,
      category_id, subcategory_id, created_at, updated_at
    ) VALUES (
      v_product, v_tenant, '10000000-0000-0000-0000-000000000001'::uuid, v_iva5, 'Ron bacardi carta blanca superior 700ml', 'Ron bacardi carta blanca superior 700ml', 'XLS-7610113024942',
      62000.00, 49080.00,
      62000.00, 62000.00, TRUE, FALSE,
      'ACTIVE', 'UNIT', 'UND',
      'd62a28a9-32ac-4df5-ad91-142c14b0edd8'::uuid, '59469cae-477c-4263-b086-3883c987a82b'::uuid, NOW(), NOW()
    );
  END IF;
  IF v_product IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_product,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_icl, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_adv, 'calculation_order', 20),
        jsonb_build_object('tax_id', v_iva5, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_product,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000010'::uuid,
        'alcohol_degree', 35.000,
        'net_volume_ml', 700.000,
        'dane_certified_retail_price', 62000.00,
        'dane_price_effective_from', CURRENT_DATE::text,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva5, updated_at = NOW()
    WHERE id = v_product AND tenant_id = v_tenant;
  END IF;

  -- LIQUOR 764009055361 / Smirnoff spicy tamarindo lata 350ml 1 unidad
  v_product := NULL;
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-764009055361'))
      OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('Smirnoff spicy tamarindo lata 350ml 1 unidad'))
      OR UPPER(BTRIM(p.name)) LIKE '%' || UPPER(BTRIM('Smirnoff spicy tamarindo lata 350ml 1 unidad')) || '%')
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    v_product := v_matched;
  ELSIF NOT EXISTS (
    SELECT 1 FROM products
    WHERE tenant_id = v_tenant AND UPPER(BTRIM(sku)) = UPPER(BTRIM('XLS-764009055361'))
  ) THEN
    v_product := '1911cab7-4562-5d0d-8f5d-17994e649142'::uuid;
    INSERT INTO products (
      id, tenant_id, unit_id, tax_id, name, description, sku, price, cost,
      price_with_tax, price_without_tax, is_active, requires_lot,
      operational_status, sale_type, measurement_unit,
      category_id, subcategory_id, created_at, updated_at
    ) VALUES (
      v_product, v_tenant, '10000000-0000-0000-0000-000000000001'::uuid, v_iva5, 'Smirnoff spicy tamarindo lata 350ml 1 unidad', 'Smirnoff spicy tamarindo lata 350ml 1 unidad', 'XLS-764009055361',
      10500.00, 8260.00,
      10500.00, 10500.00, TRUE, FALSE,
      'ACTIVE', 'UNIT', 'UND',
      'd62a28a9-32ac-4df5-ad91-142c14b0edd8'::uuid, '59469cae-477c-4263-b086-3883c987a82b'::uuid, NOW(), NOW()
    );
  END IF;
  IF v_product IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_product,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_icl, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_adv, 'calculation_order', 20),
        jsonb_build_object('tax_id', v_iva5, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_product,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000010'::uuid,
        'alcohol_degree', 29.000,
        'net_volume_ml', 350.000,
        'dane_certified_retail_price', 10500.00,
        'dane_price_effective_from', CURRENT_DATE::text,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva5, updated_at = NOW()
    WHERE id = v_product AND tenant_id = v_tenant;
  END IF;

  -- LIQUOR 5000299609347 / The glenlivet  founder,reserve
  v_product := NULL;
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-5000299609347'))
      OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('The glenlivet  founder,reserve'))
      OR UPPER(BTRIM(p.name)) LIKE '%' || UPPER(BTRIM('The glenlivet  founder,reserve')) || '%')
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    v_product := v_matched;
  ELSIF NOT EXISTS (
    SELECT 1 FROM products
    WHERE tenant_id = v_tenant AND UPPER(BTRIM(sku)) = UPPER(BTRIM('XLS-5000299609347'))
  ) THEN
    v_product := 'd34a2905-4385-5334-a211-76c1d3738f83'::uuid;
    INSERT INTO products (
      id, tenant_id, unit_id, tax_id, name, description, sku, price, cost,
      price_with_tax, price_without_tax, is_active, requires_lot,
      operational_status, sale_type, measurement_unit,
      category_id, subcategory_id, created_at, updated_at
    ) VALUES (
      v_product, v_tenant, '10000000-0000-0000-0000-000000000001'::uuid, v_iva5, 'The glenlivet  founder,reserve', 'The glenlivet  founder,reserve', 'XLS-5000299609347',
      174873.00, 139899.00,
      174873.00, 174873.00, TRUE, FALSE,
      'ACTIVE', 'UNIT', 'UND',
      'd62a28a9-32ac-4df5-ad91-142c14b0edd8'::uuid, '59469cae-477c-4263-b086-3883c987a82b'::uuid, NOW(), NOW()
    );
  END IF;
  IF v_product IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_product,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_icl, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_adv, 'calculation_order', 20),
        jsonb_build_object('tax_id', v_iva5, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_product,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000010'::uuid,
        'alcohol_degree', 29.000,
        'net_volume_ml', 750.000,
        'dane_certified_retail_price', 174873.00,
        'dane_price_effective_from', CURRENT_DATE::text,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva5, updated_at = NOW()
    WHERE id = v_product AND tenant_id = v_tenant;
  END IF;

  -- LIQUOR I-17829470540 / Ron medellin 3 años bot lt
  v_product := NULL;
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-I-17829470540'))
      OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('Ron medellin 3 años bot lt'))
      OR UPPER(BTRIM(p.name)) LIKE '%' || UPPER(BTRIM('Ron medellin 3 años bot lt')) || '%')
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    v_product := v_matched;
  ELSIF NOT EXISTS (
    SELECT 1 FROM products
    WHERE tenant_id = v_tenant AND UPPER(BTRIM(sku)) = UPPER(BTRIM('XLS-I-17829470540'))
  ) THEN
    v_product := 'd3078d4d-352e-52c1-8939-b5e6c92ec90c'::uuid;
    INSERT INTO products (
      id, tenant_id, unit_id, tax_id, name, description, sku, price, cost,
      price_with_tax, price_without_tax, is_active, requires_lot,
      operational_status, sale_type, measurement_unit,
      category_id, subcategory_id, created_at, updated_at
    ) VALUES (
      v_product, v_tenant, '10000000-0000-0000-0000-000000000001'::uuid, v_iva5, 'Ron medellin 3 años bot lt', 'Ron medellin 3 años bot lt', 'XLS-I-17829470540',
      83000.00, 66200.00,
      83000.00, 83000.00, TRUE, FALSE,
      'ACTIVE', 'UNIT', 'UND',
      'd62a28a9-32ac-4df5-ad91-142c14b0edd8'::uuid, '59469cae-477c-4263-b086-3883c987a82b'::uuid, NOW(), NOW()
    );
  END IF;
  IF v_product IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_product,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_icl, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_adv, 'calculation_order', 20),
        jsonb_build_object('tax_id', v_iva5, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_product,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000010'::uuid,
        'alcohol_degree', 35.000,
        'net_volume_ml', 750.000,
        'dane_certified_retail_price', 83000.00,
        'dane_price_effective_from', CURRENT_DATE::text,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva5, updated_at = NOW()
    WHERE id = v_product AND tenant_id = v_tenant;
  END IF;

  -- LIQUOR I-17829473050 / Aguardiente antioqueño verde 1000 botella
  v_product := NULL;
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-I-17829473050'))
      OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('Aguardiente antioqueño verde 1000 botella'))
      OR UPPER(BTRIM(p.name)) LIKE '%' || UPPER(BTRIM('Aguardiente antioqueño verde 1000 botella')) || '%')
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    v_product := v_matched;
  ELSIF NOT EXISTS (
    SELECT 1 FROM products
    WHERE tenant_id = v_tenant AND UPPER(BTRIM(sku)) = UPPER(BTRIM('XLS-I-17829473050'))
  ) THEN
    v_product := 'ade34e0d-702e-5b09-8dc8-736e0788b453'::uuid;
    INSERT INTO products (
      id, tenant_id, unit_id, tax_id, name, description, sku, price, cost,
      price_with_tax, price_without_tax, is_active, requires_lot,
      operational_status, sale_type, measurement_unit,
      category_id, subcategory_id, created_at, updated_at
    ) VALUES (
      v_product, v_tenant, '10000000-0000-0000-0000-000000000001'::uuid, v_iva5, 'Aguardiente antioqueño verde 1000 botella', 'Aguardiente antioqueño verde 1000 botella', 'XLS-I-17829473050',
      70000.00, 56600.00,
      70000.00, 70000.00, TRUE, FALSE,
      'ACTIVE', 'UNIT', 'UND',
      'd62a28a9-32ac-4df5-ad91-142c14b0edd8'::uuid, '59469cae-477c-4263-b086-3883c987a82b'::uuid, NOW(), NOW()
    );
  END IF;
  IF v_product IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_product,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_icl, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_adv, 'calculation_order', 20),
        jsonb_build_object('tax_id', v_iva5, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_product,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000010'::uuid,
        'alcohol_degree', 29.000,
        'net_volume_ml', 1000.000,
        'dane_certified_retail_price', 70000.00,
        'dane_price_effective_from', CURRENT_DATE::text,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva5, updated_at = NOW()
    WHERE id = v_product AND tenant_id = v_tenant;
  END IF;

  -- LIQUOR I-17829476520 / Ron medellin dorado 750ml
  v_product := NULL;
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-I-17829476520'))
      OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('Ron medellin dorado 750ml'))
      OR UPPER(BTRIM(p.name)) LIKE '%' || UPPER(BTRIM('Ron medellin dorado 750ml')) || '%')
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    v_product := v_matched;
  ELSIF NOT EXISTS (
    SELECT 1 FROM products
    WHERE tenant_id = v_tenant AND UPPER(BTRIM(sku)) = UPPER(BTRIM('XLS-I-17829476520'))
  ) THEN
    v_product := '78238aa4-0e23-5c03-80b7-89d5f92f60f6'::uuid;
    INSERT INTO products (
      id, tenant_id, unit_id, tax_id, name, description, sku, price, cost,
      price_with_tax, price_without_tax, is_active, requires_lot,
      operational_status, sale_type, measurement_unit,
      category_id, subcategory_id, created_at, updated_at
    ) VALUES (
      v_product, v_tenant, '10000000-0000-0000-0000-000000000001'::uuid, v_iva5, 'Ron medellin dorado 750ml', 'Ron medellin dorado 750ml', 'XLS-I-17829476520',
      60000.00, 49200.00,
      60000.00, 60000.00, TRUE, FALSE,
      'ACTIVE', 'UNIT', 'UND',
      'd62a28a9-32ac-4df5-ad91-142c14b0edd8'::uuid, '59469cae-477c-4263-b086-3883c987a82b'::uuid, NOW(), NOW()
    );
  END IF;
  IF v_product IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_product,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_icl, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_adv, 'calculation_order', 20),
        jsonb_build_object('tax_id', v_iva5, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_product,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000010'::uuid,
        'alcohol_degree', 35.000,
        'net_volume_ml', 750.000,
        'dane_certified_retail_price', 60000.00,
        'dane_price_effective_from', CURRENT_DATE::text,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva5, updated_at = NOW()
    WHERE id = v_product AND tenant_id = v_tenant;
  END IF;

  -- LIQUOR 080432402931 / Whisky chiva regal 12 años 700ml
  v_product := NULL;
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-080432402931'))
      OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('Whisky chiva regal 12 años 700ml'))
      OR UPPER(BTRIM(p.name)) LIKE '%' || UPPER(BTRIM('Whisky chiva regal 12 años 700ml')) || '%')
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    v_product := v_matched;
  ELSIF NOT EXISTS (
    SELECT 1 FROM products
    WHERE tenant_id = v_tenant AND UPPER(BTRIM(sku)) = UPPER(BTRIM('XLS-080432402931'))
  ) THEN
    v_product := '388e8c09-023d-5cba-8983-37ccd79df106'::uuid;
    INSERT INTO products (
      id, tenant_id, unit_id, tax_id, name, description, sku, price, cost,
      price_with_tax, price_without_tax, is_active, requires_lot,
      operational_status, sale_type, measurement_unit,
      category_id, subcategory_id, created_at, updated_at
    ) VALUES (
      v_product, v_tenant, '10000000-0000-0000-0000-000000000001'::uuid, v_iva5, 'Whisky chiva regal 12 años 700ml', 'Whisky chiva regal 12 años 700ml', 'XLS-080432402931',
      134000.00, 107781.00,
      134000.00, 134000.00, TRUE, FALSE,
      'ACTIVE', 'UNIT', 'UND',
      'd62a28a9-32ac-4df5-ad91-142c14b0edd8'::uuid, '7fd6dac4-6a98-4cda-822f-332ff15c791e'::uuid, NOW(), NOW()
    );
  END IF;
  IF v_product IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_product,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_icl, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_adv, 'calculation_order', 20),
        jsonb_build_object('tax_id', v_iva5, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_product,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000010'::uuid,
        'alcohol_degree', 40.000,
        'net_volume_ml', 700.000,
        'dane_certified_retail_price', 134000.00,
        'dane_price_effective_from', CURRENT_DATE::text,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva5, updated_at = NOW()
    WHERE id = v_product AND tenant_id = v_tenant;
  END IF;

  -- LIQUOR 7312040017683 / Vodka absolut 700ml
  v_product := NULL;
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-7312040017683'))
      OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('Vodka absolut 700ml'))
      OR UPPER(BTRIM(p.name)) LIKE '%' || UPPER(BTRIM('Vodka absolut 700ml')) || '%')
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    v_product := v_matched;
  ELSIF NOT EXISTS (
    SELECT 1 FROM products
    WHERE tenant_id = v_tenant AND UPPER(BTRIM(sku)) = UPPER(BTRIM('XLS-7312040017683'))
  ) THEN
    v_product := 'bc323ef9-2aaf-5192-9a8c-3f3873a76428'::uuid;
    INSERT INTO products (
      id, tenant_id, unit_id, tax_id, name, description, sku, price, cost,
      price_with_tax, price_without_tax, is_active, requires_lot,
      operational_status, sale_type, measurement_unit,
      category_id, subcategory_id, created_at, updated_at
    ) VALUES (
      v_product, v_tenant, '10000000-0000-0000-0000-000000000001'::uuid, v_iva5, 'Vodka absolut 700ml', 'Vodka absolut 700ml', 'XLS-7312040017683',
      86000.00, 69052.00,
      86000.00, 86000.00, TRUE, FALSE,
      'ACTIVE', 'UNIT', 'UND',
      'd62a28a9-32ac-4df5-ad91-142c14b0edd8'::uuid, '59469cae-477c-4263-b086-3883c987a82b'::uuid, NOW(), NOW()
    );
  END IF;
  IF v_product IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_product,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_icl, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_adv, 'calculation_order', 20),
        jsonb_build_object('tax_id', v_iva5, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_product,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000010'::uuid,
        'alcohol_degree', 29.000,
        'net_volume_ml', 700.000,
        'dane_certified_retail_price', 86000.00,
        'dane_price_effective_from', CURRENT_DATE::text,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva5, updated_at = NOW()
    WHERE id = v_product AND tenant_id = v_tenant;
  END IF;

  -- LIQUOR 5000299611104 / Whisky chivas regal 13 años 700ml
  v_product := NULL;
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-5000299611104'))
      OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('Whisky chivas regal 13 años 700ml'))
      OR UPPER(BTRIM(p.name)) LIKE '%' || UPPER(BTRIM('Whisky chivas regal 13 años 700ml')) || '%')
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    v_product := v_matched;
  ELSIF NOT EXISTS (
    SELECT 1 FROM products
    WHERE tenant_id = v_tenant AND UPPER(BTRIM(sku)) = UPPER(BTRIM('XLS-5000299611104'))
  ) THEN
    v_product := '6044e8a9-7ecf-54ec-830a-a8a6ae62783a'::uuid;
    INSERT INTO products (
      id, tenant_id, unit_id, tax_id, name, description, sku, price, cost,
      price_with_tax, price_without_tax, is_active, requires_lot,
      operational_status, sale_type, measurement_unit,
      category_id, subcategory_id, created_at, updated_at
    ) VALUES (
      v_product, v_tenant, '10000000-0000-0000-0000-000000000001'::uuid, v_iva5, 'Whisky chivas regal 13 años 700ml', 'Whisky chivas regal 13 años 700ml', 'XLS-5000299611104',
      184000.00, 146900.00,
      184000.00, 184000.00, TRUE, FALSE,
      'ACTIVE', 'UNIT', 'UND',
      'd62a28a9-32ac-4df5-ad91-142c14b0edd8'::uuid, '7fd6dac4-6a98-4cda-822f-332ff15c791e'::uuid, NOW(), NOW()
    );
  END IF;
  IF v_product IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_product,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_icl, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_adv, 'calculation_order', 20),
        jsonb_build_object('tax_id', v_iva5, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_product,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000010'::uuid,
        'alcohol_degree', 40.000,
        'net_volume_ml', 700.000,
        'dane_certified_retail_price', 184000.00,
        'dane_price_effective_from', CURRENT_DATE::text,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva5, updated_at = NOW()
    WHERE id = v_product AND tenant_id = v_tenant;
  END IF;

  -- LIQUOR 080432402825 / Whisky the glenlivet  single malt scotch 12 años 700
  v_product := NULL;
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-080432402825'))
      OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('Whisky the glenlivet  single malt scotch 12 años 700'))
      OR UPPER(BTRIM(p.name)) LIKE '%' || UPPER(BTRIM('Whisky the glenlivet  single malt scotch 12 años 700')) || '%')
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    v_product := v_matched;
  ELSIF NOT EXISTS (
    SELECT 1 FROM products
    WHERE tenant_id = v_tenant AND UPPER(BTRIM(sku)) = UPPER(BTRIM('XLS-080432402825'))
  ) THEN
    v_product := 'd3983cca-7e3f-504f-b4c5-d737c6659b8b'::uuid;
    INSERT INTO products (
      id, tenant_id, unit_id, tax_id, name, description, sku, price, cost,
      price_with_tax, price_without_tax, is_active, requires_lot,
      operational_status, sale_type, measurement_unit,
      category_id, subcategory_id, created_at, updated_at
    ) VALUES (
      v_product, v_tenant, '10000000-0000-0000-0000-000000000001'::uuid, v_iva5, 'Whisky the glenlivet  single malt scotch 12 años 700', 'Whisky the glenlivet  single malt scotch 12 años 700', 'XLS-080432402825',
      197000.00, 157300.00,
      197000.00, 197000.00, TRUE, FALSE,
      'ACTIVE', 'UNIT', 'UND',
      'd62a28a9-32ac-4df5-ad91-142c14b0edd8'::uuid, '7fd6dac4-6a98-4cda-822f-332ff15c791e'::uuid, NOW(), NOW()
    );
  END IF;
  IF v_product IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_product,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_icl, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_adv, 'calculation_order', 20),
        jsonb_build_object('tax_id', v_iva5, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_product,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000010'::uuid,
        'alcohol_degree', 40.000,
        'net_volume_ml', 700.000,
        'dane_certified_retail_price', 197000.00,
        'dane_price_effective_from', CURRENT_DATE::text,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva5, updated_at = NOW()
    WHERE id = v_product AND tenant_id = v_tenant;
  END IF;

  -- LIQUOR 5000299627471 / Whisky the glenlivet caribbean reserve 700ml
  v_product := NULL;
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-5000299627471'))
      OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('Whisky the glenlivet caribbean reserve 700ml'))
      OR UPPER(BTRIM(p.name)) LIKE '%' || UPPER(BTRIM('Whisky the glenlivet caribbean reserve 700ml')) || '%')
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    v_product := v_matched;
  ELSIF NOT EXISTS (
    SELECT 1 FROM products
    WHERE tenant_id = v_tenant AND UPPER(BTRIM(sku)) = UPPER(BTRIM('XLS-5000299627471'))
  ) THEN
    v_product := '530aa172-f5c8-531e-b6f3-904d12b6a0b8'::uuid;
    INSERT INTO products (
      id, tenant_id, unit_id, tax_id, name, description, sku, price, cost,
      price_with_tax, price_without_tax, is_active, requires_lot,
      operational_status, sale_type, measurement_unit,
      category_id, subcategory_id, created_at, updated_at
    ) VALUES (
      v_product, v_tenant, '10000000-0000-0000-0000-000000000001'::uuid, v_iva5, 'Whisky the glenlivet caribbean reserve 700ml', 'Whisky the glenlivet caribbean reserve 700ml', 'XLS-5000299627471',
      159000.00, 127121.00,
      159000.00, 159000.00, TRUE, FALSE,
      'ACTIVE', 'UNIT', 'UND',
      'd62a28a9-32ac-4df5-ad91-142c14b0edd8'::uuid, '7fd6dac4-6a98-4cda-822f-332ff15c791e'::uuid, NOW(), NOW()
    );
  END IF;
  IF v_product IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_product,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_icl, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_adv, 'calculation_order', 20),
        jsonb_build_object('tax_id', v_iva5, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_product,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000010'::uuid,
        'alcohol_degree', 40.000,
        'net_volume_ml', 700.000,
        'dane_certified_retail_price', 159000.00,
        'dane_price_effective_from', CURRENT_DATE::text,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva5, updated_at = NOW()
    WHERE id = v_product AND tenant_id = v_tenant;
  END IF;

  -- LIQUOR I-17868225770 / Aguardiente amarillo 1500ml
  v_product := NULL;
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-I-17868225770'))
      OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('Aguardiente amarillo 1500ml'))
      OR UPPER(BTRIM(p.name)) LIKE '%' || UPPER(BTRIM('Aguardiente amarillo 1500ml')) || '%')
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    v_product := v_matched;
  ELSIF NOT EXISTS (
    SELECT 1 FROM products
    WHERE tenant_id = v_tenant AND UPPER(BTRIM(sku)) = UPPER(BTRIM('XLS-I-17868225770'))
  ) THEN
    v_product := 'eac5f240-d80c-5921-a03e-7840bd6ed91a'::uuid;
    INSERT INTO products (
      id, tenant_id, unit_id, tax_id, name, description, sku, price, cost,
      price_with_tax, price_without_tax, is_active, requires_lot,
      operational_status, sale_type, measurement_unit,
      category_id, subcategory_id, created_at, updated_at
    ) VALUES (
      v_product, v_tenant, '10000000-0000-0000-0000-000000000001'::uuid, v_iva5, 'Aguardiente amarillo 1500ml', 'Aguardiente amarillo 1500ml', 'XLS-I-17868225770',
      100000.00, 80230.00,
      100000.00, 100000.00, TRUE, FALSE,
      'ACTIVE', 'UNIT', 'UND',
      'd62a28a9-32ac-4df5-ad91-142c14b0edd8'::uuid, '59469cae-477c-4263-b086-3883c987a82b'::uuid, NOW(), NOW()
    );
  END IF;
  IF v_product IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_product,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_icl, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_adv, 'calculation_order', 20),
        jsonb_build_object('tax_id', v_iva5, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_product,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000010'::uuid,
        'alcohol_degree', 29.000,
        'net_volume_ml', 1500.000,
        'dane_certified_retail_price', 100000.00,
        'dane_price_effective_from', CURRENT_DATE::text,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva5, updated_at = NOW()
    WHERE id = v_product AND tenant_id = v_tenant;
  END IF;

  -- LIQUOR 7707096200019 / Smirnoff tamarindo 375ml
  v_product := NULL;
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-7707096200019'))
      OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('Smirnoff tamarindo 375ml'))
      OR UPPER(BTRIM(p.name)) LIKE '%' || UPPER(BTRIM('Smirnoff tamarindo 375ml')) || '%')
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    v_product := v_matched;
  ELSIF NOT EXISTS (
    SELECT 1 FROM products
    WHERE tenant_id = v_tenant AND UPPER(BTRIM(sku)) = UPPER(BTRIM('XLS-7707096200019'))
  ) THEN
    v_product := '22901630-2b81-51b3-92e9-557e448d4a45'::uuid;
    INSERT INTO products (
      id, tenant_id, unit_id, tax_id, name, description, sku, price, cost,
      price_with_tax, price_without_tax, is_active, requires_lot,
      operational_status, sale_type, measurement_unit,
      category_id, subcategory_id, created_at, updated_at
    ) VALUES (
      v_product, v_tenant, '10000000-0000-0000-0000-000000000001'::uuid, v_iva5, 'Smirnoff tamarindo 375ml', 'Smirnoff tamarindo 375ml', 'XLS-7707096200019',
      30500.00, 24350.00,
      30500.00, 30500.00, TRUE, FALSE,
      'ACTIVE', 'UNIT', 'UND',
      'd62a28a9-32ac-4df5-ad91-142c14b0edd8'::uuid, '59469cae-477c-4263-b086-3883c987a82b'::uuid, NOW(), NOW()
    );
  END IF;
  IF v_product IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_product,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_icl, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_adv, 'calculation_order', 20),
        jsonb_build_object('tax_id', v_iva5, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_product,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000010'::uuid,
        'alcohol_degree', 29.000,
        'net_volume_ml', 375.000,
        'dane_certified_retail_price', 30500.00,
        'dane_price_effective_from', CURRENT_DATE::text,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva5, updated_at = NOW()
    WHERE id = v_product AND tenant_id = v_tenant;
  END IF;

  -- LIQUOR 7707096225951 / SMIRNOFF LULO 375ML
  v_product := NULL;
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-7707096225951'))
      OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('SMIRNOFF LULO 375ML'))
      OR UPPER(BTRIM(p.name)) LIKE '%' || UPPER(BTRIM('SMIRNOFF LULO 375ML')) || '%')
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    v_product := v_matched;
  ELSIF NOT EXISTS (
    SELECT 1 FROM products
    WHERE tenant_id = v_tenant AND UPPER(BTRIM(sku)) = UPPER(BTRIM('XLS-7707096225951'))
  ) THEN
    v_product := '7d9e663f-1ffa-5e1b-abe1-73087125bd43'::uuid;
    INSERT INTO products (
      id, tenant_id, unit_id, tax_id, name, description, sku, price, cost,
      price_with_tax, price_without_tax, is_active, requires_lot,
      operational_status, sale_type, measurement_unit,
      category_id, subcategory_id, created_at, updated_at
    ) VALUES (
      v_product, v_tenant, '10000000-0000-0000-0000-000000000001'::uuid, v_iva5, 'SMIRNOFF LULO 375ML', 'SMIRNOFF LULO 375ML', 'XLS-7707096225951',
      29500.00, 23450.00,
      29500.00, 29500.00, TRUE, FALSE,
      'ACTIVE', 'UNIT', 'UND',
      'd62a28a9-32ac-4df5-ad91-142c14b0edd8'::uuid, '59469cae-477c-4263-b086-3883c987a82b'::uuid, NOW(), NOW()
    );
  END IF;
  IF v_product IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_product,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_icl, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_adv, 'calculation_order', 20),
        jsonb_build_object('tax_id', v_iva5, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_product,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000010'::uuid,
        'alcohol_degree', 29.000,
        'net_volume_ml', 375.000,
        'dane_certified_retail_price', 29500.00,
        'dane_price_effective_from', CURRENT_DATE::text,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva5, updated_at = NOW()
    WHERE id = v_product AND tenant_id = v_tenant;
  END IF;

  -- LIQUOR I-17874347680 / Ron medellin 3 años 375ml
  v_product := NULL;
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-I-17874347680'))
      OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('Ron medellin 3 años 375ml'))
      OR UPPER(BTRIM(p.name)) LIKE '%' || UPPER(BTRIM('Ron medellin 3 años 375ml')) || '%')
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    v_product := v_matched;
  ELSIF NOT EXISTS (
    SELECT 1 FROM products
    WHERE tenant_id = v_tenant AND UPPER(BTRIM(sku)) = UPPER(BTRIM('XLS-I-17874347680'))
  ) THEN
    v_product := '7bbd0cb4-f3c2-5481-ad79-5846abca4bec'::uuid;
    INSERT INTO products (
      id, tenant_id, unit_id, tax_id, name, description, sku, price, cost,
      price_with_tax, price_without_tax, is_active, requires_lot,
      operational_status, sale_type, measurement_unit,
      category_id, subcategory_id, created_at, updated_at
    ) VALUES (
      v_product, v_tenant, '10000000-0000-0000-0000-000000000001'::uuid, v_iva5, 'Ron medellin 3 años 375ml', 'Ron medellin 3 años 375ml', 'XLS-I-17874347680',
      34000.00, 26999.00,
      34000.00, 34000.00, TRUE, FALSE,
      'ACTIVE', 'UNIT', 'UND',
      'd62a28a9-32ac-4df5-ad91-142c14b0edd8'::uuid, '59469cae-477c-4263-b086-3883c987a82b'::uuid, NOW(), NOW()
    );
  END IF;
  IF v_product IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_product,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_icl, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_adv, 'calculation_order', 20),
        jsonb_build_object('tax_id', v_iva5, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_product,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000010'::uuid,
        'alcohol_degree', 35.000,
        'net_volume_ml', 375.000,
        'dane_certified_retail_price', 34000.00,
        'dane_price_effective_from', CURRENT_DATE::text,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva5, updated_at = NOW()
    WHERE id = v_product AND tenant_id = v_tenant;
  END IF;

  -- LIQUOR 7702049002177 / Aguardiente antioqueño real 750ml
  v_product := NULL;
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-7702049002177'))
      OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('Aguardiente antioqueño real 750ml'))
      OR UPPER(BTRIM(p.name)) LIKE '%' || UPPER(BTRIM('Aguardiente antioqueño real 750ml')) || '%')
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    v_product := v_matched;
  ELSIF NOT EXISTS (
    SELECT 1 FROM products
    WHERE tenant_id = v_tenant AND UPPER(BTRIM(sku)) = UPPER(BTRIM('XLS-7702049002177'))
  ) THEN
    v_product := '9106bb07-0c33-537c-9bab-1c8fa6477087'::uuid;
    INSERT INTO products (
      id, tenant_id, unit_id, tax_id, name, description, sku, price, cost,
      price_with_tax, price_without_tax, is_active, requires_lot,
      operational_status, sale_type, measurement_unit,
      category_id, subcategory_id, created_at, updated_at
    ) VALUES (
      v_product, v_tenant, '10000000-0000-0000-0000-000000000001'::uuid, v_iva5, 'Aguardiente antioqueño real 750ml', 'Aguardiente antioqueño real 750ml', 'XLS-7702049002177',
      50000.00, 39900.00,
      50000.00, 50000.00, TRUE, FALSE,
      'ACTIVE', 'UNIT', 'UND',
      'd62a28a9-32ac-4df5-ad91-142c14b0edd8'::uuid, '59469cae-477c-4263-b086-3883c987a82b'::uuid, NOW(), NOW()
    );
  END IF;
  IF v_product IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_product,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_icl, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_adv, 'calculation_order', 20),
        jsonb_build_object('tax_id', v_iva5, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_product,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000010'::uuid,
        'alcohol_degree', 29.000,
        'net_volume_ml', 750.000,
        'dane_certified_retail_price', 50000.00,
        'dane_price_effective_from', CURRENT_DATE::text,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva5, updated_at = NOW()
    WHERE id = v_product AND tenant_id = v_tenant;
  END IF;

  -- LIQUOR 7702049101092 / Ron medellin 5 años 750ml
  v_product := NULL;
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-7702049101092'))
      OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('Ron medellin 5 años 750ml'))
      OR UPPER(BTRIM(p.name)) LIKE '%' || UPPER(BTRIM('Ron medellin 5 años 750ml')) || '%')
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    v_product := v_matched;
  ELSIF NOT EXISTS (
    SELECT 1 FROM products
    WHERE tenant_id = v_tenant AND UPPER(BTRIM(sku)) = UPPER(BTRIM('XLS-7702049101092'))
  ) THEN
    v_product := '4269adda-2eed-5349-b33c-be6b23c8fbdf'::uuid;
    INSERT INTO products (
      id, tenant_id, unit_id, tax_id, name, description, sku, price, cost,
      price_with_tax, price_without_tax, is_active, requires_lot,
      operational_status, sale_type, measurement_unit,
      category_id, subcategory_id, created_at, updated_at
    ) VALUES (
      v_product, v_tenant, '10000000-0000-0000-0000-000000000001'::uuid, v_iva5, 'Ron medellin 5 años 750ml', 'Ron medellin 5 años 750ml', 'XLS-7702049101092',
      76000.00, 62300.00,
      76000.00, 76000.00, TRUE, FALSE,
      'ACTIVE', 'UNIT', 'UND',
      'd62a28a9-32ac-4df5-ad91-142c14b0edd8'::uuid, '59469cae-477c-4263-b086-3883c987a82b'::uuid, NOW(), NOW()
    );
  END IF;
  IF v_product IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_product,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_icl, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_adv, 'calculation_order', 20),
        jsonb_build_object('tax_id', v_iva5, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_product,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000010'::uuid,
        'alcohol_degree', 35.000,
        'net_volume_ml', 750.000,
        'dane_certified_retail_price', 76000.00,
        'dane_price_effective_from', CURRENT_DATE::text,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva5, updated_at = NOW()
    WHERE id = v_product AND tenant_id = v_tenant;
  END IF;

  -- BEER match-only I-17816393030 / CERVEZA AGUILA ORIGINAL BOTELLA 330
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-I-17816393030')) OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('CERVEZA AGUILA ORIGINAL BOTELLA 330')))
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_matched,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_beer, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_iva19, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_matched,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000014'::uuid,
        'alcohol_degree', 4.500,
        'net_volume_ml', 330.000,
        'dane_certified_retail_price', NULL,
        'dane_price_effective_from', NULL,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva19, updated_at = NOW()
    WHERE id = v_matched AND tenant_id = v_tenant;
  END IF;

  -- BEER match-only I-17816393031 / CERVEZA AGUILA ORIGINAL BOTELLA 330
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-I-17816393031')) OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('CERVEZA AGUILA ORIGINAL BOTELLA 330')))
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_matched,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_beer, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_iva19, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_matched,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000014'::uuid,
        'alcohol_degree', 4.500,
        'net_volume_ml', 330.000,
        'dane_certified_retail_price', NULL,
        'dane_price_effective_from', NULL,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva19, updated_at = NOW()
    WHERE id = v_matched AND tenant_id = v_tenant;
  END IF;

  -- BEER match-only I-17816409440 / CERVEZA  AGUILA UNIDA 1000
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-I-17816409440')) OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('CERVEZA  AGUILA UNIDA 1000')))
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_matched,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_beer, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_iva19, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_matched,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000014'::uuid,
        'alcohol_degree', 4.500,
        'net_volume_ml', 1000.000,
        'dane_certified_retail_price', NULL,
        'dane_price_effective_from', NULL,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva19, updated_at = NOW()
    WHERE id = v_matched AND tenant_id = v_tenant;
  END IF;

  -- BEER match-only I-1781663870 / CERVEZA  POKER 1000
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-I-1781663870')) OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('CERVEZA  POKER 1000')))
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_matched,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_beer, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_iva19, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_matched,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000014'::uuid,
        'alcohol_degree', 4.500,
        'net_volume_ml', 1000.000,
        'dane_certified_retail_price', NULL,
        'dane_price_effective_from', NULL,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva19, updated_at = NOW()
    WHERE id = v_matched AND tenant_id = v_tenant;
  END IF;

  -- BEER match-only 7702004003454 / CLUB COLOMBIA DORADA BOTELLA 330ML
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-7702004003454')) OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('CLUB COLOMBIA DORADA BOTELLA 330ML')))
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_matched,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_beer, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_iva19, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_matched,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000014'::uuid,
        'alcohol_degree', 4.500,
        'net_volume_ml', 330.000,
        'dane_certified_retail_price', NULL,
        'dane_price_effective_from', NULL,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva19, updated_at = NOW()
    WHERE id = v_matched AND tenant_id = v_tenant;
  END IF;

  -- BEER match-only 7702004111531 / CORONA 330ML BOTELLA
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-7702004111531')) OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('CORONA 330ML BOTELLA')))
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_matched,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_beer, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_iva19, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_matched,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000014'::uuid,
        'alcohol_degree', 4.500,
        'net_volume_ml', 330.000,
        'dane_certified_retail_price', NULL,
        'dane_price_effective_from', NULL,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva19, updated_at = NOW()
    WHERE id = v_matched AND tenant_id = v_tenant;
  END IF;

  -- BEER match-only 7702004002037 / AGUILA LIGTH 330 BOTELLA
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-7702004002037')) OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('AGUILA LIGTH 330 BOTELLA')))
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_matched,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_beer, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_iva19, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_matched,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000014'::uuid,
        'alcohol_degree', 4.500,
        'net_volume_ml', 330.000,
        'dane_certified_retail_price', NULL,
        'dane_price_effective_from', NULL,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva19, updated_at = NOW()
    WHERE id = v_matched AND tenant_id = v_tenant;
  END IF;

  -- BEER match-only 7702004110596 / CERVEZA BUDWEISER LATA 269
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-7702004110596')) OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('CERVEZA BUDWEISER LATA 269')))
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_matched,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_beer, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_iva19, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_matched,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000014'::uuid,
        'alcohol_degree', 4.500,
        'net_volume_ml', 269.000,
        'dane_certified_retail_price', NULL,
        'dane_price_effective_from', NULL,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva19, updated_at = NOW()
    WHERE id = v_matched AND tenant_id = v_tenant;
  END IF;

  -- BEER match-only 7702004007360 / CEREVEZA POKER RUBIA LATA 330ML
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-7702004007360')) OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('CEREVEZA POKER RUBIA LATA 330ML')))
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_matched,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_beer, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_iva19, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_matched,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000014'::uuid,
        'alcohol_degree', 4.500,
        'net_volume_ml', 330.000,
        'dane_certified_retail_price', NULL,
        'dane_price_effective_from', NULL,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva19, updated_at = NOW()
    WHERE id = v_matched AND tenant_id = v_tenant;
  END IF;

  -- BEER match-only 7702004011183 / RED LATA 269ML
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-7702004011183')) OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('RED LATA 269ML')))
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_matched,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_beer, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_iva19, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_matched,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000014'::uuid,
        'alcohol_degree', 4.500,
        'net_volume_ml', 269.000,
        'dane_certified_retail_price', NULL,
        'dane_price_effective_from', NULL,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva19, updated_at = NOW()
    WHERE id = v_matched AND tenant_id = v_tenant;
  END IF;

  -- BEER match-only 7702004011565 / RED ROSE LATA 269ML
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-7702004011565')) OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('RED ROSE LATA 269ML')))
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_matched,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_beer, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_iva19, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_matched,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000014'::uuid,
        'alcohol_degree', 4.500,
        'net_volume_ml', 269.000,
        'dane_certified_retail_price', NULL,
        'dane_price_effective_from', NULL,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva19, updated_at = NOW()
    WHERE id = v_matched AND tenant_id = v_tenant;
  END IF;

  -- BEER match-only I-1781663008 / RED ROSE LATA 269ML 24
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-I-1781663008')) OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('RED ROSE LATA 269ML 24')))
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_matched,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_beer, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_iva19, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_matched,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000014'::uuid,
        'alcohol_degree', 4.500,
        'net_volume_ml', 269.000,
        'dane_certified_retail_price', NULL,
        'dane_price_effective_from', NULL,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva19, updated_at = NOW()
    WHERE id = v_matched AND tenant_id = v_tenant;
  END IF;

  -- BEER match-only I-1781662935 / COSTEÑA BACANA BOTELLA 320
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-I-1781662935')) OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('COSTEÑA BACANA BOTELLA 320')))
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_matched,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_beer, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_iva19, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_matched,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000014'::uuid,
        'alcohol_degree', 4.500,
        'net_volume_ml', 320.000,
        'dane_certified_retail_price', NULL,
        'dane_price_effective_from', NULL,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva19, updated_at = NOW()
    WHERE id = v_matched AND tenant_id = v_tenant;
  END IF;

  -- BEER match-only 7702004007414 / POKER BOTELLA 330ML
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-7702004007414')) OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('POKER BOTELLA 330ML')))
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_matched,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_beer, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_iva19, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_matched,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000014'::uuid,
        'alcohol_degree', 4.500,
        'net_volume_ml', 330.000,
        'dane_certified_retail_price', NULL,
        'dane_price_effective_from', NULL,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva19, updated_at = NOW()
    WHERE id = v_matched AND tenant_id = v_tenant;
  END IF;

  -- BEER match-only 7702004002013 / CERVEZA AGUILA 330ML
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-7702004002013')) OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('CERVEZA AGUILA 330ML')))
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_matched,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_beer, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_iva19, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_matched,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000014'::uuid,
        'alcohol_degree', 4.500,
        'net_volume_ml', 330.000,
        'dane_certified_retail_price', NULL,
        'dane_price_effective_from', NULL,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva19, updated_at = NOW()
    WHERE id = v_matched AND tenant_id = v_tenant;
  END IF;

  -- BEER match-only I-17817267910 / Cerveza aguila original   lata 330ml 1 unida
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-I-17817267910')) OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('Cerveza aguila original   lata 330ml 1 unida')))
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_matched,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_beer, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_iva19, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_matched,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000014'::uuid,
        'alcohol_degree', 4.500,
        'net_volume_ml', 330.000,
        'dane_certified_retail_price', NULL,
        'dane_price_effective_from', NULL,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva19, updated_at = NOW()
    WHERE id = v_matched AND tenant_id = v_tenant;
  END IF;

  -- BEER match-only I-17817274830 / Cerveza costeña lata 330 ml unida
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-I-17817274830')) OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('Cerveza costeña lata 330 ml unida')))
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_matched,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_beer, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_iva19, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_matched,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000014'::uuid,
        'alcohol_degree', 4.500,
        'net_volume_ml', 330.000,
        'dane_certified_retail_price', NULL,
        'dane_price_effective_from', NULL,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva19, updated_at = NOW()
    WHERE id = v_matched AND tenant_id = v_tenant;
  END IF;

  -- BEER match-only 7702354958206 / los cuates margarita mango 269ml
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-7702354958206')) OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('los cuates margarita mango 269ml')))
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_matched,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_beer, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_iva19, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_matched,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000014'::uuid,
        'alcohol_degree', 4.500,
        'net_volume_ml', 269.000,
        'dane_certified_retail_price', NULL,
        'dane_price_effective_from', NULL,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva19, updated_at = NOW()
    WHERE id = v_matched AND tenant_id = v_tenant;
  END IF;

  -- BEER match-only 7702004003539 / Cerveza club colombia dorada unidad
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-7702004003539')) OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('Cerveza club colombia dorada unidad')))
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_matched,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_beer, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_iva19, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_matched,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000014'::uuid,
        'alcohol_degree', 4.500,
        'net_volume_ml', 330.000,
        'dane_certified_retail_price', NULL,
        'dane_price_effective_from', NULL,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva19, updated_at = NOW()
    WHERE id = v_matched AND tenant_id = v_tenant;
  END IF;

  -- BEER match-only I-17817318250 / cerveza club colombia roja 330ml unida
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-I-17817318250')) OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('cerveza club colombia roja 330ml unida')))
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_matched,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_beer, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_iva19, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_matched,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000014'::uuid,
        'alcohol_degree', 4.500,
        'net_volume_ml', 330.000,
        'dane_certified_retail_price', NULL,
        'dane_price_effective_from', NULL,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva19, updated_at = NOW()
    WHERE id = v_matched AND tenant_id = v_tenant;
  END IF;

  -- BEER match-only I-17817320670 / Cerveza club colombia roja lata 330ml
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-I-17817320670')) OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('Cerveza club colombia roja lata 330ml')))
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_matched,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_beer, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_iva19, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_matched,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000014'::uuid,
        'alcohol_degree', 4.500,
        'net_volume_ml', 330.000,
        'dane_certified_retail_price', NULL,
        'dane_price_effective_from', NULL,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva19, updated_at = NOW()
    WHERE id = v_matched AND tenant_id = v_tenant;
  END IF;

  -- BEER match-only 7702004111043 / cerveza corona lata 269ml unidad
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-7702004111043')) OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('cerveza corona lata 269ml unidad')))
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_matched,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_beer, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_iva19, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_matched,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000014'::uuid,
        'alcohol_degree', 4.500,
        'net_volume_ml', 269.000,
        'dane_certified_retail_price', NULL,
        'dane_price_effective_from', NULL,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva19, updated_at = NOW()
    WHERE id = v_matched AND tenant_id = v_tenant;
  END IF;

  -- BEER match-only 7702004010681 / Michelob ultra 269ml unida
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-7702004010681')) OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('Michelob ultra 269ml unida')))
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_matched,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_beer, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_iva19, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_matched,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000014'::uuid,
        'alcohol_degree', 4.500,
        'net_volume_ml', 269.000,
        'dane_certified_retail_price', NULL,
        'dane_price_effective_from', NULL,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva19, updated_at = NOW()
    WHERE id = v_matched AND tenant_id = v_tenant;
  END IF;

  -- BEER match-only 7702004110701 / 1 coronita 210ml
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-7702004110701')) OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('1 coronita 210ml')))
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_matched,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_beer, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_iva19, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_matched,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000014'::uuid,
        'alcohol_degree', 4.500,
        'net_volume_ml', 210.000,
        'dane_certified_retail_price', NULL,
        'dane_price_effective_from', NULL,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva19, updated_at = NOW()
    WHERE id = v_matched AND tenant_id = v_tenant;
  END IF;

  -- BEER match-only 7702004010544 / stella artois botella 330ml unidad
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-7702004010544')) OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('stella artois botella 330ml unidad')))
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_matched,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_beer, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_iva19, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_matched,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000014'::uuid,
        'alcohol_degree', 4.500,
        'net_volume_ml', 330.000,
        'dane_certified_retail_price', NULL,
        'dane_price_effective_from', NULL,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva19, updated_at = NOW()
    WHERE id = v_matched AND tenant_id = v_tenant;
  END IF;

  -- BEER match-only 7702354957407 / Like ice blueberry pet azul 300ml
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-7702354957407')) OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('Like ice blueberry pet azul 300ml')))
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_matched,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_beer, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_iva19, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_matched,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000014'::uuid,
        'alcohol_degree', 4.500,
        'net_volume_ml', 300.000,
        'dane_certified_retail_price', NULL,
        'dane_price_effective_from', NULL,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva19, updated_at = NOW()
    WHERE id = v_matched AND tenant_id = v_tenant;
  END IF;

  -- BEER match-only 7702354953966 / Like ice limon pet 300ml
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-7702354953966')) OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('Like ice limon pet 300ml')))
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_matched,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_beer, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_iva19, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_matched,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000014'::uuid,
        'alcohol_degree', 4.500,
        'net_volume_ml', 300.000,
        'dane_certified_retail_price', NULL,
        'dane_price_effective_from', NULL,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva19, updated_at = NOW()
    WHERE id = v_matched AND tenant_id = v_tenant;
  END IF;

  -- BEER match-only I-17818188490 / Cerveza miller lite lata 310ml 6 unidades
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-I-17818188490')) OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('Cerveza miller lite lata 310ml 6 unidades')))
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_matched,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_beer, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_iva19, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_matched,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000014'::uuid,
        'alcohol_degree', 4.500,
        'net_volume_ml', 310.000,
        'dane_certified_retail_price', NULL,
        'dane_price_effective_from', NULL,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva19, updated_at = NOW()
    WHERE id = v_matched AND tenant_id = v_tenant;
  END IF;

  -- BEER match-only I-17818190640 / Cerveza miller lite lata 310ml 1 unidad
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-I-17818190640')) OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('Cerveza miller lite lata 310ml 1 unidad')))
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_matched,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_beer, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_iva19, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_matched,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000014'::uuid,
        'alcohol_degree', 4.500,
        'net_volume_ml', 310.000,
        'dane_certified_retail_price', NULL,
        'dane_price_effective_from', NULL,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva19, updated_at = NOW()
    WHERE id = v_matched AND tenant_id = v_tenant;
  END IF;

  -- BEER match-only I-17818198790 / Cerveza heineken lata 269ml 6 unidades
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-I-17818198790')) OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('Cerveza heineken lata 269ml 6 unidades')))
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_matched,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_beer, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_iva19, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_matched,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000014'::uuid,
        'alcohol_degree', 4.500,
        'net_volume_ml', 269.000,
        'dane_certified_retail_price', NULL,
        'dane_price_effective_from', NULL,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva19, updated_at = NOW()
    WHERE id = v_matched AND tenant_id = v_tenant;
  END IF;

  -- BEER match-only I-17818200160 / Cerveza heineken lata 269ml  1 unidad
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-I-17818200160')) OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('Cerveza heineken lata 269ml  1 unidad')))
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_matched,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_beer, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_iva19, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_matched,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000014'::uuid,
        'alcohol_degree', 4.500,
        'net_volume_ml', 269.000,
        'dane_certified_retail_price', NULL,
        'dane_price_effective_from', NULL,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva19, updated_at = NOW()
    WHERE id = v_matched AND tenant_id = v_tenant;
  END IF;

  -- BEER match-only I-17819114750 / Cerveza modelo 355ml 6 unidades
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-I-17819114750')) OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('Cerveza modelo 355ml 6 unidades')))
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_matched,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_beer, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_iva19, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_matched,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000014'::uuid,
        'alcohol_degree', 4.500,
        'net_volume_ml', 355.000,
        'dane_certified_retail_price', NULL,
        'dane_price_effective_from', NULL,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva19, updated_at = NOW()
    WHERE id = v_matched AND tenant_id = v_tenant;
  END IF;

  -- BEER match-only I-17819115710 / Cerveza modelo 355ml 1 unidad
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-I-17819115710')) OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('Cerveza modelo 355ml 1 unidad')))
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_matched,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_beer, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_iva19, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_matched,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000014'::uuid,
        'alcohol_degree', 4.500,
        'net_volume_ml', 355.000,
        'dane_certified_retail_price', NULL,
        'dane_price_effective_from', NULL,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva19, updated_at = NOW()
    WHERE id = v_matched AND tenant_id = v_tenant;
  END IF;

  -- BEER match-only I-17819823810 / Cerveza costeña lata 269ml 6 unidades
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-I-17819823810')) OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('Cerveza costeña lata 269ml 6 unidades')))
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_matched,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_beer, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_iva19, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_matched,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000014'::uuid,
        'alcohol_degree', 4.500,
        'net_volume_ml', 269.000,
        'dane_certified_retail_price', NULL,
        'dane_price_effective_from', NULL,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva19, updated_at = NOW()
    WHERE id = v_matched AND tenant_id = v_tenant;
  END IF;

  -- BEER match-only I-17819824890 / Cerveza costeña lata 269ml 1 unidad
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-I-17819824890')) OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('Cerveza costeña lata 269ml 1 unidad')))
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_matched,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_beer, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_iva19, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_matched,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000014'::uuid,
        'alcohol_degree', 4.500,
        'net_volume_ml', 269.000,
        'dane_certified_retail_price', NULL,
        'dane_price_effective_from', NULL,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva19, updated_at = NOW()
    WHERE id = v_matched AND tenant_id = v_tenant;
  END IF;

  -- BEER match-only I-17819827920 / Cerveza aguila original lata 269ml 6 unidades
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-I-17819827920')) OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('Cerveza aguila original lata 269ml 6 unidades')))
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_matched,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_beer, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_iva19, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_matched,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000014'::uuid,
        'alcohol_degree', 4.500,
        'net_volume_ml', 269.000,
        'dane_certified_retail_price', NULL,
        'dane_price_effective_from', NULL,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva19, updated_at = NOW()
    WHERE id = v_matched AND tenant_id = v_tenant;
  END IF;

  -- BEER match-only I-17819828800 / Cerveza aguila original lata 269ml 1 unidad
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-I-17819828800')) OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('Cerveza aguila original lata 269ml 1 unidad')))
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_matched,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_beer, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_iva19, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_matched,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000014'::uuid,
        'alcohol_degree', 4.500,
        'net_volume_ml', 269.000,
        'dane_certified_retail_price', NULL,
        'dane_price_effective_from', NULL,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva19, updated_at = NOW()
    WHERE id = v_matched AND tenant_id = v_tenant;
  END IF;

  -- BEER match-only I-17823309660 / Cerveza stella artois edicion limitada 269ml 1 unida
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-I-17823309660')) OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('Cerveza stella artois edicion limitada 269ml 1 unida')))
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_matched,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_beer, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_iva19, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_matched,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000014'::uuid,
        'alcohol_degree', 4.500,
        'net_volume_ml', 269.000,
        'dane_certified_retail_price', NULL,
        'dane_price_effective_from', NULL,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva19, updated_at = NOW()
    WHERE id = v_matched AND tenant_id = v_tenant;
  END IF;

  -- BEER match-only I-17823314300 / Cerveza costeña roja botella 330ml 30 unidades
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-I-17823314300')) OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('Cerveza costeña roja botella 330ml 30 unidades')))
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_matched,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_beer, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_iva19, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_matched,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000014'::uuid,
        'alcohol_degree', 4.500,
        'net_volume_ml', 330.000,
        'dane_certified_retail_price', NULL,
        'dane_price_effective_from', NULL,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva19, updated_at = NOW()
    WHERE id = v_matched AND tenant_id = v_tenant;
  END IF;

  -- BEER match-only I-17823315180 / Cerveza costeña roja botella 330ml 1 unida
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-I-17823315180')) OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('Cerveza costeña roja botella 330ml 1 unida')))
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_matched,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_beer, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_iva19, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_matched,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000014'::uuid,
        'alcohol_degree', 4.500,
        'net_volume_ml', 330.000,
        'dane_certified_retail_price', NULL,
        'dane_price_effective_from', NULL,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva19, updated_at = NOW()
    WHERE id = v_matched AND tenant_id = v_tenant;
  END IF;

  -- BEER match-only I-17823317760 / Cerveza corona cero botella 330ml
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-I-17823317760')) OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('Cerveza corona cero botella 330ml')))
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_matched,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_beer, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_iva19, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_matched,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000014'::uuid,
        'alcohol_degree', 4.500,
        'net_volume_ml', 330.000,
        'dane_certified_retail_price', NULL,
        'dane_price_effective_from', NULL,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva19, updated_at = NOW()
    WHERE id = v_matched AND tenant_id = v_tenant;
  END IF;

  -- BEER match-only I-17823320440 / Cerveza corona cero lata 269ml
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-I-17823320440')) OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('Cerveza corona cero lata 269ml')))
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_matched,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_beer, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_iva19, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_matched,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000014'::uuid,
        'alcohol_degree', 4.500,
        'net_volume_ml', 269.000,
        'dane_certified_retail_price', NULL,
        'dane_price_effective_from', NULL,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva19, updated_at = NOW()
    WHERE id = v_matched AND tenant_id = v_tenant;
  END IF;

  -- BEER match-only I-17823327910 / Cerveza michelob ultra 330 botella 1 unida
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-I-17823327910')) OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('Cerveza michelob ultra 330 botella 1 unida')))
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_matched,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_beer, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_iva19, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_matched,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000014'::uuid,
        'alcohol_degree', 4.500,
        'net_volume_ml', 330.000,
        'dane_certified_retail_price', NULL,
        'dane_price_effective_from', NULL,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva19, updated_at = NOW()
    WHERE id = v_matched AND tenant_id = v_tenant;
  END IF;

  -- BEER match-only I-17826770510 / Cerveza central lata 330ml 1 unidad
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-I-17826770510')) OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('Cerveza central lata 330ml 1 unidad')))
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_matched,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_beer, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_iva19, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_matched,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000014'::uuid,
        'alcohol_degree', 4.500,
        'net_volume_ml', 330.000,
        'dane_certified_retail_price', NULL,
        'dane_price_effective_from', NULL,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva19, updated_at = NOW()
    WHERE id = v_matched AND tenant_id = v_tenant;
  END IF;

  -- BEER match-only I-17830130950 / Cerveza costeña lata 269 al por mayor 24 unidades
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-I-17830130950')) OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('Cerveza costeña lata 269 al por mayor 24 unidades')))
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_matched,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_beer, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_iva19, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_matched,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000014'::uuid,
        'alcohol_degree', 4.500,
        'net_volume_ml', 269.000,
        'dane_certified_retail_price', NULL,
        'dane_price_effective_from', NULL,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva19, updated_at = NOW()
    WHERE id = v_matched AND tenant_id = v_tenant;
  END IF;

  -- BEER match-only I-17831132120 / Cerveza aguila original lata 330ml 24 al por mayor
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-I-17831132120')) OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('Cerveza aguila original lata 330ml 24 al por mayor')))
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_matched,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_beer, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_iva19, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_matched,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000014'::uuid,
        'alcohol_degree', 4.500,
        'net_volume_ml', 330.000,
        'dane_certified_retail_price', NULL,
        'dane_price_effective_from', NULL,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva19, updated_at = NOW()
    WHERE id = v_matched AND tenant_id = v_tenant;
  END IF;

  -- BEER match-only I-17834405470 / Red bull 250 ml lata energy drink
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-I-17834405470')) OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('Red bull 250 ml lata energy drink')))
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_matched,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_beer, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_iva19, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_matched,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000014'::uuid,
        'alcohol_degree', 4.500,
        'net_volume_ml', 250.000,
        'dane_certified_retail_price', NULL,
        'dane_price_effective_from', NULL,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva19, updated_at = NOW()
    WHERE id = v_matched AND tenant_id = v_tenant;
  END IF;

  -- BEER match-only I-17834406520 / Red bull 250 ml lata 250ml sugar free
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-I-17834406520')) OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('Red bull 250 ml lata 250ml sugar free')))
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_matched,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_beer, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_iva19, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_matched,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000014'::uuid,
        'alcohol_degree', 4.500,
        'net_volume_ml', 250.000,
        'dane_certified_retail_price', NULL,
        'dane_price_effective_from', NULL,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva19, updated_at = NOW()
    WHERE id = v_matched AND tenant_id = v_tenant;
  END IF;

  -- BEER match-only I-17834407580 / Red bull 250 ml lata the red edition
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-I-17834407580')) OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('Red bull 250 ml lata the red edition')))
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_matched,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_beer, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_iva19, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_matched,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000014'::uuid,
        'alcohol_degree', 4.500,
        'net_volume_ml', 250.000,
        'dane_certified_retail_price', NULL,
        'dane_price_effective_from', NULL,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva19, updated_at = NOW()
    WHERE id = v_matched AND tenant_id = v_tenant;
  END IF;

  -- BEER match-only I-17841460720 / Cerveza costeñita 175ml 1 unidad
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-I-17841460720')) OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('Cerveza costeñita 175ml 1 unidad')))
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_matched,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_beer, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_iva19, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_matched,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000014'::uuid,
        'alcohol_degree', 4.500,
        'net_volume_ml', 175.000,
        'dane_certified_retail_price', NULL,
        'dane_price_effective_from', NULL,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva19, updated_at = NOW()
    WHERE id = v_matched AND tenant_id = v_tenant;
  END IF;

  -- BEER match-only I-17844004320 / Cerveza aguila light 269ml 6 unidades
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-I-17844004320')) OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('Cerveza aguila light 269ml 6 unidades')))
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_matched,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_beer, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_iva19, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_matched,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000014'::uuid,
        'alcohol_degree', 4.500,
        'net_volume_ml', 269.000,
        'dane_certified_retail_price', NULL,
        'dane_price_effective_from', NULL,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva19, updated_at = NOW()
    WHERE id = v_matched AND tenant_id = v_tenant;
  END IF;

  -- BEER match-only I-17848319180 / Cerveza andina light lata 269ml
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-I-17848319180')) OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('Cerveza andina light lata 269ml')))
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_matched,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_beer, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_iva19, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_matched,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000014'::uuid,
        'alcohol_degree', 4.500,
        'net_volume_ml', 269.000,
        'dane_certified_retail_price', NULL,
        'dane_price_effective_from', NULL,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva19, updated_at = NOW()
    WHERE id = v_matched AND tenant_id = v_tenant;
  END IF;

  -- BEER match-only I-17848324650 / Cerveza sol bot 250ml 1unida
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-I-17848324650')) OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('Cerveza sol bot 250ml 1unida')))
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_matched,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_beer, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_iva19, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_matched,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000014'::uuid,
        'alcohol_degree', 4.500,
        'net_volume_ml', 250.000,
        'dane_certified_retail_price', NULL,
        'dane_price_effective_from', NULL,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva19, updated_at = NOW()
    WHERE id = v_matched AND tenant_id = v_tenant;
  END IF;

  -- BEER match-only I-17853547110 / Cerveza miller lite lata 269ml 6 unidades
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-I-17853547110')) OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('Cerveza miller lite lata 269ml 6 unidades')))
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_matched,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_beer, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_iva19, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_matched,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000014'::uuid,
        'alcohol_degree', 4.500,
        'net_volume_ml', 269.000,
        'dane_certified_retail_price', NULL,
        'dane_price_effective_from', NULL,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva19, updated_at = NOW()
    WHERE id = v_matched AND tenant_id = v_tenant;
  END IF;

  -- BEER match-only I-17853548760 / Cerveza miller lite lata 269ml 1unidad
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-I-17853548760')) OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('Cerveza miller lite lata 269ml 1unidad')))
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_matched,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_beer, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_iva19, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_matched,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000014'::uuid,
        'alcohol_degree', 4.500,
        'net_volume_ml', 269.000,
        'dane_certified_retail_price', NULL,
        'dane_price_effective_from', NULL,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva19, updated_at = NOW()
    WHERE id = v_matched AND tenant_id = v_tenant;
  END IF;

  -- BEER match-only I-17853558350 / cerveza andina dorada lata 269 1 unidad
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-I-17853558350')) OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('cerveza andina dorada lata 269 1 unidad')))
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_matched,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_beer, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_iva19, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_matched,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000014'::uuid,
        'alcohol_degree', 4.500,
        'net_volume_ml', 269.000,
        'dane_certified_retail_price', NULL,
        'dane_price_effective_from', NULL,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva19, updated_at = NOW()
    WHERE id = v_matched AND tenant_id = v_tenant;
  END IF;

  -- BEER match-only I-17859542620 / Cerveza club colombia trigo lata 330ml 6 unidades
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-I-17859542620')) OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('Cerveza club colombia trigo lata 330ml 6 unidades')))
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_matched,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_beer, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_iva19, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_matched,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000014'::uuid,
        'alcohol_degree', 4.500,
        'net_volume_ml', 330.000,
        'dane_certified_retail_price', NULL,
        'dane_price_effective_from', NULL,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva19, updated_at = NOW()
    WHERE id = v_matched AND tenant_id = v_tenant;
  END IF;

  -- BEER match-only I-17865008490 / Cerveza miller bot 300ml 1 unidad
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-I-17865008490')) OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('Cerveza miller bot 300ml 1 unidad')))
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_matched,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_beer, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_iva19, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_matched,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000014'::uuid,
        'alcohol_degree', 4.500,
        'net_volume_ml', 300.000,
        'dane_certified_retail_price', NULL,
        'dane_price_effective_from', NULL,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva19, updated_at = NOW()
    WHERE id = v_matched AND tenant_id = v_tenant;
  END IF;

  -- BEER match-only I-17874335080 / Cerveza aguila cero lata 330ml 1unid
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-I-17874335080')) OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('Cerveza aguila cero lata 330ml 1unid')))
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_matched,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_beer, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_iva19, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_matched,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000014'::uuid,
        'alcohol_degree', 4.500,
        'net_volume_ml', 330.000,
        'dane_certified_retail_price', NULL,
        'dane_price_effective_from', NULL,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva19, updated_at = NOW()
    WHERE id = v_matched AND tenant_id = v_tenant;
  END IF;

  -- BEER match-only I-17883821820 / Cerveza club colombia trigo bot 330ml
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-I-17883821820')) OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('Cerveza club colombia trigo bot 330ml')))
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_matched,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_beer, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_iva19, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_matched,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000014'::uuid,
        'alcohol_degree', 4.500,
        'net_volume_ml', 330.000,
        'dane_certified_retail_price', NULL,
        'dane_price_effective_from', NULL,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva19, updated_at = NOW()
    WHERE id = v_matched AND tenant_id = v_tenant;
  END IF;

  -- BEER match-only I-17889982000 / Michelob ultra bot 210ml 1unida
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-I-17889982000')) OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('Michelob ultra bot 210ml 1unida')))
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_matched,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_beer, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_iva19, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_matched,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000014'::uuid,
        'alcohol_degree', 4.500,
        'net_volume_ml', 210.000,
        'dane_certified_retail_price', NULL,
        'dane_price_effective_from', NULL,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva19, updated_at = NOW()
    WHERE id = v_matched AND tenant_id = v_tenant;
  END IF;

  -- BEER match-only I-17890710720 / Cerveza heineken  nal bot nr 250mg 1 unidad
  SELECT p.id INTO v_matched
  FROM products p
  WHERE p.tenant_id = v_tenant
    AND (UPPER(BTRIM(p.sku)) = UPPER(BTRIM('XLS-I-17890710720')) OR UPPER(BTRIM(p.name)) = UPPER(BTRIM('Cerveza heineken  nal bot nr 250mg 1 unidad')))
  LIMIT 1;
  IF v_matched IS NOT NULL THEN
    PERFORM public.prc_replace_product_taxes(
      v_tenant, v_matched,
      jsonb_build_array(
        jsonb_build_object('tax_id', v_beer, 'calculation_order', 10),
        jsonb_build_object('tax_id', v_iva19, 'calculation_order', 100)
      )
    );
    PERFORM public.prc_upsert_product_tax_profile(
      v_tenant, v_matched,
      jsonb_build_object(
        'tax_product_category_id', '16000000-0000-0000-0000-000000000014'::uuid,
        'alcohol_degree', 4.500,
        'net_volume_ml', 330.000,
        'dane_certified_retail_price', NULL,
        'dane_price_effective_from', NULL,
        'dane_price_effective_to', NULL
      )
    );
    UPDATE products SET tax_id = v_iva19, updated_at = NOW()
    WHERE id = v_matched AND tenant_id = v_tenant;
  END IF;
END
$excel$;

-- Generated liquor units: 61; beer match-only: 62; skipped packs: 34
-- <<< END SECTION: products/2026_09_12_migrate_alcohol_from_excel.sql

-- =============================================================================
-- Register incremental migrations (same keys as migrate_prd.sh ONLY_INCREMENTAL)
-- =============================================================================
INSERT INTO public.migrations_history (version, checksum, success, details, execution_time_ms)
VALUES
  ('V077__tax_model_extension.sql', 'bundle-2026-09-12', true, 'applied by 2026_09_12_vps_tax_model_alcohol_bundle.sql', NULL),
  ('V078__sale_item_taxes_multi_tax_snapshot.sql', 'bundle-2026-09-12', true, 'applied by 2026_09_12_vps_tax_model_alcohol_bundle.sql', NULL),
  ('V079__tax_model_prc_fnc_routines.sql', 'bundle-2026-09-12', true, 'applied by 2026_09_12_vps_tax_model_alcohol_bundle.sql', NULL),
  ('V080__tax_dictionaries_es_names.sql', 'bundle-2026-09-12', true, 'applied by 2026_09_12_vps_tax_model_alcohol_bundle.sql', NULL)
ON CONFLICT (version) DO NOTHING;
