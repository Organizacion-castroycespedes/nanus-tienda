CREATE OR REPLACE FUNCTION public.inventory_cancel_sale(p_sale_id uuid, p_tenant_id uuid)
 RETURNS TABLE(id uuid, tenant_id uuid, customer_id uuid, order_id uuid, type character varying, status character varying, total numeric, balance numeric, created_at timestamp with time zone)
 LANGUAGE plpgsql
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.inventory_create_sale(p_tenant_id uuid, p_branch_id uuid, p_terminal_id uuid, p_user_id uuid, p_pos_session_id uuid, p_customer_id uuid, p_order_id uuid, p_type character varying, p_items jsonb, p_payment_methods jsonb DEFAULT '[]'::jsonb)
 RETURNS TABLE(id uuid, tenant_id uuid, customer_id uuid, order_id uuid, type character varying, status character varying, total numeric, balance numeric, created_at timestamp with time zone)
 LANGUAGE plpgsql
AS $function$
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

  PERFORM finance_sync_order_financial_state(p_order_id, p_tenant_id);

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
$function$;

CREATE OR REPLACE FUNCTION public.inventory_dashboard_snapshot(p_tenant_id uuid, p_branch_id uuid DEFAULT NULL::uuid, p_terminal_id uuid DEFAULT NULL::uuid, p_cash_session_id uuid DEFAULT NULL::uuid, p_start_date date DEFAULT CURRENT_DATE, p_end_date date DEFAULT CURRENT_DATE)
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_payload JSONB;
BEGIN
  WITH date_bounds AS (
    SELECT
      p_start_date::timestamptz AS start_at,
      (p_end_date::date + INTERVAL '1 day')::timestamptz AS end_at
  ),
  scoped_products AS (
    SELECT
      p.id,
      p.name,
      p.sku
    FROM products AS p
    WHERE p.tenant_id = p_tenant_id
      AND p.is_active = TRUE
  ),
  scoped_branches AS (
    SELECT
      b.id,
      b.nombre
    FROM tenant_branches AS b
    WHERE b.tenant_id = p_tenant_id
      AND b.estado = 'ACTIVE'
      AND (p_branch_id IS NULL OR b.id = p_branch_id)
  ),
  product_branch_grid AS (
    SELECT
      p.id AS product_id,
      p.name AS product_name,
      p.sku,
      b.id AS branch_id,
      b.nombre AS branch_name
    FROM scoped_products AS p
    CROSS JOIN scoped_branches AS b
  ),
  scoped_movements AS (
    SELECT
      sm.id,
      sm.tenant_id,
      sm.product_id,
      sm.type,
      sm.quantity,
      sm.reference_type,
      sm.reference_id,
      sm.branch_id,
      sm.terminal_id,
      sm.user_id,
      sm.reference_table,
      sm.stock_before,
      sm.stock_after,
      sm.created_at
    FROM stock_movements AS sm
    INNER JOIN scoped_branches AS b
      ON b.id = sm.branch_id
    WHERE sm.tenant_id = p_tenant_id
      AND (p_terminal_id IS NULL OR sm.terminal_id = p_terminal_id)
  ),
  stock_balance AS (
    SELECT
      grid.product_id,
      grid.product_name,
      grid.sku,
      grid.branch_id,
      grid.branch_name,
      COALESCE(
        SUM(
          CASE
            WHEN movement.type = 'IN' THEN movement.quantity
            ELSE -movement.quantity
          END
        ),
        0
      ) AS stock,
      COALESCE(
        SUM(
          CASE
            WHEN movement.type = 'OUT'
             AND movement.created_at >= bounds.start_at
             AND movement.created_at < bounds.end_at
              THEN movement.quantity
            ELSE 0
          END
        ),
        0
      ) AS outbound_in_period,
      MAX(movement.created_at) AS last_movement_at
    FROM product_branch_grid AS grid
    CROSS JOIN date_bounds AS bounds
    LEFT JOIN scoped_movements AS movement
      ON movement.product_id = grid.product_id
     AND movement.branch_id = grid.branch_id
    GROUP BY
      grid.product_id,
      grid.product_name,
      grid.sku,
      grid.branch_id,
      grid.branch_name
  ),
  purchase_scope AS (
    SELECT
      p.id,
      p.status,
      p.type,
      p.total,
      COALESCE(p.balance_due, p.balance, 0) AS balance_due,
      p.created_at,
      supplier.name AS supplier_name,
      audit_context.branch_id,
      branch.nombre AS branch_name,
      audit_context.terminal_id,
      terminal.name AS terminal_name
    FROM purchases AS p
    LEFT JOIN suppliers AS supplier
      ON supplier.id = p.supplier_id
     AND supplier.tenant_id = p.tenant_id
    LEFT JOIN LATERAL (
      SELECT
        NULLIF(ae.datos_despues->>'branchId', '')::uuid AS branch_id,
        NULLIF(ae.datos_despues->>'terminalId', '')::uuid AS terminal_id
      FROM auditoria_eventos AS ae
      WHERE ae.tenant_id = p.tenant_id
        AND ae.entidad = 'purchases'
        AND ae.entidad_id = p.id::text
        AND ae.accion = 'PURCHASE_CREATED'
      ORDER BY ae.created_at DESC, ae.id DESC
      LIMIT 1
    ) AS audit_context ON TRUE
    LEFT JOIN tenant_branches AS branch
      ON branch.id = audit_context.branch_id
     AND branch.tenant_id = p.tenant_id
    LEFT JOIN terminals AS terminal
      ON terminal.id = audit_context.terminal_id
     AND terminal.tenant_id = p.tenant_id
    WHERE p.tenant_id = p_tenant_id
      AND (p_branch_id IS NULL OR audit_context.branch_id = p_branch_id)
      AND (p_terminal_id IS NULL OR audit_context.terminal_id = p_terminal_id)
  ),
  order_scope AS (
    SELECT
      o.id,
      o.status,
      o.type,
      o.total,
      COALESCE(o.balance_due, 0) AS balance_due,
      o.created_at,
      customer.name AS customer_name,
      audit_context.branch_id,
      branch.nombre AS branch_name,
      audit_context.terminal_id,
      terminal.name AS terminal_name,
      COALESCE(item_totals.pending_quantity, 0) AS pending_quantity
    FROM orders AS o
    LEFT JOIN customers AS customer
      ON customer.id = o.customer_id
     AND customer.tenant_id = o.tenant_id
    LEFT JOIN LATERAL (
      SELECT
        NULLIF(ae.datos_despues->>'branchId', '')::uuid AS branch_id,
        NULLIF(ae.datos_despues->>'terminalId', '')::uuid AS terminal_id
      FROM auditoria_eventos AS ae
      WHERE ae.tenant_id = o.tenant_id
        AND ae.entidad = 'orders'
        AND ae.entidad_id = o.id::text
        AND ae.accion IN ('ORDER_CREATED', 'ORDER_UPDATED')
      ORDER BY ae.created_at DESC, ae.id DESC
      LIMIT 1
    ) AS audit_context ON TRUE
    LEFT JOIN tenant_branches AS branch
      ON branch.id = audit_context.branch_id
     AND branch.tenant_id = o.tenant_id
    LEFT JOIN terminals AS terminal
      ON terminal.id = audit_context.terminal_id
     AND terminal.tenant_id = o.tenant_id
    LEFT JOIN LATERAL (
      SELECT
        SUM(GREATEST(oi.ordered_quantity - oi.delivered_quantity, 0)) AS pending_quantity
      FROM order_items AS oi
      WHERE oi.order_id = o.id
    ) AS item_totals ON TRUE
    WHERE o.tenant_id = p_tenant_id
      AND (p_branch_id IS NULL OR audit_context.branch_id = p_branch_id)
      AND (p_terminal_id IS NULL OR audit_context.terminal_id = p_terminal_id)
  ),
  sale_scope AS (
    SELECT DISTINCT
      s.id,
      s.total,
      s.created_at,
      s.branch_id,
      branch.nombre AS branch_name,
      s.terminal_id,
      terminal.name AS terminal_name
    FROM sales AS s
    LEFT JOIN tenant_branches AS branch
      ON branch.id = s.branch_id
     AND branch.tenant_id = s.tenant_id
    LEFT JOIN terminals AS terminal
      ON terminal.id = s.terminal_id
     AND terminal.tenant_id = s.tenant_id
    LEFT JOIN payments AS payment
      ON payment.tenant_id = s.tenant_id
     AND payment.reference_type = 'SALE'
     AND payment.reference_id = s.id
     AND payment.status IN ('PENDING', 'COMPLETED')
    WHERE s.tenant_id = p_tenant_id
      AND (p_branch_id IS NULL OR s.branch_id = p_branch_id)
      AND (p_terminal_id IS NULL OR s.terminal_id = p_terminal_id)
      AND (p_cash_session_id IS NULL OR payment.cash_session_id = p_cash_session_id)
  ),
  series_days AS (
    SELECT generate_series(p_start_date, p_end_date, INTERVAL '1 day')::date AS day
  ),
  movement_daily AS (
    SELECT
      movement.created_at::date AS day,
      SUM(CASE WHEN movement.type = 'IN' THEN movement.quantity ELSE 0 END) AS entries,
      SUM(CASE WHEN movement.type = 'OUT' THEN movement.quantity ELSE 0 END) AS exits
    FROM scoped_movements AS movement
    CROSS JOIN date_bounds AS bounds
    WHERE movement.created_at >= bounds.start_at
      AND movement.created_at < bounds.end_at
    GROUP BY movement.created_at::date
  ),
  sales_daily AS (
    SELECT
      sale.created_at::date AS day,
      SUM(sale.total) AS total
    FROM sale_scope AS sale
    CROSS JOIN date_bounds AS bounds
    WHERE sale.created_at >= bounds.start_at
      AND sale.created_at < bounds.end_at
    GROUP BY sale.created_at::date
  ),
  purchases_daily AS (
    SELECT
      purchase.created_at::date AS day,
      SUM(purchase.total) AS total
    FROM purchase_scope AS purchase
    CROSS JOIN date_bounds AS bounds
    WHERE purchase.created_at >= bounds.start_at
      AND purchase.created_at < bounds.end_at
    GROUP BY purchase.created_at::date
  ),
  top_products AS (
    SELECT
      product.id,
      product.name,
      product.sku,
      SUM(item.quantity) AS quantity,
      SUM(item.subtotal) AS total
    FROM sale_scope AS sale
    INNER JOIN sale_items AS item
      ON item.sale_id = sale.id
     AND item.tenant_id = p_tenant_id
    INNER JOIN products AS product
      ON product.id = item.product_id
     AND product.tenant_id = p_tenant_id
    CROSS JOIN date_bounds AS bounds
    WHERE sale.created_at >= bounds.start_at
      AND sale.created_at < bounds.end_at
    GROUP BY product.id, product.name, product.sku
    ORDER BY quantity DESC, total DESC, product.name ASC
    LIMIT 8
  ),
  recent_movements AS (
    SELECT
      movement.id,
      movement.type,
      movement.quantity,
      movement.reference_type,
      movement.reference_id,
      movement.created_at,
      product.name AS product_name,
      product.sku,
      branch.nombre AS branch_name,
      terminal.name AS terminal_name,
      movement.stock_before,
      movement.stock_after
    FROM scoped_movements AS movement
    INNER JOIN products AS product
      ON product.id = movement.product_id
     AND product.tenant_id = movement.tenant_id
    LEFT JOIN tenant_branches AS branch
      ON branch.id = movement.branch_id
     AND branch.tenant_id = movement.tenant_id
    LEFT JOIN terminals AS terminal
      ON terminal.id = movement.terminal_id
     AND terminal.tenant_id = movement.tenant_id
    CROSS JOIN date_bounds AS bounds
    WHERE movement.created_at >= bounds.start_at
      AND movement.created_at < bounds.end_at
    ORDER BY movement.created_at DESC, movement.id DESC
    LIMIT 10
  ),
  recent_purchases AS (
    SELECT
      purchase.id,
      purchase.status,
      purchase.type,
      purchase.total,
      purchase.balance_due,
      purchase.created_at,
      purchase.supplier_name,
      purchase.branch_name,
      purchase.terminal_name
    FROM purchase_scope AS purchase
    ORDER BY purchase.created_at DESC, purchase.id DESC
    LIMIT 10
  ),
  pending_orders AS (
    SELECT
      ord.id,
      ord.status,
      ord.type,
      ord.total,
      ord.balance_due,
      ord.pending_quantity,
      ord.created_at,
      ord.customer_name,
      ord.branch_name,
      ord.terminal_name
    FROM order_scope AS ord
    WHERE ord.status IN ('DRAFT', 'CONFIRMED', 'PARTIAL')
    ORDER BY ord.created_at DESC, ord.id DESC
    LIMIT 10
  ),
  critical_products AS (
    SELECT
      stock.product_id,
      stock.product_name,
      stock.sku,
      stock.branch_id,
      stock.branch_name,
      stock.stock,
      stock.outbound_in_period,
      stock.last_movement_at
    FROM stock_balance AS stock
    WHERE stock.stock <= 0
       OR (
         stock.stock > 0
         AND stock.outbound_in_period > 0
         AND stock.stock <= stock.outbound_in_period
       )
    ORDER BY
      stock.stock ASC,
      stock.outbound_in_period DESC,
      stock.product_name ASC
    LIMIT 10
  )
  SELECT jsonb_build_object(
    'summary',
    jsonb_build_object(
      'stockTotal', COALESCE((SELECT SUM(stock) FROM stock_balance), 0),
      'productsLow', COALESCE((
        SELECT COUNT(*)
        FROM stock_balance
        WHERE stock > 0
          AND outbound_in_period > 0
          AND stock <= outbound_in_period
      ), 0),
      'productsOut', COALESCE((
        SELECT COUNT(*)
        FROM stock_balance
        WHERE stock <= 0
      ), 0),
      'pendingPurchases', COALESCE((
        SELECT COUNT(*)
        FROM purchase_scope
        WHERE status IN ('DRAFT', 'PENDING', 'PARTIAL')
      ), 0),
      'pendingOrders', COALESCE((
        SELECT COUNT(*)
        FROM order_scope
        WHERE status IN ('DRAFT', 'CONFIRMED', 'PARTIAL')
      ), 0),
      'salesDay', COALESCE((
        SELECT SUM(total)
        FROM sale_scope
        WHERE created_at::date = p_end_date
      ), 0),
      'recentMovements', COALESCE((
        SELECT COUNT(*)
        FROM scoped_movements AS movement
        CROSS JOIN date_bounds AS bounds
        WHERE movement.created_at >= bounds.start_at
          AND movement.created_at < bounds.end_at
      ), 0)
    ),
    'header',
    jsonb_build_object(
      'tenant', (
        SELECT jsonb_build_object('id', tenant.id, 'name', tenant.nombre)
        FROM tenants AS tenant
        WHERE tenant.id = p_tenant_id
        LIMIT 1
      ),
      'branch', (
        SELECT jsonb_build_object('id', branch.id, 'name', branch.nombre)
        FROM tenant_branches AS branch
        WHERE branch.id = p_branch_id
          AND branch.tenant_id = p_tenant_id
        LIMIT 1
      ),
      'terminal', (
        SELECT jsonb_build_object('id', terminal.id, 'name', terminal.name, 'code', terminal.code)
        FROM terminals AS terminal
        WHERE terminal.id = p_terminal_id
          AND terminal.tenant_id = p_tenant_id
        LIMIT 1
      ),
      'cashSession', (
        SELECT jsonb_build_object(
          'id', session.id,
          'status', session.status,
          'openedAt', session.opened_at,
          'cashRegisterId', session.cash_register_id,
          'cashRegisterName', register.nombre,
          'branchId', session.branch_id
        )
        FROM cash_sessions AS session
        INNER JOIN cash_registers AS register
          ON register.id = session.cash_register_id
         AND register.tenant_id = session.tenant_id
        WHERE session.id = p_cash_session_id
          AND session.tenant_id = p_tenant_id
        LIMIT 1
      )
    ),
    'charts',
    jsonb_build_object(
      'movementSeries', COALESCE((
        SELECT jsonb_agg(
          jsonb_build_object(
            'date', day.day,
            'entries', COALESCE(movement.entries, 0),
            'exits', COALESCE(movement.exits, 0)
          )
          ORDER BY day.day
        )
        FROM series_days AS day
        LEFT JOIN movement_daily AS movement
          ON movement.day = day.day
      ), '[]'::jsonb),
      'salesSeries', COALESCE((
        SELECT jsonb_agg(
          jsonb_build_object(
            'date', day.day,
            'total', COALESCE(sales.total, 0)
          )
          ORDER BY day.day
        )
        FROM series_days AS day
        LEFT JOIN sales_daily AS sales
          ON sales.day = day.day
      ), '[]'::jsonb),
      'purchaseSeries', COALESCE((
        SELECT jsonb_agg(
          jsonb_build_object(
            'date', day.day,
            'total', COALESCE(purchase.total, 0)
          )
          ORDER BY day.day
        )
        FROM series_days AS day
        LEFT JOIN purchases_daily AS purchase
          ON purchase.day = day.day
      ), '[]'::jsonb),
      'topProducts', COALESCE((
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', top.id,
            'name', top.name,
            'sku', top.sku,
            'quantity', top.quantity,
            'total', top.total
          )
          ORDER BY top.quantity DESC, top.total DESC, top.name ASC
        )
        FROM top_products AS top
      ), '[]'::jsonb)
    ),
    'tables',
    jsonb_build_object(
      'recentMovements', COALESCE((
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', movement.id,
            'type', movement.type,
            'quantity', movement.quantity,
            'referenceType', movement.reference_type,
            'referenceId', movement.reference_id,
            'productName', movement.product_name,
            'sku', movement.sku,
            'branchName', movement.branch_name,
            'terminalName', movement.terminal_name,
            'stockBefore', movement.stock_before,
            'stockAfter', movement.stock_after,
            'createdAt', movement.created_at
          )
          ORDER BY movement.created_at DESC, movement.id DESC
        )
        FROM recent_movements AS movement
      ), '[]'::jsonb),
      'recentPurchases', COALESCE((
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', purchase.id,
            'status', purchase.status,
            'type', purchase.type,
            'total', purchase.total,
            'balanceDue', purchase.balance_due,
            'supplierName', purchase.supplier_name,
            'branchName', purchase.branch_name,
            'terminalName', purchase.terminal_name,
            'createdAt', purchase.created_at
          )
          ORDER BY purchase.created_at DESC, purchase.id DESC
        )
        FROM recent_purchases AS purchase
      ), '[]'::jsonb),
      'criticalProducts', COALESCE((
        SELECT jsonb_agg(
          jsonb_build_object(
            'productId', product.product_id,
            'productName', product.product_name,
            'sku', product.sku,
            'branchId', product.branch_id,
            'branchName', product.branch_name,
            'stock', product.stock,
            'outboundInPeriod', product.outbound_in_period,
            'lastMovementAt', product.last_movement_at
          )
          ORDER BY product.stock ASC, product.outbound_in_period DESC, product.product_name ASC
        )
        FROM critical_products AS product
      ), '[]'::jsonb),
      'pendingOrders', COALESCE((
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', ord.id,
            'status', ord.status,
            'type', ord.type,
            'total', ord.total,
            'balanceDue', ord.balance_due,
            'pendingQuantity', ord.pending_quantity,
            'customerName', ord.customer_name,
            'branchName', ord.branch_name,
            'terminalName', ord.terminal_name,
            'createdAt', ord.created_at
          )
          ORDER BY ord.created_at DESC, ord.id DESC
        )
        FROM pending_orders AS ord
      ), '[]'::jsonb)
    )
  ) INTO v_payload;

  RETURN COALESCE(v_payload, '{}'::jsonb);
