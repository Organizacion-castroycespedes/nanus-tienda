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

BEGIN;

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

COMMIT;
