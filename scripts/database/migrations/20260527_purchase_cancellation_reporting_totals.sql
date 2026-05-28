BEGIN;

CREATE OR REPLACE FUNCTION public.report_purchases(
  p_actor_user_id UUID,
  p_actor_role TEXT,
  p_actor_tenant_id UUID,
  p_actor_branch_id UUID,
  p_tenant_id UUID DEFAULT NULL,
  p_branch_id UUID DEFAULT NULL,
  p_date_from TIMESTAMPTZ DEFAULT NULL,
  p_date_to TIMESTAMPTZ DEFAULT NULL,
  p_customer_document TEXT DEFAULT NULL,
  p_customer_name TEXT DEFAULT NULL
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
      COALESCE(
        p.balance_due,
        p.balance,
        GREATEST(p.total - COALESCE(p.total_paid, 0), 0)
      )::NUMERIC(14, 2) AS balance,
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
        OR EXISTS (
          SELECT 1
          FROM auditoria_eventos AS ae_scope
          WHERE ae_scope.tenant_id = p.tenant_id
            AND ae_scope.entidad = 'purchases'
            AND ae_scope.entidad_id = p.id::TEXT
            AND ae_scope.usuario_id = p_actor_user_id
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
      'activeCount', COUNT(*) FILTER (WHERE row.status <> 'CANCELLED'),
      'cancelled', COUNT(*) FILTER (WHERE row.status = 'CANCELLED'),
      'total', COALESCE(SUM(row.total) FILTER (WHERE row.status <> 'CANCELLED'), 0),
      'paid', COALESCE(SUM(row.paid) FILTER (WHERE row.status <> 'CANCELLED'), 0),
      'balance', COALESCE(SUM(row.balance) FILTER (WHERE row.status <> 'CANCELLED'), 0)
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
        'activeCount', 0,
        'cancelled', 0,
        'total', 0,
        'paid', 0,
        'balance', 0
      ),
      'rows', '[]'::JSONB
    )
  );
END;
$$;

COMMIT;
