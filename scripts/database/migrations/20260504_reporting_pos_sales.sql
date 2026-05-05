BEGIN;

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
  v_role TEXT := UPPER(COALESCE(NULLIF(BTRIM(p_actor_role), ''), 'USER'));
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
        OR EXISTS (
          SELECT 1
          FROM pos_user_sessions AS actor_session
          WHERE actor_session.id = s.pos_session_id
            AND actor_session.tenant_id = s.tenant_id
            AND actor_session.user_id = p_actor_user_id
            AND actor_session.is_active = TRUE
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
        OR EXISTS (
          SELECT 1
          FROM pos_user_sessions AS actor_session
          WHERE actor_session.id = s.pos_session_id
            AND actor_session.tenant_id = s.tenant_id
            AND actor_session.user_id = p_actor_user_id
            AND actor_session.is_active = TRUE
        )
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
        OR EXISTS (
          SELECT 1
          FROM pos_user_sessions AS actor_session
          WHERE actor_session.id = s.pos_session_id
            AND actor_session.tenant_id = s.tenant_id
            AND actor_session.user_id = p_actor_user_id
            AND actor_session.is_active = TRUE
        )
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

COMMIT;
