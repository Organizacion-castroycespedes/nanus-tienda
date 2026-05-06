-- Sync script generated from local source migrations to align AWS manus_tienda with local manus_tienda_prd
-- Generated on 2026-05-05
BEGIN;

-- Sales status and supporting indexes
ALTER TABLE sales
  DROP CONSTRAINT IF EXISTS chk_sales_status;

ALTER TABLE sales
  ADD CONSTRAINT chk_sales_status
    CHECK (status IN ('DRAFT', 'CONFIRMED', 'CANCELLED', 'REFUNDED'));

CREATE INDEX IF NOT EXISTS idx_sales_tenant_branch_status
  ON sales (tenant_id, branch_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_stock_movements_tenant_branch_product
  ON stock_movements (tenant_id, branch_id, product_id, created_at DESC);

-- Finance cash session summary
CREATE OR REPLACE FUNCTION finance_cash_session_summary(
  p_tenant_id UUID,
  p_cash_session_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_payload JSONB;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM cash_sessions AS session
    WHERE session.id = p_cash_session_id
      AND session.tenant_id = p_tenant_id
  ) THEN
    RETURN NULL;
  END IF;

  WITH session_scope AS (
    SELECT
      session.id,
      session.tenant_id,
      session.branch_id,
      session.cash_register_id,
      register.codigo AS cash_register_codigo,
      register.nombre AS cash_register_nombre,
      register.terminal_id,
      terminal.name AS terminal_name,
      session.opened_by_user_id,
      opened_user.email AS opened_by_user_email,
      session.closed_by_user_id,
      closed_user.email AS closed_by_user_email,
      session.opened_at,
      session.closed_at,
      session.opening_amount,
      session.closing_amount,
      session.expected_amount,
      session.difference_amount,
      session.status
    FROM cash_sessions AS session
    INNER JOIN cash_registers AS register
      ON register.id = session.cash_register_id
     AND register.tenant_id = session.tenant_id
    LEFT JOIN terminals AS terminal
      ON terminal.id = register.terminal_id
     AND terminal.tenant_id = session.tenant_id
    LEFT JOIN users AS opened_user
      ON opened_user.id = session.opened_by_user_id
     AND opened_user.tenant_id = session.tenant_id
    LEFT JOIN users AS closed_user
      ON closed_user.id = session.closed_by_user_id
     AND closed_user.tenant_id = session.tenant_id
    WHERE session.id = p_cash_session_id
      AND session.tenant_id = p_tenant_id
  ),
  movement_scope AS (
    SELECT
      movement.id,
      movement.movement_type,
      movement.direction,
      movement.reference_type,
      movement.reference_id,
      movement.amount,
      movement.description,
      movement.created_by,
      creator.email AS created_by_email,
      movement.created_at
    FROM cash_movements AS movement
    LEFT JOIN users AS creator
      ON creator.id = movement.created_by
     AND creator.tenant_id = movement.tenant_id
    WHERE movement.tenant_id = p_tenant_id
      AND movement.cash_session_id = p_cash_session_id
  ),
  payment_scope AS (
    SELECT
      payment.id,
      payment.payment_method_id,
      method.nombre AS payment_method_nombre,
      method.tipo AS payment_method_tipo,
      payment.reference_type,
      payment.reference_id,
      payment.direction,
      payment.amount,
      payment.status,
      payment.created_at
    FROM payments AS payment
    INNER JOIN payment_methods AS method
      ON method.id = payment.payment_method_id
     AND method.tenant_id = payment.tenant_id
    WHERE payment.tenant_id = p_tenant_id
      AND payment.cash_session_id = p_cash_session_id
      AND payment.status IN ('PENDING', 'COMPLETED')
  ),
  totals AS (
    SELECT
      session.opening_amount AS opening_amount,
      COALESCE((
        SELECT SUM(payment.amount)
        FROM payment_scope AS payment
        WHERE payment.direction = 'IN'
      ), 0) AS payments_in,
      COALESCE((
        SELECT SUM(payment.amount)
        FROM payment_scope AS payment
        WHERE payment.direction = 'OUT'
      ), 0) AS payments_out,
      COALESCE((
        SELECT SUM(movement.amount)
        FROM movement_scope AS movement
        WHERE movement.movement_type = 'EXPENSE'
      ), 0) AS expenses,
      COALESCE((
        SELECT SUM(movement.amount)
        FROM movement_scope AS movement
        WHERE movement.movement_type = 'WITHDRAWAL'
      ), 0) AS withdrawals,
      COALESCE((
        SELECT SUM(movement.amount)
        FROM movement_scope AS movement
        WHERE movement.movement_type = 'ADJUSTMENT'
          AND movement.direction = 'IN'
      ), 0) AS adjustments_in,
      COALESCE((
        SELECT SUM(movement.amount)
        FROM movement_scope AS movement
        WHERE movement.movement_type = 'ADJUSTMENT'
          AND movement.direction = 'OUT'
      ), 0) AS adjustments_out,
      COALESCE((
        SELECT SUM(movement.amount)
        FROM movement_scope AS movement
        WHERE movement.movement_type = 'CLOSING'
          AND movement.direction = 'OUT'
      ), 0) AS closing_recorded,
      COALESCE((
        SELECT SUM(payment.amount)
        FROM payment_scope AS payment
        WHERE payment.reference_type = 'SALE'
          AND payment.direction = 'IN'
      ), 0) AS sales_payments,
      COALESCE((
        SELECT SUM(payment.amount)
        FROM payment_scope AS payment
        WHERE payment.reference_type IN ('PURCHASE', 'PURCHASE_ORDER')
          AND payment.direction = 'OUT'
      ), 0) AS purchase_payments,
      COALESCE((
        SELECT SUM(payment.amount)
        FROM payment_scope AS payment
        WHERE payment.reference_type = 'REFUND'
          AND payment.direction = 'OUT'
      ), 0) AS refund_payments,
      COALESCE((
        SELECT COUNT(*)::INTEGER
        FROM movement_scope
      ), 0) AS movement_count,
      COALESCE((
        SELECT COUNT(*)::INTEGER
        FROM payment_scope
      ), 0) AS payment_count
    FROM session_scope AS session
  ),
  expected AS (
    SELECT
      COALESCE((
        SELECT SUM(
          CASE
            WHEN movement.direction = 'IN' THEN movement.amount
            ELSE -movement.amount
          END
        )
        FROM movement_scope AS movement
        WHERE movement.movement_type <> 'CLOSING'
      ), 0) AS expected_amount
  ),
  last_count AS (
    SELECT
      count.id,
      count.counted_cash_amount,
      count.expected_amount,
      count.difference_amount,
      count.notes,
      count.counted_by_user_id,
      user_data.email AS counted_by_user_email,
      count.counted_at
    FROM cash_counts AS count
    LEFT JOIN users AS user_data
      ON user_data.id = count.counted_by_user_id
     AND user_data.tenant_id = count.tenant_id
    WHERE count.tenant_id = p_tenant_id
      AND count.cash_session_id = p_cash_session_id
    ORDER BY count.counted_at DESC, count.created_at DESC, count.id DESC
    LIMIT 1
  ),
  payment_breakdown AS (
    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'paymentMethodId', payment.payment_method_id,
          'paymentMethodNombre', payment.payment_method_nombre,
          'paymentMethodTipo', payment.payment_method_tipo,
          'direction', payment.direction,
          'count', payment.total_count,
          'total', payment.total_amount
        )
        ORDER BY payment.payment_method_tipo, payment.payment_method_nombre, payment.direction
      ),
      '[]'::jsonb
    ) AS data
    FROM (
      SELECT
        scope.payment_method_id,
        scope.payment_method_nombre,
        scope.payment_method_tipo,
        scope.direction,
        COUNT(*)::INTEGER AS total_count,
        ROUND(SUM(scope.amount), 2) AS total_amount
      FROM payment_scope AS scope
      GROUP BY
        scope.payment_method_id,
        scope.payment_method_nombre,
        scope.payment_method_tipo,
        scope.direction
    ) AS payment
  ),
  movement_breakdown AS (
    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'movementType', movement.movement_type,
          'direction', movement.direction,
          'count', movement.total_count,
          'total', movement.total_amount
        )
        ORDER BY movement.movement_type, movement.direction
      ),
      '[]'::jsonb
    ) AS data
    FROM (
      SELECT
        scope.movement_type,
        scope.direction,
        COUNT(*)::INTEGER AS total_count,
        ROUND(SUM(scope.amount), 2) AS total_amount
      FROM movement_scope AS scope
      GROUP BY scope.movement_type, scope.direction
    ) AS movement
  ),
  recent_movements AS (
    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'id', movement.id,
          'movementType', movement.movement_type,
          'direction', movement.direction,
          'referenceType', movement.reference_type,
          'referenceId', movement.reference_id,
          'amount', movement.amount,
          'description', movement.description,
          'createdBy', movement.created_by,
          'createdByEmail', movement.created_by_email,
          'createdAt', movement.created_at
        )
        ORDER BY movement.created_at DESC
      ),
      '[]'::jsonb
    ) AS data
    FROM (
      SELECT *
      FROM movement_scope
      ORDER BY created_at DESC
      LIMIT 8
    ) AS movement
  )
  SELECT jsonb_build_object(
    'sessionId', session.id,
    'tenantId', session.tenant_id,
    'branchId', session.branch_id,
    'cashRegisterId', session.cash_register_id,
    'cashRegisterCodigo', session.cash_register_codigo,
    'cashRegisterNombre', session.cash_register_nombre,
    'terminalId', session.terminal_id,
    'terminalName', session.terminal_name,
    'openedByUserId', session.opened_by_user_id,
    'openedByUserEmail', session.opened_by_user_email,
    'closedByUserId', session.closed_by_user_id,
    'closedByUserEmail', session.closed_by_user_email,
    'openedAt', session.opened_at,
    'closedAt', session.closed_at,
    'status', session.status,
    'totals', jsonb_build_object(
      'openingAmount', ROUND(totals.opening_amount, 2),
      'paymentsIn', ROUND(totals.payments_in, 2),
      'paymentsOut', ROUND(totals.payments_out, 2),
      'expenses', ROUND(totals.expenses, 2),
      'withdrawals', ROUND(totals.withdrawals, 2),
      'adjustmentsIn', ROUND(totals.adjustments_in, 2),
      'adjustmentsOut', ROUND(totals.adjustments_out, 2),
      'closingRecorded', ROUND(totals.closing_recorded, 2),
      'salesPayments', ROUND(totals.sales_payments, 2),
      'purchasePayments', ROUND(totals.purchase_payments, 2),
      'refundPayments', ROUND(totals.refund_payments, 2),
      'expectedAmount', ROUND(expected.expected_amount, 2),
      'netAmount', ROUND(totals.opening_amount + expected.expected_amount - totals.opening_amount, 2),
      'movementCount', totals.movement_count,
      'paymentCount', totals.payment_count
    ),
    'paymentBreakdown', payment_breakdown.data,
    'movementBreakdown', movement_breakdown.data,
    'recentMovements', recent_movements.data,
    'lastCount', CASE
      WHEN last_count.id IS NULL THEN NULL
      ELSE jsonb_build_object(
        'id', last_count.id,
        'countedCashAmount', ROUND(last_count.counted_cash_amount, 2),
        'expectedAmount', ROUND(last_count.expected_amount, 2),
        'differenceAmount', ROUND(last_count.difference_amount, 2),
        'notes', last_count.notes,
        'countedByUserId', last_count.counted_by_user_id,
        'countedByUserEmail', last_count.counted_by_user_email,
        'countedAt', last_count.counted_at
      )
    END
  )
  INTO v_payload
  FROM session_scope AS session
  CROSS JOIN totals
  CROSS JOIN expected
  CROSS JOIN payment_breakdown
  CROSS JOIN movement_breakdown
  CROSS JOIN recent_movements
  LEFT JOIN last_count ON TRUE;

  RETURN v_payload;
