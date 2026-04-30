ALTER TABLE stock_movements
  ADD COLUMN IF NOT EXISTS branch_id UUID,
  ADD COLUMN IF NOT EXISTS terminal_id UUID,
  ADD COLUMN IF NOT EXISTS pos_session_code VARCHAR(50),
  ADD COLUMN IF NOT EXISTS user_id UUID,
  ADD COLUMN IF NOT EXISTS reference_table VARCHAR(50),
  ADD COLUMN IF NOT EXISTS stock_before NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS stock_after NUMERIC(12, 2);

DO $$
BEGIN
  ALTER TABLE stock_movements
    ADD CONSTRAINT fk_stock_movements_branch
      FOREIGN KEY (branch_id) REFERENCES tenant_branches(id);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE stock_movements
    ADD CONSTRAINT fk_stock_movements_terminal
      FOREIGN KEY (terminal_id) REFERENCES terminals(id);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE stock_movements
    ADD CONSTRAINT fk_stock_movements_user
      FOREIGN KEY (user_id) REFERENCES users(id);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_stock_movements_branch
  ON stock_movements (branch_id);

CREATE INDEX IF NOT EXISTS idx_stock_movements_terminal
  ON stock_movements (terminal_id);

CREATE INDEX IF NOT EXISTS idx_stock_movements_reference
  ON stock_movements (reference_table, reference_id);
