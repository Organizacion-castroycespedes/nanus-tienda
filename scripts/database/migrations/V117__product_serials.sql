-- V117: trazabilidad individual por número de serie (productos con serie obligatoria).
-- OpenSpec: incorporar-trazabilidad-series-productos
-- Requiere V116 (order_delivery_idempotency) y las tablas de productos, ubicaciones, compras, ventas y pedidos.
-- No modifica inventory_create_sale_v2, el consumo FEFO ni el cálculo de existencias:
-- las series viven en tablas propias y se cambian solo con las funciones fnc_product_serials_*.
-- Sin control transaccional: lo aporta apply_single_migration.sh.

DO $$
BEGIN
  IF to_regclass('public.order_delivery_idempotency') IS NULL THEN
    RAISE EXCEPTION 'PRODUCT_SERIALS_V116_REQUIRED';
  END IF;
  IF to_regclass('public.products') IS NULL
    OR to_regclass('public.tenant_branches') IS NULL
    OR to_regclass('public.inventory_locations') IS NULL
    OR to_regclass('public.stock_movements') IS NULL
    OR to_regclass('public.purchases') IS NULL
    OR to_regclass('public.purchase_items') IS NULL
    OR to_regclass('public.sales') IS NULL
    OR to_regclass('public.sale_items') IS NULL
    OR to_regclass('public.orders') IS NULL
    OR to_regclass('public.order_items') IS NULL
    OR to_regclass('public.customers') IS NULL
    OR to_regclass('public.users') IS NULL THEN
    RAISE EXCEPTION 'PRODUCT_SERIALS_PREREQUISITES_MISSING';
  END IF;
  IF to_regclass('public.product_serials') IS NOT NULL THEN
    RAISE EXCEPTION 'PRODUCT_SERIALS_V117_ALREADY_APPLIED';
  END IF;
END $$;

-- 1. Producto con serie obligatoria (configuración estructural, ver ProductService).
ALTER TABLE public.products
  ADD COLUMN requires_serial BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.products
  ADD CONSTRAINT chk_products_serial_rules
  CHECK (
    requires_serial = FALSE
    OR (
      is_inventoryable = TRUE
      AND sale_type = 'UNIT'
      AND measurement_unit = 'UND'
      AND requires_lot = FALSE
      AND requires_expiration = FALSE
    )
  );

-- 2. Estado actual de cada unidad.
CREATE TABLE public.product_serials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  branch_id UUID NOT NULL REFERENCES public.tenant_branches(id) ON DELETE RESTRICT,
  location_id UUID NULL REFERENCES public.inventory_locations(id) ON DELETE RESTRICT,
  serial_number VARCHAR(100) NOT NULL,
  serial_number_normalized VARCHAR(100) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'AVAILABLE',
  version INTEGER NOT NULL DEFAULT 1,
  source_type VARCHAR(20) NOT NULL,
  purchase_id UUID NULL REFERENCES public.purchases(id) ON DELETE RESTRICT,
  purchase_item_id UUID NULL REFERENCES public.purchase_items(id) ON DELETE RESTRICT,
  in_stock_movement_id UUID NULL REFERENCES public.stock_movements(id) ON DELETE RESTRICT,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sale_id UUID NULL REFERENCES public.sales(id) ON DELETE RESTRICT,
  sale_item_id UUID NULL REFERENCES public.sale_items(id) ON DELETE RESTRICT,
  order_id UUID NULL REFERENCES public.orders(id) ON DELETE RESTRICT,
  order_item_id UUID NULL REFERENCES public.order_items(id) ON DELETE RESTRICT,
  out_stock_movement_id UUID NULL REFERENCES public.stock_movements(id) ON DELETE RESTRICT,
  customer_id UUID NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
  sold_at TIMESTAMPTZ NULL,
  created_by UUID NULL REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_product_serials_status
    CHECK (status IN ('AVAILABLE', 'SOLD', 'RETURNED', 'BLOCKED', 'WRITTEN_OFF')),
  CONSTRAINT chk_product_serials_source_type
    CHECK (source_type IN ('PURCHASE', 'ADJUSTMENT')),
  CONSTRAINT chk_product_serials_purchase_source
    CHECK (source_type <> 'PURCHASE' OR purchase_id IS NOT NULL),
  CONSTRAINT chk_product_serials_normalized
    CHECK (serial_number_normalized = upper(btrim(serial_number))),
  CONSTRAINT chk_product_serials_format
    CHECK (serial_number_normalized ~ '^[A-Z0-9._/-]{1,100}$'),
  CONSTRAINT chk_product_serials_sold
    CHECK (status <> 'SOLD' OR (sold_at IS NOT NULL AND (sale_id IS NOT NULL OR order_id IS NOT NULL))),
  CONSTRAINT chk_product_serials_version
    CHECK (version > 0)
);

CREATE UNIQUE INDEX ux_product_serials_tenant_product_serial
  ON public.product_serials (tenant_id, product_id, serial_number_normalized);

