BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM tenants
    WHERE id = '00000000-0000-0000-0000-000000000001'
  ) THEN
    RAISE EXCEPTION 'QA reporting fixtures require tenant 00000000-0000-0000-0000-000000000001';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM users
    WHERE id = '781912fe-5a32-483f-b99a-a931f9700913'
      AND tenant_id = '00000000-0000-0000-0000-000000000001'
  ) THEN
    RAISE EXCEPTION 'QA reporting fixtures require user 781912fe-5a32-483f-b99a-a931f9700913';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM cash_sessions
    WHERE id = '44ad07a9-38b2-49b4-8361-7da53d17c0a7'
      AND tenant_id = '00000000-0000-0000-0000-000000000001'
      AND branch_id = 'dc1b81e0-5ea9-4972-839c-2eb158112e40'
  ) THEN
    RAISE EXCEPTION 'QA reporting fixtures require open cash session 44ad07a9-38b2-49b4-8361-7da53d17c0a7';
  END IF;
END;
$$;

-- Shared QA context for reporting smoke tests.
INSERT INTO auth_sessions (
  id,
  user_id,
  tenant_id,
  refresh_token,
  user_agent,
  ip_address,
  is_active,
  created_at,
  last_activity
)
VALUES (
  '91000000-0000-0000-0000-000000000001',
  '781912fe-5a32-483f-b99a-a931f9700913',
  '00000000-0000-0000-0000-000000000001',
  'reporting-qa-fixture-refresh-token',
  'reporting-fixtures',
  '127.0.0.1',
  TRUE,
  TIMESTAMPTZ '2026-05-04 14:30:00-05',
  TIMESTAMPTZ '2026-05-04 14:30:00-05'
)
ON CONFLICT (id) DO UPDATE
SET
  user_id = EXCLUDED.user_id,
  tenant_id = EXCLUDED.tenant_id,
  refresh_token = EXCLUDED.refresh_token,
  user_agent = EXCLUDED.user_agent,
  ip_address = EXCLUDED.ip_address,
  is_active = EXCLUDED.is_active,
  created_at = EXCLUDED.created_at,
  last_activity = EXCLUDED.last_activity;

INSERT INTO pos_user_sessions (
  id,
  auth_session_id,
  user_id,
  tenant_id,
  branch_id,
  terminal_id,
  started_at,
  ended_at,
  is_active
)
VALUES (
  '92000000-0000-0000-0000-000000000001',
  '91000000-0000-0000-0000-000000000001',
  '781912fe-5a32-483f-b99a-a931f9700913',
  '00000000-0000-0000-0000-000000000001',
  'dc1b81e0-5ea9-4972-839c-2eb158112e40',
  'da6f6369-c770-4051-82b8-f9b2ebc85b46',
  TIMESTAMPTZ '2026-05-04 14:35:00-05',
  NULL,
  TRUE
)
ON CONFLICT (id) DO UPDATE
SET
  auth_session_id = EXCLUDED.auth_session_id,
  user_id = EXCLUDED.user_id,
  tenant_id = EXCLUDED.tenant_id,
  branch_id = EXCLUDED.branch_id,
  terminal_id = EXCLUDED.terminal_id,
  started_at = EXCLUDED.started_at,
  ended_at = EXCLUDED.ended_at,
  is_active = EXCLUDED.is_active;

-- Fixture 1: confirmed sale with partial payment.
INSERT INTO sales (
  id,
  tenant_id,
  branch_id,
  terminal_id,
  user_id,
  pos_session_id,
  customer_id,
  order_id,
  type,
  status,
  total,
  balance,
  created_at,
  payment_status,
  total_paid,
  balance_due
)
VALUES (
  '94000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000001',
  'dc1b81e0-5ea9-4972-839c-2eb158112e40',
  'da6f6369-c770-4051-82b8-f9b2ebc85b46',
  '781912fe-5a32-483f-b99a-a931f9700913',
  '92000000-0000-0000-0000-000000000001',
  'c13b691d-10fd-4183-81b7-a2ae9e9c1841',
  NULL,
  'CREDIT',
  'CONFIRMED',
  50000.00,
  30000.00,
  TIMESTAMPTZ '2026-05-04 14:45:00-05',
  'PARTIAL',
  20000.00,
  30000.00
)
ON CONFLICT (id) DO UPDATE
SET
  tenant_id = EXCLUDED.tenant_id,
  branch_id = EXCLUDED.branch_id,
  terminal_id = EXCLUDED.terminal_id,
  user_id = EXCLUDED.user_id,
  pos_session_id = EXCLUDED.pos_session_id,
  customer_id = EXCLUDED.customer_id,
  order_id = EXCLUDED.order_id,
  type = EXCLUDED.type,
  status = EXCLUDED.status,
  total = EXCLUDED.total,
  balance = EXCLUDED.balance,
  created_at = EXCLUDED.created_at,
  payment_status = EXCLUDED.payment_status,
  total_paid = EXCLUDED.total_paid,
  balance_due = EXCLUDED.balance_due;

