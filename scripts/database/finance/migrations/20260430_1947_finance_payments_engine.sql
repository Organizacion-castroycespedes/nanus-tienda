ALTER TABLE cash_movements
  DROP CONSTRAINT IF EXISTS cash_movements_movement_type_check;

ALTER TABLE cash_movements
  ADD CONSTRAINT cash_movements_movement_type_check CHECK (
    movement_type IN (
      'OPENING',
      'CLOSING',
      'ADJUSTMENT',
      'EXPENSE',
      'WITHDRAWAL',
      'PAYMENT'
    )
  );

CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES tenant_branches(id) ON DELETE RESTRICT,
  payment_method_id UUID NOT NULL REFERENCES payment_methods(id) ON DELETE RESTRICT,
  cash_session_id UUID REFERENCES cash_sessions(id) ON DELETE RESTRICT,
  reference_type VARCHAR(30) NOT NULL,
  reference_id UUID NOT NULL,
  direction VARCHAR(10) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'COMPLETED',
  amount NUMERIC(14, 2) NOT NULL,
  reference_number VARCHAR(120),
  notes TEXT,
  paid_by_person_id UUID REFERENCES personas(id) ON DELETE SET NULL,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT payments_reference_type_check CHECK (
    reference_type IN (
      'SALE',
      'PURCHASE',
      'SALES_ORDER',
      'PURCHASE_ORDER',
      'EXPENSE',
      'REFUND',
      'CUSTOMER_CREDIT',
      'SUPPLIER_CREDIT'
    )
  ),
  CONSTRAINT payments_direction_check CHECK (
    direction IN ('IN', 'OUT')
  ),
  CONSTRAINT payments_status_check CHECK (
    status IN ('PENDING', 'COMPLETED', 'CANCELLED', 'REFUNDED')
  ),
  CONSTRAINT payments_amount_check CHECK (amount > 0),
  CONSTRAINT payments_reference_number_not_blank_check CHECK (
    reference_number IS NULL OR btrim(reference_number) <> ''
  ),
  CONSTRAINT payments_notes_not_blank_check CHECK (
    notes IS NULL OR btrim(notes) <> ''
  )
);

CREATE INDEX IF NOT EXISTS idx_payments_tenant
  ON payments(tenant_id);

CREATE INDEX IF NOT EXISTS idx_payments_branch
  ON payments(branch_id);

CREATE INDEX IF NOT EXISTS idx_payments_status
  ON payments(status);

CREATE INDEX IF NOT EXISTS idx_payments_created_at
  ON payments(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_payments_payment_method
  ON payments(payment_method_id);

CREATE INDEX IF NOT EXISTS idx_payments_cash_session
  ON payments(cash_session_id);

CREATE INDEX IF NOT EXISTS idx_payments_reference
  ON payments(reference_type, reference_id);

CREATE INDEX IF NOT EXISTS idx_payments_created_by
  ON payments(created_by);

CREATE TABLE IF NOT EXISTS payment_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  reference_type VARCHAR(30) NOT NULL,
  reference_id UUID NOT NULL,
  allocated_amount NUMERIC(14, 2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT payment_allocations_reference_type_check CHECK (
    reference_type IN (
      'SALE',
      'PURCHASE',
      'SALES_ORDER',
      'PURCHASE_ORDER',
      'EXPENSE',
      'REFUND',
      'CUSTOMER_CREDIT',
      'SUPPLIER_CREDIT'
    )
  ),
  CONSTRAINT payment_allocations_amount_check CHECK (allocated_amount > 0)
);

CREATE INDEX IF NOT EXISTS idx_payment_allocations_payment
  ON payment_allocations(payment_id);

CREATE INDEX IF NOT EXISTS idx_payment_allocations_reference
  ON payment_allocations(reference_type, reference_id);

CREATE INDEX IF NOT EXISTS idx_payment_allocations_created_at
  ON payment_allocations(created_at DESC);