CREATE INDEX idx_product_serials_availability
  ON public.product_serials (tenant_id, product_id, branch_id, status);

CREATE INDEX idx_product_serials_search
  ON public.product_serials (tenant_id, serial_number_normalized text_pattern_ops);

CREATE INDEX idx_product_serials_location
  ON public.product_serials (tenant_id, branch_id, location_id, status)
  WHERE location_id IS NOT NULL;

CREATE INDEX idx_product_serials_sale
  ON public.product_serials (tenant_id, sale_id)
  WHERE sale_id IS NOT NULL;

CREATE INDEX idx_product_serials_order
  ON public.product_serials (tenant_id, order_id)
  WHERE order_id IS NOT NULL;

-- 3. Historial de solo inserción.
CREATE TABLE public.product_serial_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  serial_id UUID NOT NULL REFERENCES public.product_serials(id) ON DELETE RESTRICT,
  event_type VARCHAR(30) NOT NULL,
  from_status VARCHAR(20) NULL,
  to_status VARCHAR(20) NOT NULL,
  branch_id UUID NOT NULL REFERENCES public.tenant_branches(id) ON DELETE RESTRICT,
  from_location_id UUID NULL REFERENCES public.inventory_locations(id) ON DELETE RESTRICT,
  to_location_id UUID NULL REFERENCES public.inventory_locations(id) ON DELETE RESTRICT,
  reference_type VARCHAR(30) NULL,
  reference_id UUID NULL,
  stock_movement_id UUID NULL REFERENCES public.stock_movements(id) ON DELETE RESTRICT,
  user_id UUID NULL REFERENCES public.users(id) ON DELETE SET NULL,
  reason TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_product_serial_events_type
    CHECK (event_type IN (
      'RECEIVED', 'SOLD', 'DELIVERED', 'RETURNED', 'VOIDED_NOT_RETURNED',
      'INSPECTED_AVAILABLE', 'BLOCKED', 'UNBLOCKED', 'WRITTEN_OFF', 'LOCATION_CHANGED'
    ))
);

CREATE INDEX idx_product_serial_events_serial
  ON public.product_serial_events (tenant_id, serial_id, created_at);

CREATE INDEX idx_product_serial_events_reference
  ON public.product_serial_events (tenant_id, reference_type, reference_id)
  WHERE reference_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.fnc_product_serial_events_immutable()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'SERIAL_EVENTS_IMMUTABLE';
END;
$$;

CREATE TRIGGER trg_product_serial_events_immutable
  BEFORE UPDATE OR DELETE ON public.product_serial_events
  FOR EACH ROW EXECUTE FUNCTION public.fnc_product_serial_events_immutable();

-- 4. Funciones. Errores con prefijo estable SERIAL_* (ProductSerialService los traduce a 400/409).