INSERT INTO sale_items (
  id,
  tenant_id,
  sale_id,
  product_id,
  order_item_id,
  quantity,
  price,
  price_without_tax,
  tax_total,
  subtotal,
  created_at
)
VALUES (
  '94000000-0000-0000-0000-000000000011',
  '00000000-0000-0000-0000-000000000001',
  '94000000-0000-0000-0000-000000000001',
  '30000000-0000-0000-0000-000000000005',
  NULL,
  1.00,
  50000.00,
  50000.00,
  0.00,
  50000.00,
  TIMESTAMPTZ '2026-05-04 14:45:00-05'
)
ON CONFLICT (id) DO UPDATE
SET
  tenant_id = EXCLUDED.tenant_id,
  sale_id = EXCLUDED.sale_id,
  product_id = EXCLUDED.product_id,
  order_item_id = EXCLUDED.order_item_id,
  quantity = EXCLUDED.quantity,
  price = EXCLUDED.price,
  price_without_tax = EXCLUDED.price_without_tax,
  tax_total = EXCLUDED.tax_total,
  subtotal = EXCLUDED.subtotal,
  created_at = EXCLUDED.created_at;

INSERT INTO payments (
  id,
  tenant_id,
  branch_id,
  payment_method_id,
  cash_session_id,
  reference_type,
  reference_id,
  direction,
  status,
  amount,
  reference_number,
  notes,
  paid_by_person_id,
  created_by,
  created_at
)
VALUES (
  '94000000-0000-0000-0000-000000000021',
  '00000000-0000-0000-0000-000000000001',
  'dc1b81e0-5ea9-4972-839c-2eb158112e40',
  '5bfc18ac-9f27-4eb8-998a-cc478be3fecb',
  '44ad07a9-38b2-49b4-8361-7da53d17c0a7',
  'SALE',
  '94000000-0000-0000-0000-000000000001',
  'IN',
  'COMPLETED',
  20000.00,
  'REPORTING-QA-PARTIAL-001',
  'REPORTING-QA partial sale payment',
  NULL,
  '781912fe-5a32-483f-b99a-a931f9700913',
  TIMESTAMPTZ '2026-05-04 14:46:00-05'
)
ON CONFLICT (id) DO UPDATE
SET
  tenant_id = EXCLUDED.tenant_id,
  branch_id = EXCLUDED.branch_id,
  payment_method_id = EXCLUDED.payment_method_id,
  cash_session_id = EXCLUDED.cash_session_id,
  reference_type = EXCLUDED.reference_type,
  reference_id = EXCLUDED.reference_id,
  direction = EXCLUDED.direction,
  status = EXCLUDED.status,
  amount = EXCLUDED.amount,
  reference_number = EXCLUDED.reference_number,
  notes = EXCLUDED.notes,
  paid_by_person_id = EXCLUDED.paid_by_person_id,
  created_by = EXCLUDED.created_by,
  created_at = EXCLUDED.created_at;

INSERT INTO payment_allocations (
  id,
  payment_id,
  reference_type,
  reference_id,
  allocated_amount,
  created_at
)
VALUES (
  '94000000-0000-0000-0000-000000000031',
  '94000000-0000-0000-0000-000000000021',
  'SALE',
  '94000000-0000-0000-0000-000000000001',
  20000.00,
  TIMESTAMPTZ '2026-05-04 14:46:00-05'
)
ON CONFLICT (id) DO UPDATE
SET
  payment_id = EXCLUDED.payment_id,
  reference_type = EXCLUDED.reference_type,
  reference_id = EXCLUDED.reference_id,
  allocated_amount = EXCLUDED.allocated_amount,
  created_at = EXCLUDED.created_at;

