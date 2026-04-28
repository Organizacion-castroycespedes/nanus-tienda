ALTER TABLE sales
  ADD COLUMN IF NOT EXISTS branch_id UUID,
  ADD COLUMN IF NOT EXISTS terminal_id UUID,
  ADD COLUMN IF NOT EXISTS user_id UUID,
  ADD COLUMN IF NOT EXISTS pos_session_id UUID;

DO $$
BEGIN
  ALTER TABLE sales
    ADD CONSTRAINT fk_sales_branch
      FOREIGN KEY (branch_id) REFERENCES tenant_branches(id);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE sales
    ADD CONSTRAINT fk_sales_terminal
      FOREIGN KEY (terminal_id) REFERENCES terminals(id);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE sales
    ADD CONSTRAINT fk_sales_user
      FOREIGN KEY (user_id) REFERENCES users(id);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE sales
    ADD CONSTRAINT fk_sales_pos_session
      FOREIGN KEY (pos_session_id) REFERENCES pos_user_sessions(id);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_sales_branch
  ON sales (branch_id);

CREATE INDEX IF NOT EXISTS idx_sales_terminal
  ON sales (terminal_id);

CREATE INDEX IF NOT EXISTS idx_sales_user
  ON sales (user_id);

CREATE INDEX IF NOT EXISTS idx_sales_pos_session
  ON sales (pos_session_id);

CREATE INDEX IF NOT EXISTS idx_sales_tenant_branch
  ON sales (tenant_id, branch_id);

CREATE INDEX IF NOT EXISTS idx_sales_tenant_terminal
  ON sales (tenant_id, terminal_id);

CREATE INDEX IF NOT EXISTS idx_sales_tenant_user
  ON sales (tenant_id, user_id);