END;
$function$;

CREATE OR REPLACE FUNCTION public.inventory_invoice_order(p_tenant_id uuid, p_branch_id uuid, p_terminal_id uuid, p_user_id uuid, p_pos_session_id uuid, p_order_id uuid, p_type character varying, p_payments jsonb DEFAULT '[]'::jsonb)
 RETURNS TABLE(id uuid, tenant_id uuid, customer_id uuid, order_id uuid, type character varying, status character varying, total numeric, balance numeric, created_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

    IF v_payment_method = 'CASH' AND to_regclass('public.cash_movements') IS NOT NULL THEN
      IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'cash_movements'
          AND column_name = 'payment_id'
      ) THEN
        EXECUTE $sql$
          INSERT INTO cash_movements (
            tenant_id,
            branch_id,
            cash_session_id,
            payment_id,
            movement_type,
            direction,
            reference_type,
            reference_id,
            amount,
            description,
            created_by
          )
          VALUES ($1, $2, $3, $4, 'PAYMENT', 'IN', 'SALE', $5, $6, $7, $8)
        $sql$
        USING
          p_tenant_id,
          p_branch_id,
          v_payment.cash_session_id,
          v_payment_id,
          v_sale_id,
          ROUND(v_payment.amount::numeric, 2),
          COALESCE(NULLIF(BTRIM(v_payment.notes), ''), 'Pago sale'),
          p_user_id;
      ELSE
        EXECUTE $sql$
          INSERT INTO cash_movements (
            tenant_id,
            branch_id,
            cash_session_id,
            movement_type,
            direction,
            reference_type,
            reference_id,
            amount,
            description,
            created_by
          )
          VALUES ($1, $2, $3, 'PAYMENT', 'IN', 'SALE', $4, $5, $6, $7)
        $sql$
        USING
          p_tenant_id,
          p_branch_id,
          v_payment.cash_session_id,
          v_sale_id,
          ROUND(v_payment.amount::numeric, 2),
          COALESCE(NULLIF(BTRIM(v_payment.notes), ''), 'Pago sale'),
          p_user_id;
      END IF;
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
$function$;

