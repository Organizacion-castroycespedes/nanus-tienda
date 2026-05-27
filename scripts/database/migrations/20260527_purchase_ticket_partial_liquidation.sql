BEGIN;

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
      COALESCE(p.total_pedido, p.total)::NUMERIC(14, 2) AS total_pedido,
      COALESCE(p.total_recibido, p.total_liquidado, p.total)::NUMERIC(14, 2) AS total_recibido,
      COALESCE(p.total_liquidado, p.total_recibido, p.total)::NUMERIC(14, 2) AS total_liquidado,
      COALESCE(p.total_no_recibido, 0)::NUMERIC(14, 2) AS total_no_recibido,
      p.motivo_liquidacion,
      p.liquidado_en,
      p.liquidado_por,
      COALESCE(
        NULLIF(TRIM(CONCAT(COALESCE(liquid_person.nombres, ''), ' ', COALESCE(liquid_person.apellidos, ''))), ''),
        liquid_user.email,
        p.liquidado_por::TEXT
      ) AS liquidado_por_nombre,
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
    LEFT JOIN users AS liquid_user
      ON liquid_user.id = p.liquidado_por
     AND liquid_user.tenant_id = p.tenant_id
    LEFT JOIN personas AS liquid_person
      ON liquid_person.id = liquid_user.persona_id
     AND liquid_person.tenant_id = liquid_user.tenant_id
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
      GREATEST(item.ordered_quantity - COALESCE(item.received_quantity, 0), 0)::NUMERIC(14, 2) AS unreceived_quantity,
      item.cost::NUMERIC(14, 2) AS unit_cost,
      item.subtotal::NUMERIC(14, 2) AS subtotal,
      COALESCE(item.received_subtotal, COALESCE(item.received_quantity, 0) * item.cost)::NUMERIC(14, 2) AS received_subtotal,
      COALESCE(
        item.unreceived_subtotal,
        GREATEST(item.ordered_quantity - COALESCE(item.received_quantity, 0), 0) * item.cost
      )::NUMERIC(14, 2) AS unreceived_subtotal
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
      'type', purchase.type,
      'motivoLiquidacion', purchase.motivo_liquidacion,
      'liquidadoEn', purchase.liquidado_en,
      'liquidadoPor', purchase.liquidado_por,
      'liquidadoPorNombre', purchase.liquidado_por_nombre
    ),
    'items', COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'productId', item.product_id,
            'productName', item.product_name,
            'quantity', item.quantity,
            'receivedQuantity', item.received_quantity,
            'unreceivedQuantity', item.unreceived_quantity,
            'unitCost', item.unit_cost,
            'subtotal', item.subtotal,
            'receivedSubtotal', item.received_subtotal,
            'unreceivedSubtotal', item.unreceived_subtotal
          )
          ORDER BY item.id ASC
        )
        FROM item_rows AS item
      ),
      '[]'::JSONB
    ),
    'totals', jsonb_build_object(
      'total', purchase.total,
      'totalPedido', purchase.total_pedido,
      'totalRecibido', purchase.total_recibido,
      'totalLiquidado', purchase.total_liquidado,
      'diferenciaNoRecibida', purchase.total_no_recibido,
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

COMMIT;
