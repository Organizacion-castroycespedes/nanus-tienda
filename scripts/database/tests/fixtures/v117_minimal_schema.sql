-- Esquema mínimo para probar V117 en una base PostgreSQL desechable (no es un esquema real de MANUS).
-- Lo usa scripts/database/tests/test_v117_product_serials_migration.py.
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE TABLE tenants (id uuid PRIMARY KEY);
CREATE TABLE tenant_branches (id uuid PRIMARY KEY, tenant_id uuid REFERENCES tenants(id));
CREATE TABLE users (id uuid PRIMARY KEY, tenant_id uuid);
CREATE TABLE customers (id uuid PRIMARY KEY, tenant_id uuid);
CREATE TABLE products (id uuid PRIMARY KEY, tenant_id uuid NOT NULL, is_inventoryable boolean NOT NULL DEFAULT true,
  sale_type text NOT NULL DEFAULT 'UNIT', measurement_unit text NOT NULL DEFAULT 'UND',
  requires_lot boolean NOT NULL DEFAULT false, requires_expiration boolean NOT NULL DEFAULT false);
CREATE TABLE inventory_locations (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, branch_id uuid NOT NULL,
  code text, name text, is_active boolean NOT NULL DEFAULT true);
CREATE TABLE stock_movements (id uuid PRIMARY KEY, tenant_id uuid NOT NULL, product_id uuid NOT NULL, branch_id uuid,
  type text NOT NULL, quantity numeric(14,3) NOT NULL, reference_type text, reference_id uuid, reference_table text);
CREATE TABLE purchases (id uuid PRIMARY KEY, tenant_id uuid);
CREATE TABLE purchase_items (id uuid PRIMARY KEY, purchase_id uuid REFERENCES purchases(id) ON DELETE CASCADE, product_id uuid);
CREATE TABLE sales (id uuid PRIMARY KEY, tenant_id uuid, customer_id uuid);
CREATE TABLE sale_items (id uuid PRIMARY KEY, tenant_id uuid NOT NULL, sale_id uuid NOT NULL, product_id uuid NOT NULL, quantity numeric(12,3) NOT NULL);
CREATE TABLE orders (id uuid PRIMARY KEY, tenant_id uuid, customer_id uuid);
CREATE TABLE order_items (id uuid PRIMARY KEY, order_id uuid REFERENCES orders(id) ON DELETE CASCADE, product_id uuid);
CREATE TABLE order_delivery_idempotency (tenant_id uuid);
CREATE TABLE roles (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), nombre text);
CREATE TABLE menu_items (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid, key text, module text, label text, route text,
  icon text, parent_id uuid, sort_order int, visible boolean, below_main_menu boolean, metadata jsonb,
  created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now(), deleted_at timestamptz);
CREATE UNIQUE INDEX ux_menu ON menu_items (tenant_id, key) WHERE deleted_at IS NULL;
CREATE TABLE role_menu_permissions (tenant_id uuid, role_id uuid, menu_item_id uuid, access_level text, actions jsonb,
  UNIQUE (tenant_id, role_id, menu_item_id));

INSERT INTO tenants VALUES ('00000000-0000-0000-0000-0000000000a1'), ('00000000-0000-0000-0000-0000000000a2');
INSERT INTO tenant_branches VALUES ('00000000-0000-0000-0000-0000000000b1','00000000-0000-0000-0000-0000000000a1'),
  ('00000000-0000-0000-0000-0000000000b2','00000000-0000-0000-0000-0000000000a1');
INSERT INTO users VALUES ('00000000-0000-0000-0000-0000000000e1','00000000-0000-0000-0000-0000000000a1');
INSERT INTO customers VALUES ('00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-0000000000a1');
INSERT INTO products (id, tenant_id) VALUES ('00000000-0000-0000-0000-0000000000f1','00000000-0000-0000-0000-0000000000a1'),
  ('00000000-0000-0000-0000-0000000000f2','00000000-0000-0000-0000-0000000000a1');
INSERT INTO products (id, tenant_id, requires_lot) VALUES ('00000000-0000-0000-0000-0000000000f3','00000000-0000-0000-0000-0000000000a1', true);
INSERT INTO inventory_locations (id, tenant_id, branch_id, code) VALUES
  ('00000000-0000-0000-0000-0000000001a1','00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000b1','BOD-A'),
  ('00000000-0000-0000-0000-0000000001a2','00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000b1','VITRINA'),
  ('00000000-0000-0000-0000-0000000001a3','00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000b2','OTRA-SUC');
INSERT INTO roles (nombre) VALUES ('SUPER_ADMIN'),('SUPER_USER'),('ADMIN'),('USER');
INSERT INTO menu_items (tenant_id, key) VALUES ('00000000-0000-0000-0000-0000000000a1','INVENTORY');