CREATE OR REPLACE FUNCTION public.report_cash_audit(p_actor_user_id uuid, p_actor_role text, p_actor_tenant_id uuid, p_actor_branch_id uuid, p_tenant_id uuid DEFAULT NULL::uuid, p_branch_id uuid DEFAULT NULL::uuid, p_date_from timestamp with time zone DEFAULT NULL::timestamp with time zone, p_date_to timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_scope JSONB;
  v_effective_tenant_id UUID;
  v_effective_branch_id UUID;
  v_restrict_to_user BOOLEAN;
  v_payload JSONB;
BEGIN
  v_scope := public.report_resolve_pos_scope(
    p_actor_role,
    p_actor_tenant_id,
    p_actor_branch_id,
    p_tenant_id,
    p_branch_id
  );

  v_effective_tenant_id := NULLIF(v_scope->>'tenantId', '')::UUID;
  v_effective_branch_id := NULLIF(v_scope->>'branchId', '')::UUID;
  v_restrict_to_user := COALESCE((v_scope->>'restrictToUser')::BOOLEAN, FALSE);

  WITH count_scope AS (
    SELECT
      count_data.id AS cash_count_id,
      count_data.tenant_id,
      count_data.branch_id,
      count_data.cash_session_id,
      count_data.counted_by_user_id,
      count_data.counted_at,
      count_data.counted_cash_amount::NUMERIC(14, 2) AS counted_amount,
      count_data.expected_amount::NUMERIC(14, 2) AS expected_amount,
      count_data.difference_amount::NUMERIC(14, 2) AS difference_amount,
      count_data.notes,
      session.status AS session_status,
      session.opened_at,
      session.closed_at,
      session.opened_by_user_id,
      branch.nombre AS branch_name,
      register.nombre AS cash_register_name,
      terminal.name AS terminal_name,
      counter_user.email AS counted_by_email
    FROM cash_counts AS count_data
    INNER JOIN cash_sessions AS session
      ON session.id = count_data.cash_session_id
     AND session.tenant_id = count_data.tenant_id
    LEFT JOIN tenant_branches AS branch
      ON branch.id = count_data.branch_id
     AND branch.tenant_id = count_data.tenant_id
    LEFT JOIN cash_registers AS register
      ON register.id = session.cash_register_id
     AND register.tenant_id = session.tenant_id
    LEFT JOIN terminals AS terminal
      ON terminal.id = register.terminal_id
     AND terminal.tenant_id = register.tenant_id
    LEFT JOIN users AS counter_user
      ON counter_user.id = count_data.counted_by_user_id
     AND counter_user.tenant_id = count_data.tenant_id
    WHERE count_data.tenant_id = v_effective_tenant_id
      AND (v_effective_branch_id IS NULL OR count_data.branch_id = v_effective_branch_id)
      AND (p_date_from IS NULL OR count_data.counted_at >= p_date_from)
      AND (p_date_to IS NULL OR count_data.counted_at < p_date_to)
      AND (
        NOT v_restrict_to_user
        OR count_data.counted_by_user_id = p_actor_user_id
        OR session.opened_by_user_id = p_actor_user_id
      )
  )
  SELECT jsonb_build_object(
    'filters', jsonb_build_object(
      'tenantId', v_effective_tenant_id,
      'branchId', v_effective_branch_id,
      'dateFrom', p_date_from,
      'dateTo', p_date_to,
      'actorRole', UPPER(COALESCE(NULLIF(BTRIM(p_actor_role), ''), 'USER'))
    ),
    'summary', jsonb_build_object(
      'count', COUNT(*)::INTEGER,
      'countedAmount', COALESCE(SUM(item.counted_amount), 0),
      'expectedAmount', COALESCE(SUM(item.expected_amount), 0),
      'difference', COALESCE(SUM(item.difference_amount), 0)
    ),
    'rows', COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'cashCountId', item.cash_count_id,
          'cashSessionId', item.cash_session_id,
          'branchId', item.branch_id,
          'branchName', item.branch_name,
          'cashRegister', item.cash_register_name,
          'terminal', item.terminal_name,
          'countedAt', item.counted_at,
          'countedAmount', item.counted_amount,
          'expectedAmount', item.expected_amount,
          'difference', item.difference_amount,
          'countedByUserId', item.counted_by_user_id,
          'countedBy', item.counted_by_email,
          'notes', item.notes,
          'sessionStatus', item.session_status,
          'openedAt', item.opened_at,
          'closedAt', item.closed_at
        )
        ORDER BY item.counted_at DESC, item.cash_count_id DESC
      ),
      '[]'::JSONB
    )
  )
  INTO v_payload
  FROM count_scope AS item;

  RETURN COALESCE(
    v_payload,
    jsonb_build_object(
      'filters', jsonb_build_object(
        'tenantId', v_effective_tenant_id,
        'branchId', v_effective_branch_id,
        'dateFrom', p_date_from,
        'dateTo', p_date_to,
        'actorRole', UPPER(COALESCE(NULLIF(BTRIM(p_actor_role), ''), 'USER'))
      ),
      'summary', jsonb_build_object(
        'count', 0,
        'countedAmount', 0,
        'expectedAmount', 0,
        'difference', 0
      ),
      'rows', '[]'::JSONB
    )
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.report_cash_audit_ticket(p_actor_user_id uuid, p_actor_role text, p_actor_tenant_id uuid, p_actor_branch_id uuid, p_cash_count_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_scope JSONB;
  v_effective_tenant_id UUID;
  v_effective_branch_id UUID;
  v_restrict_to_user BOOLEAN;
  v_role TEXT := UPPER(COALESCE(NULLIF(BTRIM(p_actor_role), ''), 'USER'));
  v_payload JSONB;
BEGIN
  IF v_role = 'SUPER_ADMIN' THEN
    SELECT count_data.tenant_id, count_data.branch_id
    INTO v_effective_tenant_id, v_effective_branch_id
    FROM cash_counts AS count_data
    WHERE count_data.id = p_cash_count_id
    LIMIT 1;

    v_restrict_to_user := FALSE;
  ELSIF v_role = 'SUPER_USER' THEN
    SELECT count_data.tenant_id, count_data.branch_id
    INTO v_effective_tenant_id, v_effective_branch_id
    FROM cash_counts AS count_data
    WHERE count_data.id = p_cash_count_id
      AND count_data.tenant_id = p_actor_tenant_id
    LIMIT 1;

    v_restrict_to_user := FALSE;
  ELSE
    v_scope := public.report_resolve_pos_scope(
      p_actor_role,
      p_actor_tenant_id,
      p_actor_branch_id,
      p_actor_tenant_id,
      p_actor_branch_id
    );

    v_effective_tenant_id := NULLIF(v_scope->>'tenantId', '')::UUID;
    v_effective_branch_id := NULLIF(v_scope->>'branchId', '')::UUID;
    v_restrict_to_user := COALESCE((v_scope->>'restrictToUser')::BOOLEAN, FALSE);
  END IF;

  IF v_effective_tenant_id IS NULL THEN
    RETURN NULL;
  END IF;

  WITH count_scope AS (
    SELECT
      count_data.id AS cash_count_id,
      count_data.tenant_id,
      count_data.branch_id,
      count_data.cash_session_id,
      count_data.counted_by_user_id,
      count_data.counted_at,
      count_data.counted_cash_amount::NUMERIC(14, 2) AS counted_amount,
      count_data.expected_amount::NUMERIC(14, 2) AS expected_amount,
      count_data.difference_amount::NUMERIC(14, 2) AS difference_amount,
      count_data.notes,
      tenant.nombre AS tenant_name,
      branch.nombre AS branch_name,
      register.id AS cash_register_id,
      register.codigo AS cash_register_code,
      register.nombre AS cash_register_name,
      terminal.id AS terminal_id,
      terminal.name AS terminal_name,
      session.status AS session_status,
      session.opened_at,
      session.closed_at,
      session.opened_by_user_id,
      opened_user.email AS opened_by_email,
      session.closed_by_user_id,
      closed_user.email AS closed_by_email,
      counter_user.email AS counted_by_email,
      public.finance_cash_session_summary(count_data.tenant_id, count_data.cash_session_id) AS summary
    FROM cash_counts AS count_data
    INNER JOIN cash_sessions AS session
      ON session.id = count_data.cash_session_id
     AND session.tenant_id = count_data.tenant_id
    INNER JOIN tenants AS tenant
      ON tenant.id = count_data.tenant_id
    LEFT JOIN tenant_branches AS branch
      ON branch.id = count_data.branch_id
     AND branch.tenant_id = count_data.tenant_id
    LEFT JOIN cash_registers AS register
      ON register.id = session.cash_register_id
     AND register.tenant_id = session.tenant_id
    LEFT JOIN terminals AS terminal
      ON terminal.id = register.terminal_id
     AND terminal.tenant_id = register.tenant_id
    LEFT JOIN users AS opened_user
      ON opened_user.id = session.opened_by_user_id
     AND opened_user.tenant_id = session.tenant_id
    LEFT JOIN users AS closed_user
      ON closed_user.id = session.closed_by_user_id
     AND closed_user.tenant_id = session.tenant_id
    LEFT JOIN users AS counter_user
      ON counter_user.id = count_data.counted_by_user_id
     AND counter_user.tenant_id = count_data.tenant_id
    WHERE count_data.id = p_cash_count_id
      AND count_data.tenant_id = v_effective_tenant_id
      AND (v_effective_branch_id IS NULL OR count_data.branch_id = v_effective_branch_id)
      AND (
        NOT v_restrict_to_user
        OR count_data.counted_by_user_id = p_actor_user_id
        OR session.opened_by_user_id = p_actor_user_id
      )
    LIMIT 1
  ),
  payment_metrics AS (
    SELECT
      COALESCE(SUM(CASE WHEN payment.direction = 'IN' AND payment.reference_type = 'SALE' THEN payment.amount ELSE 0 END), 0)::NUMERIC(14, 2) AS pos_sales_payments,
      COALESCE(SUM(CASE WHEN payment.direction = 'IN' AND payment.reference_type = 'SALES_ORDER' THEN payment.amount ELSE 0 END), 0)::NUMERIC(14, 2) AS order_sales_payments,
      COALESCE(SUM(CASE WHEN payment.direction = 'OUT' AND payment.reference_type = 'REFUND' THEN payment.amount ELSE 0 END), 0)::NUMERIC(14, 2) AS refund_payments
    FROM payments AS payment
    INNER JOIN count_scope AS count_data
      ON count_data.cash_session_id = payment.cash_session_id
     AND count_data.tenant_id = payment.tenant_id
    WHERE payment.status IN ('PENDING', 'COMPLETED')
  )
  SELECT jsonb_build_object(
    'header', jsonb_build_object(
      'cashCountId', count_data.cash_count_id,
      'cashSessionId', count_data.cash_session_id,
      'tenantName', count_data.tenant_name,
      'branchId', count_data.branch_id,
      'branchName', count_data.branch_name,
      'cashRegisterId', count_data.cash_register_id,
      'cashRegister', count_data.cash_register_name,
      'cashRegisterCode', count_data.cash_register_code,
      'terminalId', count_data.terminal_id,
      'terminal', count_data.terminal_name,
      'sessionStatus', count_data.session_status,
      'openedAt', count_data.opened_at,
      'closedAt', count_data.closed_at,
      'openedByUserId', count_data.opened_by_user_id,
      'openedBy', count_data.opened_by_email,
      'closedByUserId', count_data.closed_by_user_id,
      'closedBy', count_data.closed_by_email,
      'countedAt', count_data.counted_at,
      'countedByUserId', count_data.counted_by_user_id,
      'countedBy', count_data.counted_by_email
    ),
    'audit', jsonb_build_object(
      'countedAmount', count_data.counted_amount,
      'expectedAmount', count_data.expected_amount,
      'difference', count_data.difference_amount,
      'notes', count_data.notes
    ),
    'sessionTotals', jsonb_build_object(
      'openingAmount', COALESCE((count_data.summary->'totals'->>'openingAmount')::NUMERIC, 0),
      'posSalesPayments', metrics.pos_sales_payments,
      'orderSalesPayments', metrics.order_sales_payments,
      'refundPayments', metrics.refund_payments,
      'expectedAmount', COALESCE((count_data.summary->'totals'->>'expectedAmount')::NUMERIC, 0)
    )
  )
  INTO v_payload
  FROM count_scope AS count_data
  CROSS JOIN payment_metrics AS metrics;

  RETURN v_payload;
END;
$function$;

CREATE OR REPLACE FUNCTION public.report_cash_closing_ticket(p_actor_user_id uuid, p_actor_role text, p_actor_tenant_id uuid, p_actor_branch_id uuid, p_cash_session_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_scope JSONB;
  v_effective_tenant_id UUID;
  v_effective_branch_id UUID;
  v_restrict_to_user BOOLEAN;
  v_role TEXT := UPPER(COALESCE(NULLIF(BTRIM(p_actor_role), ''), 'USER'));
  v_payload JSONB;
BEGIN
  IF v_role = 'SUPER_ADMIN' THEN
    SELECT session.tenant_id, session.branch_id
    INTO v_effective_tenant_id, v_effective_branch_id
    FROM cash_sessions AS session
    WHERE session.id = p_cash_session_id
    LIMIT 1;

    v_restrict_to_user := FALSE;
  ELSIF v_role = 'SUPER_USER' THEN
    SELECT session.tenant_id, session.branch_id
    INTO v_effective_tenant_id, v_effective_branch_id
    FROM cash_sessions AS session
    WHERE session.id = p_cash_session_id
      AND session.tenant_id = p_actor_tenant_id
    LIMIT 1;

    v_restrict_to_user := FALSE;
  ELSE
    v_scope := public.report_resolve_pos_scope(
      p_actor_role,
      p_actor_tenant_id,
      p_actor_branch_id,
      p_actor_tenant_id,
      p_actor_branch_id
    );

    v_effective_tenant_id := NULLIF(v_scope->>'tenantId', '')::UUID;
    v_effective_branch_id := NULLIF(v_scope->>'branchId', '')::UUID;
    v_restrict_to_user := COALESCE((v_scope->>'restrictToUser')::BOOLEAN, FALSE);
  END IF;

  IF v_effective_tenant_id IS NULL THEN
    RETURN NULL;
  END IF;

  WITH session_scope AS (
    SELECT
      session.id,
      session.tenant_id,
      session.branch_id,
      session.cash_register_id,
      session.opened_by_user_id,
      session.closed_by_user_id,
      session.opened_at,
      session.closed_at,
      session.opening_amount::NUMERIC(14, 2) AS opening_amount,
      session.closing_amount::NUMERIC(14, 2) AS closing_amount,
      session.expected_amount::NUMERIC(14, 2) AS expected_amount_recorded,
      session.difference_amount::NUMERIC(14, 2) AS difference_amount_recorded,
      session.status,
      tenant.nombre AS tenant_name,
      branch.nombre AS branch_name,
      register.codigo AS cash_register_code,
      register.nombre AS cash_register_name,
      register.terminal_id,
      terminal.name AS terminal_name,
      opened_user.email AS opened_by_email,
      closed_user.email AS closed_by_email,
      public.finance_cash_session_summary(session.tenant_id, session.id) AS summary
    FROM cash_sessions AS session
    INNER JOIN tenants AS tenant
      ON tenant.id = session.tenant_id
    LEFT JOIN tenant_branches AS branch
      ON branch.id = session.branch_id
     AND branch.tenant_id = session.tenant_id
    LEFT JOIN cash_registers AS register
      ON register.id = session.cash_register_id
     AND register.tenant_id = session.tenant_id
    LEFT JOIN terminals AS terminal
      ON terminal.id = register.terminal_id
     AND terminal.tenant_id = register.tenant_id
    LEFT JOIN users AS opened_user
      ON opened_user.id = session.opened_by_user_id
     AND opened_user.tenant_id = session.tenant_id
    LEFT JOIN users AS closed_user
      ON closed_user.id = session.closed_by_user_id
     AND closed_user.tenant_id = session.tenant_id
    WHERE session.id = p_cash_session_id
      AND session.tenant_id = v_effective_tenant_id
      AND (v_effective_branch_id IS NULL OR session.branch_id = v_effective_branch_id)
      AND (
        NOT v_restrict_to_user
        OR session.opened_by_user_id = p_actor_user_id
        OR session.closed_by_user_id = p_actor_user_id
      )
    LIMIT 1
  ),
  payment_metrics AS (
    SELECT
      COALESCE(SUM(CASE WHEN payment.direction = 'IN' AND payment.reference_type = 'SALE' THEN payment.amount ELSE 0 END), 0)::NUMERIC(14, 2) AS pos_sales_payments,
      COALESCE(SUM(CASE WHEN payment.direction = 'IN' AND payment.reference_type = 'SALES_ORDER' THEN payment.amount ELSE 0 END), 0)::NUMERIC(14, 2) AS order_sales_payments,
      COALESCE(SUM(CASE WHEN payment.direction = 'OUT' AND payment.reference_type = 'REFUND' THEN payment.amount ELSE 0 END), 0)::NUMERIC(14, 2) AS refund_payments,
      COALESCE(SUM(CASE WHEN payment.direction = 'OUT' AND payment.reference_type IN ('PURCHASE', 'PURCHASE_ORDER') THEN payment.amount ELSE 0 END), 0)::NUMERIC(14, 2) AS purchase_payments,
      COALESCE(SUM(CASE WHEN payment.direction = 'IN' THEN payment.amount ELSE 0 END), 0)::NUMERIC(14, 2) AS payments_in,
      COALESCE(SUM(CASE WHEN payment.direction = 'OUT' THEN payment.amount ELSE 0 END), 0)::NUMERIC(14, 2) AS payments_out
    FROM payments AS payment
    INNER JOIN session_scope AS session
      ON session.id = payment.cash_session_id
     AND session.tenant_id = payment.tenant_id
    WHERE payment.status IN ('PENDING', 'COMPLETED')
  ),
  summary_payload AS (
    SELECT
      session.id AS cash_session_id,
      session.tenant_id,
      session.branch_id,
      session.tenant_name,
      session.branch_name,
      session.cash_register_id,
      session.cash_register_name,
      session.cash_register_code,
      session.terminal_id,
      session.terminal_name,
      session.opened_by_user_id,
      session.opened_by_email,
      session.closed_by_user_id,
      session.closed_by_email,
      session.opened_at,
      session.closed_at,
      session.status,
      COALESCE((session.summary->'totals'->>'openingAmount')::NUMERIC, session.opening_amount, 0)::NUMERIC(14, 2) AS opening_amount,
      metrics.pos_sales_payments,
      metrics.order_sales_payments,
      metrics.payments_in,
      metrics.payments_out,
      metrics.refund_payments,
      metrics.purchase_payments,
      COALESCE((session.summary->'totals'->>'expenses')::NUMERIC, 0)::NUMERIC(14, 2) AS expenses,
      COALESCE((session.summary->'totals'->>'withdrawals')::NUMERIC, 0)::NUMERIC(14, 2) AS withdrawals,
      COALESCE((session.summary->'totals'->>'adjustmentsIn')::NUMERIC, 0)::NUMERIC(14, 2) AS adjustments_in,
      COALESCE((session.summary->'totals'->>'adjustmentsOut')::NUMERIC, 0)::NUMERIC(14, 2) AS adjustments_out,
      COALESCE((session.summary->'totals'->>'closingRecorded')::NUMERIC, 0)::NUMERIC(14, 2) AS closing_recorded,
      COALESCE((session.summary->'totals'->>'expectedAmount')::NUMERIC, session.expected_amount_recorded, 0)::NUMERIC(14, 2) AS expected_amount,
      COALESCE(session.closing_amount, (session.summary->'lastCount'->>'countedCashAmount')::NUMERIC, 0)::NUMERIC(14, 2) AS closing_amount,
      COALESCE(
        session.difference_amount_recorded,
        (session.summary->'lastCount'->>'differenceAmount')::NUMERIC,
        COALESCE(session.closing_amount, (session.summary->'lastCount'->>'countedCashAmount')::NUMERIC, 0)
        - COALESCE((session.summary->'totals'->>'expectedAmount')::NUMERIC, session.expected_amount_recorded, 0)
      )::NUMERIC(14, 2) AS difference_amount,
      COALESCE(session.summary->'paymentBreakdown', '[]'::JSONB) AS payment_breakdown,
      COALESCE(session.summary->'movementBreakdown', '[]'::JSONB) AS movement_breakdown,
      COALESCE(session.summary->'recentMovements', '[]'::JSONB) AS recent_movements,
      session.summary->'lastCount' AS last_count
    FROM session_scope AS session
    CROSS JOIN payment_metrics AS metrics
  )
  SELECT jsonb_build_object(
    'header', jsonb_build_object(
      'cashSessionId', session.cash_session_id,
      'tenantName', session.tenant_name,
      'branchId', session.branch_id,
      'branchName', session.branch_name,
      'cashRegisterId', session.cash_register_id,
      'cashRegister', session.cash_register_name,
      'cashRegisterCode', session.cash_register_code,
      'terminalId', session.terminal_id,
      'terminal', session.terminal_name,
      'openedByUserId', session.opened_by_user_id,
      'openedBy', session.opened_by_email,
      'closedByUserId', session.closed_by_user_id,
      'closedBy', session.closed_by_email,
      'openedAt', session.opened_at,
      'closedAt', session.closed_at,
      'status', session.status
    ),
    'totals', jsonb_build_object(
      'openingAmount', session.opening_amount,
      'posSalesPayments', session.pos_sales_payments,
      'orderSalesPayments', session.order_sales_payments,
      'totalIn', session.pos_sales_payments + session.order_sales_payments,
      'paymentsIn', session.payments_in,
      'paymentsOut', session.payments_out,
      'refundPayments', session.refund_payments,
      'purchasePayments', session.purchase_payments,
      'expenses', session.expenses,
      'withdrawals', session.withdrawals,
      'adjustmentsIn', session.adjustments_in,
      'adjustmentsOut', session.adjustments_out,
      'closingRecorded', session.closing_recorded,
      'totalOut', session.refund_payments + session.purchase_payments + session.expenses + session.withdrawals + session.adjustments_out,
      'expectedAmount', session.expected_amount,
      'closingAmount', session.closing_amount,
      'difference', session.difference_amount
    ),
    'paymentBreakdown', session.payment_breakdown,
    'movementBreakdown', session.movement_breakdown,
    'recentMovements', session.recent_movements,
    'lastCount', session.last_count
  )
  INTO v_payload
  FROM summary_payload AS session;

  RETURN v_payload;
END;
$function$;

CREATE OR REPLACE FUNCTION public.report_cash_closings(p_actor_user_id uuid, p_actor_role text, p_actor_tenant_id uuid, p_actor_branch_id uuid, p_tenant_id uuid DEFAULT NULL::uuid, p_branch_id uuid DEFAULT NULL::uuid, p_date_from timestamp with time zone DEFAULT NULL::timestamp with time zone, p_date_to timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_scope JSONB;
  v_effective_tenant_id UUID;
  v_effective_branch_id UUID;
  v_restrict_to_user BOOLEAN;
  v_payload JSONB;
BEGIN
  v_scope := public.report_resolve_pos_scope(
    p_actor_role,
    p_actor_tenant_id,
    p_actor_branch_id,
    p_tenant_id,
    p_branch_id
  );

  v_effective_tenant_id := NULLIF(v_scope->>'tenantId', '')::UUID;
  v_effective_branch_id := NULLIF(v_scope->>'branchId', '')::UUID;
  v_restrict_to_user := COALESCE((v_scope->>'restrictToUser')::BOOLEAN, FALSE);

  WITH session_scope AS (
    SELECT
      session.id,
      session.tenant_id,
      session.branch_id,
      session.cash_register_id,
      session.opened_by_user_id,
      session.closed_by_user_id,
      session.opened_at,
      session.closed_at,
      session.opening_amount::NUMERIC(14, 2) AS opening_amount,
      session.closing_amount::NUMERIC(14, 2) AS closing_amount,
      session.expected_amount::NUMERIC(14, 2) AS expected_amount_recorded,
      session.difference_amount::NUMERIC(14, 2) AS difference_amount_recorded,
      session.status,
      tenant.nombre AS tenant_name,
      branch.nombre AS branch_name,
      register.codigo AS cash_register_code,
      register.nombre AS cash_register_name,
      terminal.name AS terminal_name,
      opened_user.email AS opened_by_email,
      closed_user.email AS closed_by_email,
      public.finance_cash_session_summary(session.tenant_id, session.id) AS summary
    FROM cash_sessions AS session
    INNER JOIN tenants AS tenant
      ON tenant.id = session.tenant_id
    LEFT JOIN tenant_branches AS branch
      ON branch.id = session.branch_id
     AND branch.tenant_id = session.tenant_id
    LEFT JOIN cash_registers AS register
      ON register.id = session.cash_register_id
     AND register.tenant_id = session.tenant_id
    LEFT JOIN terminals AS terminal
      ON terminal.id = register.terminal_id
     AND terminal.tenant_id = register.tenant_id
    LEFT JOIN users AS opened_user
      ON opened_user.id = session.opened_by_user_id
     AND opened_user.tenant_id = session.tenant_id
    LEFT JOIN users AS closed_user
      ON closed_user.id = session.closed_by_user_id
     AND closed_user.tenant_id = session.tenant_id
    WHERE session.tenant_id = v_effective_tenant_id
      AND (v_effective_branch_id IS NULL OR session.branch_id = v_effective_branch_id)
      AND (p_date_from IS NULL OR COALESCE(session.closed_at, session.opened_at) >= p_date_from)
      AND (p_date_to IS NULL OR COALESCE(session.closed_at, session.opened_at) < p_date_to)
      AND (
        NOT v_restrict_to_user
        OR session.opened_by_user_id = p_actor_user_id
        OR session.closed_by_user_id = p_actor_user_id
      )
  ),
  summary_rows AS (
    SELECT
      session.id AS cash_session_id,
      session.opened_at,
      session.closed_at,
      session.status,
      session.tenant_name,
      session.branch_name,
      session.branch_id,
      session.cash_register_name,
      session.cash_register_code,
      session.terminal_name,
      session.opened_by_email,
      session.closed_by_email,
      COALESCE((session.summary->'totals'->>'openingAmount')::NUMERIC, session.opening_amount, 0)::NUMERIC(14, 2) AS opening_amount,
      COALESCE((session.summary->'totals'->>'salesPayments')::NUMERIC, 0)::NUMERIC(14, 2) AS pos_sales_payments,
      COALESCE((
        SELECT SUM(payment.amount)
        FROM payments AS payment
        WHERE payment.tenant_id = session.tenant_id
          AND payment.cash_session_id = session.id
          AND payment.status IN ('PENDING', 'COMPLETED')
          AND payment.direction = 'IN'
          AND payment.reference_type = 'SALES_ORDER'
      ), 0)::NUMERIC(14, 2) AS order_sales_payments,
      COALESCE((session.summary->'totals'->>'refundPayments')::NUMERIC, 0)::NUMERIC(14, 2) AS refund_payments,
      COALESCE((session.summary->'totals'->>'purchasePayments')::NUMERIC, 0)::NUMERIC(14, 2) AS purchase_payments,
      COALESCE((session.summary->'totals'->>'expenses')::NUMERIC, 0)::NUMERIC(14, 2) AS expenses,
      COALESCE((session.summary->'totals'->>'withdrawals')::NUMERIC, 0)::NUMERIC(14, 2) AS withdrawals,
      COALESCE((session.summary->'totals'->>'adjustmentsIn')::NUMERIC, 0)::NUMERIC(14, 2) AS adjustments_in,
      COALESCE((session.summary->'totals'->>'adjustmentsOut')::NUMERIC, 0)::NUMERIC(14, 2) AS adjustments_out,
      COALESCE((session.summary->'totals'->>'expectedAmount')::NUMERIC, session.expected_amount_recorded, 0)::NUMERIC(14, 2) AS expected_amount,
      COALESCE(session.closing_amount, (session.summary->'lastCount'->>'countedCashAmount')::NUMERIC, 0)::NUMERIC(14, 2) AS closing_amount,
      COALESCE(
        session.difference_amount_recorded,
        (session.summary->'lastCount'->>'differenceAmount')::NUMERIC,
        COALESCE(session.closing_amount, (session.summary->'lastCount'->>'countedCashAmount')::NUMERIC, 0)
        - COALESCE((session.summary->'totals'->>'expectedAmount')::NUMERIC, session.expected_amount_recorded, 0)
      )::NUMERIC(14, 2) AS difference_amount
    FROM session_scope AS session
  )
  SELECT jsonb_build_object(
    'filters', jsonb_build_object(
      'tenantId', v_effective_tenant_id,
      'branchId', v_effective_branch_id,
      'dateFrom', p_date_from,
      'dateTo', p_date_to,
      'actorRole', UPPER(COALESCE(NULLIF(BTRIM(p_actor_role), ''), 'USER'))
    ),
    'summary', jsonb_build_object(
      'count', COUNT(*)::INTEGER,
      'openingAmount', COALESCE(SUM(row.opening_amount), 0),
      'totalIn', COALESCE(SUM(row.pos_sales_payments + row.order_sales_payments), 0),
      'totalOut', COALESCE(SUM(row.refund_payments + row.purchase_payments + row.expenses + row.withdrawals + row.adjustments_out), 0),
      'expectedAmount', COALESCE(SUM(row.expected_amount), 0),
      'closingAmount', COALESCE(SUM(row.closing_amount), 0),
      'difference', COALESCE(SUM(row.difference_amount), 0)
    ),
    'rows', COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'cashSessionId', row.cash_session_id,
          'openedAt', row.opened_at,
          'closedAt', row.closed_at,
          'status', row.status,
          'tenantName', row.tenant_name,
          'branchId', row.branch_id,
          'branchName', row.branch_name,
          'cashRegister', row.cash_register_name,
          'cashRegisterCode', row.cash_register_code,
          'terminal', row.terminal_name,
          'openedBy', row.opened_by_email,
          'closedBy', row.closed_by_email,
          'openingAmount', row.opening_amount,
          'totalIn', row.pos_sales_payments + row.order_sales_payments,
          'totalOut', row.refund_payments + row.purchase_payments + row.expenses + row.withdrawals + row.adjustments_out,
          'expectedAmount', row.expected_amount,
          'closingAmount', row.closing_amount,
          'difference', row.difference_amount
        )
        ORDER BY row.opened_at DESC, row.cash_session_id DESC
      ),
      '[]'::JSONB
    )
  )
  INTO v_payload
  FROM summary_rows AS row;

  RETURN COALESCE(
    v_payload,
    jsonb_build_object(
      'filters', jsonb_build_object(
        'tenantId', v_effective_tenant_id,
        'branchId', v_effective_branch_id,
        'dateFrom', p_date_from,
        'dateTo', p_date_to,
        'actorRole', UPPER(COALESCE(NULLIF(BTRIM(p_actor_role), ''), 'USER'))
      ),
      'summary', jsonb_build_object(
        'count', 0,
        'openingAmount', 0,
        'totalIn', 0,
        'totalOut', 0,
        'expectedAmount', 0,
        'closingAmount', 0,
        'difference', 0
      ),
      'rows', '[]'::JSONB
    )
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.report_customer_orders_status(p_actor_user_id uuid, p_actor_role text, p_actor_tenant_id uuid, p_actor_branch_id uuid, p_tenant_id uuid DEFAULT NULL::uuid, p_branch_id uuid DEFAULT NULL::uuid, p_date_from timestamp with time zone DEFAULT NULL::timestamp with time zone, p_date_to timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_scope JSONB;
  v_effective_tenant_id UUID;
  v_effective_branch_id UUID;
  v_restrict_to_user BOOLEAN;
  v_payload JSONB;
BEGIN
  v_scope := public.report_resolve_pos_scope(
    p_actor_role,
    p_actor_tenant_id,
    p_actor_branch_id,
    p_tenant_id,
    p_branch_id
  );

  v_effective_tenant_id := NULLIF(v_scope->>'tenantId', '')::UUID;
  v_effective_branch_id := NULLIF(v_scope->>'branchId', '')::UUID;
  v_restrict_to_user := COALESCE((v_scope->>'restrictToUser')::BOOLEAN, FALSE);

  IF p_date_from IS NOT NULL
     AND p_date_to IS NOT NULL
     AND p_date_to < p_date_from THEN
    RAISE EXCEPTION 'date_to must be greater than or equal to date_from';
  END IF;

  WITH scoped_orders AS (
    SELECT
      o.id AS order_id,
      o.customer_id,
      customer.name AS customer_name,
      o.status,
      COALESCE(o.payment_status, 'PENDING') AS payment_status,
      o.total::NUMERIC(14, 2) AS total,
      COALESCE(o.total_paid, 0)::NUMERIC(14, 2) AS paid,
      COALESCE(o.balance_due, GREATEST(o.total - COALESCE(o.total_paid, 0), 0))::NUMERIC(14, 2) AS balance,
      COALESCE(sale_context.branch_id, payment_context.branch_id) AS branch_id
    FROM orders AS o
    INNER JOIN customers AS customer
      ON customer.id = o.customer_id
     AND customer.tenant_id = o.tenant_id
    LEFT JOIN LATERAL (
      SELECT
        s.branch_id,
        s.user_id
      FROM sales AS s
      WHERE s.tenant_id = o.tenant_id
        AND s.order_id = o.id
      ORDER BY s.created_at ASC, s.id ASC
      LIMIT 1
    ) AS sale_context ON TRUE
    LEFT JOIN LATERAL (
      SELECT
        payment_scope.branch_id,
        payment_scope.created_by
      FROM (
        SELECT
          pay.branch_id,
          pay.created_by,
          pay.created_at,
          pay.id
        FROM payments AS pay
        WHERE pay.tenant_id = o.tenant_id
          AND pay.reference_type = 'SALES_ORDER'
          AND pay.reference_id = o.id

        UNION ALL

        SELECT
          pay.branch_id,
          pay.created_by,
          pay.created_at,
          pay.id
        FROM payment_allocations AS allocation
        INNER JOIN payments AS pay
          ON pay.id = allocation.payment_id
        WHERE pay.tenant_id = o.tenant_id
          AND allocation.reference_type = 'SALES_ORDER'
          AND allocation.reference_id = o.id
      ) AS payment_scope
      ORDER BY payment_scope.created_at ASC, payment_scope.id ASC
      LIMIT 1
    ) AS payment_context ON TRUE
    WHERE o.tenant_id = v_effective_tenant_id
      AND (p_date_from IS NULL OR o.created_at >= p_date_from)
      AND (p_date_to IS NULL OR o.created_at < p_date_to)
      AND (
        v_effective_branch_id IS NULL
        OR COALESCE(sale_context.branch_id, payment_context.branch_id) = v_effective_branch_id
      )
      AND (
        NOT v_restrict_to_user
        OR EXISTS (
          SELECT 1
          FROM sales AS sales_scope
          WHERE sales_scope.tenant_id = o.tenant_id
            AND sales_scope.order_id = o.id
            AND sales_scope.user_id = p_actor_user_id
        )
        OR EXISTS (
          SELECT 1
          FROM payments AS pay_scope
          WHERE pay_scope.tenant_id = o.tenant_id
            AND pay_scope.reference_type = 'SALES_ORDER'
            AND pay_scope.reference_id = o.id
            AND pay_scope.created_by = p_actor_user_id
        )
        OR EXISTS (
          SELECT 1
          FROM payment_allocations AS allocation_scope
          INNER JOIN payments AS pay_scope
            ON pay_scope.id = allocation_scope.payment_id
          WHERE pay_scope.tenant_id = o.tenant_id
            AND allocation_scope.reference_type = 'SALES_ORDER'
            AND allocation_scope.reference_id = o.id
            AND pay_scope.created_by = p_actor_user_id
        )
      )
  ),
  normalized_orders AS (
    SELECT
      order_id,
      customer_id,
      customer_name,
      total,
      balance,
      CASE
        WHEN status = 'COMPLETED' AND balance <= 0 THEN 'COMPLETED'
        WHEN status = 'PARTIAL' OR (paid > 0 AND balance > 0) THEN 'PARTIAL'
        ELSE 'PENDING'
      END AS order_state
    FROM scoped_orders
  ),
  customer_rows AS (
    SELECT
      customer_id,
      customer_name,
      COUNT(*)::INTEGER AS total_orders,
      COUNT(*) FILTER (WHERE order_state = 'PENDING')::INTEGER AS pending_orders,
      COUNT(*) FILTER (WHERE order_state = 'PARTIAL')::INTEGER AS partial_orders,
      COUNT(*) FILTER (WHERE order_state = 'COMPLETED')::INTEGER AS completed_orders,
      COALESCE(SUM(total), 0)::NUMERIC(14, 2) AS total_amount,
      COALESCE(SUM(balance), 0)::NUMERIC(14, 2) AS total_pending
    FROM normalized_orders
    GROUP BY customer_id, customer_name
  )
  SELECT jsonb_build_object(
    'filters', jsonb_build_object(
      'tenantId', v_effective_tenant_id,
      'branchId', v_effective_branch_id,
      'dateFrom', p_date_from,
      'dateTo', p_date_to,
      'actorRole', UPPER(COALESCE(p_actor_role, 'USER'))
    ),
    'summary', jsonb_build_object(
      'count', COUNT(*),
      'totalOrders', COALESCE(SUM(row.total_orders), 0),
      'pendingOrders', COALESCE(SUM(row.pending_orders), 0),
      'partialOrders', COALESCE(SUM(row.partial_orders), 0),
      'completedOrders', COALESCE(SUM(row.completed_orders), 0),
      'totalAmount', COALESCE(SUM(row.total_amount), 0),
      'totalPending', COALESCE(SUM(row.total_pending), 0)
    ),
    'rows', COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'customerId', row.customer_id,
          'customerName', row.customer_name,
          'totalOrders', row.total_orders,
          'pendingOrders', row.pending_orders,
          'partialOrders', row.partial_orders,
          'completedOrders', row.completed_orders,
          'totalAmount', row.total_amount,
          'totalPending', row.total_pending
        )
        ORDER BY row.total_pending DESC, row.customer_name ASC
      ),
      '[]'::JSONB
    )
  )
  INTO v_payload
  FROM customer_rows AS row;

  RETURN COALESCE(
    v_payload,
    jsonb_build_object(
      'filters', jsonb_build_object(
        'tenantId', v_effective_tenant_id,
        'branchId', v_effective_branch_id,
        'dateFrom', p_date_from,
        'dateTo', p_date_to,
        'actorRole', UPPER(COALESCE(p_actor_role, 'USER'))
      ),
      'summary', jsonb_build_object(
        'count', 0,
        'totalOrders', 0,
        'pendingOrders', 0,
        'partialOrders', 0,
        'completedOrders', 0,
        'totalAmount', 0,
        'totalPending', 0
      ),
      'rows', '[]'::JSONB
    )
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.report_demo()
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_items jsonb;
  v_total numeric(14, 2);
BEGIN
  v_items := jsonb_build_array(
    jsonb_build_object(
      'code', 'ITEM-001',
      'description', 'Producto demo A',
      'quantity', 2,
      'unitPrice', 12500,
      'subtotal', 25000
    ),
    jsonb_build_object(
      'code', 'ITEM-002',
      'description', 'Producto demo B',
      'quantity', 1,
      'unitPrice', 18000,
      'subtotal', 18000
    )
  );

  v_total := 43000;

  RETURN jsonb_build_object(
    'reportTitle', 'Reporte Demo',
    'tenantName', 'Tenant Demo',
    'branchName', 'Sucursal Demo',
    'generatedAt', NOW(),
    'items', v_items,
    'total', v_total
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.report_order_sale_ticket(p_actor_user_id uuid, p_actor_role text, p_actor_tenant_id uuid, p_actor_branch_id uuid, p_order_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_scope JSONB;
  v_effective_tenant_id UUID;
  v_effective_branch_id UUID;
  v_restrict_to_user BOOLEAN;
  v_role TEXT := UPPER(COALESCE(NULLIF(BTRIM(p_actor_role), ''), 'USER'));
  v_payload JSONB;
BEGIN
  IF v_role = 'SUPER_ADMIN' THEN
    SELECT o.tenant_id
    INTO v_effective_tenant_id
    FROM orders AS o
    WHERE o.id = p_order_id
    LIMIT 1;

    v_effective_branch_id := NULL;
    v_restrict_to_user := FALSE;
  ELSIF v_role = 'SUPER_USER' THEN
    SELECT o.tenant_id
    INTO v_effective_tenant_id
    FROM orders AS o
    WHERE o.id = p_order_id
      AND o.tenant_id = p_actor_tenant_id
    LIMIT 1;

    v_effective_branch_id := NULL;
    v_restrict_to_user := FALSE;
  ELSE
    v_scope := public.report_resolve_pos_scope(
      p_actor_role,
      p_actor_tenant_id,
      p_actor_branch_id,
      p_actor_tenant_id,
      p_actor_branch_id
    );

    v_effective_tenant_id := NULLIF(v_scope->>'tenantId', '')::UUID;
    v_effective_branch_id := NULLIF(v_scope->>'branchId', '')::UUID;
    v_restrict_to_user := COALESCE((v_scope->>'restrictToUser')::BOOLEAN, FALSE);
  END IF;

  IF v_effective_tenant_id IS NULL THEN
    RETURN NULL;
  END IF;

  WITH order_scope AS (
    SELECT
      o.id,
      o.tenant_id,
      o.customer_id,
      o.type,
      o.status,
      o.created_at,
      o.total::NUMERIC(14, 2) AS total,
      COALESCE(o.total_paid, 0)::NUMERIC(14, 2) AS paid,
      COALESCE(o.balance_due, GREATEST(o.total - COALESCE(o.total_paid, 0), 0))::NUMERIC(14, 2) AS balance,
      COALESCE(o.payment_status, 'PENDING') AS payment_status,
      tenant.nombre AS tenant_name,
      customer.name AS customer_name,
      COALESCE(sale_context.branch_id, payment_context.branch_id) AS branch_id,
      branch.nombre AS branch_name
    FROM orders AS o
    INNER JOIN tenants AS tenant
      ON tenant.id = o.tenant_id
    INNER JOIN customers AS customer
      ON customer.id = o.customer_id
     AND customer.tenant_id = o.tenant_id
    LEFT JOIN LATERAL (
      SELECT
        s.branch_id,
        s.user_id
      FROM sales AS s
      WHERE s.tenant_id = o.tenant_id
        AND s.order_id = o.id
      ORDER BY s.created_at ASC, s.id ASC
      LIMIT 1
    ) AS sale_context ON TRUE
    LEFT JOIN LATERAL (
      SELECT
        payment_scope.branch_id,
        payment_scope.created_by
      FROM (
        SELECT
          pay.branch_id,
          pay.created_by,
          pay.created_at,
          pay.id
        FROM payments AS pay
        WHERE pay.tenant_id = o.tenant_id
          AND pay.reference_type = 'SALES_ORDER'
          AND pay.reference_id = o.id

        UNION ALL

        SELECT
          pay.branch_id,
          pay.created_by,
          pay.created_at,
          pay.id
        FROM payment_allocations AS allocation
        INNER JOIN payments AS pay
          ON pay.id = allocation.payment_id
        WHERE pay.tenant_id = o.tenant_id
          AND allocation.reference_type = 'SALES_ORDER'
          AND allocation.reference_id = o.id
      ) AS payment_scope
      ORDER BY payment_scope.created_at ASC, payment_scope.id ASC
      LIMIT 1
    ) AS payment_context ON TRUE
    LEFT JOIN tenant_branches AS branch
      ON branch.id = COALESCE(sale_context.branch_id, payment_context.branch_id)
     AND branch.tenant_id = o.tenant_id
    WHERE o.id = p_order_id
      AND o.tenant_id = v_effective_tenant_id
      AND (
        v_effective_branch_id IS NULL
        OR COALESCE(sale_context.branch_id, payment_context.branch_id) = v_effective_branch_id
      )
      AND (
        NOT v_restrict_to_user
        OR EXISTS (
          SELECT 1
          FROM sales AS sales_scope
          WHERE sales_scope.tenant_id = o.tenant_id
            AND sales_scope.order_id = o.id
            AND sales_scope.user_id = p_actor_user_id
        )
        OR EXISTS (
          SELECT 1
          FROM payments AS pay_scope
          WHERE pay_scope.tenant_id = o.tenant_id
            AND pay_scope.reference_type = 'SALES_ORDER'
            AND pay_scope.reference_id = o.id
            AND pay_scope.created_by = p_actor_user_id
        )
        OR EXISTS (
          SELECT 1
          FROM payment_allocations AS allocation_scope
          INNER JOIN payments AS pay_scope
            ON pay_scope.id = allocation_scope.payment_id
          WHERE pay_scope.tenant_id = o.tenant_id
            AND allocation_scope.reference_type = 'SALES_ORDER'
            AND allocation_scope.reference_id = o.id
            AND pay_scope.created_by = p_actor_user_id
        )
      )
    LIMIT 1
  ),
  generated_sales AS (
    SELECT
      s.id AS sale_id,
      s.created_at,
      s.status,
      COALESCE(s.payment_status, 'PENDING') AS payment_status,
      s.total::NUMERIC(14, 2) AS total,
      COALESCE(s.total_paid, 0)::NUMERIC(14, 2) AS paid,
      COALESCE(s.balance_due, s.balance, GREATEST(s.total - COALESCE(s.total_paid, 0), 0))::NUMERIC(14, 2) AS balance,
      s.branch_id,
      branch.nombre AS branch_name,
      s.user_id AS cashier_id,
      COALESCE(
        NULLIF(TRIM(CONCAT(COALESCE(person.nombres, ''), ' ', COALESCE(person.apellidos, ''))), ''),
        usr.email,
        s.user_id::TEXT
      ) AS cashier_name
    FROM sales AS s
    INNER JOIN order_scope AS ord
      ON ord.id = s.order_id
     AND ord.tenant_id = s.tenant_id
    LEFT JOIN tenant_branches AS branch
      ON branch.id = s.branch_id
     AND branch.tenant_id = s.tenant_id
    LEFT JOIN users AS usr
      ON usr.id = s.user_id
     AND usr.tenant_id = s.tenant_id
    LEFT JOIN personas AS person
      ON person.id = usr.persona_id
     AND person.tenant_id = s.tenant_id
    ORDER BY s.created_at ASC, s.id ASC
  ),
  item_rows AS (
    SELECT
      oi.id AS order_item_id,
      oi.product_id,
      COALESCE(NULLIF(BTRIM(product.name), ''), oi.product_id::TEXT) AS product_name,
      oi.ordered_quantity::NUMERIC(14, 2) AS ordered_quantity,
      COALESCE(oi.delivered_quantity, 0)::NUMERIC(14, 2) AS delivered_quantity,
      COALESCE(oi.billed_quantity, 0)::NUMERIC(14, 2) AS billed_quantity,
      oi.price::NUMERIC(14, 2) AS unit_price,
      oi.subtotal::NUMERIC(14, 2) AS subtotal
    FROM order_items AS oi
    INNER JOIN order_scope AS ord
      ON ord.id = oi.order_id
    LEFT JOIN products AS product
      ON product.id = oi.product_id
     AND product.tenant_id = ord.tenant_id
    ORDER BY oi.id ASC
  ),
  payment_rows AS (
    SELECT
      payment_id,
      source,
      method_name,
      amount,
      status,
      reference_number,
      notes,
      created_at
    FROM (
      SELECT *
      FROM (
        SELECT DISTINCT ON (order_payment_rows.payment_id)
          order_payment_rows.payment_id,
          order_payment_rows.source,
          order_payment_rows.method_name,
          order_payment_rows.amount,
          order_payment_rows.status,
          order_payment_rows.reference_number,
          order_payment_rows.notes,
          order_payment_rows.created_at
        FROM (
          SELECT
            pay.id AS payment_id,
            'ORDER'::TEXT AS source,
            method.nombre AS method_name,
            pay.amount::NUMERIC(14, 2) AS amount,
            pay.status,
            pay.reference_number,
            pay.notes,
            pay.created_at
          FROM payments AS pay
          INNER JOIN payment_methods AS method
            ON method.id = pay.payment_method_id
           AND method.tenant_id = pay.tenant_id
          INNER JOIN order_scope AS ord
            ON ord.id = pay.reference_id
           AND ord.tenant_id = pay.tenant_id
          WHERE pay.reference_type = 'SALES_ORDER'

          UNION ALL

          SELECT
            pay.id AS payment_id,
            'ORDER'::TEXT AS source,
            method.nombre AS method_name,
            allocation.allocated_amount::NUMERIC(14, 2) AS amount,
            pay.status,
            pay.reference_number,
            pay.notes,
            pay.created_at
          FROM payment_allocations AS allocation
          INNER JOIN payments AS pay
            ON pay.id = allocation.payment_id
          INNER JOIN payment_methods AS method
            ON method.id = pay.payment_method_id
           AND method.tenant_id = pay.tenant_id
          INNER JOIN order_scope AS ord
            ON ord.id = allocation.reference_id
           AND ord.tenant_id = pay.tenant_id
          WHERE allocation.reference_type = 'SALES_ORDER'
        ) AS order_payment_rows
        ORDER BY order_payment_rows.payment_id, order_payment_rows.created_at ASC
      ) AS order_payments

      UNION ALL

      SELECT
        pay.id AS payment_id,
        'SALE'::TEXT AS source,
        method.nombre AS method_name,
        pay.amount::NUMERIC(14, 2) AS amount,
        pay.status,
        pay.reference_number,
        pay.notes,
        pay.created_at
      FROM payments AS pay
      INNER JOIN payment_methods AS method
        ON method.id = pay.payment_method_id
       AND method.tenant_id = pay.tenant_id
      INNER JOIN generated_sales AS sale
        ON sale.sale_id = pay.reference_id
      WHERE pay.reference_type = 'SALE'
        AND pay.direction = 'IN'
    ) AS union_rows
    ORDER BY created_at ASC, payment_id ASC
  )
  SELECT jsonb_build_object(
    'header', jsonb_build_object(
      'orderId', ord.id,
      'date', ord.created_at,
      'tenantName', ord.tenant_name,
      'customerId', ord.customer_id,
      'customerName', ord.customer_name,
      'branchId', ord.branch_id,
      'branchName', ord.branch_name,
      'status', ord.status,
      'paymentStatus', ord.payment_status,
      'type', ord.type
    ),
    'generatedSales', COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'saleId', sale.sale_id,
            'date', sale.created_at,
            'status', sale.status,
            'paymentStatus', sale.payment_status,
            'total', sale.total,
            'paid', sale.paid,
            'balance', sale.balance,
            'branchId', sale.branch_id,
            'branchName', sale.branch_name,
            'cashierId', sale.cashier_id,
            'cashierName', sale.cashier_name
          )
          ORDER BY sale.created_at ASC, sale.sale_id ASC
        )
        FROM generated_sales AS sale
      ),
      '[]'::JSONB
    ),
    'items', COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'orderItemId', item.order_item_id,
            'productId', item.product_id,
            'productName', item.product_name,
            'orderedQuantity', item.ordered_quantity,
            'deliveredQuantity', item.delivered_quantity,
            'billedQuantity', item.billed_quantity,
            'unitPrice', item.unit_price,
            'subtotal', item.subtotal
          )
          ORDER BY item.order_item_id ASC
        )
        FROM item_rows AS item
      ),
      '[]'::JSONB
    ),
    'payments', COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'paymentId', payment.payment_id,
            'source', payment.source,
            'method', payment.method_name,
            'amount', payment.amount,
            'status', payment.status,
            'referenceNumber', payment.reference_number,
            'notes', payment.notes,
            'date', payment.created_at
          )
          ORDER BY payment.created_at ASC, payment.payment_id ASC
        )
        FROM payment_rows AS payment
      ),
      '[]'::JSONB
    ),
    'totals', jsonb_build_object(
      'total', ord.total,
      'paid', ord.paid,
      'balance', ord.balance
    )
  )
  INTO v_payload
  FROM order_scope AS ord;

  RETURN v_payload;
