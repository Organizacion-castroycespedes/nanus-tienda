CREATE OR REPLACE FUNCTION inventory_dashboard_snapshot(
  p_tenant_id UUID,
  p_branch_id UUID DEFAULT NULL,
  p_terminal_id UUID DEFAULT NULL,
  p_cash_session_id UUID DEFAULT NULL,
  p_start_date DATE DEFAULT CURRENT_DATE,
  p_end_date DATE DEFAULT CURRENT_DATE
) RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_payload JSONB;
BEGIN
  WITH date_bounds AS (
    SELECT
      p_start_date::timestamptz AS start_at,
      (p_end_date::date + INTERVAL '1 day')::timestamptz AS end_at
  ),
  scoped_products AS (
    SELECT
      p.id,
      p.name,
      p.sku
    FROM products AS p
    WHERE p.tenant_id = p_tenant_id
      AND p.is_active = TRUE
  ),
  scoped_branches AS (
    SELECT
      b.id,
      b.nombre
    FROM tenant_branches AS b
    WHERE b.tenant_id = p_tenant_id
      AND b.estado = 'ACTIVE'
      AND (p_branch_id IS NULL OR b.id = p_branch_id)
  ),
  product_branch_grid AS (
    SELECT
      p.id AS product_id,
      p.name AS product_name,
      p.sku,
      b.id AS branch_id,
      b.nombre AS branch_name
    FROM scoped_products AS p
    CROSS JOIN scoped_branches AS b
  ),
  scoped_movements AS (
    SELECT
      sm.id,
      sm.tenant_id,
      sm.product_id,
      sm.type,
      sm.quantity,
      sm.reference_type,
      sm.reference_id,
      sm.branch_id,
      sm.terminal_id,
      sm.user_id,
      sm.reference_table,
      sm.stock_before,
      sm.stock_after,
      sm.created_at
    FROM stock_movements AS sm
    INNER JOIN scoped_branches AS b
      ON b.id = sm.branch_id
    WHERE sm.tenant_id = p_tenant_id
      AND (p_terminal_id IS NULL OR sm.terminal_id = p_terminal_id)
  ),
  stock_balance AS (
    SELECT
      grid.product_id,
      grid.product_name,
      grid.sku,
      grid.branch_id,
      grid.branch_name,
      COALESCE(
        SUM(
          CASE
            WHEN movement.type = 'IN' THEN movement.quantity
            ELSE -movement.quantity
          END
        ),
        0
      ) AS stock,
      COALESCE(
        SUM(
          CASE
            WHEN movement.type = 'OUT'
             AND movement.created_at >= bounds.start_at
             AND movement.created_at < bounds.end_at
              THEN movement.quantity
            ELSE 0
          END
        ),
        0
      ) AS outbound_in_period,
      MAX(movement.created_at) AS last_movement_at
    FROM product_branch_grid AS grid
    CROSS JOIN date_bounds AS bounds
    LEFT JOIN scoped_movements AS movement
      ON movement.product_id = grid.product_id
     AND movement.branch_id = grid.branch_id
    GROUP BY
      grid.product_id,
      grid.product_name,
      grid.sku,
      grid.branch_id,
      grid.branch_name
  ),
  purchase_scope AS (
    SELECT
      p.id,
      p.status,
      p.type,
      p.total,
      COALESCE(p.balance_due, p.balance, 0) AS balance_due,
      p.created_at,
      supplier.name AS supplier_name,
      audit_context.branch_id,
      branch.nombre AS branch_name,
      audit_context.terminal_id,
      terminal.name AS terminal_name
    FROM purchases AS p
    LEFT JOIN suppliers AS supplier
      ON supplier.id = p.supplier_id
     AND supplier.tenant_id = p.tenant_id
    LEFT JOIN LATERAL (
      SELECT
        NULLIF(ae.datos_despues->>'branchId', '')::uuid AS branch_id,
        NULLIF(ae.datos_despues->>'terminalId', '')::uuid AS terminal_id
      FROM auditoria_eventos AS ae
      WHERE ae.tenant_id = p.tenant_id
        AND ae.entidad = 'purchases'
        AND ae.entidad_id = p.id::text
        AND ae.accion = 'PURCHASE_CREATED'
      ORDER BY ae.created_at DESC, ae.id DESC
      LIMIT 1
    ) AS audit_context ON TRUE
    LEFT JOIN tenant_branches AS branch
      ON branch.id = audit_context.branch_id
     AND branch.tenant_id = p.tenant_id
    LEFT JOIN terminals AS terminal
      ON terminal.id = audit_context.terminal_id
     AND terminal.tenant_id = p.tenant_id
    WHERE p.tenant_id = p_tenant_id
      AND (p_branch_id IS NULL OR audit_context.branch_id = p_branch_id)
      AND (p_terminal_id IS NULL OR audit_context.terminal_id = p_terminal_id)
  ),
  order_scope AS (
    SELECT
      o.id,
      o.status,
      o.type,
      o.total,
      COALESCE(o.balance_due, 0) AS balance_due,
      o.created_at,
      customer.name AS customer_name,
      audit_context.branch_id,
      branch.nombre AS branch_name,
      audit_context.terminal_id,
      terminal.name AS terminal_name,
      COALESCE(item_totals.pending_quantity, 0) AS pending_quantity
    FROM orders AS o
    LEFT JOIN customers AS customer
      ON customer.id = o.customer_id
     AND customer.tenant_id = o.tenant_id
    LEFT JOIN LATERAL (
      SELECT
        NULLIF(ae.datos_despues->>'branchId', '')::uuid AS branch_id,
        NULLIF(ae.datos_despues->>'terminalId', '')::uuid AS terminal_id
      FROM auditoria_eventos AS ae
      WHERE ae.tenant_id = o.tenant_id
        AND ae.entidad = 'orders'
        AND ae.entidad_id = o.id::text
        AND ae.accion IN ('ORDER_CREATED', 'ORDER_UPDATED')
      ORDER BY ae.created_at DESC, ae.id DESC
      LIMIT 1
    ) AS audit_context ON TRUE
    LEFT JOIN tenant_branches AS branch
      ON branch.id = audit_context.branch_id
     AND branch.tenant_id = o.tenant_id
    LEFT JOIN terminals AS terminal
      ON terminal.id = audit_context.terminal_id
     AND terminal.tenant_id = o.tenant_id
    LEFT JOIN LATERAL (
      SELECT
        SUM(GREATEST(oi.ordered_quantity - oi.delivered_quantity, 0)) AS pending_quantity
      FROM order_items AS oi
      WHERE oi.order_id = o.id
    ) AS item_totals ON TRUE
    WHERE o.tenant_id = p_tenant_id
      AND (p_branch_id IS NULL OR audit_context.branch_id = p_branch_id)
      AND (p_terminal_id IS NULL OR audit_context.terminal_id = p_terminal_id)
  ),
  sale_scope AS (
    SELECT DISTINCT
      s.id,
      s.total,
      s.created_at,
      s.branch_id,
      branch.nombre AS branch_name,
      s.terminal_id,
      terminal.name AS terminal_name
    FROM sales AS s
    LEFT JOIN tenant_branches AS branch
      ON branch.id = s.branch_id
     AND branch.tenant_id = s.tenant_id
    LEFT JOIN terminals AS terminal
      ON terminal.id = s.terminal_id
     AND terminal.tenant_id = s.tenant_id
    LEFT JOIN payments AS payment
      ON payment.tenant_id = s.tenant_id
     AND payment.reference_type = 'SALE'
     AND payment.reference_id = s.id
     AND payment.status IN ('PENDING', 'COMPLETED')
    WHERE s.tenant_id = p_tenant_id
      AND (p_branch_id IS NULL OR s.branch_id = p_branch_id)
      AND (p_terminal_id IS NULL OR s.terminal_id = p_terminal_id)
      AND (p_cash_session_id IS NULL OR payment.cash_session_id = p_cash_session_id)
  ),
  series_days AS (
    SELECT generate_series(p_start_date, p_end_date, INTERVAL '1 day')::date AS day
  ),
  movement_daily AS (
    SELECT
      movement.created_at::date AS day,
      SUM(CASE WHEN movement.type = 'IN' THEN movement.quantity ELSE 0 END) AS entries,
      SUM(CASE WHEN movement.type = 'OUT' THEN movement.quantity ELSE 0 END) AS exits
    FROM scoped_movements AS movement
    CROSS JOIN date_bounds AS bounds
    WHERE movement.created_at >= bounds.start_at
      AND movement.created_at < bounds.end_at
    GROUP BY movement.created_at::date
  ),
  sales_daily AS (
    SELECT
      sale.created_at::date AS day,
      SUM(sale.total) AS total
    FROM sale_scope AS sale
    CROSS JOIN date_bounds AS bounds
    WHERE sale.created_at >= bounds.start_at
      AND sale.created_at < bounds.end_at
    GROUP BY sale.created_at::date
  ),
  purchases_daily AS (
    SELECT
      purchase.created_at::date AS day,
      SUM(purchase.total) AS total
    FROM purchase_scope AS purchase
    CROSS JOIN date_bounds AS bounds
    WHERE purchase.created_at >= bounds.start_at
      AND purchase.created_at < bounds.end_at
    GROUP BY purchase.created_at::date
  ),
  top_products AS (
    SELECT
      product.id,
      product.name,
      product.sku,
      SUM(item.quantity) AS quantity,
      SUM(item.subtotal) AS total
    FROM sale_scope AS sale
    INNER JOIN sale_items AS item
      ON item.sale_id = sale.id
     AND item.tenant_id = p_tenant_id
    INNER JOIN products AS product
      ON product.id = item.product_id
     AND product.tenant_id = p_tenant_id
    CROSS JOIN date_bounds AS bounds
    WHERE sale.created_at >= bounds.start_at
      AND sale.created_at < bounds.end_at
    GROUP BY product.id, product.name, product.sku
    ORDER BY quantity DESC, total DESC, product.name ASC
    LIMIT 8
  ),
  recent_movements AS (
    SELECT
      movement.id,
      movement.type,
      movement.quantity,
      movement.reference_type,
      movement.reference_id,
      movement.created_at,
      product.name AS product_name,
      product.sku,
      branch.nombre AS branch_name,
      terminal.name AS terminal_name,
      movement.stock_before,
      movement.stock_after
    FROM scoped_movements AS movement
    INNER JOIN products AS product
      ON product.id = movement.product_id
     AND product.tenant_id = movement.tenant_id
    LEFT JOIN tenant_branches AS branch
      ON branch.id = movement.branch_id
     AND branch.tenant_id = movement.tenant_id
    LEFT JOIN terminals AS terminal
      ON terminal.id = movement.terminal_id
     AND terminal.tenant_id = movement.tenant_id
    CROSS JOIN date_bounds AS bounds
    WHERE movement.created_at >= bounds.start_at
      AND movement.created_at < bounds.end_at
    ORDER BY movement.created_at DESC, movement.id DESC
    LIMIT 10
  ),
  recent_purchases AS (
    SELECT
      purchase.id,
      purchase.status,
      purchase.type,
      purchase.total,
      purchase.balance_due,
      purchase.created_at,
      purchase.supplier_name,
      purchase.branch_name,
      purchase.terminal_name
    FROM purchase_scope AS purchase
    ORDER BY purchase.created_at DESC, purchase.id DESC
    LIMIT 10
  ),
  pending_orders AS (
    SELECT
      ord.id,
      ord.status,
      ord.type,
      ord.total,
      ord.balance_due,
      ord.pending_quantity,
      ord.created_at,
      ord.customer_name,
      ord.branch_name,
      ord.terminal_name
    FROM order_scope AS ord
    WHERE ord.status IN ('DRAFT', 'CONFIRMED', 'PARTIAL')
    ORDER BY ord.created_at DESC, ord.id DESC
    LIMIT 10
  ),
  critical_products AS (
    SELECT
      stock.product_id,
      stock.product_name,
      stock.sku,
      stock.branch_id,
      stock.branch_name,
      stock.stock,
      stock.outbound_in_period,
      stock.last_movement_at
    FROM stock_balance AS stock
    WHERE stock.stock <= 0
       OR (
         stock.stock > 0
         AND stock.outbound_in_period > 0
         AND stock.stock <= stock.outbound_in_period
       )
    ORDER BY
      stock.stock ASC,
      stock.outbound_in_period DESC,
      stock.product_name ASC
    LIMIT 10
  )
  SELECT jsonb_build_object(
    'summary',
    jsonb_build_object(
      'stockTotal', COALESCE((SELECT SUM(stock) FROM stock_balance), 0),
      'productsLow', COALESCE((
        SELECT COUNT(*)
        FROM stock_balance
        WHERE stock > 0
          AND outbound_in_period > 0
          AND stock <= outbound_in_period
      ), 0),
      'productsOut', COALESCE((
        SELECT COUNT(*)
        FROM stock_balance
        WHERE stock <= 0
      ), 0),
      'pendingPurchases', COALESCE((
        SELECT COUNT(*)
        FROM purchase_scope
        WHERE status IN ('DRAFT', 'PENDING', 'PARTIAL')
      ), 0),
      'pendingOrders', COALESCE((
        SELECT COUNT(*)
        FROM order_scope
        WHERE status IN ('DRAFT', 'CONFIRMED', 'PARTIAL')
      ), 0),
      'salesDay', COALESCE((
        SELECT SUM(total)
        FROM sale_scope
        WHERE created_at::date = p_end_date
      ), 0),
      'recentMovements', COALESCE((
        SELECT COUNT(*)
        FROM scoped_movements AS movement
        CROSS JOIN date_bounds AS bounds
        WHERE movement.created_at >= bounds.start_at
          AND movement.created_at < bounds.end_at
      ), 0)
    ),
    'header',
    jsonb_build_object(
      'tenant', (
        SELECT jsonb_build_object('id', tenant.id, 'name', tenant.nombre)
        FROM tenants AS tenant
        WHERE tenant.id = p_tenant_id
        LIMIT 1
      ),
      'branch', (
        SELECT jsonb_build_object('id', branch.id, 'name', branch.nombre)
        FROM tenant_branches AS branch
        WHERE branch.id = p_branch_id
          AND branch.tenant_id = p_tenant_id
        LIMIT 1
      ),
      'terminal', (
        SELECT jsonb_build_object('id', terminal.id, 'name', terminal.name, 'code', terminal.code)
        FROM terminals AS terminal
        WHERE terminal.id = p_terminal_id
          AND terminal.tenant_id = p_tenant_id
        LIMIT 1
      ),
      'cashSession', (
        SELECT jsonb_build_object(
          'id', session.id,
          'status', session.status,
          'openedAt', session.opened_at,
          'cashRegisterId', session.cash_register_id,
          'cashRegisterName', register.nombre,
          'branchId', session.branch_id
        )
        FROM cash_sessions AS session
        INNER JOIN cash_registers AS register
          ON register.id = session.cash_register_id
         AND register.tenant_id = session.tenant_id
        WHERE session.id = p_cash_session_id
          AND session.tenant_id = p_tenant_id
        LIMIT 1
      )
    ),
    'charts',
    jsonb_build_object(
      'movementSeries', COALESCE((
        SELECT jsonb_agg(
          jsonb_build_object(
            'date', day.day,
            'entries', COALESCE(movement.entries, 0),
            'exits', COALESCE(movement.exits, 0)
          )
          ORDER BY day.day
        )
        FROM series_days AS day
        LEFT JOIN movement_daily AS movement
          ON movement.day = day.day
      ), '[]'::jsonb),
      'salesSeries', COALESCE((
        SELECT jsonb_agg(
          jsonb_build_object(
            'date', day.day,
            'total', COALESCE(sales.total, 0)
          )
          ORDER BY day.day
        )
        FROM series_days AS day
        LEFT JOIN sales_daily AS sales
          ON sales.day = day.day
      ), '[]'::jsonb),
      'purchaseSeries', COALESCE((
        SELECT jsonb_agg(
          jsonb_build_object(
            'date', day.day,
            'total', COALESCE(purchase.total, 0)
          )
          ORDER BY day.day
        )
        FROM series_days AS day
        LEFT JOIN purchases_daily AS purchase
          ON purchase.day = day.day
      ), '[]'::jsonb),
      'topProducts', COALESCE((
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', top.id,
            'name', top.name,
            'sku', top.sku,
            'quantity', top.quantity,
            'total', top.total
          )
          ORDER BY top.quantity DESC, top.total DESC, top.name ASC
        )
        FROM top_products AS top
      ), '[]'::jsonb)
    ),
    'tables',
    jsonb_build_object(
      'recentMovements', COALESCE((
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', movement.id,
            'type', movement.type,
            'quantity', movement.quantity,
            'referenceType', movement.reference_type,
            'referenceId', movement.reference_id,
            'productName', movement.product_name,
            'sku', movement.sku,
            'branchName', movement.branch_name,
            'terminalName', movement.terminal_name,
            'stockBefore', movement.stock_before,
            'stockAfter', movement.stock_after,
            'createdAt', movement.created_at
          )
          ORDER BY movement.created_at DESC, movement.id DESC
        )
        FROM recent_movements AS movement
      ), '[]'::jsonb),
      'recentPurchases', COALESCE((
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', purchase.id,
            'status', purchase.status,
            'type', purchase.type,
            'total', purchase.total,
            'balanceDue', purchase.balance_due,
            'supplierName', purchase.supplier_name,
            'branchName', purchase.branch_name,
            'terminalName', purchase.terminal_name,
            'createdAt', purchase.created_at
          )
          ORDER BY purchase.created_at DESC, purchase.id DESC
        )
        FROM recent_purchases AS purchase
      ), '[]'::jsonb),
      'criticalProducts', COALESCE((
        SELECT jsonb_agg(
          jsonb_build_object(
            'productId', product.product_id,
            'productName', product.product_name,
            'sku', product.sku,
            'branchId', product.branch_id,
            'branchName', product.branch_name,
            'stock', product.stock,
            'outboundInPeriod', product.outbound_in_period,
            'lastMovementAt', product.last_movement_at
          )
          ORDER BY product.stock ASC, product.outbound_in_period DESC, product.product_name ASC
        )
        FROM critical_products AS product
      ), '[]'::jsonb),
      'pendingOrders', COALESCE((
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', ord.id,
            'status', ord.status,
            'type', ord.type,
            'total', ord.total,
            'balanceDue', ord.balance_due,
            'pendingQuantity', ord.pending_quantity,
            'customerName', ord.customer_name,
            'branchName', ord.branch_name,
            'terminalName', ord.terminal_name,
            'createdAt', ord.created_at
          )
          ORDER BY ord.created_at DESC, ord.id DESC
        )
        FROM pending_orders AS ord
      ), '[]'::jsonb)
    )
  ) INTO v_payload;

  RETURN COALESCE(v_payload, '{}'::jsonb);
END;
$$;