CREATE OR REPLACE FUNCTION public.fnc_product_serials_normalize(p_serial TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT upper(btrim(p_serial));
$$;

-- Registra series nuevas AVAILABLE (recepción de compra o ajuste de entrada).
-- p_serials: arreglo JSON de textos o de objetos {"serial": "...", "locationId": "uuid|null"}.
CREATE OR REPLACE FUNCTION public.fnc_product_serials_register(
  p_tenant_id UUID,
  p_branch_id UUID,
  p_product_id UUID,
  p_source_type TEXT,
  p_source_id UUID,
  p_source_item_id UUID,
  p_stock_movement_id UUID,
  p_serials JSONB,
  p_default_location_id UUID,
  p_user_id UUID
)
RETURNS TABLE (serial_id UUID, serial_number VARCHAR)
LANGUAGE plpgsql
AS $$
#variable_conflict use_column
DECLARE
  v_requires_serial BOOLEAN;
  v_count INTEGER;
  v_value TEXT;
  v_movement_quantity NUMERIC;
BEGIN
  IF p_source_type NOT IN ('PURCHASE', 'ADJUSTMENT') THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'SERIAL_SOURCE_INVALID';
  END IF;

  SELECT p.requires_serial INTO v_requires_serial
  FROM public.products p
  WHERE p.id = p_product_id AND p.tenant_id = p_tenant_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'SERIAL_PRODUCT_NOT_FOUND';
  END IF;
  IF NOT v_requires_serial THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'SERIAL_NOT_REQUIRED';
  END IF;

  IF p_serials IS NULL OR jsonb_typeof(p_serials) <> 'array' OR jsonb_array_length(p_serials) = 0 THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'SERIAL_REQUIRED';
  END IF;

  CREATE TEMP TABLE IF NOT EXISTS tmp_product_serials_register (
    ordinal INTEGER,
    raw_serial TEXT,
    normalized TEXT,
    location_id UUID
  ) ON COMMIT DROP;
  TRUNCATE tmp_product_serials_register;

  INSERT INTO tmp_product_serials_register (ordinal, raw_serial, normalized, location_id)
  SELECT
    item.ordinal::INTEGER,
    btrim(CASE WHEN jsonb_typeof(item.value) = 'string' THEN item.value #>> '{}' ELSE item.value ->> 'serial' END),
    public.fnc_product_serials_normalize(
      CASE WHEN jsonb_typeof(item.value) = 'string' THEN item.value #>> '{}' ELSE item.value ->> 'serial' END
    ),
    COALESCE(
      CASE WHEN jsonb_typeof(item.value) = 'object' THEN NULLIF(item.value ->> 'locationId', '')::UUID END,
      p_default_location_id
    )
  FROM jsonb_array_elements(p_serials) WITH ORDINALITY AS item(value, ordinal);

  SELECT t.normalized INTO v_value
  FROM tmp_product_serials_register t
  WHERE t.normalized IS NULL OR t.normalized !~ '^[A-Z0-9._/-]{1,100}$'
  ORDER BY t.ordinal
  LIMIT 1;
  IF FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'SERIAL_INVALID_FORMAT', DETAIL = COALESCE(v_value, '');
  END IF;

  SELECT t.normalized INTO v_value
  FROM tmp_product_serials_register t
  GROUP BY t.normalized
  HAVING count(*) > 1
  ORDER BY t.normalized
  LIMIT 1;
  IF FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'SERIAL_DUPLICATE_IN_PAYLOAD', DETAIL = v_value;
  END IF;

  SELECT t.normalized INTO v_value
  FROM tmp_product_serials_register t
  JOIN public.product_serials s
    ON s.tenant_id = p_tenant_id
   AND s.product_id = p_product_id
   AND s.serial_number_normalized = t.normalized
  ORDER BY t.ordinal
  LIMIT 1;
  IF FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'SERIAL_DUPLICATE', DETAIL = v_value;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM tmp_product_serials_register t
    WHERE t.location_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.inventory_locations l
        WHERE l.id = t.location_id
          AND l.tenant_id = p_tenant_id
          AND l.branch_id = p_branch_id
          AND l.is_active = TRUE
      )
  ) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'SERIAL_LOCATION_INVALID';
  END IF;

  SELECT count(*) INTO v_count FROM tmp_product_serials_register;

  IF p_stock_movement_id IS NOT NULL THEN
    SELECT m.quantity INTO v_movement_quantity
    FROM public.stock_movements m
    WHERE m.id = p_stock_movement_id
      AND m.tenant_id = p_tenant_id
      AND m.product_id = p_product_id
      AND m.branch_id = p_branch_id
      AND m.type = 'IN';
    IF NOT FOUND THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'SERIAL_MOVEMENT_INVALID';
    END IF;
    IF v_movement_quantity <> v_count THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'SERIAL_COUNT_MISMATCH',
        DETAIL = format('expected=%s received=%s', v_movement_quantity, v_count);
    END IF;
  END IF;

  BEGIN
    RETURN QUERY
    WITH inserted AS (
      INSERT INTO public.product_serials (
        tenant_id, product_id, branch_id, location_id, serial_number, serial_number_normalized,
        status, source_type, purchase_id, purchase_item_id, in_stock_movement_id, created_by
      )
      SELECT
        p_tenant_id, p_product_id, p_branch_id, t.location_id, t.raw_serial, t.normalized,
        'AVAILABLE', p_source_type,
        CASE WHEN p_source_type = 'PURCHASE' THEN p_source_id END,
        CASE WHEN p_source_type = 'PURCHASE' THEN p_source_item_id END,
        p_stock_movement_id, p_user_id
      FROM tmp_product_serials_register t
      ORDER BY t.ordinal
      RETURNING id, product_serials.serial_number, product_serials.location_id
    ), events AS (
      INSERT INTO public.product_serial_events (
        tenant_id, serial_id, event_type, from_status, to_status, branch_id, to_location_id,
        reference_type, reference_id, stock_movement_id, user_id
      )
      SELECT p_tenant_id, i.id, 'RECEIVED', NULL, 'AVAILABLE', p_branch_id, i.location_id,
        p_source_type, p_source_id, p_stock_movement_id, p_user_id
      FROM inserted i
    )
    SELECT i.id, i.serial_number FROM inserted i;
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'SERIAL_DUPLICATE';
  END;
END;
$$;

-- Asigna series a las líneas de una venta POS ya creada (misma transacción que la venta).
-- p_lines: [{"saleItemId": "uuid", "serialIds": ["uuid", ...]}]. Sin productos con serie ni líneas: retorna 0.
CREATE OR REPLACE FUNCTION public.fnc_product_serials_assign_sale(
  p_tenant_id UUID,
  p_branch_id UUID,
  p_sale_id UUID,
  p_lines JSONB,
  p_user_id UUID
)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_has_lines BOOLEAN := p_lines IS NOT NULL AND jsonb_typeof(p_lines) = 'array' AND jsonb_array_length(p_lines) > 0;
  v_customer_id UUID;
  v_item RECORD;
  v_serial_ids UUID[];
  v_updated INTEGER;
  v_total INTEGER := 0;
  v_movement_id UUID;
  v_value TEXT;
