DO $$
BEGIN
  ALTER TABLE sales
    ADD CONSTRAINT fk_sales_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE sales
    ADD CONSTRAINT fk_sales_customer
      FOREIGN KEY (customer_id) REFERENCES customers(id);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

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

DO $$
BEGIN
  ALTER TABLE sales
    ADD CONSTRAINT fk_sales_order
      FOREIGN KEY (order_id) REFERENCES orders(id);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE sale_items
    ADD CONSTRAINT fk_sale_items_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE sale_items
    ADD CONSTRAINT fk_sale_items_sale
      FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE sale_items
    ADD CONSTRAINT fk_sale_items_product
      FOREIGN KEY (product_id) REFERENCES products(id);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE sale_items
    ADD CONSTRAINT fk_sale_items_order_item
      FOREIGN KEY (order_item_id) REFERENCES order_items(id);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE sale_item_taxes
    ADD CONSTRAINT fk_sale_item_taxes_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE sale_item_taxes
    ADD CONSTRAINT fk_sale_item_taxes_sale_item
      FOREIGN KEY (sale_item_id) REFERENCES sale_items(id) ON DELETE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE sale_item_taxes
    ADD CONSTRAINT fk_sale_item_taxes_tax
      FOREIGN KEY (tax_id) REFERENCES taxes(id);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE sale_payment_methods
    ADD CONSTRAINT fk_sale_payment_methods_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE sale_payment_methods
    ADD CONSTRAINT fk_sale_payment_methods_sale
      FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_sales_tenant
  ON sales (tenant_id);

CREATE INDEX IF NOT EXISTS idx_sales_customer
  ON sales (customer_id);

CREATE INDEX IF NOT EXISTS idx_sales_branch
  ON sales (branch_id);

CREATE INDEX IF NOT EXISTS idx_sales_terminal
  ON sales (terminal_id);

CREATE INDEX IF NOT EXISTS idx_sales_user
  ON sales (user_id);

CREATE INDEX IF NOT EXISTS idx_sales_pos_session
  ON sales (pos_session_id);

CREATE INDEX IF NOT EXISTS idx_sales_order
  ON sales (order_id);

CREATE INDEX IF NOT EXISTS idx_sales_tenant_customer
  ON sales (tenant_id, customer_id);

CREATE INDEX IF NOT EXISTS idx_sales_tenant_branch
  ON sales (tenant_id, branch_id);

CREATE INDEX IF NOT EXISTS idx_sales_tenant_terminal
  ON sales (tenant_id, terminal_id);

CREATE INDEX IF NOT EXISTS idx_sales_tenant_user
  ON sales (tenant_id, user_id);

CREATE INDEX IF NOT EXISTS idx_sales_tenant_order
  ON sales (tenant_id, order_id);

CREATE INDEX IF NOT EXISTS idx_sale_items_tenant
  ON sale_items (tenant_id);

CREATE INDEX IF NOT EXISTS idx_sale_items_sale
  ON sale_items (sale_id);

CREATE INDEX IF NOT EXISTS idx_sale_items_tenant_sale
  ON sale_items (tenant_id, sale_id);

CREATE INDEX IF NOT EXISTS idx_sale_items_product
  ON sale_items (product_id);

CREATE INDEX IF NOT EXISTS idx_sale_item_taxes_tenant
  ON sale_item_taxes (tenant_id);

CREATE INDEX IF NOT EXISTS idx_sale_item_taxes_sale_item
  ON sale_item_taxes (sale_item_id);

CREATE INDEX IF NOT EXISTS idx_sale_item_taxes_tenant_sale_item
  ON sale_item_taxes (tenant_id, sale_item_id);

CREATE INDEX IF NOT EXISTS idx_sale_payment_methods_tenant
  ON sale_payment_methods (tenant_id);

CREATE INDEX IF NOT EXISTS idx_sale_payment_methods_sale
  ON sale_payment_methods (sale_id);

CREATE INDEX IF NOT EXISTS idx_sale_payment_methods_tenant_sale
  ON sale_payment_methods (tenant_id, sale_id);