END;
$function$;

CREATE OR REPLACE FUNCTION public.report_orders_sales(p_actor_user_id uuid, p_actor_role text, p_actor_tenant_id uuid, p_actor_branch_id uuid, p_tenant_id uuid DEFAULT NULL::uuid, p_branch_id uuid DEFAULT NULL::uuid, p_date_from timestamp with time zone DEFAULT NULL::timestamp with time zone, p_date_to timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_scope JSONB;
  v_effective_tenant_id UUID;
  v_effective_branch_id UUID;
  v_restrict_to_user BOOLEAN;
  v_payload JSONB;
BEGIN
  v_scope := public.report_resolve_pos_scope(
    p_actor_role,
    p_actor_tenant_id,
    p_actor_branch_id,
    p_tenant_id,
    p_branch_id
  );

  v_effective_tenant_id := NULLIF(v_scope->>'tenantId', '')::UUID;
  v_effective_branch_id := NULLIF(v_scope->>'branchId', '')::UUID;
  v_restrict_to_user := COALESCE((v_scope->>'restrictToUser')::BOOLEAN, FALSE);

  IF p_date_from IS NOT NULL
     AND p_date_to IS NOT NULL
     AND p_date_to < p_date_from THEN
    RAISE EXCEPTION 'date_to must be greater than or equal to date_from';
  END IF;

  WITH order_rows AS (
    SELECT
      o.id AS order_id,
      o.created_at AS order_date,
      customer.name AS customer_name,
      o.status,
      COALESCE(o.payment_status, 'PENDING') AS payment_status,
      o.total::NUMERIC(14, 2) AS total,
      COALESCE(o.total_paid, 0)::NUMERIC(14, 2) AS paid,
      COALESCE(o.balance_due, GREATEST(o.total - COALESCE(o.total_paid, 0), 0))::NUMERIC(14, 2) AS balance,
      COALESCE(sale_context.branch_id, payment_context.branch_id) AS branch_id,
      branch.nombre AS branch_name,
      sale_context.sale_id AS generated_sale_id
    FROM orders AS o
    INNER JOIN customers AS customer
      ON customer.id = o.customer_id
     AND customer.tenant_id = o.tenant_id
    LEFT JOIN LATERAL (
      SELECT
        s.id AS sale_id,
        s.branch_id,
        s.user_id
      FROM sales AS s
      WHERE s.tenant_id = o.tenant_id
        AND s.order_id = o.id
      ORDER BY s.created_at ASC, s.id ASC
      LIMIT 1
    ) AS sale_context ON TRUE
    LEFT JOIN LATERAL (
      SELECT
        payment_scope.branch_id,
        payment_scope.created_by
      FROM (
        SELECT
          pay.branch_id,
          pay.created_by,
          pay.created_at,
          pay.id
        FROM payments AS pay
        WHERE pay.tenant_id = o.tenant_id
          AND pay.reference_type = 'SALES_ORDER'
          AND pay.reference_id = o.id

        UNION ALL

        SELECT
          pay.branch_id,
          pay.created_by,
          pay.created_at,
          pay.id
        FROM payment_allocations AS allocation
        INNER JOIN payments AS pay
          ON pay.id = allocation.payment_id
        WHERE pay.tenant_id = o.tenant_id
          AND allocation.reference_type = 'SALES_ORDER'
          AND allocation.reference_id = o.id
      ) AS payment_scope
      ORDER BY payment_scope.created_at ASC, payment_scope.id ASC
      LIMIT 1
    ) AS payment_context ON TRUE
    LEFT JOIN tenant_branches AS branch
      ON branch.id = COALESCE(sale_context.branch_id, payment_context.branch_id)
     AND branch.tenant_id = o.tenant_id
    WHERE o.tenant_id = v_effective_tenant_id
      AND (p_date_from IS NULL OR o.created_at >= p_date_from)
      AND (p_date_to IS NULL OR o.created_at < p_date_to)
      AND (
        v_effective_branch_id IS NULL
        OR COALESCE(sale_context.branch_id, payment_context.branch_id) = v_effective_branch_id
      )
      AND (
        NOT v_restrict_to_user
        OR EXISTS (
          SELECT 1
          FROM sales AS sales_scope
          WHERE sales_scope.tenant_id = o.tenant_id
            AND sales_scope.order_id = o.id
            AND sales_scope.user_id = p_actor_user_id
        )
        OR EXISTS (
          SELECT 1
          FROM payments AS pay_scope
          WHERE pay_scope.tenant_id = o.tenant_id
            AND pay_scope.reference_type = 'SALES_ORDER'
            AND pay_scope.reference_id = o.id
            AND pay_scope.created_by = p_actor_user_id
        )
        OR EXISTS (
          SELECT 1
          FROM payment_allocations AS allocation_scope
          INNER JOIN payments AS pay_scope
            ON pay_scope.id = allocation_scope.payment_id
          WHERE pay_scope.tenant_id = o.tenant_id
            AND allocation_scope.reference_type = 'SALES_ORDER'
            AND allocation_scope.reference_id = o.id
            AND pay_scope.created_by = p_actor_user_id
        )
      )
  )
  SELECT jsonb_build_object(
    'filters', jsonb_build_object(
      'tenantId', v_effective_tenant_id,
      'branchId', v_effective_branch_id,
      'dateFrom', p_date_from,
      'dateTo', p_date_to,
      'actorRole', UPPER(COALESCE(p_actor_role, 'USER'))
    ),
    'summary', jsonb_build_object(
      'count', COUNT(*),
      'total', COALESCE(SUM(row.total), 0),
      'paid', COALESCE(SUM(row.paid), 0),
      'balance', COALESCE(SUM(row.balance), 0),
      'completed', COUNT(*) FILTER (WHERE row.status = 'COMPLETED'),
      'partial', COUNT(*) FILTER (WHERE row.status = 'PARTIAL' OR row.payment_status = 'PARTIAL'),
      'pending', COUNT(*) FILTER (
        WHERE row.status IN ('DRAFT', 'CONFIRMED')
           OR row.payment_status = 'PENDING'
      )
    ),
    'rows', COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'orderId', row.order_id,
          'date', row.order_date,
          'customerName', row.customer_name,
          'total', row.total,
          'paid', row.paid,
          'balance', row.balance,
          'status', row.status,
          'paymentStatus', row.payment_status,
          'branchId', row.branch_id,
          'branchName', row.branch_name,
          'generatedSaleId', row.generated_sale_id
        )
        ORDER BY row.order_date DESC, row.order_id DESC
      ),
      '[]'::JSONB
    )
  )
  INTO v_payload
  FROM order_rows AS row;

  RETURN COALESCE(
    v_payload,
    jsonb_build_object(
      'filters', jsonb_build_object(
        'tenantId', v_effective_tenant_id,
        'branchId', v_effective_branch_id,
        'dateFrom', p_date_from,
        'dateTo', p_date_to,
        'actorRole', UPPER(COALESCE(p_actor_role, 'USER'))
      ),
      'summary', jsonb_build_object(
        'count', 0,
        'total', 0,
        'paid', 0,
        'balance', 0,
        'completed', 0,
        'partial', 0,
        'pending', 0
      ),
      'rows', '[]'::JSONB
    )
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.report_pos_sale_cancel_ticket(p_actor_user_id uuid, p_actor_role text, p_actor_tenant_id uuid, p_actor_branch_id uuid, p_sale_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_scope JSONB;
  v_effective_tenant_id UUID;
  v_effective_branch_id UUID;
  v_restrict_to_user BOOLEAN;
  v_role TEXT := UPPER(COALESCE(NULLIF(BTRIM(p_actor_role), ''), 'USER'));
  v_payload JSONB;
BEGIN
  IF v_role = 'SUPER_ADMIN' THEN
    SELECT s.tenant_id, s.branch_id
    INTO v_effective_tenant_id, v_effective_branch_id
    FROM sales AS s
    WHERE s.id = p_sale_id
    LIMIT 1;

    v_restrict_to_user := FALSE;
  ELSIF v_role = 'SUPER_USER' THEN
    SELECT s.tenant_id, s.branch_id
    INTO v_effective_tenant_id, v_effective_branch_id
    FROM sales AS s
    WHERE s.id = p_sale_id
      AND s.tenant_id = p_actor_tenant_id
    LIMIT 1;

    v_restrict_to_user := FALSE;
  ELSE
    v_scope := public.report_resolve_pos_scope(
      p_actor_role,
      p_actor_tenant_id,
      p_actor_branch_id,
      p_actor_tenant_id,
      p_actor_branch_id
    );

    v_effective_tenant_id := NULLIF(v_scope->>'tenantId', '')::UUID;
    v_effective_branch_id := NULLIF(v_scope->>'branchId', '')::UUID;
    v_restrict_to_user := COALESCE((v_scope->>'restrictToUser')::BOOLEAN, FALSE);
  END IF;

  IF v_effective_tenant_id IS NULL THEN
    RETURN NULL;
  END IF;

  WITH sale_scope AS (
    SELECT
      s.id,
      s.tenant_id,
      s.branch_id,
      s.terminal_id,
      s.user_id,
      s.customer_id,
      s.status,
      s.total::NUMERIC(14, 2) AS total,
      COALESCE(s.total_paid, 0)::NUMERIC(14, 2) AS paid,
      COALESCE(s.balance_due, s.balance, GREATEST(s.total - COALESCE(s.total_paid, 0), 0))::NUMERIC(14, 2) AS balance,
      COALESCE(s.payment_status, 'PENDING') AS payment_status,
      s.created_at,
      tenant.nombre AS tenant_name,
      branch.nombre AS branch_name,
      terminal.name AS terminal_name,
      COALESCE(
        NULLIF(TRIM(CONCAT(COALESCE(person.nombres, ''), ' ', COALESCE(person.apellidos, ''))), ''),
        cashier.email,
        s.user_id::TEXT
      ) AS cashier_name,
      COALESCE(NULLIF(BTRIM(customer.name), ''), 'CONSUMIDOR FINAL') AS customer_name
    FROM sales AS s
    INNER JOIN tenants AS tenant
      ON tenant.id = s.tenant_id
    LEFT JOIN tenant_branches AS branch
      ON branch.id = s.branch_id
     AND branch.tenant_id = s.tenant_id
    LEFT JOIN terminals AS terminal
      ON terminal.id = s.terminal_id
     AND terminal.tenant_id = s.tenant_id
    LEFT JOIN users AS cashier
      ON cashier.id = s.user_id
     AND cashier.tenant_id = s.tenant_id
    LEFT JOIN personas AS person
      ON person.id = cashier.persona_id
     AND person.tenant_id = s.tenant_id
    LEFT JOIN customers AS customer
      ON customer.id = s.customer_id
     AND customer.tenant_id = s.tenant_id
    WHERE s.id = p_sale_id
      AND s.tenant_id = v_effective_tenant_id
      AND (v_effective_branch_id IS NULL OR s.branch_id = v_effective_branch_id)
      AND (
        NOT v_restrict_to_user
        OR s.user_id = p_actor_user_id
      )
    LIMIT 1
  ),
  refund_rows AS (
    SELECT
      payment.id,
      method.nombre AS payment_method_name,
      payment.status,
      payment.reference_number,
      payment.notes,
      payment.created_at,
      payment.cash_session_id,
      allocation.allocated_amount::NUMERIC(14, 2) AS amount
    FROM payment_allocations AS allocation
    INNER JOIN payments AS payment
      ON payment.id = allocation.payment_id
    INNER JOIN payment_methods AS method
      ON method.id = payment.payment_method_id
     AND method.tenant_id = payment.tenant_id
    INNER JOIN sale_scope AS sale
      ON sale.id = allocation.reference_id
     AND sale.tenant_id = payment.tenant_id
    WHERE allocation.reference_type = 'SALE'
      AND allocation.reference_id = p_sale_id
      AND payment.reference_type = 'REFUND'
      AND payment.direction = 'OUT'
    ORDER BY payment.created_at ASC, payment.id ASC
  ),
  cash_movement_rows AS (
    SELECT
      movement.id,
      movement.cash_session_id,
      movement.amount::NUMERIC(14, 2) AS amount,
      movement.description,
      movement.created_at,
      register.nombre AS cash_register_name
    FROM cash_movements AS movement
    INNER JOIN sale_scope AS sale
      ON sale.tenant_id = movement.tenant_id
    LEFT JOIN cash_sessions AS session
      ON session.id = movement.cash_session_id
     AND session.tenant_id = movement.tenant_id
    LEFT JOIN cash_registers AS register
      ON register.id = session.cash_register_id
     AND register.tenant_id = movement.tenant_id
    WHERE movement.reference_type = 'REFUND'
      AND movement.reference_id = p_sale_id::TEXT
      AND movement.direction = 'OUT'
    ORDER BY movement.created_at ASC, movement.id ASC
  ),
  cancellation_clock AS (
    SELECT MAX(event_at) AS cancelled_at
    FROM (
      SELECT refund.created_at AS event_at
      FROM refund_rows AS refund
      UNION ALL
      SELECT movement.created_at AS event_at
      FROM cash_movement_rows AS movement
      UNION ALL
      SELECT stock.created_at AS event_at
      FROM stock_movements AS stock
      INNER JOIN sale_scope AS sale
        ON sale.tenant_id = stock.tenant_id
       AND sale.branch_id = stock.branch_id
      WHERE stock.reference_type = 'SALE'
        AND stock.reference_id = p_sale_id
        AND stock.type = 'IN'
    ) AS events
  )
  SELECT jsonb_build_object(
    'header', jsonb_build_object(
      'saleId', sale.id,
      'originalDate', sale.created_at,
      'cancelledAt', clock.cancelled_at,
      'tenantName', sale.tenant_name,
      'branch', sale.branch_name,
      'branchId', sale.branch_id,
      'terminal', sale.terminal_name,
      'terminalId', sale.terminal_id,
      'cashier', sale.cashier_name,
      'cashierId', sale.user_id,
      'customer', sale.customer_name,
      'customerId', sale.customer_id,
      'status', sale.status,
      'paymentStatus', sale.payment_status
    ),
    'cancellation', jsonb_build_object(
      'originalSaleId', sale.id,
      'reason', CASE
        WHEN sale.status IN ('CANCELLED', 'REFUNDED') THEN
          COALESCE(
            (
              SELECT refund.notes
              FROM refund_rows AS refund
              WHERE refund.notes IS NOT NULL
                AND BTRIM(refund.notes) <> ''
              ORDER BY refund.created_at DESC, refund.id DESC
              LIMIT 1
            ),
            'Sin motivo registrado en el sistema'
          )
        ELSE NULL
      END,
      'finalStatus', sale.status
    ),
    'paymentsReverted', COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'paymentId', refund.id,
            'method', refund.payment_method_name,
            'amount', refund.amount,
            'status', refund.status,
            'referenceNumber', refund.reference_number,
            'notes', refund.notes,
            'date', refund.created_at
          )
          ORDER BY refund.created_at ASC, refund.id ASC
        )
        FROM refund_rows AS refund
      ),
      '[]'::JSONB
    ),
    'cashMovements', COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'movementId', movement.id,
            'cashSessionId', movement.cash_session_id,
            'cashRegister', movement.cash_register_name,
            'amount', movement.amount,
            'description', movement.description,
            'date', movement.created_at
          )
          ORDER BY movement.created_at ASC, movement.id ASC
        )
        FROM cash_movement_rows AS movement
      ),
      '[]'::JSONB
    ),
    'totals', jsonb_build_object(
      'saleTotal', sale.total,
      'paid', sale.paid,
      'balance', sale.balance,
      'refunded', COALESCE((SELECT SUM(refund.amount) FROM refund_rows AS refund), 0)
    )
  )
  INTO v_payload
  FROM sale_scope AS sale
  CROSS JOIN cancellation_clock AS clock;

  RETURN v_payload;
