CREATE OR REPLACE FUNCTION inventory_create_sale(
  p_tenant_id UUID,
  p_customer_id UUID,
  p_order_id UUID,
  p_type VARCHAR(20),
  p_items JSONB,
  p_payment_methods JSONB DEFAULT '[]'::JSONB
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
  v_sale_id UUID := gen_random_uuid();
  v_now TIMESTAMPTZ := NOW();
  v_total NUMERIC(12, 2) := 0;
  v_balance NUMERIC(12, 2) := 0;
  v_payment_total NUMERIC(12, 2) := 0;
  v_item RECORD;
  v_product RECORD;
  v_payment_method RECORD;
  v_order_item RECORD;
  v_sale_item_id UUID;
  v_price NUMERIC(12, 2);
  v_quantity NUMERIC(12, 2);
  v_tax_rate NUMERIC(12, 4);
  v_price_without_tax NUMERIC(12, 2);
  v_tax_total NUMERIC(12, 2);
  v_subtotal NUMERIC(12, 2);
  v_available_stock NUMERIC(12, 2);
  v_order_items_total INTEGER := 0;
  v_order_items_zero_delivered INTEGER := 0;
  v_order_items_completed INTEGER := 0;
BEGIN
  IF p_type NOT IN ('CASH', 'CREDIT') THEN
    RAISE EXCEPTION 'type is invalid';
  END IF;

  IF p_items IS NULL
    OR jsonb_typeof(p_items) <> 'array'
    OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'sale items are required';
  END IF;

  IF p_payment_methods IS NOT NULL
    AND jsonb_typeof(p_payment_methods) <> 'array' THEN
    RAISE EXCEPTION 'payment methods must be an array';
  END IF;

  PERFORM 1
  FROM customers c
  WHERE c.id = p_customer_id
    AND c.tenant_id = p_tenant_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'customer not found for tenant';
  END IF;

  IF p_order_id IS NOT NULL THEN
    PERFORM 1
    FROM orders o
    WHERE o.id = p_order_id
      AND o.tenant_id = p_tenant_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'order not found for tenant';
    END IF;
  END IF;

  INSERT INTO sales (
    id,
    tenant_id,
    customer_id,
    order_id,
    type,
    status,
    total,
    balance,
    created_at
  ) VALUES (
    v_sale_id,
    p_tenant_id,
    p_customer_id,
    p_order_id,
    p_type,
    'DRAFT',
    0,
    0,
    v_now
  );

  FOR v_item IN
    SELECT
      item.product_id::UUID AS product_id,
      item.quantity::NUMERIC(12, 2) AS quantity,
      item.price::NUMERIC(12, 2) AS price,
      CASE
        WHEN item.order_item_id IS NULL OR BTRIM(item.order_item_id) = '' THEN NULL
        ELSE item.order_item_id::UUID
      END AS order_item_id
    FROM jsonb_to_recordset(p_items) AS item(
      product_id TEXT,
      quantity NUMERIC,
      price NUMERIC,
      order_item_id TEXT
    )
  LOOP
    IF v_item.product_id IS NULL THEN
      RAISE EXCEPTION 'productId is required';
    END IF;

    IF v_item.quantity IS NULL OR v_item.quantity <= 0 THEN
      RAISE EXCEPTION 'quantity must be a positive number';
    END IF;

    IF v_item.price IS NULL OR v_item.price < 0 THEN
      RAISE EXCEPTION 'price must be a non-negative number';
    END IF;

    v_price := ROUND(v_item.price, 2);
    v_quantity := ROUND(v_item.quantity, 2);

    SELECT
      p.id,
      p.tax_id,
      t.name AS tax_name,
      COALESCE(t.rate, 0) AS tax_rate,
      COALESCE(t.is_included, FALSE) AS tax_is_included
    INTO v_product
    FROM products p
    LEFT JOIN taxes t
      ON t.id = p.tax_id
     AND t.tenant_id = p.tenant_id
    WHERE p.id = v_item.product_id
      AND p.tenant_id = p_tenant_id
    LIMIT 1;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'product not found for tenant';
    END IF;

    IF v_item.order_item_id IS NOT NULL THEN
      IF p_order_id IS NULL THEN
        RAISE EXCEPTION 'order_id is required when order_item_id is provided';
      END IF;

      SELECT
        oi.id,
        oi.order_id,
        oi.ordered_quantity,
        oi.delivered_quantity
      INTO v_order_item
      FROM order_items oi
      INNER JOIN orders o
        ON o.id = oi.order_id
      WHERE oi.id = v_item.order_item_id
        AND oi.order_id = p_order_id
        AND o.tenant_id = p_tenant_id
      FOR UPDATE OF oi;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'order item not found for order and tenant';
      END IF;

      IF v_quantity > (v_order_item.ordered_quantity - v_order_item.delivered_quantity) THEN
        RAISE EXCEPTION 'sale quantity exceeds pending quantity for order item %', v_item.order_item_id;
      END IF;
    ELSIF p_order_id IS NOT NULL THEN
      RAISE EXCEPTION 'order_item_id is required for sale items linked to an order';
    END IF;

    SELECT
      COALESCE(SUM(quantity) FILTER (WHERE sm.type = 'IN'), 0)
      - COALESCE(SUM(quantity) FILTER (WHERE sm.type = 'OUT'), 0)
    INTO v_available_stock
    FROM stock_movements sm
    WHERE sm.product_id = v_item.product_id
      AND sm.tenant_id = p_tenant_id;

    IF COALESCE(v_available_stock, 0) < v_item.quantity THEN
      RAISE EXCEPTION 'insufficient stock for product %', v_item.product_id;
    END IF;

    v_sale_item_id := gen_random_uuid();
    v_tax_rate := COALESCE(v_product.tax_rate, 0);

    IF v_tax_rate > 0 THEN
      v_price_without_tax := ROUND(v_price / (1 + v_tax_rate), 2);
      v_tax_total := ROUND((v_price - v_price_without_tax) * v_quantity, 2);
    ELSE
      v_price_without_tax := v_price;
      v_tax_total := 0;
    END IF;

    v_subtotal := ROUND(v_price * v_quantity, 2);
    v_total := ROUND(v_total + v_subtotal, 2);

    INSERT INTO sale_items (
      id,
      tenant_id,
      sale_id,
      product_id,
      order_item_id,
      quantity,
      price,
      price_without_tax,
      tax_total,
      subtotal,
      created_at
    ) VALUES (
      v_sale_item_id,
      p_tenant_id,
      v_sale_id,
      v_item.product_id,
      v_item.order_item_id,
      v_quantity,
      v_price,
      v_price_without_tax,
      v_tax_total,
      v_subtotal,
      v_now
    );

    IF v_product.tax_id IS NOT NULL AND v_product.tax_name IS NOT NULL THEN
      INSERT INTO sale_item_taxes (
        id,
        tenant_id,
        sale_item_id,
        tax_id,
        tax_name,
        tax_rate,
        tax_amount,
        is_included,
        created_at
      ) VALUES (
        gen_random_uuid(),
        p_tenant_id,
        v_sale_item_id,
        v_product.tax_id,
        v_product.tax_name,
        v_tax_rate,
        v_tax_total,
        COALESCE(v_product.tax_is_included, FALSE),
        v_now
      );
    END IF;

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
      'OUT',
      v_quantity,
      'SALE',
      v_sale_id,
      v_now
    );

    IF v_item.order_item_id IS NOT NULL THEN
      UPDATE order_items
      SET delivered_quantity = delivered_quantity + v_quantity
      WHERE order_items.id = v_item.order_item_id
        AND order_items.order_id = p_order_id;
    END IF;
  END LOOP;

  FOR v_payment_method IN
    SELECT
      payment.payment_method::VARCHAR(20) AS payment_method,
      payment.amount::NUMERIC(12, 2) AS amount,
      NULLIF(BTRIM(payment.reference), '') AS reference
    FROM jsonb_to_recordset(COALESCE(p_payment_methods, '[]'::JSONB)) AS payment(
      payment_method TEXT,
      amount NUMERIC,
      reference TEXT
    )
  LOOP
    IF v_payment_method.payment_method NOT IN ('CASH', 'CARD', 'TRANSFER', 'OTHER') THEN
      RAISE EXCEPTION 'paymentMethod is invalid';
    END IF;

    IF v_payment_method.amount IS NULL OR v_payment_method.amount <= 0 THEN
      RAISE EXCEPTION 'amount must be a positive number';
    END IF;

    v_payment_total := ROUND(v_payment_total + ROUND(v_payment_method.amount, 2), 2);

    INSERT INTO sale_payment_methods (
      id,
      tenant_id,
      sale_id,
      payment_method,
      amount,
      reference,
      created_at
    ) VALUES (
      gen_random_uuid(),
      p_tenant_id,
      v_sale_id,
      v_payment_method.payment_method,
      ROUND(v_payment_method.amount, 2),
      v_payment_method.reference,
      v_now
    );
  END LOOP;

  IF p_type = 'CASH' THEN
    IF COALESCE(jsonb_array_length(COALESCE(p_payment_methods, '[]'::JSONB)), 0) = 0 THEN
      RAISE EXCEPTION 'payment methods are required for cash sales';
    END IF;

    IF v_payment_total <> v_total THEN
      RAISE EXCEPTION 'payment methods total must equal sale total for cash sales';
    END IF;

    v_balance := 0;
  ELSE
    v_balance := ROUND(v_total - v_payment_total, 2);
  END IF;

  IF v_balance < 0 THEN
    RAISE EXCEPTION 'balance cannot be negative';
  END IF;

  UPDATE sales
  SET total = v_total,
      balance = v_balance
  WHERE sales.id = v_sale_id
    AND sales.tenant_id = p_tenant_id;

  IF p_order_id IS NOT NULL THEN
    SELECT
      COUNT(*)::INTEGER,
      COUNT(*) FILTER (WHERE delivered_quantity = 0)::INTEGER,
      COUNT(*) FILTER (WHERE delivered_quantity >= ordered_quantity)::INTEGER
    INTO
      v_order_items_total,
      v_order_items_zero_delivered,
      v_order_items_completed
    FROM order_items oi
    WHERE oi.order_id = p_order_id;

    UPDATE orders
    SET status = CASE
      WHEN v_order_items_total = 0 THEN 'CONFIRMED'
      WHEN v_order_items_zero_delivered = v_order_items_total THEN 'CONFIRMED'
      WHEN v_order_items_completed = v_order_items_total THEN 'COMPLETED'
      ELSE 'PARTIAL'
    END
    WHERE id = p_order_id
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
  WHERE s.id = v_sale_id
    AND s.tenant_id = p_tenant_id;
END;
$$;
