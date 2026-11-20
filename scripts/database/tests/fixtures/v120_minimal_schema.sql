-- Esquema minimo para probar V120 en una base PostgreSQL desechable (no es un esquema real de MANUS).
-- Lo usa scripts/database/tests/test_v120_quotations_migration.py.
CREATE TABLE tenants (id uuid PRIMARY KEY, slug text NOT NULL);
CREATE TABLE tenant_branches (id uuid PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES tenants(id));
CREATE TABLE customers (id uuid PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES tenants(id));
CREATE TABLE products (id uuid PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES tenants(id));
CREATE TABLE users (id uuid PRIMARY KEY);
CREATE TABLE orders (id uuid PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES tenants(id),
  customer_id uuid NOT NULL REFERENCES customers(id), status varchar(20) NOT NULL DEFAULT 'DRAFT');
CREATE TABLE roles (id uuid PRIMARY KEY, nombre text NOT NULL UNIQUE);
CREATE TABLE menu_items (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id),
  key text NOT NULL, module text, label text, route text, icon text, parent_id uuid, sort_order integer,
  visible boolean NOT NULL DEFAULT true, below_main_menu boolean NOT NULL DEFAULT false,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb, created_at timestamptz, updated_at timestamptz, deleted_at timestamptz);
CREATE UNIQUE INDEX uq_menu_items_tenant_key ON menu_items (tenant_id, key) WHERE deleted_at IS NULL;
CREATE TABLE role_menu_permissions (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL,
  role_id uuid NOT NULL REFERENCES roles(id), menu_item_id uuid NOT NULL REFERENCES menu_items(id),
  access_level varchar(20) NOT NULL, actions jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (tenant_id, role_id, menu_item_id));

INSERT INTO tenants VALUES
  ('00000000-0000-0000-0000-0000000000a1', 'tienda-a'),
  ('00000000-0000-0000-0000-0000000000a2', 'tienda-b');
INSERT INTO tenant_branches VALUES
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000a1'),
  ('00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000a2');
INSERT INTO customers VALUES
  ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000a1');
INSERT INTO products VALUES
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000a1');
INSERT INTO users VALUES ('00000000-0000-0000-0000-0000000000e1');
INSERT INTO orders (id, tenant_id, customer_id) VALUES
  ('00000000-0000-0000-0000-000000000d01', '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000c1'),
  ('00000000-0000-0000-0000-000000000d02', '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000c1');
INSERT INTO roles VALUES
  ('00000000-0000-0000-0000-000000000901', 'SUPER_ADMIN'),
  ('00000000-0000-0000-0000-000000000902', 'SUPER_USER'),
  ('00000000-0000-0000-0000-000000000903', 'ADMIN'),
  ('00000000-0000-0000-0000-000000000904', 'USER');
-- Menu QUOTATIONS borrado en el tenant B: la migracion lo debe volver a crear.
INSERT INTO menu_items (tenant_id, key, deleted_at) VALUES
  ('00000000-0000-0000-0000-0000000000a2', 'QUOTATIONS', NOW() - INTERVAL '1 day');