END;
$function$;

CREATE OR REPLACE FUNCTION public.report_pos_sale_ticket(p_actor_user_id uuid, p_actor_role text, p_actor_tenant_id uuid, p_actor_branch_id uuid, p_sale_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_scope JSONB;
  v_effective_tenant_id UUID;
  v_effective_branch_id UUID;
  v_restrict_to_user BOOLEAN;
  v_role TEXT := UPPER(COALESCE(NULLIF(BTRIM(p_actor_role), ''), 'USER'));
  v_payload JSONB;
BEGIN
  IF v_role = 'SUPER_ADMIN' THEN
    SELECT s.tenant_id, s.branch_id
    INTO v_effective_tenant_id, v_effective_branch_id
    FROM sales AS s
    WHERE s.id = p_sale_id
    LIMIT 1;

    v_restrict_to_user := FALSE;
  ELSIF v_role = 'SUPER_USER' THEN
    SELECT s.tenant_id, s.branch_id
    INTO v_effective_tenant_id, v_effective_branch_id
    FROM sales AS s
    WHERE s.id = p_sale_id
      AND s.tenant_id = p_actor_tenant_id
    LIMIT 1;

    v_restrict_to_user := FALSE;
  ELSE
    v_scope := public.report_resolve_pos_scope(
      p_actor_role,
      p_actor_tenant_id,
      p_actor_branch_id,
      p_actor_tenant_id,
      p_actor_branch_id
    );

    v_effective_tenant_id := NULLIF(v_scope->>'tenantId', '')::UUID;
    v_effective_branch_id := NULLIF(v_scope->>'branchId', '')::UUID;
    v_restrict_to_user := COALESCE((v_scope->>'restrictToUser')::BOOLEAN, FALSE);
  END IF;

  IF v_effective_tenant_id IS NULL THEN
    RETURN NULL;
  END IF;

  WITH sale_scope AS (
    SELECT
      s.id,
      s.tenant_id,
      s.branch_id,
      s.terminal_id,
      s.user_id,
      s.customer_id,
      s.pos_session_id,
      s.status,
      s.total::NUMERIC(14, 2) AS total,
      COALESCE(s.total_paid, 0)::NUMERIC(14, 2) AS paid,
      COALESCE(s.balance_due, s.balance, GREATEST(s.total - COALESCE(s.total_paid, 0), 0))::NUMERIC(14, 2) AS balance,
      COALESCE(s.payment_status, 'PENDING') AS payment_status,
      s.created_at,
      tenant.nombre AS tenant_name,
      branch.nombre AS branch_name,
      terminal.name AS terminal_name,
      COALESCE(
        NULLIF(TRIM(CONCAT(COALESCE(person.nombres, ''), ' ', COALESCE(person.apellidos, ''))), ''),
        cashier.email,
        s.user_id::TEXT
      ) AS cashier_name,
      COALESCE(NULLIF(BTRIM(customer.name), ''), 'CONSUMIDOR FINAL') AS customer_name
    FROM sales AS s
    INNER JOIN tenants AS tenant
      ON tenant.id = s.tenant_id
    LEFT JOIN tenant_branches AS branch
      ON branch.id = s.branch_id
     AND branch.tenant_id = s.tenant_id
    LEFT JOIN terminals AS terminal
      ON terminal.id = s.terminal_id
     AND terminal.tenant_id = s.tenant_id
    LEFT JOIN users AS cashier
      ON cashier.id = s.user_id
     AND cashier.tenant_id = s.tenant_id
    LEFT JOIN personas AS person
      ON person.id = cashier.persona_id
     AND person.tenant_id = s.tenant_id
    LEFT JOIN customers AS customer
      ON customer.id = s.customer_id
     AND customer.tenant_id = s.tenant_id
    WHERE s.id = p_sale_id
      AND s.tenant_id = v_effective_tenant_id
      AND (v_effective_branch_id IS NULL OR s.branch_id = v_effective_branch_id)
      AND (
        NOT v_restrict_to_user
        OR s.user_id = p_actor_user_id
      )
    LIMIT 1
  ),
  item_rows AS (
    SELECT
      item.id,
      COALESCE(NULLIF(BTRIM(product.name), ''), item.product_id::TEXT) AS product_name,
      item.quantity::NUMERIC(14, 2) AS quantity,
      item.price::NUMERIC(14, 2) AS unit_price,
      item.tax_total::NUMERIC(14, 2) AS tax_total,
      item.subtotal::NUMERIC(14, 2) AS subtotal,
      item.created_at
    FROM sale_items AS item
    INNER JOIN sale_scope AS sale
      ON sale.id = item.sale_id
    LEFT JOIN products AS product
      ON product.id = item.product_id
     AND product.tenant_id = sale.tenant_id
    ORDER BY item.created_at ASC, item.id ASC
  ),
  payment_rows AS (
    SELECT DISTINCT ON (payment_id)
      payment_id AS id,
      reference_type,
      direction,
      status,
      amount,
      reference_number,
      notes,
      cash_session_id,
      payment_method_name,
      created_at
    FROM (
      SELECT
        payment.id AS payment_id,
        payment.reference_type,
        payment.direction,
        payment.status,
        payment.amount::NUMERIC(14, 2) AS amount,
        payment.reference_number,
        payment.notes,
        payment.cash_session_id,
        method.nombre AS payment_method_name,
        payment.created_at,
        1 AS source_priority
      FROM payments AS payment
      INNER JOIN payment_methods AS method
        ON method.id = payment.payment_method_id
       AND method.tenant_id = payment.tenant_id
      INNER JOIN sale_scope AS sale
        ON sale.id = payment.reference_id
       AND sale.tenant_id = payment.tenant_id
      WHERE payment.reference_type = 'SALE'
        AND payment.reference_id = p_sale_id
        AND payment.direction = 'IN'

      UNION ALL

      SELECT
        payment.id AS payment_id,
        payment.reference_type,
        payment.direction,
        payment.status,
        allocation.allocated_amount::NUMERIC(14, 2) AS amount,
        payment.reference_number,
        payment.notes,
        payment.cash_session_id,
        method.nombre AS payment_method_name,
        payment.created_at,
        2 AS source_priority
      FROM payment_allocations AS allocation
      INNER JOIN payments AS payment
        ON payment.id = allocation.payment_id
      INNER JOIN payment_methods AS method
        ON method.id = payment.payment_method_id
       AND method.tenant_id = payment.tenant_id
      INNER JOIN sale_scope AS sale
        ON sale.id = allocation.reference_id
       AND sale.tenant_id = payment.tenant_id
      WHERE allocation.reference_type = 'SALE'
        AND allocation.reference_id = p_sale_id
        AND payment.direction = 'IN'
        AND payment.reference_type <> 'REFUND'
    ) AS source_rows
    ORDER BY payment_id, source_priority ASC, created_at ASC
  ),
  original_cash_context AS (
    SELECT
      original_payment.cash_session_id,
      session.opened_at,
      register.nombre AS cash_register_name
    FROM payments AS original_payment
    INNER JOIN sale_scope AS sale
      ON sale.id = original_payment.reference_id
     AND sale.tenant_id = original_payment.tenant_id
    INNER JOIN cash_sessions AS session
      ON session.id = original_payment.cash_session_id
    LEFT JOIN cash_registers AS register
      ON register.id = session.cash_register_id
     AND register.tenant_id = session.tenant_id
    WHERE original_payment.reference_type = 'SALE'
      AND original_payment.reference_id = p_sale_id
      AND original_payment.direction = 'IN'
      AND original_payment.cash_session_id IS NOT NULL
    ORDER BY original_payment.created_at ASC, original_payment.id ASC
    LIMIT 1
  )
  SELECT jsonb_build_object(
    'header', jsonb_build_object(
      'saleId', sale.id,
      'date', sale.created_at,
      'tenantName', sale.tenant_name,
      'branch', sale.branch_name,
      'branchId', sale.branch_id,
      'terminal', sale.terminal_name,
      'terminalId', sale.terminal_id,
      'cashier', sale.cashier_name,
      'cashierId', sale.user_id,
      'customer', sale.customer_name,
      'customerId', sale.customer_id,
      'status', sale.status,
      'paymentStatus', sale.payment_status
    ),
    'items', COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'productName', item.product_name,
            'quantity', item.quantity,
            'unitPrice', item.unit_price,
            'subtotal', item.subtotal
          )
          ORDER BY item.created_at ASC, item.id ASC
        )
        FROM item_rows AS item
      ),
      '[]'::JSONB
    ),
    'payments', COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'paymentId', payment.id,
            'method', payment.payment_method_name,
            'amount', payment.amount,
            'status', payment.status,
            'direction', payment.direction,
            'referenceType', payment.reference_type,
            'referenceNumber', payment.reference_number,
            'notes', payment.notes
          )
          ORDER BY payment.created_at ASC, payment.id ASC
        )
        FROM payment_rows AS payment
      ),
      '[]'::JSONB
    ),
    'totals', jsonb_build_object(
      'subtotal', COALESCE((SELECT SUM(item.subtotal - item.tax_total) FROM item_rows AS item), 0),
      'taxes', COALESCE((SELECT SUM(item.tax_total) FROM item_rows AS item), 0),
      'total', sale.total,
      'paid', sale.paid,
      'change', GREATEST(sale.paid - sale.total, 0),
      'balance', sale.balance
    ),
    'cashContext', (
      SELECT jsonb_build_object(
        'cashSession', context.cash_session_id,
        'cashRegister', context.cash_register_name,
        'openedAt', context.opened_at
      )
      FROM original_cash_context AS context
    )
  )
  INTO v_payload
  FROM sale_scope AS sale;

  RETURN v_payload;
