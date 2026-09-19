-- GENERAL and PHYSICAL_COUNT return one row per product and branch.
-- LOTS_EXPIRATIONS returns one row per product, branch, lot and location.
CREATE OR REPLACE FUNCTION public.fnc_report_product_inventory(
  p_tenant_id uuid,
  p_branch_ids uuid[],
  p_preset text DEFAULT 'GENERAL',
  p_search text DEFAULT NULL,
  p_sku text DEFAULT NULL,
  p_code text DEFAULT NULL,
  p_category_id uuid DEFAULT NULL,
  p_subcategory_id uuid DEFAULT NULL,
  p_unit_id uuid DEFAULT NULL,
  p_sale_type text DEFAULT NULL,
  p_measurement_unit text DEFAULT NULL,
  p_operational_status text DEFAULT NULL,
  p_stock_state text DEFAULT NULL,
  p_min_stock numeric DEFAULT NULL,
  p_max_stock numeric DEFAULT NULL,
  p_lot_code text DEFAULT NULL,
  p_lot_presence text DEFAULT NULL,
  p_expiration_from date DEFAULT NULL,
  p_expiration_to date DEFAULT NULL,
  p_expired_only boolean DEFAULT FALSE,
  p_location_id uuid DEFAULT NULL,
  p_limit integer DEFAULT 100,
  p_offset integer DEFAULT 0
)
RETURNS TABLE (
  product_id uuid, product_name text, sku text,
  category_id uuid, category_name text, subcategory_id uuid, subcategory_name text,
  unit_id uuid, unit_name text, unit_abbreviation text,
  sale_type text, measurement_unit text, operational_status text,
  branch_id uuid, branch_name text, price numeric, catalog_cost numeric,
  stock numeric, min_stock numeric, max_stock numeric, stock_state text,
  primary_code text, assigned_codes text[], requires_lot boolean,
  requires_expiration boolean, lot_id uuid, lot_code text, lot_status text,
  lot_unit_cost numeric, expiration_date date, days_to_expiration integer,
  quantity_on_hand numeric, quantity_reserved numeric, quantity_available numeric,
  location_id uuid, location_code text, location_name text, total_rows bigint
)
LANGUAGE sql
STABLE
AS $function$
  WITH scoped_branches AS (
    SELECT b.id, b.nombre
    FROM public.tenant_branches AS b
    WHERE p_tenant_id IS NOT NULL
      AND COALESCE(cardinality(p_branch_ids), 0) > 0
      AND b.tenant_id = p_tenant_id
      AND b.estado = 'ACTIVE'
      AND b.id = ANY(p_branch_ids)
  ),
  scoped_products AS (
    SELECT p.*
    FROM public.products AS p
    WHERE p.tenant_id = p_tenant_id
      AND (p_search IS NULL OR p.name ILIKE '%' || p_search || '%' OR p.sku ILIKE '%' || p_search || '%')
      AND (p_sku IS NULL OR p.sku ILIKE '%' || p_sku || '%')
      AND (p_category_id IS NULL OR p.category_id = p_category_id)
      AND (p_subcategory_id IS NULL OR p.subcategory_id = p_subcategory_id)
      AND (p_unit_id IS NULL OR p.unit_id = p_unit_id)
      AND (p_sale_type IS NULL OR p.sale_type = p_sale_type)
      AND (p_measurement_unit IS NULL OR p.measurement_unit = p_measurement_unit)
      AND (p_operational_status IS NULL OR p.operational_status = p_operational_status)
      AND (p_code IS NULL OR EXISTS (
        SELECT 1 FROM public.product_barcodes AS barcode
        WHERE barcode.tenant_id = p_tenant_id AND barcode.product_id = p.id
          AND barcode.is_active AND barcode.barcode ILIKE '%' || p_code || '%'
      ))
  ),
  code_summary AS (
    SELECT c.product_id,
      (array_agg(c.barcode ORDER BY c.is_primary DESC, c.created_at, c.id))[1] AS primary_code,
      array_agg(c.barcode ORDER BY c.is_primary DESC, c.created_at, c.id) AS assigned_codes
    FROM public.product_barcodes AS c
    INNER JOIN scoped_products AS p ON p.id = c.product_id AND p.tenant_id = c.tenant_id
    WHERE c.tenant_id = p_tenant_id AND c.is_active
    GROUP BY c.product_id
  ),
  stock_summary AS (
    SELECT m.product_id, m.branch_id,
      SUM(CASE WHEN m.type = 'IN' THEN m.quantity ELSE -m.quantity END) AS stock
    FROM public.stock_movements AS m
    INNER JOIN scoped_products AS p ON p.id = m.product_id AND p.tenant_id = m.tenant_id
    INNER JOIN scoped_branches AS b ON b.id = m.branch_id
    WHERE m.tenant_id = p_tenant_id
    GROUP BY m.product_id, m.branch_id
  ),
  lot_detail AS (
    SELECT l.product_id, l.branch_id, l.id AS lot_id, l.lot_code,
      l.status AS lot_status, l.unit_cost AS lot_unit_cost, l.expiration_date,
      bal.location_id,
      COALESCE(SUM(bal.quantity_on_hand), 0) AS quantity_on_hand,
      COALESCE(SUM(bal.quantity_reserved), 0) AS quantity_reserved,
      COALESCE(SUM(bal.quantity_available), 0) AS quantity_available
    FROM public.inventory_lots AS l
    INNER JOIN scoped_products AS p ON p.id = l.product_id AND p.tenant_id = l.tenant_id
    INNER JOIN scoped_branches AS b ON b.id = l.branch_id
    LEFT JOIN public.inventory_lot_balances AS bal
      ON bal.tenant_id = l.tenant_id AND bal.branch_id = l.branch_id
      AND bal.product_id = l.product_id AND bal.lot_id = l.id
    WHERE l.tenant_id = p_tenant_id
    GROUP BY l.product_id, l.branch_id, l.id, l.lot_code,
      l.status, l.unit_cost, l.expiration_date, bal.location_id
  )
  SELECT p.id, p.name::text, p.sku::text,
    category.id, category.name::text, subcategory.id, subcategory.name::text,
    unit.id, unit.name::text, unit.abbreviation::text,
    p.sale_type, p.measurement_unit, p.operational_status,
    b.id, b.nombre::text, p.price, p.cost,
    COALESCE(stock.stock, 0), p.min_stock, p.max_stock,
    CASE WHEN COALESCE(stock.stock, 0) <= 0 THEN 'OUT_OF_STOCK'
      WHEN p.min_stock IS NOT NULL AND stock.stock < p.min_stock THEN 'LOW_STOCK'
      ELSE 'AVAILABLE' END,
    codes.primary_code, COALESCE(codes.assigned_codes, ARRAY[]::text[]),
    p.requires_lot, p.requires_expiration,
    lot.lot_id, lot.lot_code, lot.lot_status, lot.lot_unit_cost,
    lot.expiration_date,
    CASE WHEN lot.expiration_date IS NULL THEN NULL
      ELSE lot.expiration_date - CURRENT_DATE END,
    lot.quantity_on_hand, lot.quantity_reserved, lot.quantity_available,
    location.id, location.code, location.name,
    COUNT(*) OVER () AS total_rows
  FROM scoped_products AS p
  CROSS JOIN scoped_branches AS b
  LEFT JOIN public.product_categories AS category
    ON category.id = p.category_id AND category.tenant_id = p_tenant_id
  LEFT JOIN public.product_subcategories AS subcategory
    ON subcategory.id = p.subcategory_id AND subcategory.tenant_id = p_tenant_id
    AND subcategory.category_id = category.id
  INNER JOIN public.units AS unit
    ON unit.id = p.unit_id AND unit.tenant_id = p_tenant_id
  LEFT JOIN code_summary AS codes ON codes.product_id = p.id
  LEFT JOIN stock_summary AS stock ON stock.product_id = p.id AND stock.branch_id = b.id
  LEFT JOIN lot_detail AS lot
    ON p_preset = 'LOTS_EXPIRATIONS'
    AND lot.product_id = p.id AND lot.branch_id = b.id
  LEFT JOIN public.inventory_locations AS location
    ON location.id = lot.location_id AND location.tenant_id = p_tenant_id
    AND location.branch_id = b.id
  WHERE (p_stock_state IS NULL OR
    CASE WHEN COALESCE(stock.stock, 0) <= 0 THEN 'OUT_OF_STOCK'
      WHEN p.min_stock IS NOT NULL AND stock.stock < p.min_stock THEN 'LOW_STOCK'
      ELSE 'AVAILABLE' END = p_stock_state)
    AND (p_min_stock IS NULL OR COALESCE(stock.stock, 0) >= p_min_stock)
    AND (p_max_stock IS NULL OR COALESCE(stock.stock, 0) <= p_max_stock)
    AND (
      p_preset = 'LOTS_EXPIRATIONS'
      OR p_lot_presence IS NULL
      OR (p_lot_presence = 'WITH' AND EXISTS (
        SELECT 1 FROM lot_detail filter_lot
        WHERE filter_lot.product_id = p.id AND filter_lot.branch_id = b.id
      ))
      OR (p_lot_presence = 'WITHOUT' AND NOT EXISTS (
        SELECT 1 FROM lot_detail filter_lot
        WHERE filter_lot.product_id = p.id AND filter_lot.branch_id = b.id
      ))
    )
    AND (
      p_preset = 'LOTS_EXPIRATIONS'
      OR (p_lot_code IS NULL AND p_expiration_from IS NULL AND p_expiration_to IS NULL
        AND NOT COALESCE(p_expired_only, FALSE) AND p_location_id IS NULL)
      OR EXISTS (
        SELECT 1 FROM lot_detail filter_lot
        WHERE filter_lot.product_id = p.id AND filter_lot.branch_id = b.id
          AND (p_lot_code IS NULL OR filter_lot.lot_code ILIKE '%' || p_lot_code || '%')
          AND (p_expiration_from IS NULL OR filter_lot.expiration_date >= p_expiration_from)
          AND (p_expiration_to IS NULL OR filter_lot.expiration_date <= p_expiration_to)
          AND (NOT COALESCE(p_expired_only, FALSE) OR filter_lot.expiration_date < CURRENT_DATE)
          AND (p_location_id IS NULL OR filter_lot.location_id = p_location_id)
      )
    )
    AND (p_preset = 'LOTS_EXPIRATIONS' OR p_preset IN ('GENERAL', 'PHYSICAL_COUNT'))
    AND (p_preset <> 'LOTS_EXPIRATIONS' OR p_lot_code IS NULL OR lot.lot_code ILIKE '%' || p_lot_code || '%')
    AND (p_preset <> 'LOTS_EXPIRATIONS' OR p_expiration_from IS NULL OR lot.expiration_date >= p_expiration_from)
    AND (p_preset <> 'LOTS_EXPIRATIONS' OR p_expiration_to IS NULL OR lot.expiration_date <= p_expiration_to)
    AND (p_preset <> 'LOTS_EXPIRATIONS' OR NOT COALESCE(p_expired_only, FALSE) OR lot.expiration_date < CURRENT_DATE)
    AND (p_preset <> 'LOTS_EXPIRATIONS' OR p_location_id IS NULL OR location.id = p_location_id)
    AND (p_preset <> 'LOTS_EXPIRATIONS' OR lot.lot_id IS NOT NULL)
    AND (p_preset <> 'LOTS_EXPIRATIONS' OR p_lot_presence IS NULL
      OR (p_lot_presence = 'WITH' AND lot.lot_id IS NOT NULL)
      OR (p_lot_presence = 'WITHOUT' AND lot.lot_id IS NULL))
  ORDER BY b.nombre, b.id, p.name, p.id, lot.expiration_date NULLS LAST,
    lot.lot_code NULLS LAST, lot.lot_id NULLS LAST, location.code NULLS LAST,
    location.id NULLS LAST
  LIMIT GREATEST(COALESCE(p_limit, 100), 0)
  OFFSET GREATEST(COALESCE(p_offset, 0), 0);
$function$;

REVOKE ALL ON FUNCTION public.fnc_report_product_inventory(
  uuid, uuid[], text, text, text, text, uuid, uuid, uuid, text, text, text,
  text, numeric, numeric, text, text, date, date, boolean, uuid, integer, integer
) FROM PUBLIC;

DO $grant$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'manus_user') THEN
    GRANT EXECUTE ON FUNCTION public.fnc_report_product_inventory(
      uuid, uuid[], text, text, text, text, uuid, uuid, uuid, text, text, text,
      text, numeric, numeric, text, text, date, date, boolean, uuid, integer, integer
    ) TO manus_user;
  END IF;
END
$grant$;