INSERT INTO cash_movements (
  id,
  tenant_id,
  branch_id,
  cash_session_id,
  movement_type,
  direction,
  reference_type,
  reference_id,
  amount,
  description,
  created_by,
  created_at,
  payment_id
)
VALUES (
  '94000000-0000-0000-0000-000000000041',
  '00000000-0000-0000-0000-000000000001',
  'dc1b81e0-5ea9-4972-839c-2eb158112e40',
  '44ad07a9-38b2-49b4-8361-7da53d17c0a7',
  'PAYMENT',
  'IN',
  'SALE',
  '94000000-0000-0000-0000-000000000001',
  20000.00,
  'REPORTING-QA payment in for partial sale 94000000-0000-0000-0000-000000000001',
  '781912fe-5a32-483f-b99a-a931f9700913',
  TIMESTAMPTZ '2026-05-04 14:46:00-05',
  '94000000-0000-0000-0000-000000000021'
)
ON CONFLICT (id) DO UPDATE
SET
  tenant_id = EXCLUDED.tenant_id,
  branch_id = EXCLUDED.branch_id,
  cash_session_id = EXCLUDED.cash_session_id,
  movement_type = EXCLUDED.movement_type,
  direction = EXCLUDED.direction,
  reference_type = EXCLUDED.reference_type,
  reference_id = EXCLUDED.reference_id,
  amount = EXCLUDED.amount,
  description = EXCLUDED.description,
  created_by = EXCLUDED.created_by,
  created_at = EXCLUDED.created_at,
  payment_id = EXCLUDED.payment_id;

-- Fixture 2: refunded sale with real refund payment and cash out movement.
INSERT INTO sales (
  id,
  tenant_id,
  branch_id,
  terminal_id,
  user_id,
  pos_session_id,
  customer_id,
  order_id,
  type,
  status,
  total,
  balance,
  created_at,
  payment_status,
  total_paid,
  balance_due
)
VALUES (
  '95000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000001',
  'dc1b81e0-5ea9-4972-839c-2eb158112e40',
  'da6f6369-c770-4051-82b8-f9b2ebc85b46',
  '781912fe-5a32-483f-b99a-a931f9700913',
  '92000000-0000-0000-0000-000000000001',
  'c13b691d-10fd-4183-81b7-a2ae9e9c1841',
  NULL,
  'CASH',
  'REFUNDED',
  30000.00,
  0.00,
  TIMESTAMPTZ '2026-05-04 14:50:00-05',
  'PENDING',
  0.00,
  0.00
)
ON CONFLICT (id) DO UPDATE
SET
  tenant_id = EXCLUDED.tenant_id,
  branch_id = EXCLUDED.branch_id,
  terminal_id = EXCLUDED.terminal_id,
  user_id = EXCLUDED.user_id,
  pos_session_id = EXCLUDED.pos_session_id,
  customer_id = EXCLUDED.customer_id,
  order_id = EXCLUDED.order_id,
  type = EXCLUDED.type,
  status = EXCLUDED.status,
  total = EXCLUDED.total,
  balance = EXCLUDED.balance,
  created_at = EXCLUDED.created_at,
  payment_status = EXCLUDED.payment_status,
  total_paid = EXCLUDED.total_paid,
  balance_due = EXCLUDED.balance_due;

INSERT INTO sale_items (
  id,
  tenant_id,
  sale_id,
  product_id,
  order_item_id,
  quantity,
  price,
  price_without_tax,
  tax_total,
  subtotal,
  created_at
)
VALUES (
  '95000000-0000-0000-0000-000000000011',
  '00000000-0000-0000-0000-000000000001',
  '95000000-0000-0000-0000-000000000001',
  '30000000-0000-0000-0000-000000000003',
  NULL,
  1.00,
  30000.00,
  30000.00,
  0.00,
  30000.00,
  TIMESTAMPTZ '2026-05-04 14:50:00-05'
)
ON CONFLICT (id) DO UPDATE
SET
  tenant_id = EXCLUDED.tenant_id,
  sale_id = EXCLUDED.sale_id,
  product_id = EXCLUDED.product_id,
  order_item_id = EXCLUDED.order_item_id,
  quantity = EXCLUDED.quantity,
  price = EXCLUDED.price,
  price_without_tax = EXCLUDED.price_without_tax,
  tax_total = EXCLUDED.tax_total,
  subtotal = EXCLUDED.subtotal,
  created_at = EXCLUDED.created_at;

