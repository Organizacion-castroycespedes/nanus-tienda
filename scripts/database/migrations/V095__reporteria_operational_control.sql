BEGIN;

DROP FUNCTION IF EXISTS public.report_operational_control(
  UUID, TEXT, UUID, UUID, UUID, UUID, UUID, UUID, TIMESTAMPTZ, TIMESTAMPTZ, TEXT
);

CREATE OR REPLACE FUNCTION public.report_operational_control(
  p_actor_user_id UUID,
  p_actor_role TEXT,
  p_actor_tenant_id UUID,
  p_actor_branch_id UUID DEFAULT NULL,
  p_requested_tenant_id UUID DEFAULT NULL,
  p_requested_branch_id UUID DEFAULT NULL,
  p_requested_terminal_id UUID DEFAULT NULL,
  p_requested_cashier_id UUID DEFAULT NULL,
  p_date_from TIMESTAMPTZ DEFAULT NULL,
  p_date_to TIMESTAMPTZ DEFAULT NULL,
  p_bucket TEXT DEFAULT 'day'
) RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY INVOKER
AS $$
DECLARE
  v_tenant UUID;
  v_branch UUID;
  v_terminal UUID := p_requested_terminal_id;
  v_cashier UUID := p_requested_cashier_id;
  v_role TEXT := UPPER(COALESCE(NULLIF(BTRIM(p_actor_role), ''), 'USER'));
  v_payload JSONB;