END;
$$;

-- Missing finance function detected in compare
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

-- Reporting scope base function
CREATE OR REPLACE FUNCTION public.report_resolve_pos_scope(
  p_actor_role TEXT,
  p_actor_tenant_id UUID,
  p_actor_branch_id UUID,
  p_requested_tenant_id UUID,
  p_requested_branch_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
AS $$
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
$$;

-- POS reporting functions with latest user-scope fixes
CREATE OR REPLACE FUNCTION public.report_pos_sales(
  p_actor_user_id UUID,
  p_actor_role TEXT,
  p_actor_tenant_id UUID,
  p_actor_branch_id UUID,
  p_tenant_id UUID DEFAULT NULL,
  p_branch_id UUID DEFAULT NULL,
  p_date_from TIMESTAMPTZ DEFAULT NULL,
  p_date_to TIMESTAMPTZ DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
AS $$
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
$$;

CREATE OR REPLACE FUNCTION public.report_pos_sale_ticket(
  p_actor_user_id UUID,
  p_actor_role TEXT,
  p_actor_tenant_id UUID,
  p_actor_branch_id UUID,
  p_sale_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
AS $$
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
    'paymentBreakdown', COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'method', grouped.method,
            'amount', grouped.amount
          )
          ORDER BY grouped.method ASC
        )
        FROM (
          SELECT
            COALESCE(NULLIF(BTRIM(payment.payment_method_name), ''), 'SIN METODO') AS method,
            SUM(payment.amount)::NUMERIC(14, 2) AS amount
          FROM payment_rows AS payment
          GROUP BY COALESCE(NULLIF(BTRIM(payment.payment_method_name), ''), 'SIN METODO')
        ) AS grouped
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
$$;

CREATE OR REPLACE FUNCTION public.report_pos_sale_cancel_ticket(
  p_actor_user_id UUID,
  p_actor_role TEXT,
  p_actor_tenant_id UUID,
  p_actor_branch_id UUID,
  p_sale_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
AS $$
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
$$;

-- Cash reporting functions
CREATE OR REPLACE FUNCTION public.report_cash_closings(
  p_actor_user_id UUID,
  p_actor_role TEXT,
  p_actor_tenant_id UUID,
  p_actor_branch_id UUID,
  p_tenant_id UUID DEFAULT NULL,
  p_branch_id UUID DEFAULT NULL,
  p_date_from TIMESTAMPTZ DEFAULT NULL,
  p_date_to TIMESTAMPTZ DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
AS $$
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
$$;

CREATE OR REPLACE FUNCTION public.report_cash_closing_ticket(
  p_actor_user_id UUID,
  p_actor_role TEXT,
  p_actor_tenant_id UUID,
  p_actor_branch_id UUID,
  p_cash_session_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
AS $$
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
$$;

CREATE OR REPLACE FUNCTION public.report_cash_audit(
  p_actor_user_id UUID,
  p_actor_role TEXT,
  p_actor_tenant_id UUID,
  p_actor_branch_id UUID,
  p_tenant_id UUID DEFAULT NULL,
  p_branch_id UUID DEFAULT NULL,
  p_date_from TIMESTAMPTZ DEFAULT NULL,
  p_date_to TIMESTAMPTZ DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
AS $$
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
$$;

CREATE OR REPLACE FUNCTION public.report_cash_audit_ticket(
  p_actor_user_id UUID,
  p_actor_role TEXT,
  p_actor_tenant_id UUID,
  p_actor_branch_id UUID,
  p_cash_count_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
AS $$
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
$$;

-- Business reporting functions
CREATE OR REPLACE FUNCTION public.report_purchases(
  p_actor_user_id UUID,
  p_actor_role TEXT,
  p_actor_tenant_id UUID,
  p_actor_branch_id UUID,
  p_tenant_id UUID DEFAULT NULL,
  p_branch_id UUID DEFAULT NULL,
  p_date_from TIMESTAMPTZ DEFAULT NULL,
  p_date_to TIMESTAMPTZ DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
AS $$
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
$$;

CREATE OR REPLACE FUNCTION public.report_purchase_ticket(
  p_actor_user_id UUID,
  p_actor_role TEXT,
  p_actor_tenant_id UUID,
  p_actor_branch_id UUID,
  p_purchase_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
AS $$
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
$$;

CREATE OR REPLACE FUNCTION public.report_orders_sales(
  p_actor_user_id UUID,
  p_actor_role TEXT,
  p_actor_tenant_id UUID,
  p_actor_branch_id UUID,
  p_tenant_id UUID DEFAULT NULL,
  p_branch_id UUID DEFAULT NULL,
  p_date_from TIMESTAMPTZ DEFAULT NULL,
  p_date_to TIMESTAMPTZ DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
AS $$
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
$$;

CREATE OR REPLACE FUNCTION public.report_order_sale_ticket(
  p_actor_user_id UUID,
  p_actor_role TEXT,
  p_actor_tenant_id UUID,
  p_actor_branch_id UUID,
  p_order_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
AS $$
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
$$;

CREATE OR REPLACE FUNCTION public.report_customer_orders_status(
  p_actor_user_id UUID,
  p_actor_role TEXT,
  p_actor_tenant_id UUID,
  p_actor_branch_id UUID,
  p_tenant_id UUID DEFAULT NULL,
  p_branch_id UUID DEFAULT NULL,
  p_date_from TIMESTAMPTZ DEFAULT NULL,
  p_date_to TIMESTAMPTZ DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
AS $$
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
$$;

COMMIT;

