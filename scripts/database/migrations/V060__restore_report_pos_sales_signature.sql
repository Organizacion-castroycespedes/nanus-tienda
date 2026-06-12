BEGIN;

DROP FUNCTION IF EXISTS public.report_pos_sales(
  UUID,
  TEXT,
  UUID,
  UUID,
  UUID,
  UUID,
  TIMESTAMPTZ,
  TIMESTAMPTZ
);

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
      COALESCE(
        s.balance_due,
        s.balance,
        GREATEST(s.total - COALESCE(s.total_paid, 0), 0)
      )::NUMERIC(14, 2) AS balance,
      COALESCE(s.payment_status, 'PENDING') AS payment_status,
      s.branch_id,
      branch.nombre AS branch_name,
      payment_context.cash_session_id
    FROM public.sales AS s
    LEFT JOIN public.customers AS customer
      ON customer.id = s.customer_id
     AND customer.tenant_id = s.tenant_id
    LEFT JOIN public.tenant_branches AS branch
      ON branch.id = s.branch_id
     AND branch.tenant_id = s.tenant_id
    LEFT JOIN LATERAL (
      SELECT payment.cash_session_id
      FROM public.payments AS payment
      WHERE payment.tenant_id = s.tenant_id
        AND payment.reference_type = 'SALE'
        AND payment.reference_id = s.id
        AND payment.direction = 'IN'
      ORDER BY payment.created_at ASC, payment.id ASC
      LIMIT 1
    ) AS payment_context ON TRUE
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

DO $$
DECLARE
  v_function_oid OID;
  v_arguments TEXT;
BEGIN
  v_function_oid := to_regprocedure(
    'public.report_pos_sales(uuid,text,uuid,uuid,uuid,uuid,timestamptz,timestamptz)'
  );

  IF v_function_oid IS NULL THEN
    RAISE EXCEPTION 'report_pos_sales expected signature was not created';
  END IF;

  SELECT pg_get_function_arguments(v_function_oid)
  INTO v_arguments;

  IF v_arguments IS NULL THEN
    RAISE EXCEPTION 'report_pos_sales expected arguments could not be read';
  END IF;
END $$;

COMMIT;