BEGIN
  IF p_date_from IS NULL OR p_date_to IS NULL OR p_date_to <= p_date_from THEN
    RAISE EXCEPTION 'valid half-open date range is required';
  END IF;
  IF p_bucket NOT IN ('hour', 'day') THEN
    RAISE EXCEPTION 'unsupported report bucket';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.tenants t WHERE t.id = p_actor_tenant_id) THEN
    RAISE EXCEPTION 'actor tenant is not valid';
  END IF;

  IF v_role = 'SUPER_ADMIN' THEN
    v_tenant := COALESCE(p_requested_tenant_id, p_actor_tenant_id);
    v_branch := p_requested_branch_id;
  ELSIF v_role = 'SUPER_USER' THEN
    IF p_requested_tenant_id IS NOT NULL AND p_requested_tenant_id <> p_actor_tenant_id THEN
      RAISE EXCEPTION 'tenant filter is outside actor scope';
    END IF;
    v_tenant := p_actor_tenant_id;
    v_branch := p_requested_branch_id;
  ELSIF v_role = 'ADMIN' THEN
    v_tenant := p_actor_tenant_id;
    v_branch := p_actor_branch_id;
    IF v_branch IS NULL THEN
      RAISE EXCEPTION 'admin branch scope is required';
    END IF;
    IF p_requested_branch_id IS NOT NULL AND p_requested_branch_id <> v_branch THEN
      RAISE EXCEPTION 'branch filter is outside actor scope';
    END IF;
  ELSE
    v_tenant := p_actor_tenant_id;
    v_branch := p_actor_branch_id;
    IF p_requested_tenant_id IS NOT NULL AND p_requested_tenant_id <> v_tenant THEN
      RAISE EXCEPTION 'tenant filter is outside actor scope';
    END IF;
    IF v_branch IS NOT NULL AND p_requested_branch_id IS NOT NULL AND p_requested_branch_id <> v_branch THEN
      RAISE EXCEPTION 'branch filter is outside actor scope';
    END IF;
    IF p_requested_cashier_id IS NOT NULL AND p_requested_cashier_id <> p_actor_user_id THEN
      RAISE EXCEPTION 'cashier filter is outside actor scope';
    END IF;
    v_cashier := p_actor_user_id;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.tenants t WHERE t.id = v_tenant) THEN
    RAISE EXCEPTION 'tenant filter is outside actor scope';
  END IF;
  IF v_branch IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.tenant_branches b
    WHERE b.id = v_branch AND b.tenant_id = v_tenant AND b.estado = 'ACTIVE'
  ) THEN
    RAISE EXCEPTION 'branch filter is outside actor scope';
  END IF;
  IF v_terminal IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.terminals t
    WHERE t.id = v_terminal AND t.tenant_id = v_tenant
      AND (v_branch IS NULL OR t.branch_id = v_branch) AND t.is_active
  ) THEN
    RAISE EXCEPTION 'terminal filter is outside actor scope';
  END IF;
  IF v_cashier IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.users u WHERE u.id = v_cashier AND u.tenant_id = v_tenant
  ) THEN
    RAISE EXCEPTION 'cashier filter is outside actor scope';
  END IF;

  WITH sale_scope AS (
    SELECT s.id, s.tenant_id, s.branch_id, s.terminal_id, s.user_id,
           s.created_at, s.status, s.total::NUMERIC(14,2) AS total
    FROM public.sales s
    WHERE s.tenant_id = v_tenant
      AND (v_branch IS NULL OR s.branch_id = v_branch)
      AND (v_terminal IS NULL OR s.terminal_id = v_terminal)
      AND (v_cashier IS NULL OR s.user_id = v_cashier)
      AND s.created_at >= p_date_from AND s.created_at < p_date_to
  ),
  sales_by_bucket AS (
    SELECT date_trunc(p_bucket, created_at AT TIME ZONE 'America/Bogota') AS bucket,
           COUNT(*)::INTEGER AS transactions, COALESCE(SUM(total), 0)::NUMERIC(14,2) AS total
    FROM sale_scope GROUP BY 1
  ),
  payment_by_method AS (
    SELECT COALESCE(NULLIF(BTRIM(pm.nombre), ''), 'Sin método') AS label,
           COALESCE(SUM(p.amount), 0)::NUMERIC(14,2) AS total
    FROM public.payments p
    INNER JOIN sale_scope s ON s.id = p.reference_id AND p.reference_type = 'SALE'
    LEFT JOIN public.payment_methods pm ON pm.id = p.payment_method_id AND pm.tenant_id = p.tenant_id
    WHERE p.tenant_id = v_tenant AND p.direction = 'IN' AND p.status IN ('PENDING', 'COMPLETED')
    GROUP BY 1 ORDER BY total DESC, label
  ),
  cash_by_bucket AS (
    SELECT date_trunc(p_bucket, m.created_at AT TIME ZONE 'America/Bogota') AS bucket,
           COALESCE(SUM(m.amount) FILTER (WHERE m.direction = 'IN'), 0)::NUMERIC(14,2) AS cash_in,
           COALESCE(SUM(m.amount) FILTER (WHERE m.direction = 'OUT'), 0)::NUMERIC(14,2) AS cash_out
    FROM public.cash_movements m
    INNER JOIN public.cash_sessions cs ON cs.id = m.cash_session_id AND cs.tenant_id = m.tenant_id
    INNER JOIN public.cash_registers cr ON cr.id = cs.cash_register_id AND cr.tenant_id = m.tenant_id
    WHERE m.tenant_id = v_tenant AND (v_branch IS NULL OR m.branch_id = v_branch)
      AND (v_terminal IS NULL OR cr.terminal_id = v_terminal)
      AND (v_cashier IS NULL OR m.created_by = v_cashier)
      AND m.created_at >= p_date_from AND m.created_at < p_date_to
    GROUP BY 1
  ),
  order_state AS (
    SELECT CASE WHEN o.status = 'CANCELLED' THEN 'CANCELLED'
                WHEN COALESCE(SUM(p.amount) FILTER (WHERE p.status IN ('PENDING', 'COMPLETED') AND p.direction = 'IN'), 0) >= o.total THEN 'COMPLETED'
                WHEN COALESCE(SUM(p.amount) FILTER (WHERE p.status IN ('PENDING', 'COMPLETED') AND p.direction = 'IN'), 0) > 0 THEN 'PARTIAL'
                ELSE 'PENDING' END AS state
    FROM public.orders o
    LEFT JOIN public.payments p ON p.tenant_id = o.tenant_id AND p.reference_type = 'SALES_ORDER' AND p.reference_id = o.id
    LEFT JOIN public.cash_sessions cs ON cs.id = p.cash_session_id AND cs.tenant_id = p.tenant_id
    LEFT JOIN public.cash_registers cr ON cr.id = cs.cash_register_id AND cr.tenant_id = p.tenant_id
    WHERE o.tenant_id = v_tenant AND o.created_at >= p_date_from AND o.created_at < p_date_to
      AND (v_branch IS NULL OR p.branch_id = v_branch)
      AND (v_terminal IS NULL OR cr.terminal_id = v_terminal)
      AND (v_cashier IS NULL OR p.created_by = v_cashier)
    GROUP BY o.id, o.status, o.total
  ),
  open_cash AS (
    SELECT COUNT(*)::INTEGER AS sessions, COUNT(DISTINCT cs.opened_by_user_id)::INTEGER AS cashiers
    FROM public.cash_sessions cs
    INNER JOIN public.cash_registers cr ON cr.id = cs.cash_register_id AND cr.tenant_id = cs.tenant_id
    WHERE cs.tenant_id = v_tenant AND cs.status = 'OPEN'
      AND (v_branch IS NULL OR cs.branch_id = v_branch)
      AND (v_terminal IS NULL OR cr.terminal_id = v_terminal)
      AND (v_cashier IS NULL OR cs.opened_by_user_id = v_cashier)
  ),
  differences AS (
    SELECT COALESCE(SUM(cs.difference_amount), 0)::NUMERIC(14,2) AS difference
    FROM public.cash_sessions cs
    INNER JOIN public.cash_registers cr ON cr.id = cs.cash_register_id AND cr.tenant_id = cs.tenant_id
    WHERE cs.tenant_id = v_tenant AND cs.status = 'CLOSED'
      AND (v_branch IS NULL OR cs.branch_id = v_branch)
      AND (v_terminal IS NULL OR cr.terminal_id = v_terminal)
      AND (v_cashier IS NULL OR cs.opened_by_user_id = v_cashier)
      AND cs.closed_at >= p_date_from AND cs.closed_at < p_date_to
  )
  SELECT jsonb_build_object(
    'filters', jsonb_build_object('tenantId', v_tenant, 'branchId', v_branch, 'terminalId', v_terminal, 'cashierId', v_cashier, 'dateFrom', p_date_from, 'dateTo', p_date_to, 'bucket', p_bucket, 'actorRole', v_role),
    'metrics', jsonb_build_object(
      'netSales', COALESCE((SELECT SUM(total) FROM sale_scope), 0),
      'transactions', COALESCE((SELECT COUNT(*) FROM sale_scope), 0),
      'openCashSessions', (SELECT sessions FROM open_cash),
      'activeCashiers', (SELECT cashiers FROM open_cash),
      'pendingOrders', COALESCE((SELECT COUNT(*) FROM order_state WHERE state = 'PENDING'), 0),
      'cashDifference', (SELECT difference FROM differences)
    ),
    'summaries', jsonb_build_object(
      'purchases', jsonb_build_object('count', (SELECT COUNT(*) FROM public.purchases p LEFT JOIN public.cash_sessions pcs ON pcs.id = p.cash_session_id AND pcs.tenant_id = p.tenant_id LEFT JOIN public.cash_registers pcr ON pcr.id = pcs.cash_register_id AND pcr.tenant_id = p.tenant_id WHERE p.tenant_id = v_tenant AND p.created_at >= p_date_from AND p.created_at < p_date_to AND (v_branch IS NULL OR pcs.branch_id = v_branch) AND (v_terminal IS NULL OR pcr.terminal_id = v_terminal) AND (v_cashier IS NULL OR EXISTS (SELECT 1 FROM public.payments pp WHERE pp.tenant_id = p.tenant_id AND pp.cash_session_id = p.cash_session_id AND pp.created_by = v_cashier))), 'total', COALESCE((SELECT SUM(p.total) FROM public.purchases p LEFT JOIN public.cash_sessions pcs ON pcs.id = p.cash_session_id AND pcs.tenant_id = p.tenant_id LEFT JOIN public.cash_registers pcr ON pcr.id = pcs.cash_register_id AND pcr.tenant_id = p.tenant_id WHERE p.tenant_id = v_tenant AND p.created_at >= p_date_from AND p.created_at < p_date_to AND (v_branch IS NULL OR pcs.branch_id = v_branch) AND (v_terminal IS NULL OR pcr.terminal_id = v_terminal) AND (v_cashier IS NULL OR EXISTS (SELECT 1 FROM public.payments pp WHERE pp.tenant_id = p.tenant_id AND pp.cash_session_id = p.cash_session_id AND pp.created_by = v_cashier))), 0)),
      'customers', jsonb_build_object('active', (SELECT COUNT(DISTINCT o.customer_id) FROM public.orders o WHERE o.tenant_id = v_tenant AND o.created_at >= p_date_from AND o.created_at < p_date_to AND EXISTS (SELECT 1 FROM public.payments op LEFT JOIN public.cash_sessions ocs ON ocs.id = op.cash_session_id AND ocs.tenant_id = op.tenant_id LEFT JOIN public.cash_registers ocr ON ocr.id = ocs.cash_register_id AND ocr.tenant_id = op.tenant_id WHERE op.tenant_id = o.tenant_id AND op.reference_type = 'SALES_ORDER' AND op.reference_id = o.id AND (v_branch IS NULL OR op.branch_id = v_branch) AND (v_terminal IS NULL OR ocr.terminal_id = v_terminal) AND (v_cashier IS NULL OR op.created_by = v_cashier))))
    ),
    'charts', jsonb_build_object(
      'salesEvolution', COALESCE((SELECT jsonb_agg(jsonb_build_object('bucket', bucket, 'transactions', transactions, 'total', total) ORDER BY bucket) FROM sales_by_bucket), '[]'::JSONB),
      'paymentMethods', COALESCE((SELECT jsonb_agg(jsonb_build_object('label', label, 'total', total) ORDER BY total DESC) FROM payment_by_method), '[]'::JSONB),
      'cashMovements', COALESCE((SELECT jsonb_agg(jsonb_build_object('bucket', bucket, 'cashIn', cash_in, 'cashOut', cash_out) ORDER BY bucket) FROM cash_by_bucket), '[]'::JSONB),
      'ordersByState', jsonb_build_object('pending', COALESCE((SELECT COUNT(*) FROM order_state WHERE state = 'PENDING'), 0), 'partial', COALESCE((SELECT COUNT(*) FROM order_state WHERE state = 'PARTIAL'), 0), 'completed', COALESCE((SELECT COUNT(*) FROM order_state WHERE state = 'COMPLETED'), 0))
    ),
    'filterOptions', jsonb_build_object(
      'tenants', CASE WHEN v_role = 'SUPER_ADMIN' THEN COALESCE((SELECT jsonb_agg(jsonb_build_object('id', t.id, 'label', t.nombre) ORDER BY t.nombre) FROM public.tenants t), '[]'::JSONB) ELSE '[]'::JSONB END,
      'branches', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', b.id, 'label', b.nombre) ORDER BY b.nombre) FROM public.tenant_branches b WHERE b.tenant_id = v_tenant AND b.estado = 'ACTIVE' AND (v_role IN ('SUPER_ADMIN', 'SUPER_USER') OR b.id = v_branch)), '[]'::JSONB),
      'cashiers', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', u.id, 'label', COALESCE(NULLIF(BTRIM(CONCAT_WS(' ', pe.nombres, pe.apellidos)), ''), u.email)) ORDER BY u.email) FROM public.users u LEFT JOIN public.personas pe ON pe.id = u.persona_id AND pe.tenant_id = u.tenant_id WHERE u.tenant_id = v_tenant AND u.estado = 'ACTIVE' AND (v_branch IS NULL OR EXISTS (SELECT 1 FROM public.persona_tenant_branches upb WHERE upb.persona_id = u.persona_id AND upb.tenant_branch_id = v_branch AND upb.tenant_id = v_tenant)) AND (v_role <> 'USER' OR u.id = p_actor_user_id)), '[]'::JSONB),
      'terminals', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', t.id, 'label', t.name) ORDER BY t.name) FROM public.terminals t WHERE t.tenant_id = v_tenant AND t.is_active AND (v_branch IS NULL OR t.branch_id = v_branch) AND (v_role <> 'USER' OR EXISTS (SELECT 1 FROM public.sales us WHERE us.tenant_id = t.tenant_id AND us.terminal_id = t.id AND us.user_id = p_actor_user_id) OR EXISTS (SELECT 1 FROM public.cash_sessions ucs JOIN public.cash_registers ucr ON ucr.id = ucs.cash_register_id AND ucr.tenant_id = ucs.tenant_id WHERE ucs.tenant_id = t.tenant_id AND ucr.terminal_id = t.id AND ucs.opened_by_user_id = p_actor_user_id))), '[]'::JSONB)
    ),
    'details', jsonb_build_object(
      'sales', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', s.id, 'createdAt', s.created_at, 'branch', b.nombre, 'terminal', t.name, 'cashierId', s.user_id, 'cashier', COALESCE(NULLIF(BTRIM(CONCAT_WS(' ', pe.nombres, pe.apellidos)), ''), u.email), 'transactions', 1, 'amount', s.total) ORDER BY s.created_at DESC) FROM public.sales s JOIN public.tenant_branches b ON b.id = s.branch_id AND b.tenant_id = s.tenant_id LEFT JOIN public.terminals t ON t.id = s.terminal_id AND t.tenant_id = s.tenant_id LEFT JOIN public.users u ON u.id = s.user_id AND u.tenant_id = s.tenant_id LEFT JOIN public.personas pe ON pe.id = u.persona_id AND pe.tenant_id = u.tenant_id WHERE s.tenant_id = v_tenant AND (v_branch IS NULL OR s.branch_id = v_branch) AND (v_terminal IS NULL OR s.terminal_id = v_terminal) AND (v_cashier IS NULL OR s.user_id = v_cashier) AND s.created_at >= p_date_from AND s.created_at < p_date_to LIMIT 8), '[]'::JSONB),
      'cash', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', m.id, 'createdAt', m.created_at, 'branch', b.nombre, 'terminal', t.name, 'cashierId', m.created_by, 'cashier', COALESCE(NULLIF(BTRIM(CONCAT_WS(' ', pe.nombres, pe.apellidos)), ''), u.email), 'type', m.movement_type, 'direction', m.direction, 'amount', m.amount, 'description', m.description) ORDER BY m.created_at DESC) FROM public.cash_movements m JOIN public.tenant_branches b ON b.id = m.branch_id AND b.tenant_id = m.tenant_id JOIN public.cash_sessions cs ON cs.id = m.cash_session_id AND cs.tenant_id = m.tenant_id JOIN public.cash_registers cr ON cr.id = cs.cash_register_id AND cr.tenant_id = m.tenant_id LEFT JOIN public.terminals t ON t.id = cr.terminal_id AND t.tenant_id = m.tenant_id LEFT JOIN public.users u ON u.id = m.created_by AND u.tenant_id = m.tenant_id LEFT JOIN public.personas pe ON pe.id = u.persona_id AND pe.tenant_id = u.tenant_id WHERE m.tenant_id = v_tenant AND (v_branch IS NULL OR m.branch_id = v_branch) AND (v_terminal IS NULL OR cr.terminal_id = v_terminal) AND (v_cashier IS NULL OR m.created_by = v_cashier) AND m.created_at >= p_date_from AND m.created_at < p_date_to LIMIT 8), '[]'::JSONB)
    ),
    'availability', jsonb_build_object('purchases', TRUE, 'customers', TRUE)
  ) INTO v_payload;
  RETURN v_payload;
END;
$$;

REVOKE ALL ON FUNCTION public.report_operational_control(UUID, TEXT, UUID, UUID, UUID, UUID, UUID, UUID, TIMESTAMPTZ, TIMESTAMPTZ, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.report_operational_control(UUID, TEXT, UUID, UUID, UUID, UUID, UUID, UUID, TIMESTAMPTZ, TIMESTAMPTZ, TEXT) TO manus_user;
COMMIT;
