CREATE OR REPLACE FUNCTION inventory_create_sale(
  p_tenant_id UUID,
  p_branch_id UUID,
  p_terminal_id UUID,
  p_user_id UUID,
  p_pos_session_id UUID,
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
  v_balance_due NUMERIC(12, 2) := 0;
  v_total_paid NUMERIC(12, 2) := 0;
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
  v_stock_before NUMERIC(12, 2);
  v_order_items_total INTEGER := 0;
  v_order_items_zero_delivered INTEGER := 0;
  v_order_items_completed INTEGER := 0;
BEGIN
  IF p_type NOT IN ('CASH', 'CREDIT') THEN
    RAISE EXCEPTION 'type is invalid';
  END IF;

  IF p_branch_id IS NULL THEN
    RAISE EXCEPTION 'branch_id is required';
  END IF;

  IF p_terminal_id IS NULL THEN
    RAISE EXCEPTION 'terminal_id is required';
  END IF;

  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'user_id is required';
  END IF;

  IF p_pos_session_id IS NULL THEN
    RAISE EXCEPTION 'pos_session_id is required';
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
  FROM tenant_branches tb
  WHERE tb.id = p_branch_id
    AND tb.tenant_id = p_tenant_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'branch not found for tenant';
  END IF;

  PERFORM 1
  FROM terminals t
  WHERE t.id = p_terminal_id
    AND t.tenant_id = p_tenant_id
    AND t.branch_id = p_branch_id
    AND t.is_active = TRUE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'terminal not found for tenant and branch';
  END IF;

  PERFORM 1
  FROM users u
  WHERE u.id = p_user_id
    AND u.tenant_id = p_tenant_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'user not found for tenant';
  END IF;

  PERFORM 1
  FROM pos_user_sessions pus
  WHERE pus.id = p_pos_session_id
    AND pus.tenant_id = p_tenant_id
    AND pus.branch_id = p_branch_id
    AND pus.terminal_id = p_terminal_id
    AND pus.user_id = p_user_id
    AND pus.is_active = TRUE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'pos session not found for context';
  END IF;

  PERFORM 1
  FROM customers c
  WHERE c.id = p_customer_id
    AND c.tenant_id = p_tenant_id
    AND c.is_active = TRUE;

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
    branch_id,
    terminal_id,
    user_id,
    pos_session_id,
    customer_id,
    order_id,
    type,
    status,
    total,
    balance,
    payment_status,
    total_paid,
    balance_due,
    created_at
  ) VALUES (
    v_sale_id,
    p_tenant_id,
    p_branch_id,
    p_terminal_id,
    p_user_id,
    p_pos_session_id,
    p_customer_id,
    p_order_id,
    p_type,
    'DRAFT',
    0,
    0,
    'PENDING',
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
      AND p.is_active = TRUE
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
      COALESCE(SUM(sm.quantity) FILTER (WHERE sm.type = 'IN'), 0)
      - COALESCE(SUM(sm.quantity) FILTER (WHERE sm.type = 'OUT'), 0)
    INTO v_available_stock
    FROM stock_movements sm
    WHERE sm.product_id = v_item.product_id
      AND sm.tenant_id = p_tenant_id
      AND sm.branch_id = p_branch_id;

    IF COALESCE(v_available_stock, 0) < v_quantity THEN
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

    v_stock_before := COALESCE(v_available_stock, 0);

    INSERT INTO stock_movements (
      id,
      tenant_id,
      product_id,
      type,
      quantity,
      reference_type,
      reference_id,
      created_at,
      branch_id,
      terminal_id,
      pos_session_code,
      user_id,
      reference_table,
      stock_before,
      stock_after
    ) VALUES (
      gen_random_uuid(),
      p_tenant_id,
      v_item.product_id,
      'OUT',
      v_quantity,
      'SALE',
      v_sale_id,
      v_now,
      p_branch_id,
      p_terminal_id,
      p_pos_session_id::text,
      p_user_id,
      'sales',
      v_stock_before,
      ROUND(v_stock_before - v_quantity, 2)
    );

    IF v_item.order_item_id IS NOT NULL THEN
      UPDATE order_items
      SET
        delivered_quantity = delivered_quantity + v_quantity,
        billed_quantity = COALESCE(billed_quantity, 0) + v_quantity
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
    v_total_paid := v_total;
  ELSE
    v_total_paid := LEAST(v_total, v_payment_total);
    v_balance := GREATEST(v_total - v_total_paid, 0);
  END IF;

  IF v_balance < 0 THEN
    RAISE EXCEPTION 'balance cannot be negative';
  END IF;

  v_balance_due := v_balance;

  UPDATE sales AS s
  SET
    total = v_total,
    balance = v_balance,
    total_paid = v_total_paid,
    balance_due = v_balance_due,
    payment_status = CASE
      WHEN v_total_paid <= 0 THEN 'PENDING'
      WHEN v_total_paid < v_total THEN 'PARTIAL'
      WHEN v_total_paid = v_total THEN 'PAID'
      ELSE 'OVERPAID'
    END
  WHERE s.id = v_sale_id
    AND s.tenant_id = p_tenant_id;

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

CREATE OR REPLACE FUNCTION finance_sync_order_financial_state(
  p_order_id UUID,
  p_tenant_id UUID
)
RETURNS TABLE (
  id UUID,
  total_paid NUMERIC(12, 2),
  balance_due NUMERIC(12, 2),
  payment_status VARCHAR(20)
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH payment_totals AS (
    SELECT COALESCE(SUM(allocation.allocated_amount), 0)::NUMERIC(12, 2) AS total_paid
    FROM payment_allocations AS allocation
    INNER JOIN payments AS payment
      ON payment.id = allocation.payment_id
    WHERE payment.tenant_id = p_tenant_id
      AND allocation.reference_type = 'SALES_ORDER'
      AND allocation.reference_id = p_order_id
      AND payment.status IN ('PENDING', 'COMPLETED')
  ),
  invoice_totals AS (
    SELECT COALESCE(SUM(s.total), 0)::NUMERIC(12, 2) AS invoiced_total
    FROM sales AS s
    WHERE s.order_id = p_order_id
      AND s.tenant_id = p_tenant_id
      AND s.status = 'CONFIRMED'
  ),
  computed AS (
    SELECT
      o.id,
      LEAST(
        o.total,
        COALESCE(payment_totals.total_paid, 0) + COALESCE(invoice_totals.invoiced_total, 0)
      )::NUMERIC(12, 2) AS next_total_paid,
      GREATEST(
        o.total - LEAST(
          o.total,
          COALESCE(payment_totals.total_paid, 0) + COALESCE(invoice_totals.invoiced_total, 0)
        ),
        0
      )::NUMERIC(12, 2) AS next_balance_due,
      CASE
        WHEN LEAST(
          o.total,
          COALESCE(payment_totals.total_paid, 0) + COALESCE(invoice_totals.invoiced_total, 0)
        ) <= 0 THEN 'PENDING'
        WHEN LEAST(
          o.total,
          COALESCE(payment_totals.total_paid, 0) + COALESCE(invoice_totals.invoiced_total, 0)
        ) < o.total THEN 'PARTIAL'
        WHEN LEAST(
          o.total,
          COALESCE(payment_totals.total_paid, 0) + COALESCE(invoice_totals.invoiced_total, 0)
        ) = o.total THEN 'PAID'
        ELSE 'OVERPAID'
      END::VARCHAR(20) AS next_payment_status
    FROM orders AS o
    CROSS JOIN payment_totals
    CROSS JOIN invoice_totals
    WHERE o.id = p_order_id
      AND o.tenant_id = p_tenant_id
  ),
  updated AS (
    UPDATE orders AS o
    SET
      total_paid = computed.next_total_paid,
      balance_due = computed.next_balance_due,
      payment_status = computed.next_payment_status
    FROM computed
    WHERE o.id = computed.id
      AND o.tenant_id = p_tenant_id
    RETURNING
      o.id,
      o.total_paid,
      o.balance_due,
      o.payment_status
  )
  SELECT
    updated.id,
    updated.total_paid,
    updated.balance_due,
    updated.payment_status
  FROM updated;
END;
$$;

CREATE OR REPLACE FUNCTION public.inventory_invoice_order(
  p_tenant_id uuid,
  p_branch_id uuid,
  p_terminal_id uuid,
  p_user_id uuid,
  p_pos_session_id uuid,
  p_order_id uuid,
  p_type varchar(20),
  p_payments jsonb DEFAULT '[]'::jsonb
)
RETURNS TABLE (
  id uuid,
  tenant_id uuid,
  customer_id uuid,
  order_id uuid,
  type varchar(20),
  status varchar(20),
  total numeric,
  balance numeric,
  created_at timestamptz
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_sale_id uuid := gen_random_uuid();
  v_sale_total numeric(14,2) := 0;
  v_inherited_total numeric(14,2) := 0;
  v_new_payments_total numeric(14,2) := 0;
  v_total_paid numeric(14,2) := 0;
  v_covered_total numeric(14,2) := 0;
  v_remaining numeric(14,2);
  v_order record;
  v_item record;
  v_product record;
  v_allocation record;
  v_payment record;
  v_sale_item_id uuid;
  v_allocated_amount numeric(14,2);
  v_original_amount numeric(14,2);
  v_price numeric(14,2);
  v_quantity numeric(14,2);
  v_price_without_tax numeric(14,2);
  v_tax_total numeric(14,2);
  v_subtotal numeric(14,2);
  v_payment_method text;
  v_payment_id uuid;
BEGIN
  SELECT o.id, o.customer_id, o.type, o.status
  INTO v_order
  FROM orders AS o
  WHERE o.id = p_order_id
    AND o.tenant_id = p_tenant_id
    AND o.status IN ('PARTIAL', 'COMPLETED')
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'order not found or not ready for invoicing';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM customers AS c
    WHERE c.id = v_order.customer_id
      AND c.tenant_id = p_tenant_id
      AND c.is_active = TRUE
  ) THEN
    RAISE EXCEPTION 'customer not found for tenant';
  END IF;

  INSERT INTO sales (
    id,
    tenant_id,
    branch_id,
    terminal_id,
    user_id,
    pos_session_id,
    customer_id,
    order_id,
    type,
    status,
    total,
    balance,
    payment_status,
    total_paid,
    balance_due,
    created_at
  )
  VALUES (
    v_sale_id,
    p_tenant_id,
    p_branch_id,
    p_terminal_id,
    p_user_id,
    p_pos_session_id,
    v_order.customer_id,
    p_order_id,
    p_type,
    'DRAFT',
    0,
    0,
    'PENDING',
    0,
    0,
    NOW()
  );

  FOR v_item IN
    SELECT
      oi.id,
      oi.product_id,
      oi.delivered_quantity,
      COALESCE(oi.billed_quantity, 0) AS billed_quantity,
      oi.price
    FROM order_items AS oi
    WHERE oi.order_id = p_order_id
      AND oi.delivered_quantity > COALESCE(oi.billed_quantity, 0)
    ORDER BY oi.id
    FOR UPDATE
  LOOP
    v_quantity := ROUND(
      (v_item.delivered_quantity - v_item.billed_quantity)::numeric,
      2
    );

    IF v_quantity <= 0 THEN
      CONTINUE;
    END IF;

    SELECT
      p.tax_id,
      t.name AS tax_name,
      COALESCE(t.rate, 0) AS tax_rate,
      COALESCE(t.is_included, FALSE) AS tax_is_included
    INTO v_product
    FROM products AS p
    LEFT JOIN taxes AS t
      ON t.id = p.tax_id
     AND t.tenant_id = p.tenant_id
    WHERE p.id = v_item.product_id
      AND p.tenant_id = p_tenant_id
      AND p.is_active = TRUE
    LIMIT 1;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'product not found for tenant';
    END IF;

    v_price := ROUND(v_item.price::numeric, 2);
    v_price_without_tax := CASE
      WHEN COALESCE(v_product.tax_rate, 0) > 0
        THEN ROUND(v_price / (1 + v_product.tax_rate::numeric), 2)
      ELSE v_price
    END;
    v_tax_total := CASE
      WHEN COALESCE(v_product.tax_rate, 0) > 0
        THEN ROUND((v_price - v_price_without_tax) * v_quantity, 2)
      ELSE 0
    END;
    v_subtotal := ROUND(v_price * v_quantity, 2);
    v_sale_total := ROUND(v_sale_total + v_subtotal, 2);
    v_sale_item_id := gen_random_uuid();

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
    )
    VALUES (
      v_sale_item_id,
      p_tenant_id,
      v_sale_id,
      v_item.product_id,
      v_item.id,
      v_quantity,
      v_price,
      v_price_without_tax,
      v_tax_total,
      v_subtotal,
      NOW()
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
      )
      VALUES (
        gen_random_uuid(),
        p_tenant_id,
        v_sale_item_id,
        v_product.tax_id,
        v_product.tax_name,
        COALESCE(v_product.tax_rate, 0),
        v_tax_total,
        COALESCE(v_product.tax_is_included, FALSE),
        NOW()
      );
    END IF;

    UPDATE order_items AS oi
    SET billed_quantity = COALESCE(oi.billed_quantity, 0) + v_quantity
    WHERE oi.id = v_item.id;
  END LOOP;

  IF v_sale_total <= 0 THEN
    RAISE EXCEPTION 'order has no delivered items pending invoicing';
  END IF;

  UPDATE sales AS s
  SET
    total = v_sale_total,
    balance = CASE
      WHEN s.type = 'CASH' THEN 0::numeric
      ELSE v_sale_total
    END,
    total_paid = 0::numeric,
    balance_due = CASE
      WHEN s.type = 'CASH' THEN 0::numeric
      ELSE v_sale_total
    END,
    payment_status = 'PENDING'
  WHERE s.id = v_sale_id
    AND s.tenant_id = p_tenant_id;

  v_remaining := v_sale_total;

  FOR v_allocation IN
    SELECT
      allocation.id,
      allocation.payment_id,
      allocation.allocated_amount,
      payment.reference_number,
      payment.notes,
      method.tipo AS payment_method_tipo
    FROM payment_allocations AS allocation
    INNER JOIN payments AS payment
      ON payment.id = allocation.payment_id
    INNER JOIN payment_methods AS method
      ON method.id = payment.payment_method_id
     AND method.tenant_id = payment.tenant_id
    WHERE payment.tenant_id = p_tenant_id
      AND allocation.reference_type = 'SALES_ORDER'
      AND allocation.reference_id = p_order_id
      AND payment.status IN ('PENDING', 'COMPLETED')
    ORDER BY allocation.created_at ASC, allocation.id ASC
  LOOP
    EXIT WHEN v_remaining <= 0;

    v_original_amount := ROUND(v_allocation.allocated_amount::numeric, 2);
    v_allocated_amount := ROUND(LEAST(v_original_amount, v_remaining), 2);

    IF v_allocated_amount <= 0 THEN
      CONTINUE;
    END IF;

    IF v_allocated_amount = v_original_amount THEN
      UPDATE payment_allocations AS pa
      SET
        reference_type = 'SALE',
        reference_id = v_sale_id
      WHERE pa.id = v_allocation.id;
    ELSE
      UPDATE payment_allocations AS pa
      SET allocated_amount = ROUND(v_original_amount - v_allocated_amount, 2)
      WHERE pa.id = v_allocation.id;

      INSERT INTO payment_allocations (
        id,
        payment_id,
        reference_type,
        reference_id,
        allocated_amount,
        created_at
      )
      VALUES (
        gen_random_uuid(),
        v_allocation.payment_id,
        'SALE',
        v_sale_id,
        v_allocated_amount,
        NOW()
      );
    END IF;

    IF to_regclass('public.sale_payment_methods') IS NOT NULL THEN
      INSERT INTO sale_payment_methods (
        id,
        tenant_id,
        sale_id,
        payment_method,
        amount,
        reference,
        created_at
      )
      VALUES (
        gen_random_uuid(),
        p_tenant_id,
        v_sale_id,
        CASE
          WHEN v_allocation.payment_method_tipo = 'BANK' THEN 'TRANSFER'
          WHEN v_allocation.payment_method_tipo IN ('DIGITAL', 'CREDIT') THEN 'OTHER'
          ELSE v_allocation.payment_method_tipo
        END,
        v_allocated_amount,
        COALESCE(v_allocation.reference_number, v_allocation.notes),
        NOW()
      );
    END IF;

    v_inherited_total := ROUND(v_inherited_total + v_allocated_amount, 2);
    v_remaining := ROUND(v_remaining - v_allocated_amount, 2);
  END LOOP;

  FOR v_payment IN
    SELECT *
    FROM jsonb_to_recordset(COALESCE(p_payments, '[]'::jsonb)) AS payment_input(
      payment_method_id uuid,
      amount numeric,
      cash_session_id uuid,
      reference_number text,
      notes text
    )
  LOOP
    IF v_payment.payment_method_id IS NULL THEN
      RAISE EXCEPTION 'paymentMethodId is required';
    END IF;

    IF v_payment.amount IS NULL OR ROUND(v_payment.amount::numeric, 2) <= 0 THEN
      RAISE EXCEPTION 'payment amount must be a positive number';
    END IF;

    SELECT
      CASE
        WHEN pm.tipo = 'BANK' THEN 'TRANSFER'
        WHEN pm.tipo IN ('DIGITAL', 'CREDIT') THEN 'OTHER'
        ELSE pm.tipo
      END
    INTO v_payment_method
    FROM payment_methods AS pm
    WHERE pm.id = v_payment.payment_method_id
      AND pm.tenant_id = p_tenant_id
      AND pm.active = TRUE
    LIMIT 1;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'payment method not found for tenant';
    END IF;

    IF v_payment_method = 'CASH' THEN
      IF v_payment.cash_session_id IS NULL THEN
        RAISE EXCEPTION 'cashSessionId is required for cash payments';
      END IF;

      IF NOT EXISTS (
        SELECT 1
        FROM cash_sessions AS cs
        WHERE cs.id = v_payment.cash_session_id
          AND cs.tenant_id = p_tenant_id
          AND cs.branch_id = p_branch_id
          AND cs.status = 'OPEN'
      ) THEN
        RAISE EXCEPTION 'cash session is invalid';
      END IF;
    END IF;

    v_payment_id := gen_random_uuid();

    INSERT INTO payments (
      id,
      tenant_id,
      branch_id,
      payment_method_id,
      cash_session_id,
      reference_type,
      reference_id,
      direction,
      status,
      amount,
      reference_number,
      notes,
      paid_by_person_id,
      created_by
    )
    VALUES (
      v_payment_id,
      p_tenant_id,
      p_branch_id,
      v_payment.payment_method_id,
      v_payment.cash_session_id,
      'SALE',
      v_sale_id,
      'IN',
      'COMPLETED',
      ROUND(v_payment.amount::numeric, 2),
      NULLIF(BTRIM(v_payment.reference_number), ''),
      NULLIF(BTRIM(v_payment.notes), ''),
      NULL,
      p_user_id
    );

    INSERT INTO payment_allocations (
      id,
      payment_id,
      reference_type,
      reference_id,
      allocated_amount,
      created_at
    )
    VALUES (
      gen_random_uuid(),
      v_payment_id,
      'SALE',
      v_sale_id,
      ROUND(v_payment.amount::numeric, 2),
      NOW()
    );

    IF to_regclass('public.sale_payment_methods') IS NOT NULL THEN
      INSERT INTO sale_payment_methods (
        id,
        tenant_id,
        sale_id,
        payment_method,
        amount,
        reference,
        created_at
      )
      VALUES (
        gen_random_uuid(),
        p_tenant_id,
        v_sale_id,
        v_payment_method,
        ROUND(v_payment.amount::numeric, 2),
        COALESCE(NULLIF(BTRIM(v_payment.reference_number), ''), NULLIF(BTRIM(v_payment.notes), '')),
        NOW()
      );
    END IF;

    v_new_payments_total := ROUND(v_new_payments_total + ROUND(v_payment.amount::numeric, 2), 2);
  END LOOP;

  v_covered_total := ROUND(v_inherited_total + v_new_payments_total, 2);

  IF p_type = 'CASH' AND v_covered_total <> ROUND(v_sale_total, 2) THEN
    RAISE EXCEPTION 'Las ventas CASH generadas desde orden deben quedar totalmente cubiertas entre abonos heredados y pagos nuevos';
  END IF;

  IF v_covered_total > ROUND(v_sale_total, 2) THEN
    RAISE EXCEPTION 'Los pagos heredados y nuevos no pueden superar el total a facturar';
  END IF;

  UPDATE sales
  SET
    total_paid = COALESCE(payment_totals.total_paid, 0),
    balance_due = CASE
      WHEN sales.type = 'CASH' THEN 0
      ELSE GREATEST(sales.total - COALESCE(payment_totals.total_paid, 0), 0)
    END,
    balance = CASE
      WHEN sales.type = 'CASH' THEN 0
      ELSE GREATEST(sales.total - COALESCE(payment_totals.total_paid, 0), 0)
    END,
    payment_status = CASE
      WHEN COALESCE(payment_totals.total_paid, 0) <= 0 THEN 'PENDING'
      WHEN COALESCE(payment_totals.total_paid, 0) < sales.total THEN 'PARTIAL'
      WHEN COALESCE(payment_totals.total_paid, 0) = sales.total THEN 'PAID'
      ELSE 'OVERPAID'
    END,
    status = 'CONFIRMED'
  FROM (
    SELECT COALESCE(SUM(allocation.allocated_amount), 0) AS total_paid
    FROM payment_allocations AS allocation
    INNER JOIN payments AS payment
      ON payment.id = allocation.payment_id
    WHERE payment.tenant_id = p_tenant_id
      AND allocation.reference_type = 'SALE'
      AND allocation.reference_id = v_sale_id
      AND payment.status IN ('PENDING', 'COMPLETED')
  ) AS payment_totals
  WHERE sales.id = v_sale_id
    AND sales.tenant_id = p_tenant_id;

  SELECT s.total_paid
  INTO v_total_paid
  FROM sales AS s
  WHERE s.id = v_sale_id
    AND s.tenant_id = p_tenant_id
  LIMIT 1;

  PERFORM finance_sync_order_financial_state(p_order_id, p_tenant_id);

  IF NOT FOUND THEN
    RAISE EXCEPTION 'sale could not be created';
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
  FROM sales AS s
  WHERE s.id = v_sale_id
    AND s.tenant_id = p_tenant_id
  LIMIT 1;
END;
$$;
