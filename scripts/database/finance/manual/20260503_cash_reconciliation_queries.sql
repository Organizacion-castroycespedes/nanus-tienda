-- Consultas de conciliacion manual para compras, pedidos y ventas.
-- Ejecutar por bloques y siempre validar la sesion de caja correcta antes
-- de actualizar o insertar datos historicos.

-- 1. Pagos completados sin sesion de caja.
SELECT
  p.id,
  p.tenant_id,
  p.branch_id,
  p.reference_type,
  p.reference_id,
  p.direction,
  p.amount,
  p.status,
  p.cash_session_id,
  p.created_by,
  p.created_at
FROM payments p
WHERE p.status = 'COMPLETED'
  AND p.reference_type IN ('SALES_ORDER', 'SALE', 'PURCHASE', 'PURCHASE_ORDER')
  AND p.cash_session_id IS NULL
ORDER BY p.created_at ASC, p.id ASC;

-- 2. Pagos completados con sesion pero sin movimiento de caja asociado.
-- Requiere la nueva columna cash_movements.payment_id.
SELECT
  p.id,
  p.tenant_id,
  p.branch_id,
  p.reference_type,
  p.reference_id,
  p.direction,
  p.amount,
  p.status,
  p.cash_session_id,
  p.created_at
FROM payments p
WHERE p.status = 'COMPLETED'
  AND p.reference_type IN ('SALES_ORDER', 'SALE', 'PURCHASE', 'PURCHASE_ORDER')
  AND p.cash_session_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM cash_movements cm
    WHERE cm.payment_id = p.id
  )
ORDER BY p.created_at ASC, p.id ASC;

-- 3. Pedidos con venta asociada y estados financieros potencialmente desalineados.
SELECT
  o.id AS order_id,
  o.payment_status AS order_payment_status,
  o.total_paid AS order_total_paid,
  o.balance_due AS order_balance_due,
  s.id AS sale_id,
  s.payment_status AS sale_payment_status,
  s.total_paid AS sale_total_paid,
  s.balance_due AS sale_balance_due
FROM orders o
JOIN sales s
  ON s.order_id = o.id
WHERE o.tenant_id = s.tenant_id
ORDER BY s.created_at DESC, s.id DESC;

-- 4. Recalculo puntual de pedido.
-- Reemplaza los valores de ejemplo antes de ejecutar.
-- BEGIN;
-- UPDATE orders
-- SET
--   total_paid = COALESCE(payment_totals.total_paid, 0),
--   balance_due = GREATEST(orders.total - COALESCE(payment_totals.total_paid, 0), 0),
--   payment_status = CASE
--     WHEN COALESCE(payment_totals.total_paid, 0) <= 0 THEN 'PENDING'
--     WHEN COALESCE(payment_totals.total_paid, 0) < orders.total THEN 'PARTIAL'
--     WHEN COALESCE(payment_totals.total_paid, 0) = orders.total THEN 'PAID'
--     ELSE 'OVERPAID'
--   END
-- FROM (
--   SELECT COALESCE(SUM(allocation.allocated_amount), 0) AS total_paid
--   FROM payment_allocations allocation
--   INNER JOIN payments payment
--     ON payment.id = allocation.payment_id
--   WHERE payment.tenant_id = '<tenant_uuid>'
--     AND allocation.reference_type = 'SALES_ORDER'
--     AND allocation.reference_id = '<order_uuid>'
--     AND payment.status IN ('PENDING', 'COMPLETED')
-- ) AS payment_totals
-- WHERE orders.id = '<order_uuid>'
--   AND orders.tenant_id = '<tenant_uuid>';
-- COMMIT;

-- 5. Recalculo puntual de compra.
-- BEGIN;
-- UPDATE purchases
-- SET
--   total_paid = COALESCE(payment_totals.total_paid, 0),
--   balance_due = GREATEST(purchases.total - COALESCE(payment_totals.total_paid, 0), 0),
--   balance = GREATEST(purchases.total - COALESCE(payment_totals.total_paid, 0), 0),
--   payment_status = CASE
--     WHEN COALESCE(payment_totals.total_paid, 0) <= 0 THEN 'PENDING'
--     WHEN COALESCE(payment_totals.total_paid, 0) < purchases.total THEN 'PARTIAL'
--     WHEN COALESCE(payment_totals.total_paid, 0) = purchases.total THEN 'PAID'
--     ELSE 'OVERPAID'
--   END
-- FROM (
--   SELECT COALESCE(SUM(allocation.allocated_amount), 0) AS total_paid
--   FROM payment_allocations allocation
--   INNER JOIN payments payment
--     ON payment.id = allocation.payment_id
--   WHERE payment.tenant_id = '<tenant_uuid>'
--     AND allocation.reference_type IN ('PURCHASE', 'PURCHASE_ORDER')
--     AND allocation.reference_id = '<purchase_uuid>'
--     AND payment.status IN ('PENDING', 'COMPLETED')
-- ) AS payment_totals
-- WHERE purchases.id = '<purchase_uuid>'
--   AND purchases.tenant_id = '<tenant_uuid>';
-- COMMIT;

-- 6. Plantilla de reparacion manual para un pago historico.
-- Reemplaza los valores de ejemplo antes de ejecutar.
-- BEGIN;
-- UPDATE payments
-- SET cash_session_id = '<cash_session_uuid>'
-- WHERE id = '<payment_uuid>'
--   AND cash_session_id IS NULL;
--
-- INSERT INTO cash_movements (
--   tenant_id,
--   branch_id,
--   cash_session_id,
--   payment_id,
--   movement_type,
--   direction,
--   reference_type,
--   reference_id,
--   amount,
--   description,
--   created_by
-- )
-- SELECT
--   p.tenant_id,
--   p.branch_id,
--   '<cash_session_uuid>'::uuid,
--   p.id,
--   'PAYMENT',
--   p.direction,
--   p.reference_type,
--   p.reference_id::text,
--   p.amount,
--   COALESCE(NULLIF(TRIM(p.notes), ''), 'Pago conciliado manualmente'),
--   p.created_by
-- FROM payments p
-- WHERE p.id = '<payment_uuid>'
--   AND NOT EXISTS (
--     SELECT 1
--     FROM cash_movements cm
--     WHERE cm.payment_id = p.id
--   );
-- COMMIT;
