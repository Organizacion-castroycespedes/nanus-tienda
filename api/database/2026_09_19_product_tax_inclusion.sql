BEGIN;

ALTER TABLE public.product_taxes
  ADD COLUMN IF NOT EXISTS is_included BOOLEAN;

UPDATE public.product_taxes AS pt
SET is_included = COALESCE(t.is_included, FALSE)
FROM public.taxes AS t
WHERE t.id = pt.tax_id
  AND t.tenant_id = pt.tenant_id
  AND pt.is_included IS NULL;

ALTER TABLE public.product_taxes
  ALTER COLUMN is_included SET DEFAULT FALSE,
  ALTER COLUMN is_included SET NOT NULL;

CREATE OR REPLACE FUNCTION public.prc_replace_product_taxes(
  p_tenant_id UUID,
  p_product_id UUID,
  p_taxes JSONB DEFAULT '[]'::JSONB
) RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
  v_tax JSONB;
  v_tax_id UUID;
BEGIN
  DELETE FROM public.product_taxes
  WHERE tenant_id = p_tenant_id
    AND product_id = p_product_id;

  IF p_taxes IS NULL OR jsonb_typeof(p_taxes) <> 'array' THEN
    RETURN TRUE;
  END IF;

  FOR v_tax IN SELECT value FROM jsonb_array_elements(p_taxes)
  LOOP
    v_tax_id := (v_tax ->> 'tax_id')::UUID;

    INSERT INTO public.product_taxes (
      tenant_id, product_id, tax_id, calculation_order, is_included, is_active
    )
    SELECT
      p_tenant_id,
      p_product_id,
      v_tax_id,
      COALESCE((v_tax ->> 'calculation_order')::SMALLINT, 100),
      COALESCE((v_tax ->> 'is_included')::BOOLEAN, t.is_included, FALSE),
      TRUE
    FROM public.taxes AS t
    WHERE t.id = v_tax_id
      AND t.tenant_id = p_tenant_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'tax % not found for tenant %', v_tax_id, p_tenant_id;
    END IF;
  END LOOP;

  RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION public.fnc_list_product_taxes(
  p_tenant_id UUID,
  p_product_id UUID
) RETURNS TABLE(
  id UUID, tax_id UUID, calculation_order SMALLINT, is_active BOOLEAN,
  tax_name VARCHAR, tax_rate NUMERIC, is_included BOOLEAN,
  calculation_method_code VARCHAR, tax_type_code VARCHAR, tax_type_dian_code VARCHAR
)
LANGUAGE SQL STABLE
AS $$
  SELECT pt.id, pt.tax_id, pt.calculation_order, pt.is_active,
         t.name, t.rate, pt.is_included, cm.code, tt.code, tt.dian_code
  FROM public.product_taxes AS pt
  LEFT JOIN public.taxes AS t ON t.id = pt.tax_id AND t.tenant_id = pt.tenant_id
  LEFT JOIN public.tax_calculation_methods AS cm ON cm.id = t.calculation_method_id
  LEFT JOIN public.tax_types AS tt ON tt.id = t.tax_type_id
  WHERE pt.tenant_id = p_tenant_id AND pt.product_id = p_product_id
  ORDER BY pt.calculation_order ASC, pt.created_at ASC;
$$;

CREATE OR REPLACE FUNCTION public.fnc_list_product_taxes_for_pricing(
  p_tenant_id UUID,
  p_product_id UUID,
  p_as_of DATE
) RETURNS TABLE(
  tax_id UUID, tax_name VARCHAR, dian_code VARCHAR, tax_type_code VARCHAR,
  calculation_method_code VARCHAR, tax_base_type_code VARCHAR,
  calculation_order SMALLINT, is_included BOOLEAN, tax_rate NUMERIC,
  percentage_rate NUMERIC, fixed_amount NUMERIC, base_quantity NUMERIC,
  base_unit_code VARCHAR
)
LANGUAGE SQL STABLE
AS $$
  SELECT pt.tax_id, t.name, tt.dian_code, tt.code, cm.code, bt.code,
         pt.calculation_order, pt.is_included, COALESCE(t.rate, 0),
         tr.percentage_rate, tr.fixed_amount, tr.base_quantity, tr.base_unit_code
  FROM public.product_taxes AS pt
  LEFT JOIN public.taxes AS t ON t.id = pt.tax_id AND t.tenant_id = pt.tenant_id
  LEFT JOIN public.tax_types AS tt ON tt.id = t.tax_type_id
  LEFT JOIN public.tax_calculation_methods AS cm ON cm.id = t.calculation_method_id
  LEFT JOIN public.tax_base_types AS bt ON bt.id = t.tax_base_type_id
  LEFT JOIN public.product_tax_profiles AS ptp
    ON ptp.tenant_id = pt.tenant_id AND ptp.product_id = pt.product_id
  LEFT JOIN LATERAL (
    SELECT tr_inner.percentage_rate, tr_inner.fixed_amount,
           tr_inner.base_quantity, tr_inner.base_unit_code
    FROM public.tax_rates AS tr_inner
    WHERE tr_inner.tenant_id = pt.tenant_id
      AND tr_inner.tax_id = pt.tax_id
      AND (tr_inner.tax_product_category_id = ptp.tax_product_category_id
           OR tr_inner.tax_product_category_id IS NULL)
      AND tr_inner.effective_from <= p_as_of
      AND (tr_inner.effective_to IS NULL OR tr_inner.effective_to >= p_as_of)
      AND tr_inner.is_active = TRUE
    ORDER BY CASE WHEN tr_inner.tax_product_category_id = ptp.tax_product_category_id
                  THEN 0 ELSE 1 END,
             tr_inner.effective_from DESC,
             tr_inner.effective_to DESC NULLS LAST
    LIMIT 1
  ) AS tr ON TRUE
  WHERE pt.tenant_id = p_tenant_id AND pt.product_id = p_product_id
    AND pt.is_active = TRUE
  ORDER BY pt.calculation_order ASC, pt.created_at ASC;
$$;

COMMIT;
