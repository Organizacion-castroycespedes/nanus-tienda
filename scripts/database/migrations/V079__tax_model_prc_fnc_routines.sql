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