INSERT INTO payments (
  id,
  tenant_id,
  branch_id,
  payment_method_id,
  cash_session_id,
  reference_type,
  reference_id,
  direction,
  status,
  amount,
  reference_number,
  notes,
  paid_by_person_id,
  created_by,
  created_at
)
VALUES (
  '95000000-0000-0000-0000-000000000021',
  '00000000-0000-0000-0000-000000000001',
  'dc1b81e0-5ea9-4972-839c-2eb158112e40',
  '5bfc18ac-9f27-4eb8-998a-cc478be3fecb',
  '44ad07a9-38b2-49b4-8361-7da53d17c0a7',
  'SALE',
  '95000000-0000-0000-0000-000000000001',
  'IN',
  'REFUNDED',
  30000.00,
  'REPORTING-QA-REFUNDED-001',
  'REPORTING-QA original payment for refunded sale',
  NULL,
  '781912fe-5a32-483f-b99a-a931f9700913',
  TIMESTAMPTZ '2026-05-04 14:51:00-05'
)
ON CONFLICT (id) DO UPDATE
SET
  tenant_id = EXCLUDED.tenant_id,
  branch_id = EXCLUDED.branch_id,
  payment_method_id = EXCLUDED.payment_method_id,
  cash_session_id = EXCLUDED.cash_session_id,
  reference_type = EXCLUDED.reference_type,
  reference_id = EXCLUDED.reference_id,
  direction = EXCLUDED.direction,
  status = EXCLUDED.status,
  amount = EXCLUDED.amount,
  reference_number = EXCLUDED.reference_number,
  notes = EXCLUDED.notes,
  paid_by_person_id = EXCLUDED.paid_by_person_id,
  created_by = EXCLUDED.created_by,
  created_at = EXCLUDED.created_at;

DELETE FROM payment_allocations
WHERE id = '95000000-0000-0000-0000-000000000031'
   OR (
     payment_id = '95000000-0000-0000-0000-000000000021'
     AND reference_type = 'SALE'
     AND reference_id = '95000000-0000-0000-0000-000000000001'
   );

INSERT INTO cash_movements (
  id,
  tenant_id,
  branch_id,
  cash_session_id,
  movement_type,
  direction,
  reference_type,
  reference_id,
  amount,
  description,
  created_by,
  created_at,
  payment_id
)
VALUES (
  '95000000-0000-0000-0000-000000000041',
  '00000000-0000-0000-0000-000000000001',
  'dc1b81e0-5ea9-4972-839c-2eb158112e40',
  '44ad07a9-38b2-49b4-8361-7da53d17c0a7',
  'PAYMENT',
  'IN',
  'SALE',
  '95000000-0000-0000-0000-000000000001',
  30000.00,
  'REPORTING-QA payment in for refunded sale 95000000-0000-0000-0000-000000000001',
  '781912fe-5a32-483f-b99a-a931f9700913',
  TIMESTAMPTZ '2026-05-04 14:51:00-05',
  '95000000-0000-0000-0000-000000000021'
)
ON CONFLICT (id) DO UPDATE
SET
  tenant_id = EXCLUDED.tenant_id,
  branch_id = EXCLUDED.branch_id,
  cash_session_id = EXCLUDED.cash_session_id,
  movement_type = EXCLUDED.movement_type,
  direction = EXCLUDED.direction,
  reference_type = EXCLUDED.reference_type,
  reference_id = EXCLUDED.reference_id,
  amount = EXCLUDED.amount,
  description = EXCLUDED.description,
  created_by = EXCLUDED.created_by,
  created_at = EXCLUDED.created_at,
  payment_id = EXCLUDED.payment_id;

