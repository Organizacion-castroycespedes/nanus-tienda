-- Fase 3.12: inventory_create_sale_v2 con soporte FEFO/lotes.
-- No modifica inventory_create_sale v1.
-- No modifica inventory_invoice_order.
-- No activa v2 desde backend.

CREATE OR REPLACE FUNCTION public.inventory_create_sale_v2(
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
  v_lot_balance RECORD;
  v_sale_item_id UUID;
  v_stock_movement_id UUID;
  v_price NUMERIC(12, 2);
  v_quantity NUMERIC(12, 2);
  v_tax_rate NUMERIC(12, 4);
  v_price_without_tax NUMERIC(12, 2);
  v_tax_total NUMERIC(12, 2);
  v_subtotal NUMERIC(12, 2);
  v_available_stock NUMERIC(12, 2);
  v_stock_before NUMERIC(12, 2);
  v_remaining_lot_quantity NUMERIC(14, 2);
  v_quantity_from_lot NUMERIC(14, 2);
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
      p.requires_lot,
      p.requires_expiration,
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

    IF COALESCE(v_product.requires_lot, FALSE) THEN
      IF EXISTS (
        SELECT 1
        FROM inventory_lot_balances balance
        WHERE balance.tenant_id = p_tenant_id
          AND balance.branch_id = p_branch_id
          AND balance.product_id = v_item.product_id
          AND (
            balance.quantity_on_hand < 0
            OR balance.quantity_reserved < 0
            OR balance.quantity_reserved > balance.quantity_on_hand
          )
        LIMIT 1
      ) THEN
        RAISE EXCEPTION 'invalid lot balance reservation for product %', v_item.product_id;
      END IF;

      IF COALESCE(v_product.requires_expiration, FALSE)
        AND EXISTS (
          SELECT 1
          FROM inventory_lot_balances balance
          INNER JOIN inventory_lots lot
            ON lot.id = balance.lot_id
           AND lot.tenant_id = balance.tenant_id
           AND lot.branch_id = balance.branch_id
           AND lot.product_id = balance.product_id
          WHERE balance.tenant_id = p_tenant_id
            AND balance.branch_id = p_branch_id
            AND balance.product_id = v_item.product_id
            AND balance.quantity_available > 0
            AND lot.status = 'ACTIVE'
            AND lot.expiration_date IS NULL
          LIMIT 1
        ) THEN
        RAISE EXCEPTION 'expiration date is required for lot-controlled product %', v_item.product_id;
      END IF;
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
    )
    RETURNING stock_movements.id INTO v_stock_movement_id;

    IF COALESCE(v_product.requires_lot, FALSE) THEN
      v_remaining_lot_quantity := v_quantity;

      FOR v_lot_balance IN
        SELECT
          balance.id AS balance_id,
          balance.lot_id,
          balance.location_id,
          balance.quantity_available,
          lot.lot_code,
          lot.expiration_date,
          lot.received_at
        FROM inventory_lot_balances balance
        INNER JOIN inventory_lots lot
          ON lot.id = balance.lot_id
         AND lot.tenant_id = balance.tenant_id
         AND lot.branch_id = balance.branch_id
         AND lot.product_id = balance.product_id
        WHERE balance.tenant_id = p_tenant_id
          AND balance.branch_id = p_branch_id
          AND balance.product_id = v_item.product_id
          AND balance.quantity_available > 0
          AND lot.status = 'ACTIVE'
          AND (
            lot.expiration_date IS NULL
            OR lot.expiration_date >= CURRENT_DATE
          )
          AND (
            COALESCE(v_product.requires_expiration, FALSE) = FALSE
            OR lot.expiration_date IS NOT NULL
          )
        ORDER BY
          lot.expiration_date ASC NULLS LAST,
          lot.received_at ASC,
          lot.lot_code ASC,
          lot.id ASC
        FOR UPDATE OF balance
      LOOP
        EXIT WHEN v_remaining_lot_quantity <= 0;

        v_quantity_from_lot := ROUND(
          LEAST(v_remaining_lot_quantity, v_lot_balance.quantity_available),
          2
        );

        IF v_quantity_from_lot <= 0 THEN
          CONTINUE;
        END IF;

        UPDATE inventory_lot_balances AS ilb
        SET
          quantity_on_hand = ilb.quantity_on_hand - v_quantity_from_lot,
          last_movement_at = v_now,
          updated_at = v_now
        WHERE ilb.id = v_lot_balance.balance_id
          AND ilb.tenant_id = p_tenant_id
          AND ilb.branch_id = p_branch_id
          AND ilb.product_id = v_item.product_id
          AND ilb.lot_id = v_lot_balance.lot_id
          AND ilb.quantity_available >= v_quantity_from_lot;

        IF NOT FOUND THEN
          RAISE EXCEPTION 'insufficient FEFO lot stock for product %', v_item.product_id;
        END IF;

        INSERT INTO stock_movement_lots (
          id,
          tenant_id,
          stock_movement_id,
          product_id,
          lot_id,
          location_id,
          quantity,
          created_at
        ) VALUES (
          gen_random_uuid(),
          p_tenant_id,
          v_stock_movement_id,
          v_item.product_id,
          v_lot_balance.lot_id,
          v_lot_balance.location_id,
          v_quantity_from_lot,
          v_now
        );

        v_remaining_lot_quantity := ROUND(
          v_remaining_lot_quantity - v_quantity_from_lot,
          2
        );
      END LOOP;

      IF v_remaining_lot_quantity > 0 THEN
        RAISE EXCEPTION 'insufficient FEFO lot stock for product %', v_item.product_id;
      END IF;
    END IF;

    IF v_item.order_item_id IS NOT NULL THEN
      UPDATE order_items AS oi_update
      SET
        delivered_quantity = oi_update.delivered_quantity + v_quantity,
        billed_quantity = COALESCE(oi_update.billed_quantity, 0) + v_quantity
      WHERE oi_update.id = v_item.order_item_id
        AND oi_update.order_id = p_order_id;
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
      COUNT(*) FILTER (WHERE oi.delivered_quantity = 0)::INTEGER,
      COUNT(*) FILTER (WHERE oi.delivered_quantity >= oi.ordered_quantity)::INTEGER
    INTO
      v_order_items_total,
      v_order_items_zero_delivered,
      v_order_items_completed
    FROM order_items oi
    WHERE oi.order_id = p_order_id;

    UPDATE orders AS o_update
    SET status = CASE
      WHEN v_order_items_total = 0 THEN 'CONFIRMED'
      WHEN v_order_items_zero_delivered = v_order_items_total THEN 'CONFIRMED'
      WHEN v_order_items_completed = v_order_items_total THEN 'COMPLETED'
      ELSE 'PARTIAL'
    END
    WHERE o_update.id = p_order_id
      AND o_update.tenant_id = p_tenant_id;
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