BEGIN
  IF NOT v_has_lines AND NOT EXISTS (
    SELECT 1
    FROM public.sale_items si
    JOIN public.products p ON p.id = si.product_id
    WHERE si.tenant_id = p_tenant_id
      AND si.sale_id = p_sale_id
      AND p.requires_serial = TRUE
  ) THEN
    RETURN 0;
  END IF;

  SELECT s.customer_id INTO v_customer_id
  FROM public.sales s
  WHERE s.id = p_sale_id AND s.tenant_id = p_tenant_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'SERIAL_SALE_NOT_FOUND';
  END IF;

  IF v_has_lines THEN
    SELECT line ->> 'saleItemId' INTO v_value
    FROM jsonb_array_elements(p_lines) line
    WHERE NOT EXISTS (
      SELECT 1 FROM public.sale_items si
      WHERE si.id = NULLIF(line ->> 'saleItemId', '')::UUID
        AND si.sale_id = p_sale_id
        AND si.tenant_id = p_tenant_id
    )
    LIMIT 1;
    IF FOUND THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'SERIAL_SALE_ITEM_NOT_FOUND', DETAIL = COALESCE(v_value, '');
    END IF;

    SELECT serial INTO v_value
    FROM jsonb_array_elements(p_lines) line,
         jsonb_array_elements_text(COALESCE(line -> 'serialIds', '[]'::jsonb)) serial
    GROUP BY serial
    HAVING count(*) > 1
    LIMIT 1;
    IF FOUND THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'SERIAL_DUPLICATE_IN_PAYLOAD', DETAIL = v_value;
    END IF;
  END IF;

  FOR v_item IN
    SELECT si.id, si.product_id, si.quantity, p.requires_serial,
      (
        SELECT array_agg(serial::UUID)
        FROM jsonb_array_elements(COALESCE(p_lines, '[]'::jsonb)) line,
             jsonb_array_elements_text(COALESCE(line -> 'serialIds', '[]'::jsonb)) serial
        WHERE NULLIF(line ->> 'saleItemId', '')::UUID = si.id
      ) AS serial_ids
    FROM public.sale_items si
    JOIN public.products p ON p.id = si.product_id
    WHERE si.tenant_id = p_tenant_id AND si.sale_id = p_sale_id
    ORDER BY si.id
  LOOP
    v_serial_ids := COALESCE(v_item.serial_ids, ARRAY[]::UUID[]);

    IF NOT v_item.requires_serial THEN
      IF cardinality(v_serial_ids) > 0 THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'SERIAL_NOT_REQUIRED', DETAIL = v_item.id::TEXT;
      END IF;
      CONTINUE;
    END IF;

    IF v_item.quantity <> trunc(v_item.quantity) THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'SERIAL_QUANTITY_NOT_INTEGER', DETAIL = v_item.id::TEXT;
    END IF;
    IF cardinality(v_serial_ids) <> v_item.quantity THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'SERIAL_COUNT_MISMATCH',
        DETAIL = format('saleItemId=%s expected=%s received=%s', v_item.id, v_item.quantity, cardinality(v_serial_ids));
    END IF;

    SELECT CASE WHEN count(*) = 1 THEN min(m.id::TEXT)::UUID END INTO v_movement_id
    FROM public.stock_movements m
    WHERE m.tenant_id = p_tenant_id
      AND m.reference_type = 'SALE'
      AND m.reference_id = p_sale_id
      AND m.reference_table = 'sales'
      AND m.type = 'OUT'
      AND m.product_id = v_item.product_id;

    WITH updated AS (
      UPDATE public.product_serials s
      SET status = 'SOLD',
          sale_id = p_sale_id,
          sale_item_id = v_item.id,
          order_id = NULL,
          order_item_id = NULL,
          customer_id = v_customer_id,
          out_stock_movement_id = v_movement_id,
          sold_at = NOW(),
          version = s.version + 1,
          updated_at = NOW()
      WHERE s.id = ANY(v_serial_ids)
        AND s.tenant_id = p_tenant_id
        AND s.product_id = v_item.product_id
        AND s.branch_id = p_branch_id
        AND s.status = 'AVAILABLE'
      RETURNING s.id, s.location_id
    ), events AS (
      INSERT INTO public.product_serial_events (
        tenant_id, serial_id, event_type, from_status, to_status, branch_id, from_location_id,
        reference_type, reference_id, stock_movement_id, user_id
      )
      SELECT p_tenant_id, u.id, 'SOLD', 'AVAILABLE', 'SOLD', p_branch_id, u.location_id,
        'SALE', p_sale_id, v_movement_id, p_user_id
      FROM updated u
    )
    SELECT count(*) INTO v_updated FROM updated;

    IF v_updated <> cardinality(v_serial_ids) THEN
      IF EXISTS (
        SELECT 1 FROM public.product_serials s
        WHERE s.id = ANY(v_serial_ids) AND s.tenant_id = p_tenant_id
          AND s.product_id = v_item.product_id AND s.status = 'AVAILABLE'
          AND s.branch_id <> p_branch_id
      ) THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'SERIAL_WRONG_BRANCH', DETAIL = v_item.id::TEXT;
      END IF;
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'SERIAL_NOT_AVAILABLE', DETAIL = v_item.id::TEXT;
    END IF;
    v_total := v_total + v_updated;
  END LOOP;

  RETURN v_total;
