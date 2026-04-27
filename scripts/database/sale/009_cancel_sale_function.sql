CREATE OR REPLACE FUNCTION inventory_cancel_sale(
  p_sale_id UUID,
  p_tenant_id UUID
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
  v_sale RECORD;
  v_item RECORD;
  v_order_items_total INTEGER := 0;
  v_order_items_zero_delivered INTEGER := 0;
  v_order_items_completed INTEGER := 0;
BEGIN
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
  INTO v_sale
  FROM sales s
  WHERE s.id = p_sale_id
    AND s.tenant_id = p_tenant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'sale not found';
  END IF;

  IF v_sale.status = 'CANCELLED' THEN
    RAISE EXCEPTION 'sale already cancelled';
  END IF;

  IF v_sale.status NOT IN ('DRAFT', 'CONFIRMED') THEN
    RAISE EXCEPTION 'sale cannot be cancelled in its current status';
  END IF;

  FOR v_item IN
    SELECT
      si.id,
      si.product_id,
      si.order_item_id,
      si.quantity
    FROM sale_items si
    WHERE si.sale_id = p_sale_id
      AND si.tenant_id = p_tenant_id
    ORDER BY si.created_at ASC, si.id ASC
  LOOP
    INSERT INTO stock_movements (
      id,
      tenant_id,
      product_id,
      type,
      quantity,
      reference_type,
      reference_id,
      created_at
    ) VALUES (
      gen_random_uuid(),
      p_tenant_id,
      v_item.product_id,
      'IN',
      v_item.quantity,
      'SALE',
      p_sale_id,
      NOW()
    );

    IF v_sale.order_id IS NOT NULL AND v_item.order_item_id IS NOT NULL THEN
      UPDATE order_items
      SET delivered_quantity = delivered_quantity - v_item.quantity
      WHERE id = v_item.order_item_id
        AND order_id = v_sale.order_id
        AND delivered_quantity >= v_item.quantity;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'delivered quantity cannot become negative for order item %', v_item.order_item_id;
      END IF;
    END IF;
  END LOOP;

  UPDATE sales
  SET status = 'CANCELLED'
  WHERE id = p_sale_id
    AND tenant_id = p_tenant_id;

  IF v_sale.order_id IS NOT NULL THEN
    SELECT
      COUNT(*)::INTEGER,
      COUNT(*) FILTER (WHERE delivered_quantity = 0)::INTEGER,
      COUNT(*) FILTER (WHERE delivered_quantity >= ordered_quantity)::INTEGER
    INTO
      v_order_items_total,
      v_order_items_zero_delivered,
      v_order_items_completed
    FROM order_items
    WHERE order_id = v_sale.order_id;

    UPDATE orders
    SET status = CASE
      WHEN v_order_items_total = 0 THEN 'CONFIRMED'
      WHEN v_order_items_zero_delivered = v_order_items_total THEN 'CONFIRMED'
      WHEN v_order_items_completed = v_order_items_total THEN 'COMPLETED'
      ELSE 'PARTIAL'
    END
    WHERE id = v_sale.order_id
      AND tenant_id = p_tenant_id;
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
  WHERE s.id = p_sale_id
    AND s.tenant_id = p_tenant_id;
END;
$$;