END;
$function$;

CREATE OR REPLACE FUNCTION public.report_pos_sales(p_actor_user_id uuid, p_actor_role text, p_actor_tenant_id uuid, p_actor_branch_id uuid, p_tenant_id uuid DEFAULT NULL::uuid, p_branch_id uuid DEFAULT NULL::uuid, p_date_from timestamp with time zone DEFAULT NULL::timestamp with time zone, p_date_to timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_scope JSONB;
  v_effective_tenant_id UUID;
  v_effective_branch_id UUID;
  v_restrict_to_user BOOLEAN;
  v_payload JSONB;
BEGIN
  v_scope := public.report_resolve_pos_scope(
    p_actor_role,
    p_actor_tenant_id,
    p_actor_branch_id,
    p_tenant_id,
    p_branch_id
  );

  v_effective_tenant_id := NULLIF(v_scope->>'tenantId', '')::UUID;
  v_effective_branch_id := NULLIF(v_scope->>'branchId', '')::UUID;
  v_restrict_to_user := COALESCE((v_scope->>'restrictToUser')::BOOLEAN, FALSE);

  IF p_date_from IS NOT NULL
     AND p_date_to IS NOT NULL
     AND p_date_to < p_date_from THEN
    RAISE EXCEPTION 'date_to must be greater than or equal to date_from';
  END IF;

  WITH sale_rows AS (
    SELECT
      s.id AS sale_id,
      s.created_at AS sale_date,
      s.status,
      COALESCE(NULLIF(BTRIM(customer.name), ''), 'CONSUMIDOR FINAL') AS customer_name,
      s.total::NUMERIC(14, 2) AS total,
      COALESCE(s.total_paid, 0)::NUMERIC(14, 2) AS paid,
      COALESCE(s.balance_due, s.balance, GREATEST(s.total - COALESCE(s.total_paid, 0), 0))::NUMERIC(14, 2) AS balance,
      COALESCE(s.payment_status, 'PENDING') AS payment_status,
      s.branch_id,
      branch.nombre AS branch_name,
      (
        SELECT original_payment.cash_session_id
        FROM payments AS original_payment
        WHERE original_payment.tenant_id = s.tenant_id
          AND original_payment.reference_type = 'SALE'
          AND original_payment.reference_id = s.id
          AND original_payment.direction = 'IN'
        ORDER BY original_payment.created_at ASC, original_payment.id ASC
        LIMIT 1
      ) AS cash_session_id
    FROM sales AS s
    LEFT JOIN customers AS customer
      ON customer.id = s.customer_id
     AND customer.tenant_id = s.tenant_id
    LEFT JOIN tenant_branches AS branch
      ON branch.id = s.branch_id
     AND branch.tenant_id = s.tenant_id
    WHERE s.tenant_id = v_effective_tenant_id
      AND (v_effective_branch_id IS NULL OR s.branch_id = v_effective_branch_id)
      AND (p_date_from IS NULL OR s.created_at >= p_date_from)
      AND (p_date_to IS NULL OR s.created_at < p_date_to)
      AND (
        NOT v_restrict_to_user
        OR s.user_id = p_actor_user_id
      )
  )
  SELECT jsonb_build_object(
    'filters', jsonb_build_object(
      'tenantId', v_effective_tenant_id,
      'branchId', v_effective_branch_id,
      'dateFrom', p_date_from,
      'dateTo', p_date_to,
      'actorRole', UPPER(COALESCE(p_actor_role, 'USER'))
    ),
    'summary', jsonb_build_object(
      'count', COUNT(*),
      'total', COALESCE(SUM(row.total), 0),
      'paid', COALESCE(SUM(row.paid), 0),
      'balance', COALESCE(SUM(row.balance), 0),
      'cancelled', COUNT(*) FILTER (WHERE row.status = 'CANCELLED'),
      'refunded', COUNT(*) FILTER (WHERE row.status = 'REFUNDED')
    ),
    'rows', COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'saleId', row.sale_id,
          'date', row.sale_date,
          'status', row.status,
          'customerName', row.customer_name,
          'total', row.total,
          'paid', row.paid,
          'balance', row.balance,
          'paymentStatus', row.payment_status,
          'branchId', row.branch_id,
          'branchName', row.branch_name,
          'cashSessionId', row.cash_session_id
        )
        ORDER BY row.sale_date DESC, row.sale_id DESC
      ),
      '[]'::JSONB
    )
  )
  INTO v_payload
  FROM sale_rows AS row;

  RETURN COALESCE(
    v_payload,
    jsonb_build_object(
      'filters', jsonb_build_object(
        'tenantId', v_effective_tenant_id,
        'branchId', v_effective_branch_id,
        'dateFrom', p_date_from,
        'dateTo', p_date_to,
        'actorRole', UPPER(COALESCE(p_actor_role, 'USER'))
      ),
      'summary', jsonb_build_object(
        'count', 0,
        'total', 0,
        'paid', 0,
        'balance', 0,
        'cancelled', 0,
        'refunded', 0
      ),
      'rows', '[]'::JSONB
    )
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.report_purchase_ticket(p_actor_user_id uuid, p_actor_role text, p_actor_tenant_id uuid, p_actor_branch_id uuid, p_purchase_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_scope JSONB;
  v_effective_tenant_id UUID;
  v_effective_branch_id UUID;
  v_restrict_to_user BOOLEAN;
  v_role TEXT := UPPER(COALESCE(NULLIF(BTRIM(p_actor_role), ''), 'USER'));
  v_payload JSONB;
BEGIN
  IF v_role = 'SUPER_ADMIN' THEN
    SELECT p.tenant_id
    INTO v_effective_tenant_id
    FROM purchases AS p
    WHERE p.id = p_purchase_id
    LIMIT 1;

    v_effective_branch_id := NULL;
    v_restrict_to_user := FALSE;
  ELSIF v_role = 'SUPER_USER' THEN
    SELECT p.tenant_id
    INTO v_effective_tenant_id
    FROM purchases AS p
    WHERE p.id = p_purchase_id
      AND p.tenant_id = p_actor_tenant_id
    LIMIT 1;

    v_effective_branch_id := NULL;
    v_restrict_to_user := FALSE;
  ELSE
    v_scope := public.report_resolve_pos_scope(
      p_actor_role,
      p_actor_tenant_id,
      p_actor_branch_id,
      p_actor_tenant_id,
      p_actor_branch_id
    );

    v_effective_tenant_id := NULLIF(v_scope->>'tenantId', '')::UUID;
    v_effective_branch_id := NULLIF(v_scope->>'branchId', '')::UUID;
    v_restrict_to_user := COALESCE((v_scope->>'restrictToUser')::BOOLEAN, FALSE);
  END IF;

  IF v_effective_tenant_id IS NULL THEN
    RETURN NULL;
  END IF;

  WITH purchase_scope AS (
    SELECT
      p.id,
      p.tenant_id,
      p.supplier_id,
      p.created_at,
      p.status,
      p.type,
      p.total::NUMERIC(14, 2) AS total,
      COALESCE(p.total_paid, 0)::NUMERIC(14, 2) AS paid,
      COALESCE(p.balance_due, p.balance, GREATEST(p.total - COALESCE(p.total_paid, 0), 0))::NUMERIC(14, 2) AS balance,
      COALESCE(
        p.payment_status,
        CASE
          WHEN COALESCE(p.total_paid, 0) <= 0 THEN 'PENDING'
          WHEN COALESCE(p.total_paid, 0) < p.total THEN 'PARTIAL'
          WHEN COALESCE(p.total_paid, 0) = p.total THEN 'PAID'
          ELSE 'OVERPAID'
        END
      ) AS payment_status,
      tenant.nombre AS tenant_name,
      supplier.name AS supplier_name,
      COALESCE(payment_context.branch_id, stock_context.branch_id) AS branch_id,
      branch.nombre AS branch_name,
      COALESCE(payment_context.created_by, stock_context.user_id) AS actor_user_id,
      COALESCE(
        NULLIF(TRIM(CONCAT(COALESCE(person.nombres, ''), ' ', COALESCE(person.apellidos, ''))), ''),
        usr.email,
        COALESCE(payment_context.created_by, stock_context.user_id)::TEXT
      ) AS actor_user_name
    FROM purchases AS p
    INNER JOIN tenants AS tenant
      ON tenant.id = p.tenant_id
    INNER JOIN suppliers AS supplier
      ON supplier.id = p.supplier_id
     AND supplier.tenant_id = p.tenant_id
    LEFT JOIN LATERAL (
      SELECT
        pay.branch_id,
        pay.created_by
      FROM payments AS pay
      WHERE pay.tenant_id = p.tenant_id
        AND pay.reference_type = 'PURCHASE'
        AND pay.reference_id = p.id
      ORDER BY pay.created_at ASC, pay.id ASC
      LIMIT 1
    ) AS payment_context ON TRUE
    LEFT JOIN LATERAL (
      SELECT
        sm.branch_id,
        sm.user_id
      FROM stock_movements AS sm
      WHERE sm.tenant_id = p.tenant_id
        AND sm.reference_type = 'PURCHASE'
        AND sm.reference_id = p.id
      ORDER BY sm.created_at ASC, sm.id ASC
      LIMIT 1
    ) AS stock_context ON TRUE
    LEFT JOIN tenant_branches AS branch
      ON branch.id = COALESCE(payment_context.branch_id, stock_context.branch_id)
     AND branch.tenant_id = p.tenant_id
    LEFT JOIN users AS usr
      ON usr.id = COALESCE(payment_context.created_by, stock_context.user_id)
     AND usr.tenant_id = p.tenant_id
    LEFT JOIN personas AS person
      ON person.id = usr.persona_id
     AND person.tenant_id = p.tenant_id
    WHERE p.id = p_purchase_id
      AND p.tenant_id = v_effective_tenant_id
      AND (
        v_effective_branch_id IS NULL
        OR COALESCE(payment_context.branch_id, stock_context.branch_id) = v_effective_branch_id
      )
      AND (
        NOT v_restrict_to_user
        OR EXISTS (
          SELECT 1
          FROM payments AS pay_scope
          WHERE pay_scope.tenant_id = p.tenant_id
            AND pay_scope.reference_type = 'PURCHASE'
            AND pay_scope.reference_id = p.id
            AND pay_scope.created_by = p_actor_user_id
        )
        OR EXISTS (
          SELECT 1
          FROM stock_movements AS sm_scope
          WHERE sm_scope.tenant_id = p.tenant_id
            AND sm_scope.reference_type = 'PURCHASE'
            AND sm_scope.reference_id = p.id
            AND sm_scope.user_id = p_actor_user_id
        )
      )
    LIMIT 1
  ),
  item_rows AS (
    SELECT
      item.id,
      item.product_id,
      COALESCE(NULLIF(BTRIM(product.name), ''), item.product_id::TEXT) AS product_name,
      item.ordered_quantity::NUMERIC(14, 2) AS quantity,
      COALESCE(item.received_quantity, 0)::NUMERIC(14, 2) AS received_quantity,
      item.cost::NUMERIC(14, 2) AS unit_cost,
      item.subtotal::NUMERIC(14, 2) AS subtotal
    FROM purchase_items AS item
    INNER JOIN purchase_scope AS purchase
      ON purchase.id = item.purchase_id
    LEFT JOIN products AS product
      ON product.id = item.product_id
     AND product.tenant_id = purchase.tenant_id
    ORDER BY item.id ASC
  ),
  payment_rows AS (
    SELECT
      pay.id,
      pay.status,
      pay.amount::NUMERIC(14, 2) AS amount,
      pay.reference_number,
      pay.notes,
      pay.created_at,
      method.nombre AS payment_method_name
    FROM payments AS pay
    INNER JOIN purchase_scope AS purchase
      ON purchase.id = pay.reference_id
     AND purchase.tenant_id = pay.tenant_id
    INNER JOIN payment_methods AS method
      ON method.id = pay.payment_method_id
     AND method.tenant_id = pay.tenant_id
    WHERE pay.reference_type = 'PURCHASE'
    ORDER BY pay.created_at ASC, pay.id ASC
  )
  SELECT jsonb_build_object(
    'header', jsonb_build_object(
      'purchaseId', purchase.id,
      'date', purchase.created_at,
      'tenantName', purchase.tenant_name,
      'supplier', purchase.supplier_name,
      'supplierId', purchase.supplier_id,
      'branchId', purchase.branch_id,
      'branchName', purchase.branch_name,
      'userId', purchase.actor_user_id,
      'userName', purchase.actor_user_name,
      'status', purchase.status,
      'paymentStatus', purchase.payment_status,
      'type', purchase.type
    ),
    'items', COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'productId', item.product_id,
            'productName', item.product_name,
            'quantity', item.quantity,
            'receivedQuantity', item.received_quantity,
            'unitCost', item.unit_cost,
            'subtotal', item.subtotal
          )
          ORDER BY item.id ASC
        )
        FROM item_rows AS item
      ),
      '[]'::JSONB
    ),
    'totals', jsonb_build_object(
      'total', purchase.total,
      'paid', purchase.paid,
      'balance', purchase.balance
    ),
    'payments', COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'paymentId', payment.id,
            'method', payment.payment_method_name,
            'amount', payment.amount,
            'status', payment.status,
            'referenceNumber', payment.reference_number,
            'notes', payment.notes,
            'date', payment.created_at
          )
          ORDER BY payment.created_at ASC, payment.id ASC
        )
        FROM payment_rows AS payment
      ),
      '[]'::JSONB
    )
  )
  INTO v_payload
  FROM purchase_scope AS purchase;

  RETURN v_payload;
