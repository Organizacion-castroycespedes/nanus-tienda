-- Esquema minimo para probar V118 en una base PostgreSQL desechable (no es un esquema real de MANUS).
-- Lo usa scripts/database/tests/test_v118_product_decimal_quantity_migration.py.
CREATE TABLE products (id uuid PRIMARY KEY, tenant_id uuid NOT NULL,
  sale_type text NOT NULL DEFAULT 'UNIT', measurement_unit text NOT NULL DEFAULT 'UND',
  requires_serial boolean NOT NULL DEFAULT false,
  CONSTRAINT chk_products_measurement_unit CHECK (measurement_unit IN ('UND', 'KG', 'LB', 'G', 'OZ')),
  CONSTRAINT chk_products_sale_model_measurement_unit CHECK (
    (sale_type = 'UNIT' AND measurement_unit = 'UND')
    OR (sale_type IN ('WEIGHT', 'BOTH') AND measurement_unit IN ('KG', 'LB', 'G', 'OZ'))));
CREATE TABLE stock_movements (id uuid PRIMARY KEY, product_id uuid NOT NULL, type text NOT NULL, quantity numeric(14,3) NOT NULL);
CREATE TABLE purchase_items (id uuid PRIMARY KEY, product_id uuid NOT NULL,
  ordered_quantity numeric(14,3) NOT NULL, received_quantity numeric(14,3) NOT NULL DEFAULT 0);

-- f1: entero; f2: stock con decimales (cable 10.85); f3: compra pedida con decimales;
-- f4: con serie y movimiento decimal (no se marca); f5: peso (no se marca).
INSERT INTO products (id, tenant_id) VALUES
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000a1'),
  ('00000000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-0000000000a1'),
  ('00000000-0000-0000-0000-0000000000f3', '00000000-0000-0000-0000-0000000000a1');
INSERT INTO products (id, tenant_id, requires_serial) VALUES
  ('00000000-0000-0000-0000-0000000000f4', '00000000-0000-0000-0000-0000000000a1', true);
INSERT INTO products (id, tenant_id, sale_type, measurement_unit) VALUES
  ('00000000-0000-0000-0000-0000000000f5', '00000000-0000-0000-0000-0000000000a1', 'WEIGHT', 'KG');
INSERT INTO stock_movements VALUES
  ('00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-0000000000f1', 'IN', 10),
  ('00000000-0000-0000-0000-000000000102', '00000000-0000-0000-0000-0000000000f2', 'IN', 10.85),
  ('00000000-0000-0000-0000-000000000104', '00000000-0000-0000-0000-0000000000f4', 'IN', 1.5),
  ('00000000-0000-0000-0000-000000000105', '00000000-0000-0000-0000-0000000000f5', 'IN', 2.345);
INSERT INTO purchase_items VALUES
  ('00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-0000000000f1', 4, 4),
  ('00000000-0000-0000-0000-000000000203', '00000000-0000-0000-0000-0000000000f3', 2.5, 0);
