-- V108: serialize stock snapshots across SQL functions and application writers.
-- The migration is forward-only. It protects the read/validate/insert sequence.

CREATE OR REPLACE FUNCTION public.inventory_lock_stock_scope(
  p_tenant_id UUID,
  p_branch_id UUID,
  p_product_id UUID
)
RETURNS VOID
LANGUAGE SQL
AS $$
  SELECT pg_advisory_xact_lock(
    hashtextextended(
      format('%s:%s:%s', p_tenant_id, COALESCE(p_branch_id::TEXT, ''), p_product_id),
      0
    )
  );
$$;

CREATE OR REPLACE FUNCTION public.inventory_stock_movement_snapshot_before_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_stock_before NUMERIC(14, 3);
  v_stock_after NUMERIC(14, 3);
BEGIN
  IF NEW.branch_id IS NULL THEN
    RETURN NEW;
  END IF;

  PERFORM public.inventory_lock_stock_scope(NEW.tenant_id, NEW.branch_id, NEW.product_id);

  SELECT
    COALESCE(SUM(sm.quantity) FILTER (WHERE sm.type = 'IN'), 0)
    - COALESCE(SUM(sm.quantity) FILTER (WHERE sm.type = 'OUT'), 0)
  INTO v_stock_before
  FROM public.stock_movements AS sm
  WHERE sm.tenant_id = NEW.tenant_id
    AND sm.branch_id = NEW.branch_id
    AND sm.product_id = NEW.product_id;

  v_stock_before := ROUND(v_stock_before, 3);
  v_stock_after := ROUND(
    v_stock_before + CASE WHEN NEW.type = 'IN' THEN NEW.quantity ELSE -NEW.quantity END,
    3
  );

  IF NEW.type = 'OUT' AND v_stock_after < 0 THEN
    RAISE EXCEPTION 'insufficient stock for product % in branch %', NEW.product_id, NEW.branch_id;
  END IF;

  NEW.stock_before := v_stock_before;
  NEW.stock_after := v_stock_after;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_stock_movements_snapshot_before_insert ON public.stock_movements;
CREATE TRIGGER trg_stock_movements_snapshot_before_insert
BEFORE INSERT ON public.stock_movements
FOR EACH ROW
EXECUTE FUNCTION public.inventory_stock_movement_snapshot_before_insert();

DO $$
DECLARE
  v_definition TEXT;
  v_marker TEXT := E'  INSERT INTO sales (\n';
  v_marker_count INTEGER;
  v_lock_block TEXT := E'  FOR v_product IN\n'
    || E'    SELECT DISTINCT item.product_id::UUID AS product_id\n'
    || E'    FROM jsonb_to_recordset(p_items) AS item(product_id TEXT)\n'
    || E'    ORDER BY product_id\n'
    || E'  LOOP\n'
    || E'    PERFORM public.inventory_lock_stock_scope(p_tenant_id, p_branch_id, v_product.product_id);\n'
    || E'  END LOOP;\n\n';
  v_lock_block_count INTEGER;
BEGIN
  SELECT pg_get_functiondef(
    'public.inventory_create_sale_v2(uuid,uuid,uuid,uuid,uuid,uuid,uuid,character varying,jsonb,jsonb)'::REGPROCEDURE
  ) INTO v_definition;

  v_marker_count := (
    LENGTH(v_definition) - LENGTH(REPLACE(v_definition, v_marker, ''))
  ) / LENGTH(v_marker);

  IF v_marker_count <> 1 THEN
    RAISE EXCEPTION
      'inventory_create_sale_v2 source marker must occur exactly once; found %',
      v_marker_count;
  END IF;

  IF POSITION('v_product RECORD' IN v_definition) = 0 THEN
    RAISE EXCEPTION 'inventory_create_sale_v2 v_product declaration not found';
  END IF;

  v_lock_block_count := (
    LENGTH(v_definition) - LENGTH(REPLACE(v_definition, v_lock_block, ''))
  ) / LENGTH(v_lock_block);

  IF v_lock_block_count > 1 THEN
    RAISE EXCEPTION
      'inventory_create_sale_v2 lock block is duplicated; found %',
      v_lock_block_count;
  END IF;

  IF v_lock_block_count = 0 THEN
    v_definition := REPLACE(v_definition, v_marker, v_lock_block || v_marker);
    EXECUTE v_definition;
  END IF;
END $$;