END;
$$;

-- Asigna series al entregar un pedido (misma transacción que deliverOrder).
-- p_lines: [{"productId": "uuid", "quantity": n, "stockMovementId": "uuid|null", "serialIds": [...]}].
CREATE OR REPLACE FUNCTION public.fnc_product_serials_assign_order_delivery(
  p_tenant_id UUID,
  p_branch_id UUID,
  p_order_id UUID,
  p_lines JSONB,
  p_user_id UUID
)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_customer_id UUID;
  v_line RECORD;
  v_serial_ids UUID[];
  v_order_item_id UUID;
  v_updated INTEGER;
  v_total INTEGER := 0;
  v_value TEXT;
BEGIN
  IF p_lines IS NULL OR jsonb_typeof(p_lines) <> 'array' OR jsonb_array_length(p_lines) = 0 THEN
    RETURN 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_lines) line
    LEFT JOIN public.products p
      ON p.id = NULLIF(line ->> 'productId', '')::UUID AND p.tenant_id = p_tenant_id
    WHERE COALESCE(p.requires_serial, FALSE) = TRUE
       OR jsonb_array_length(COALESCE(line -> 'serialIds', '[]'::jsonb)) > 0
  ) THEN
    RETURN 0;
  END IF;

  SELECT o.customer_id INTO v_customer_id
  FROM public.orders o
  WHERE o.id = p_order_id AND o.tenant_id = p_tenant_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'SERIAL_ORDER_NOT_FOUND';
  END IF;

  SELECT serial INTO v_value
  FROM jsonb_array_elements(p_lines) line,
       jsonb_array_elements_text(COALESCE(line -> 'serialIds', '[]'::jsonb)) serial
  GROUP BY serial
  HAVING count(*) > 1
  LIMIT 1;
  IF FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'SERIAL_DUPLICATE_IN_PAYLOAD', DETAIL = v_value;
  END IF;

  FOR v_line IN
    SELECT
      NULLIF(line ->> 'productId', '')::UUID AS product_id,
      (line ->> 'quantity')::NUMERIC AS quantity,
      NULLIF(line ->> 'stockMovementId', '')::UUID AS stock_movement_id,
      COALESCE(
        ARRAY(SELECT jsonb_array_elements_text(COALESCE(line -> 'serialIds', '[]'::jsonb))::UUID),
        ARRAY[]::UUID[]
      ) AS serial_ids,
      p.requires_serial
    FROM jsonb_array_elements(p_lines) line
    LEFT JOIN public.products p
      ON p.id = NULLIF(line ->> 'productId', '')::UUID AND p.tenant_id = p_tenant_id
  LOOP
    v_serial_ids := v_line.serial_ids;

    IF v_line.requires_serial IS NULL THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'SERIAL_PRODUCT_NOT_FOUND';
    END IF;
    IF NOT v_line.requires_serial THEN
      IF cardinality(v_serial_ids) > 0 THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'SERIAL_NOT_REQUIRED', DETAIL = v_line.product_id::TEXT;
      END IF;
      CONTINUE;
    END IF;

    IF v_line.quantity IS NULL OR v_line.quantity <> trunc(v_line.quantity) THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'SERIAL_QUANTITY_NOT_INTEGER', DETAIL = v_line.product_id::TEXT;
    END IF;
    IF cardinality(v_serial_ids) <> v_line.quantity THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'SERIAL_COUNT_MISMATCH',
        DETAIL = format('productId=%s expected=%s received=%s', v_line.product_id, v_line.quantity, cardinality(v_serial_ids));
    END IF;

    SELECT CASE WHEN count(*) = 1 THEN min(oi.id::TEXT)::UUID END INTO v_order_item_id
    FROM public.order_items oi
    WHERE oi.order_id = p_order_id AND oi.product_id = v_line.product_id;

    WITH updated AS (
      UPDATE public.product_serials s
      SET status = 'SOLD',
          sale_id = NULL,
          sale_item_id = NULL,
          order_id = p_order_id,
          order_item_id = v_order_item_id,
          customer_id = v_customer_id,
          out_stock_movement_id = v_line.stock_movement_id,
          sold_at = NOW(),
          version = s.version + 1,
          updated_at = NOW()
      WHERE s.id = ANY(v_serial_ids)
        AND s.tenant_id = p_tenant_id
        AND s.product_id = v_line.product_id
        AND s.branch_id = p_branch_id
        AND s.status = 'AVAILABLE'
      RETURNING s.id, s.location_id
    ), events AS (
      INSERT INTO public.product_serial_events (
        tenant_id, serial_id, event_type, from_status, to_status, branch_id, from_location_id,
        reference_type, reference_id, stock_movement_id, user_id
      )
      SELECT p_tenant_id, u.id, 'DELIVERED', 'AVAILABLE', 'SOLD', p_branch_id, u.location_id,
        'ORDER', p_order_id, v_line.stock_movement_id, p_user_id
      FROM updated u
    )
    SELECT count(*) INTO v_updated FROM updated;

    IF v_updated <> cardinality(v_serial_ids) THEN
      IF EXISTS (
        SELECT 1 FROM public.product_serials s
        WHERE s.id = ANY(v_serial_ids) AND s.tenant_id = p_tenant_id
          AND s.product_id = v_line.product_id AND s.status = 'AVAILABLE'
          AND s.branch_id <> p_branch_id
      ) THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'SERIAL_WRONG_BRANCH', DETAIL = v_line.product_id::TEXT;
      END IF;
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'SERIAL_NOT_AVAILABLE', DETAIL = v_line.product_id::TEXT;
    END IF;
    v_total := v_total + v_updated;
  END LOOP;

  RETURN v_total;