INSERT INTO payments (
  id,
  tenant_id,
  branch_id,
  payment_method_id,
  cash_session_id,
  reference_type,
  reference_id,
  direction,
  status,
  amount,
  reference_number,
  notes,
  paid_by_person_id,
  created_by,
  created_at
)
VALUES (
  '95000000-0000-0000-0000-000000000022',
  '00000000-0000-0000-0000-000000000001',
  'dc1b81e0-5ea9-4972-839c-2eb158112e40',
  '5bfc18ac-9f27-4eb8-998a-cc478be3fecb',
  '44ad07a9-38b2-49b4-8361-7da53d17c0a7',
  'REFUND',
  '95000000-0000-0000-0000-000000000001',
  'OUT',
  'COMPLETED',
  30000.00,
  'REPORTING-QA-REFUND-001',
  'REPORTING-QA refund for cancelled sale 95000000-0000-0000-0000-000000000001',
  NULL,
  '781912fe-5a32-483f-b99a-a931f9700913',
  TIMESTAMPTZ '2026-05-04 14:52:00-05'
)
ON CONFLICT (id) DO UPDATE
SET
  tenant_id = EXCLUDED.tenant_id,
  branch_id = EXCLUDED.branch_id,
  payment_method_id = EXCLUDED.payment_method_id,
  cash_session_id = EXCLUDED.cash_session_id,
  reference_type = EXCLUDED.reference_type,
  reference_id = EXCLUDED.reference_id,
  direction = EXCLUDED.direction,
  status = EXCLUDED.status,
  amount = EXCLUDED.amount,
  reference_number = EXCLUDED.reference_number,
  notes = EXCLUDED.notes,
  paid_by_person_id = EXCLUDED.paid_by_person_id,
  created_by = EXCLUDED.created_by,
  created_at = EXCLUDED.created_at;

INSERT INTO payment_allocations (
  id,
  payment_id,
  reference_type,
  reference_id,
  allocated_amount,
  created_at
)
VALUES (
  '95000000-0000-0000-0000-000000000032',
  '95000000-0000-0000-0000-000000000022',
  'SALE',
  '95000000-0000-0000-0000-000000000001',
  30000.00,
  TIMESTAMPTZ '2026-05-04 14:52:00-05'
)
ON CONFLICT (id) DO UPDATE
SET
  payment_id = EXCLUDED.payment_id,
  reference_type = EXCLUDED.reference_type,
  reference_id = EXCLUDED.reference_id,
  allocated_amount = EXCLUDED.allocated_amount,
  created_at = EXCLUDED.created_at;

INSERT INTO cash_movements (
  id,
  tenant_id,
  branch_id,
  cash_session_id,
  movement_type,
  direction,
  reference_type,
  reference_id,
  amount,
  description,
  created_by,
  created_at,
  payment_id
)
VALUES (
  '95000000-0000-0000-0000-000000000042',
  '00000000-0000-0000-0000-000000000001',
  'dc1b81e0-5ea9-4972-839c-2eb158112e40',
  '44ad07a9-38b2-49b4-8361-7da53d17c0a7',
  'PAYMENT',
  'OUT',
  'REFUND',
  '95000000-0000-0000-0000-000000000001',
  30000.00,
  'Refund sale 95000000-0000-0000-0000-000000000001 from payment 95000000-0000-0000-0000-000000000021',
  '781912fe-5a32-483f-b99a-a931f9700913',
  TIMESTAMPTZ '2026-05-04 14:52:00-05',
  '95000000-0000-0000-0000-000000000022'
)
ON CONFLICT (id) DO UPDATE
SET
  tenant_id = EXCLUDED.tenant_id,
  branch_id = EXCLUDED.branch_id,
  cash_session_id = EXCLUDED.cash_session_id,
  movement_type = EXCLUDED.movement_type,
  direction = EXCLUDED.direction,
  reference_type = EXCLUDED.reference_type,
  reference_id = EXCLUDED.reference_id,
  amount = EXCLUDED.amount,
  description = EXCLUDED.description,
  created_by = EXCLUDED.created_by,
  created_at = EXCLUDED.created_at,
  payment_id = EXCLUDED.payment_id;

COMMIT;
