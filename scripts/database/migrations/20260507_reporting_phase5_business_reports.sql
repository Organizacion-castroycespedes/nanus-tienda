BEGIN;

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