END;
$$;

-- Anulación de una venta POS: con retorno de inventario las series pasan a RETURNED;
-- sin retorno quedan SOLD con el evento VOIDED_NOT_RETURNED. Idempotente. Sin series: retorna 0.
CREATE OR REPLACE FUNCTION public.prc_product_serials_mark_returned(
  p_tenant_id UUID,
  p_sale_id UUID,
  p_return_inventory BOOLEAN,
  p_user_id UUID,
  p_reason TEXT
)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  IF p_return_inventory THEN
    WITH updated AS (
      UPDATE public.product_serials s
      SET status = 'RETURNED',
          version = s.version + 1,
          updated_at = NOW()
      WHERE s.tenant_id = p_tenant_id
        AND s.sale_id = p_sale_id
        AND s.status = 'SOLD'
      RETURNING s.id, s.branch_id, s.location_id
    ), events AS (
      INSERT INTO public.product_serial_events (
        tenant_id, serial_id, event_type, from_status, to_status, branch_id, to_location_id,
        reference_type, reference_id, user_id, reason
      )
      SELECT p_tenant_id, u.id, 'RETURNED', 'SOLD', 'RETURNED', u.branch_id, u.location_id,
        'SALE_VOID', p_sale_id, p_user_id, p_reason
      FROM updated u
    )
    SELECT count(*) INTO v_count FROM updated;
    RETURN v_count;
  END IF;

  WITH targets AS (
    SELECT s.id, s.branch_id
    FROM public.product_serials s
    WHERE s.tenant_id = p_tenant_id
      AND s.sale_id = p_sale_id
      AND s.status = 'SOLD'
      AND NOT EXISTS (
        SELECT 1 FROM public.product_serial_events e
        WHERE e.tenant_id = p_tenant_id
          AND e.serial_id = s.id
          AND e.event_type = 'VOIDED_NOT_RETURNED'
          AND e.reference_id = p_sale_id
      )
  ), events AS (
    INSERT INTO public.product_serial_events (
      tenant_id, serial_id, event_type, from_status, to_status, branch_id,
      reference_type, reference_id, user_id, reason
    )
    SELECT p_tenant_id, t.id, 'VOIDED_NOT_RETURNED', 'SOLD', 'SOLD', t.branch_id,
      'SALE_VOID', p_sale_id, p_user_id, p_reason
    FROM targets t
    RETURNING 1
  )
  SELECT count(*) INTO v_count FROM events;
  RETURN v_count;
END;
$$;

-- Inspección y bloqueo: RETURNED|BLOCKED -> AVAILABLE|BLOCKED|WRITTEN_OFF y AVAILABLE -> BLOCKED.
-- WRITTEN_OFF exige el movimiento OUT de 1 unidad (ajuste) creado en la misma transacción.
CREATE OR REPLACE FUNCTION public.fnc_product_serials_inspect(
  p_tenant_id UUID,
  p_serial_id UUID,
  p_result TEXT,
  p_reason TEXT,
  p_user_id UUID,
  p_stock_movement_id UUID
)
RETURNS VARCHAR
LANGUAGE plpgsql
AS $$
DECLARE
  v_serial public.product_serials%ROWTYPE;
  v_event TEXT;
