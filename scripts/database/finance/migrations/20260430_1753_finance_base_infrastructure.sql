CREATE TABLE IF NOT EXISTS payment_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  codigo VARCHAR(50) NOT NULL,
  nombre VARCHAR(120) NOT NULL,
  tipo VARCHAR(20) NOT NULL,
  requires_reference BOOLEAN NOT NULL DEFAULT FALSE,
  allows_change BOOLEAN NOT NULL DEFAULT FALSE,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT payment_methods_codigo_not_blank CHECK (btrim(codigo) <> ''),
  CONSTRAINT payment_methods_nombre_not_blank CHECK (btrim(nombre) <> ''),
  CONSTRAINT payment_methods_tipo_check CHECK (
    tipo IN ('CASH', 'CARD', 'BANK', 'DIGITAL', 'CREDIT')
  ),
  CONSTRAINT payment_methods_credit_change_check CHECK (
    NOT (tipo = 'CREDIT' AND allows_change = TRUE)
  ),
  CONSTRAINT payment_methods_tenant_codigo_unique UNIQUE (tenant_id, codigo)
);

CREATE INDEX IF NOT EXISTS idx_payment_methods_tenant
  ON payment_methods(tenant_id);

CREATE INDEX IF NOT EXISTS idx_payment_methods_active
  ON payment_methods(active);

CREATE INDEX IF NOT EXISTS idx_payment_methods_created_at
  ON payment_methods(created_at DESC);

CREATE TABLE IF NOT EXISTS cash_registers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES tenant_branches(id) ON DELETE RESTRICT,
  terminal_id UUID REFERENCES terminals(id) ON DELETE SET NULL,
  codigo VARCHAR(50) NOT NULL,
  nombre VARCHAR(120) NOT NULL,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT cash_registers_codigo_not_blank CHECK (btrim(codigo) <> ''),
  CONSTRAINT cash_registers_nombre_not_blank CHECK (btrim(nombre) <> ''),
  CONSTRAINT cash_registers_tenant_branch_codigo_unique UNIQUE (tenant_id, branch_id, codigo),
  CONSTRAINT cash_registers_tenant_terminal_unique UNIQUE (tenant_id, terminal_id)
);

CREATE INDEX IF NOT EXISTS idx_cash_registers_tenant
  ON cash_registers(tenant_id);

CREATE INDEX IF NOT EXISTS idx_cash_registers_branch
  ON cash_registers(branch_id);

CREATE INDEX IF NOT EXISTS idx_cash_registers_activo
  ON cash_registers(activo);

CREATE INDEX IF NOT EXISTS idx_cash_registers_created_at
  ON cash_registers(created_at DESC);

CREATE TABLE IF NOT EXISTS cash_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES tenant_branches(id) ON DELETE RESTRICT,
  cash_register_id UUID NOT NULL REFERENCES cash_registers(id) ON DELETE RESTRICT,
  opened_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  closed_by_user_id UUID REFERENCES users(id) ON DELETE RESTRICT,
  opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at TIMESTAMPTZ,
  opening_amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
  closing_amount NUMERIC(14, 2),
  expected_amount NUMERIC(14, 2),
  difference_amount NUMERIC(14, 2),
  status VARCHAR(20) NOT NULL DEFAULT 'OPEN',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT cash_sessions_status_check CHECK (
    status IN ('OPEN', 'CLOSED', 'CANCELLED')
  ),
  CONSTRAINT cash_sessions_opening_amount_check CHECK (opening_amount >= 0),
  CONSTRAINT cash_sessions_closing_amount_check CHECK (
    closing_amount IS NULL OR closing_amount >= 0
  ),
  CONSTRAINT cash_sessions_expected_amount_check CHECK (
    expected_amount IS NULL OR expected_amount >= 0
  ),
  CONSTRAINT cash_sessions_closed_at_check CHECK (
    closed_at IS NULL OR closed_at >= opened_at
  ),
  CONSTRAINT cash_sessions_open_state_check CHECK (
    (
      status = 'OPEN'
      AND closed_at IS NULL
      AND closed_by_user_id IS NULL
      AND closing_amount IS NULL
      AND expected_amount IS NULL
      AND difference_amount IS NULL
    )
    OR status <> 'OPEN'
  ),
  CONSTRAINT cash_sessions_closed_state_check CHECK (
    (
      status IN ('CLOSED', 'CANCELLED')
      AND closed_at IS NOT NULL
      AND closed_by_user_id IS NOT NULL
    )
    OR status = 'OPEN'
  ),
  CONSTRAINT cash_sessions_closed_amount_required_check CHECK (
    status <> 'CLOSED' OR closing_amount IS NOT NULL
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS cash_sessions_register_open_unique
  ON cash_sessions(cash_register_id)
  WHERE status = 'OPEN';

CREATE INDEX IF NOT EXISTS idx_cash_sessions_tenant
  ON cash_sessions(tenant_id);

CREATE INDEX IF NOT EXISTS idx_cash_sessions_branch
  ON cash_sessions(branch_id);

CREATE INDEX IF NOT EXISTS idx_cash_sessions_status
  ON cash_sessions(status);

CREATE INDEX IF NOT EXISTS idx_cash_sessions_created_at
  ON cash_sessions(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_cash_sessions_register
  ON cash_sessions(cash_register_id);

CREATE TABLE IF NOT EXISTS cash_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES tenant_branches(id) ON DELETE RESTRICT,
  cash_session_id UUID NOT NULL REFERENCES cash_sessions(id) ON DELETE RESTRICT,
  movement_type VARCHAR(20) NOT NULL,
  direction VARCHAR(10) NOT NULL,
  reference_type VARCHAR(50),
  reference_id UUID,
  amount NUMERIC(14, 2) NOT NULL,
  description TEXT,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT cash_movements_movement_type_check CHECK (
    movement_type IN ('OPENING', 'CLOSING', 'ADJUSTMENT', 'EXPENSE', 'WITHDRAWAL')
  ),
  CONSTRAINT cash_movements_direction_check CHECK (
    direction IN ('IN', 'OUT')
  ),
  CONSTRAINT cash_movements_amount_check CHECK (amount > 0),
  CONSTRAINT cash_movements_reference_pair_check CHECK (
    (reference_type IS NULL AND reference_id IS NULL)
    OR (reference_type IS NOT NULL AND reference_id IS NOT NULL)
  ),
  CONSTRAINT cash_movements_description_not_blank_check CHECK (
    description IS NULL OR btrim(description) <> ''
  )
);

CREATE INDEX IF NOT EXISTS idx_cash_movements_tenant
  ON cash_movements(tenant_id);

CREATE INDEX IF NOT EXISTS idx_cash_movements_branch
  ON cash_movements(branch_id);

CREATE INDEX IF NOT EXISTS idx_cash_movements_created_at
  ON cash_movements(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_cash_movements_session
  ON cash_movements(cash_session_id);

CREATE INDEX IF NOT EXISTS idx_cash_movements_reference
  ON cash_movements(reference_type, reference_id);