END;
$function$;

CREATE OR REPLACE FUNCTION public.report_purchases(p_actor_user_id uuid, p_actor_role text, p_actor_tenant_id uuid, p_actor_branch_id uuid, p_tenant_id uuid DEFAULT NULL::uuid, p_branch_id uuid DEFAULT NULL::uuid, p_date_from timestamp with time zone DEFAULT NULL::timestamp with time zone, p_date_to timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_scope JSONB;
  v_effective_tenant_id UUID;
  v_effective_branch_id UUID;
  v_restrict_to_user BOOLEAN;
  v_payload JSONB;
BEGIN
  v_scope := public.report_resolve_pos_scope(
    p_actor_role,
    p_actor_tenant_id,
    p_actor_branch_id,
    p_tenant_id,
    p_branch_id
  );

  v_effective_tenant_id := NULLIF(v_scope->>'tenantId', '')::UUID;
  v_effective_branch_id := NULLIF(v_scope->>'branchId', '')::UUID;
  v_restrict_to_user := COALESCE((v_scope->>'restrictToUser')::BOOLEAN, FALSE);

  IF p_date_from IS NOT NULL
     AND p_date_to IS NOT NULL
     AND p_date_to < p_date_from THEN
    RAISE EXCEPTION 'date_to must be greater than or equal to date_from';
  END IF;

  WITH purchase_rows AS (
    SELECT
      p.id AS purchase_id,
      p.created_at AS purchase_date,
      supplier.name AS supplier_name,
      p.status,
      p.total::NUMERIC(14, 2) AS total,
      COALESCE(p.total_paid, 0)::NUMERIC(14, 2) AS paid,
      COALESCE(p.balance_due, p.balance, GREATEST(p.total - COALESCE(p.total_paid, 0), 0))::NUMERIC(14, 2) AS balance,
      COALESCE(
        p.payment_status,
        CASE
          WHEN COALESCE(p.total_paid, 0) <= 0 THEN 'PENDING'
          WHEN COALESCE(p.total_paid, 0) < p.total THEN 'PARTIAL'
          WHEN COALESCE(p.total_paid, 0) = p.total THEN 'PAID'
          ELSE 'OVERPAID'
        END
      ) AS payment_status,
      COALESCE(payment_context.branch_id, stock_context.branch_id) AS branch_id,
      branch.nombre AS branch_name
    FROM purchases AS p
    INNER JOIN suppliers AS supplier
      ON supplier.id = p.supplier_id
     AND supplier.tenant_id = p.tenant_id
    LEFT JOIN LATERAL (
      SELECT
        pay.branch_id,
        pay.created_by
      FROM payments AS pay
      WHERE pay.tenant_id = p.tenant_id
        AND pay.reference_type = 'PURCHASE'
        AND pay.reference_id = p.id
      ORDER BY pay.created_at ASC, pay.id ASC
      LIMIT 1
    ) AS payment_context ON TRUE
    LEFT JOIN LATERAL (
      SELECT
        sm.branch_id,
        sm.user_id
      FROM stock_movements AS sm
      WHERE sm.tenant_id = p.tenant_id
        AND sm.reference_type = 'PURCHASE'
        AND sm.reference_id = p.id
      ORDER BY sm.created_at ASC, sm.id ASC
      LIMIT 1
    ) AS stock_context ON TRUE
    LEFT JOIN tenant_branches AS branch
      ON branch.id = COALESCE(payment_context.branch_id, stock_context.branch_id)
     AND branch.tenant_id = p.tenant_id
    WHERE p.tenant_id = v_effective_tenant_id
      AND (p_date_from IS NULL OR p.created_at >= p_date_from)
      AND (p_date_to IS NULL OR p.created_at < p_date_to)
      AND (
        v_effective_branch_id IS NULL
        OR COALESCE(payment_context.branch_id, stock_context.branch_id) = v_effective_branch_id
      )
      AND (
        NOT v_restrict_to_user
        OR EXISTS (
          SELECT 1
          FROM payments AS pay_scope
          WHERE pay_scope.tenant_id = p.tenant_id
            AND pay_scope.reference_type = 'PURCHASE'
            AND pay_scope.reference_id = p.id
            AND pay_scope.created_by = p_actor_user_id
        )
        OR EXISTS (
          SELECT 1
          FROM stock_movements AS sm_scope
          WHERE sm_scope.tenant_id = p.tenant_id
            AND sm_scope.reference_type = 'PURCHASE'
            AND sm_scope.reference_id = p.id
            AND sm_scope.user_id = p_actor_user_id
        )
      )
  )
  SELECT jsonb_build_object(
    'filters', jsonb_build_object(
      'tenantId', v_effective_tenant_id,
      'branchId', v_effective_branch_id,
      'dateFrom', p_date_from,
      'dateTo', p_date_to,
      'actorRole', UPPER(COALESCE(p_actor_role, 'USER'))
    ),
    'summary', jsonb_build_object(
      'count', COUNT(*),
      'total', COALESCE(SUM(row.total), 0),
      'paid', COALESCE(SUM(row.paid), 0),
      'balance', COALESCE(SUM(row.balance), 0)
    ),
    'rows', COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'purchaseId', row.purchase_id,
          'date', row.purchase_date,
          'supplierName', row.supplier_name,
          'total', row.total,
          'paid', row.paid,
          'balance', row.balance,
          'paymentStatus', row.payment_status,
          'branchId', row.branch_id,
          'branchName', row.branch_name,
          'status', row.status
        )
        ORDER BY row.purchase_date DESC, row.purchase_id DESC
      ),
      '[]'::JSONB
    )
  )
  INTO v_payload
  FROM purchase_rows AS row;

  RETURN COALESCE(
    v_payload,
    jsonb_build_object(
      'filters', jsonb_build_object(
        'tenantId', v_effective_tenant_id,
        'branchId', v_effective_branch_id,
        'dateFrom', p_date_from,
        'dateTo', p_date_to,
        'actorRole', UPPER(COALESCE(p_actor_role, 'USER'))
      ),
      'summary', jsonb_build_object(
        'count', 0,
        'total', 0,
        'paid', 0,
        'balance', 0
      ),
      'rows', '[]'::JSONB
    )
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.report_resolve_pos_scope(p_actor_role text, p_actor_tenant_id uuid, p_actor_branch_id uuid, p_requested_tenant_id uuid, p_requested_branch_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_role TEXT := UPPER(COALESCE(NULLIF(BTRIM(p_actor_role), ''), 'USER'));
  v_tenant_id UUID;
  v_branch_id UUID;
  v_restrict_to_user BOOLEAN := FALSE;
BEGIN
  IF p_actor_tenant_id IS NULL AND v_role <> 'SUPER_ADMIN' THEN
    RAISE EXCEPTION 'actor tenant is required';
  END IF;

  CASE v_role
    WHEN 'SUPER_ADMIN' THEN
      v_tenant_id := COALESCE(p_requested_tenant_id, p_actor_tenant_id);
      v_branch_id := p_requested_branch_id;
    WHEN 'SUPER_USER' THEN
      v_tenant_id := p_actor_tenant_id;
      v_branch_id := p_requested_branch_id;
    WHEN 'ADMIN' THEN
      v_tenant_id := p_actor_tenant_id;
      v_branch_id := COALESCE(p_actor_branch_id, p_requested_branch_id);
    ELSE
      v_tenant_id := p_actor_tenant_id;
      v_branch_id := COALESCE(p_actor_branch_id, p_requested_branch_id);
      v_restrict_to_user := TRUE;
  END CASE;

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'effective tenant could not be resolved';
  END IF;

  RETURN jsonb_build_object(
    'tenantId', v_tenant_id,
    'branchId', v_branch_id,
    'restrictToUser', v_restrict_to_user
  );
END;
$function$;