BEGIN
  IF p_result NOT IN ('AVAILABLE', 'BLOCKED', 'WRITTEN_OFF') THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'SERIAL_INSPECTION_RESULT_INVALID';
  END IF;
  IF p_reason IS NULL OR length(btrim(p_reason)) < 5 THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'SERIAL_REASON_REQUIRED';
  END IF;

  SELECT * INTO v_serial
  FROM public.product_serials s
  WHERE s.id = p_serial_id AND s.tenant_id = p_tenant_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'SERIAL_NOT_FOUND';
  END IF;

  v_event := CASE
    WHEN v_serial.status = 'RETURNED' AND p_result = 'AVAILABLE' THEN 'INSPECTED_AVAILABLE'
    WHEN v_serial.status = 'BLOCKED' AND p_result = 'AVAILABLE' THEN 'UNBLOCKED'
    WHEN v_serial.status IN ('RETURNED', 'AVAILABLE') AND p_result = 'BLOCKED' THEN 'BLOCKED'
    WHEN v_serial.status IN ('RETURNED', 'BLOCKED') AND p_result = 'WRITTEN_OFF' THEN 'WRITTEN_OFF'
  END;
  IF v_event IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'SERIAL_TRANSITION_INVALID',
      DETAIL = format('%s -> %s', v_serial.status, p_result);
  END IF;

  IF p_result = 'WRITTEN_OFF' AND NOT EXISTS (
    SELECT 1 FROM public.stock_movements m
    WHERE m.id = p_stock_movement_id
      AND m.tenant_id = p_tenant_id
      AND m.product_id = v_serial.product_id
      AND m.branch_id = v_serial.branch_id
      AND m.type = 'OUT'
      AND m.quantity = 1
  ) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'SERIAL_MOVEMENT_INVALID';
  END IF;

  UPDATE public.product_serials s
  SET status = p_result,
      out_stock_movement_id = CASE WHEN p_result = 'WRITTEN_OFF' THEN p_stock_movement_id ELSE s.out_stock_movement_id END,
      version = s.version + 1,
      updated_at = NOW()
  WHERE s.id = v_serial.id;

  INSERT INTO public.product_serial_events (
    tenant_id, serial_id, event_type, from_status, to_status, branch_id, from_location_id,
    reference_type, reference_id, stock_movement_id, user_id, reason
  ) VALUES (
    p_tenant_id, v_serial.id, v_event, v_serial.status, p_result, v_serial.branch_id, v_serial.location_id,
    'INSPECTION', v_serial.id,
    CASE WHEN p_result = 'WRITTEN_OFF' THEN p_stock_movement_id END,
    p_user_id, btrim(p_reason)
  );

  RETURN p_result;
END;
$$;

-- Baja por ajuste de salida: series en existencia (AVAILABLE, RETURNED, BLOCKED) -> WRITTEN_OFF.
CREATE OR REPLACE FUNCTION public.fnc_product_serials_write_off(
  p_tenant_id UUID,
  p_branch_id UUID,
  p_product_id UUID,
  p_serial_ids UUID[],
  p_stock_movement_id UUID,
  p_user_id UUID,
  p_reason TEXT
)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_count INTEGER := cardinality(COALESCE(p_serial_ids, ARRAY[]::UUID[]));
  v_distinct INTEGER;
  v_movement_quantity NUMERIC;
  v_updated INTEGER;
BEGIN
  IF v_count = 0 THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'SERIAL_REQUIRED';
  END IF;
  SELECT count(DISTINCT x) INTO v_distinct FROM unnest(p_serial_ids) x;
  IF v_distinct <> v_count THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'SERIAL_DUPLICATE_IN_PAYLOAD';
  END IF;

  SELECT m.quantity INTO v_movement_quantity
  FROM public.stock_movements m
  WHERE m.id = p_stock_movement_id
    AND m.tenant_id = p_tenant_id
    AND m.product_id = p_product_id
    AND m.branch_id = p_branch_id
    AND m.type = 'OUT';
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'SERIAL_MOVEMENT_INVALID';
  END IF;
  IF v_movement_quantity <> v_count THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'SERIAL_COUNT_MISMATCH',
      DETAIL = format('expected=%s received=%s', v_movement_quantity, v_count);
  END IF;

  CREATE TEMP TABLE IF NOT EXISTS tmp_product_serials_write_off (
    id UUID, from_status VARCHAR(20), location_id UUID
  ) ON COMMIT DROP;
  TRUNCATE tmp_product_serials_write_off;

  INSERT INTO tmp_product_serials_write_off (id, from_status, location_id)
  SELECT s.id, s.status, s.location_id
  FROM public.product_serials s
  WHERE s.id = ANY(p_serial_ids)
    AND s.tenant_id = p_tenant_id
    AND s.product_id = p_product_id
    AND s.branch_id = p_branch_id
    AND s.status IN ('AVAILABLE', 'RETURNED', 'BLOCKED')
  FOR UPDATE;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated <> v_count THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'SERIAL_NOT_AVAILABLE';
  END IF;

  UPDATE public.product_serials s
  SET status = 'WRITTEN_OFF',
      out_stock_movement_id = p_stock_movement_id,
      version = s.version + 1,
      updated_at = NOW()
  FROM tmp_product_serials_write_off t
  WHERE s.id = t.id;

  INSERT INTO public.product_serial_events (
    tenant_id, serial_id, event_type, from_status, to_status, branch_id, from_location_id,
    reference_type, reference_id, stock_movement_id, user_id, reason
  )
  SELECT p_tenant_id, t.id, 'WRITTEN_OFF', t.from_status, 'WRITTEN_OFF', p_branch_id, t.location_id,
    'ADJUSTMENT', p_stock_movement_id, p_stock_movement_id, p_user_id, p_reason
  FROM tmp_product_serials_write_off t;

  RETURN v_count;
