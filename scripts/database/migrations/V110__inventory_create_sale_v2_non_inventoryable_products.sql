-- V110: permit commercial sale lines for non-inventoryable products.
--
-- This migration preserves the current V108 function body and changes only the
-- physical effects guarded by products.is_inventoryable. It does not edit V108,
-- V109, migrations_history, or the public function signature.

DO $migration$
DECLARE
  v_function REGPROCEDURE :=
    'public.inventory_create_sale_v2(uuid,uuid,uuid,uuid,uuid,uuid,uuid,character varying,jsonb,jsonb)'::REGPROCEDURE;
  v_definition TEXT;
  v_product_field_marker TEXT := E'      p.requires_expiration,\n      t.name AS tax_name,';
  v_stock_validation_marker TEXT := E'    SELECT\n      COALESCE(SUM(sm.quantity) FILTER (WHERE sm.type = ''IN''), 0)\n      - COALESCE(SUM(sm.quantity) FILTER (WHERE sm.type = ''OUT''), 0)\n    INTO v_available_stock';
  v_stock_movement_marker TEXT := E'    v_stock_before := COALESCE(v_available_stock, 0);\n\n    INSERT INTO stock_movements (';
  v_first_close_marker TEXT := E'    END IF;\n\n    v_sale_item_id := COALESCE(v_item.sale_item_id, gen_random_uuid());';
  v_fefo_close_marker TEXT := E'    END IF;\n\n    IF v_item.order_item_id IS NOT NULL THEN\n      UPDATE order_items AS oi_update';
BEGIN
  SELECT pg_get_functiondef(v_function) INTO v_definition;

  IF v_definition IS NULL THEN
    RAISE EXCEPTION 'inventory_create_sale_v2 definition is missing';
  END IF;

  IF POSITION('inventory_lock_stock_scope' IN v_definition) = 0 THEN
    RAISE EXCEPTION 'V108 advisory lock protocol is missing from inventory_create_sale_v2';
  END IF;

  IF POSITION('p.is_inventoryable' IN v_definition) > 0 THEN
    RAISE EXCEPTION 'inventory_create_sale_v2 already contains is_inventoryable';
  END IF;

  IF POSITION(v_product_field_marker IN v_definition) = 0 THEN
    RAISE EXCEPTION 'product inventoryability marker was not found';
  END IF;

  IF POSITION(v_stock_validation_marker IN v_definition) = 0 THEN
    RAISE EXCEPTION 'stock validation marker was not found';
  END IF;

  IF POSITION(v_stock_movement_marker IN v_definition) = 0 THEN
    RAISE EXCEPTION 'stock movement marker was not found';
  END IF;

  IF POSITION(v_first_close_marker IN v_definition) = 0 THEN
    RAISE EXCEPTION 'commercial line boundary marker was not found';
  END IF;

  IF POSITION(v_fefo_close_marker IN v_definition) = 0 THEN
    RAISE EXCEPTION 'physical effects boundary marker was not found';
  END IF;

  v_definition := REPLACE(
    v_definition,
    v_product_field_marker,
    E'      p.requires_expiration,\n      p.is_inventoryable,\n      t.name AS tax_name,'
  );

  v_definition := REPLACE(
    v_definition,
    v_stock_validation_marker,
    E'    IF COALESCE(v_product.is_inventoryable, TRUE) THEN\n\n' || v_stock_validation_marker
  );

  v_definition := REPLACE(
    v_definition,
    v_first_close_marker,
    E'    END IF;\n\n    END IF;\n\n    v_sale_item_id := COALESCE(v_item.sale_item_id, gen_random_uuid());'
  );

  v_definition := REPLACE(
    v_definition,
    v_stock_movement_marker,
    E'    IF COALESCE(v_product.is_inventoryable, TRUE) THEN\n\n' || v_stock_movement_marker
  );

  v_definition := REPLACE(
    v_definition,
    v_fefo_close_marker,
    E'    END IF;\n\n    END IF;\n\n    IF v_item.order_item_id IS NOT NULL THEN\n      UPDATE order_items AS oi_update'
  );

  EXECUTE v_definition;
END;
$migration$;
