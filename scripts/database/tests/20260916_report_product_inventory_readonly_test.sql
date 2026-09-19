-- Run only after V086 is applied to a safe test database. This script reads
-- existing rows and does not create or change business data.
BEGIN READ ONLY;

DO $test$
DECLARE
  selected_tenant uuid;
  selected_branch uuid;
  foreign_branch uuid;
BEGIN
  SELECT b.tenant_id, b.id INTO selected_tenant, selected_branch
  FROM public.tenant_branches AS b
  WHERE b.estado = 'ACTIVE'
  ORDER BY b.tenant_id, b.id LIMIT 1;

  IF selected_tenant IS NULL THEN
    RAISE NOTICE 'SKIP: no active test branch';
    RETURN;
  END IF;

  IF EXISTS (SELECT 1 FROM public.fnc_report_product_inventory(selected_tenant, NULL::uuid[]))
    OR EXISTS (SELECT 1 FROM public.fnc_report_product_inventory(selected_tenant, ARRAY[]::uuid[])) THEN
    RAISE EXCEPTION 'Empty branch scope returned inventory';
  END IF;

  SELECT b.id INTO foreign_branch FROM public.tenant_branches AS b
  WHERE b.tenant_id <> selected_tenant AND b.estado = 'ACTIVE'
  ORDER BY b.id LIMIT 1;
  IF foreign_branch IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.fnc_report_product_inventory(selected_tenant, ARRAY[foreign_branch])
  ) THEN
    RAISE EXCEPTION 'Foreign tenant branch returned inventory';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.fnc_report_product_inventory(selected_tenant, ARRAY[selected_branch]) AS report
    LEFT JOIN (
      SELECT product_id,
        SUM(CASE WHEN type = 'IN' THEN quantity ELSE -quantity END) AS quantity
      FROM public.stock_movements
      WHERE tenant_id = selected_tenant AND branch_id = selected_branch
      GROUP BY product_id
    ) AS movements ON movements.product_id = report.product_id
    WHERE report.stock IS DISTINCT FROM COALESCE(movements.quantity, 0)
  ) THEN
    RAISE EXCEPTION 'Product stock differs from IN minus OUT';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.fnc_report_product_inventory(selected_tenant, ARRAY[selected_branch]) AS report
    LEFT JOIN (
      SELECT lot_id, location_id,
        SUM(quantity_on_hand) AS on_hand, SUM(quantity_reserved) AS reserved,
        SUM(quantity_available) AS available
      FROM public.inventory_lot_balances
      WHERE tenant_id = selected_tenant AND branch_id = selected_branch
      GROUP BY lot_id, location_id
    ) AS balances ON balances.lot_id = report.lot_id
      AND balances.location_id IS NOT DISTINCT FROM report.location_id
    WHERE report.lot_id IS NOT NULL
      AND (report.quantity_on_hand IS DISTINCT FROM COALESCE(balances.on_hand, 0)
        OR report.quantity_reserved IS DISTINCT FROM COALESCE(balances.reserved, 0)
        OR report.quantity_available IS DISTINCT FROM COALESCE(balances.available, 0))
  ) THEN
    RAISE EXCEPTION 'Lot balances differ from source';
  END IF;
END
$test$;

ROLLBACK;