END;
$$;

-- Cambio de ubicación dentro de la misma sucursal. No crea movimientos de inventario.
-- p_location_id NULL deja las series sin ubicación.
CREATE OR REPLACE FUNCTION public.fnc_product_serials_move_location(
  p_tenant_id UUID,
  p_serial_ids UUID[],
  p_location_id UUID,
  p_user_id UUID,
  p_reason TEXT
)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_count INTEGER := cardinality(COALESCE(p_serial_ids, ARRAY[]::UUID[]));
  v_found INTEGER;
  v_moved INTEGER;
BEGIN
  IF v_count = 0 THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'SERIAL_REQUIRED';
  END IF;

  CREATE TEMP TABLE IF NOT EXISTS tmp_product_serials_move (
    id UUID, branch_id UUID, from_location_id UUID, status VARCHAR(20)
  ) ON COMMIT DROP;
  TRUNCATE tmp_product_serials_move;

  INSERT INTO tmp_product_serials_move (id, branch_id, from_location_id, status)
  SELECT s.id, s.branch_id, s.location_id, s.status
  FROM public.product_serials s
  WHERE s.id = ANY(p_serial_ids) AND s.tenant_id = p_tenant_id
  FOR UPDATE;

  GET DIAGNOSTICS v_found = ROW_COUNT;
  IF v_found <> (SELECT count(DISTINCT x) FROM unnest(p_serial_ids) x) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'SERIAL_NOT_FOUND';
  END IF;
  IF EXISTS (SELECT 1 FROM tmp_product_serials_move WHERE status NOT IN ('AVAILABLE', 'RETURNED', 'BLOCKED')) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'SERIAL_NOT_IN_STOCK';
  END IF;
  IF p_location_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM tmp_product_serials_move t
    WHERE NOT EXISTS (
      SELECT 1 FROM public.inventory_locations l
      WHERE l.id = p_location_id
        AND l.tenant_id = p_tenant_id
        AND l.branch_id = t.branch_id
        AND l.is_active = TRUE
    )
  ) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'SERIAL_LOCATION_INVALID';
  END IF;

  UPDATE public.product_serials s
  SET location_id = p_location_id,
      version = s.version + 1,
      updated_at = NOW()
  FROM tmp_product_serials_move t
  WHERE s.id = t.id
    AND t.from_location_id IS DISTINCT FROM p_location_id;
  GET DIAGNOSTICS v_moved = ROW_COUNT;

  INSERT INTO public.product_serial_events (
    tenant_id, serial_id, event_type, from_status, to_status, branch_id,
    from_location_id, to_location_id, reference_type, reference_id, user_id, reason
  )
  SELECT p_tenant_id, t.id, 'LOCATION_CHANGED', t.status, t.status, t.branch_id,
    t.from_location_id, p_location_id, 'LOCATION', p_location_id, p_user_id, p_reason
  FROM tmp_product_serials_move t
  WHERE t.from_location_id IS DISTINCT FROM p_location_id;

  RETURN v_moved;
END;
$$;

-- 5. Menú "Series" en Inventario y permisos (SUPER_ADMIN, SUPER_USER, ADMIN).
WITH inventory_parent AS (
  SELECT id, tenant_id
  FROM public.menu_items
  WHERE key = 'INVENTORY'
    AND deleted_at IS NULL
)
INSERT INTO public.menu_items (
  tenant_id, key, module, label, route, icon, parent_id, sort_order,
  visible, below_main_menu, metadata
)
SELECT
  parent.tenant_id,
  'INVENTORY_SERIALS',
  'inventory',
  'Series',
  '/{tenant}/inventory/serials',
  'Barcode',
  parent.id,
  109,
  TRUE,
  FALSE,
  '{}'::jsonb
FROM inventory_parent parent
ON CONFLICT (tenant_id, key) WHERE deleted_at IS NULL
DO UPDATE SET
  module = EXCLUDED.module,
  label = EXCLUDED.label,
  route = EXCLUDED.route,
  icon = EXCLUDED.icon,
  parent_id = EXCLUDED.parent_id,
  sort_order = EXCLUDED.sort_order,
  visible = TRUE,
  below_main_menu = FALSE,
  updated_at = NOW(),
  deleted_at = NULL;

INSERT INTO public.role_menu_permissions (
  tenant_id, role_id, menu_item_id, access_level, actions
)
SELECT
  menu_item.tenant_id,
  role.id,
  menu_item.id,
  'WRITE',
  '{"read": true, "create": true, "update": true, "delete": false}'::jsonb
FROM public.menu_items menu_item
INNER JOIN public.roles role ON role.nombre IN ('SUPER_ADMIN', 'SUPER_USER', 'ADMIN')
WHERE menu_item.key = 'INVENTORY_SERIALS'
  AND menu_item.deleted_at IS NULL
ON CONFLICT (tenant_id, role_id, menu_item_id)
DO UPDATE SET access_level = 'WRITE', actions = EXCLUDED.actions;
