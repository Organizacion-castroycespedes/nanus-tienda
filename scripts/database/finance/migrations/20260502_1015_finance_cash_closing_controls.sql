CREATE TABLE IF NOT EXISTS cash_counts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES tenant_branches(id) ON DELETE RESTRICT,
  cash_session_id UUID NOT NULL REFERENCES cash_sessions(id) ON DELETE CASCADE,
  counted_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  counted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  counted_cash_amount NUMERIC(14, 2) NOT NULL,
  expected_amount NUMERIC(14, 2) NOT NULL,
  difference_amount NUMERIC(14, 2) NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT cash_counts_counted_cash_amount_check CHECK (counted_cash_amount >= 0),
  CONSTRAINT cash_counts_expected_amount_check CHECK (expected_amount >= 0),
  CONSTRAINT cash_counts_notes_not_blank_check CHECK (
    notes IS NULL OR btrim(notes) <> ''
  )
);

CREATE INDEX IF NOT EXISTS idx_cash_counts_tenant
  ON cash_counts(tenant_id);

CREATE INDEX IF NOT EXISTS idx_cash_counts_branch
  ON cash_counts(branch_id);

CREATE INDEX IF NOT EXISTS idx_cash_counts_session
  ON cash_counts(cash_session_id);

CREATE INDEX IF NOT EXISTS idx_cash_counts_counted_at
  ON cash_counts(counted_at DESC);

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
