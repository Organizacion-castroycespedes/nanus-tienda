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
