BEGIN;

CREATE OR REPLACE FUNCTION public.inventory_bi_base(
  p_tenant_id uuid,
  p_branch_ids uuid[] DEFAULT NULL,
  p_product_ids uuid[] DEFAULT NULL,
  p_category_id uuid DEFAULT NULL,
  p_stock_status text DEFAULT 'all'
)
RETURNS TABLE (
  tenant_id uuid,
  branch_id uuid,
  branch_name text,
  product_id uuid,
  product_name text,
  sku text,
  category_id uuid,
  category_name text,
  real_stock numeric,
  real_unit_cost numeric,
  inventory_cost numeric,
  stock_status text
)
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $function$
  WITH base AS (
    SELECT
      p.tenant_id,
      b.id AS branch_id,
      b.nombre::text AS branch_name,
      p.id AS product_id,
      p.name::text AS product_name,
      p.sku::text AS sku,
      p.category_id,
      category.name::text AS category_name,
      COALESCE(
        SUM(CASE WHEN movement.type = 'IN' THEN movement.quantity ELSE -movement.quantity END),
        0
      )::numeric AS real_stock,
      p.cost::numeric AS real_unit_cost
    FROM public.products AS p
    INNER JOIN public.tenant_branches AS b
      ON b.tenant_id = p.tenant_id
     AND b.estado = 'ACTIVE'
    LEFT JOIN public.product_categories AS category
      ON category.tenant_id = p.tenant_id
     AND category.id = p.category_id
    LEFT JOIN public.stock_movements AS movement
      ON movement.tenant_id = p.tenant_id
     AND movement.product_id = p.id
     AND movement.branch_id = b.id
    WHERE p.tenant_id = p_tenant_id
      AND p.is_active = TRUE
      AND (p_branch_ids IS NULL OR b.id = ANY(p_branch_ids))
      AND (p_product_ids IS NULL OR cardinality(p_product_ids) = 0 OR p.id = ANY(p_product_ids))
      AND (p_category_id IS NULL OR p.category_id = p_category_id)
    GROUP BY
      p.tenant_id,
      b.id,
      b.nombre,
      p.id,
      p.name,
      p.sku,
      p.category_id,
      category.name,
      p.cost
  ),
  classified AS (
    SELECT
      base.*,
      (base.real_stock * base.real_unit_cost)::numeric AS inventory_cost,
      CASE
        WHEN base.real_stock > 0 THEN 'WITH_STOCK'
        WHEN base.real_stock < 0 THEN 'NEGATIVE'
        ELSE 'OUT_OF_STOCK'
      END::text AS stock_status
    FROM base
  )
  SELECT
    classified.tenant_id,
    classified.branch_id,
    classified.branch_name,
    classified.product_id,
    classified.product_name,
    classified.sku,
    classified.category_id,
    classified.category_name,
    classified.real_stock,
    classified.real_unit_cost,
    classified.inventory_cost,
    classified.stock_status
  FROM classified
  WHERE p_stock_status = 'all'
     OR (p_stock_status = 'in_stock' AND classified.stock_status = 'WITH_STOCK')
     OR (p_stock_status = 'out_of_stock' AND classified.stock_status = 'OUT_OF_STOCK')
     OR (p_stock_status = 'negative' AND classified.stock_status = 'NEGATIVE');
$function$;

COMMIT;
