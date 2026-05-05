BEGIN;

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

COMMIT;
