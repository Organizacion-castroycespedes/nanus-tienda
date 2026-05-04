CREATE OR REPLACE FUNCTION public.finance_sync_order_financial_state(
  p_order_id uuid,
  p_tenant_id uuid
)
RETURNS TABLE (
  id uuid,
  total_paid numeric(12, 2),
  balance_due numeric(12, 2),
  payment_status varchar(20)
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH payment_totals AS (
    SELECT COALESCE(
      SUM(
        CASE
          WHEN payment.direction = 'OUT' THEN -allocation.allocated_amount
          ELSE allocation.allocated_amount
        END
      ),
      0
    )::numeric(12, 2) AS total_paid
    FROM payment_allocations AS allocation
    INNER JOIN payments AS payment
      ON payment.id = allocation.payment_id
    WHERE payment.tenant_id = p_tenant_id
      AND allocation.reference_type = 'SALES_ORDER'
      AND allocation.reference_id = p_order_id
      AND payment.status IN ('PENDING', 'COMPLETED')
  ),
  invoice_totals AS (
    SELECT COALESCE(SUM(s.total), 0)::numeric(12, 2) AS invoiced_total
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
      )::numeric(12, 2) AS next_total_paid,
      GREATEST(
        o.total - LEAST(
          o.total,
          COALESCE(payment_totals.total_paid, 0) + COALESCE(invoice_totals.invoiced_total, 0)
        ),
        0
      )::numeric(12, 2) AS next_balance_due,
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
      END::varchar(20) AS next_payment_status
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
SECURITY DEFINER
SET search_path = public
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
$$;
