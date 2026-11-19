-- V119: devolucion de series al anular una venta que viene de un pedido.
-- OpenSpec: corregir-anulacion-ventas-pedido
-- Requiere V117 (product_serials). Las series entregadas en un pedido quedan con order_id y sin sale_id,
-- por eso prc_product_serials_mark_returned (que busca por sale_id) no las encuentra.
-- Esta funcion nueva elige, por producto, las series SOLD del pedido (las mas recientes primero)
-- hasta la cantidad facturada en la venta anulada. No modifica prc_product_serials_mark_returned
-- ni el flujo de anulacion de ventas del POS.
-- Sin control transaccional: lo aporta apply_single_migration.sh.

DO $$
BEGIN
  IF to_regclass('public.product_serials') IS NULL
    OR to_regclass('public.product_serial_events') IS NULL THEN
    RAISE EXCEPTION 'ORDER_SALE_VOID_SERIALS_V117_REQUIRED';
  END IF;
  IF to_regprocedure('public.prc_product_serials_mark_returned_order_sale(uuid,uuid,uuid,jsonb,boolean,uuid,text)') IS NOT NULL THEN
    RAISE EXCEPTION 'ORDER_SALE_VOID_SERIALS_V119_ALREADY_APPLIED';
  END IF;
END $$;

-- p_lines: [{"product_id": "<uuid>", "quantity": 2}, ...] con la cantidad facturada por producto.
CREATE OR REPLACE FUNCTION public.prc_product_serials_mark_returned_order_sale(
  p_tenant_id UUID,
  p_sale_id UUID,
  p_order_id UUID,
  p_lines JSONB,
  p_return_inventory BOOLEAN,
  p_user_id UUID,
  p_reason TEXT
)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_line RECORD;
  v_count INTEGER := 0;
  v_affected INTEGER;
BEGIN
  IF p_lines IS NULL OR jsonb_typeof(p_lines) <> 'array' THEN
    RAISE EXCEPTION 'SERIAL_ORDER_SALE_LINES_INVALID';
  END IF;

  FOR v_line IN
    SELECT (line ->> 'product_id')::UUID AS product_id,
           floor(COALESCE((line ->> 'quantity')::NUMERIC, 0))::INTEGER AS quantity
    FROM jsonb_array_elements(p_lines) AS line
  LOOP
    IF v_line.quantity <= 0 THEN
      CONTINUE;
    END IF;

    IF p_return_inventory THEN
      WITH targets AS (
        SELECT s.id
        FROM public.product_serials s
        WHERE s.tenant_id = p_tenant_id
          AND s.order_id = p_order_id
          AND s.product_id = v_line.product_id
          AND s.sale_id IS NULL
          AND s.status = 'SOLD'
        ORDER BY s.sold_at DESC NULLS LAST, s.id DESC
        LIMIT v_line.quantity
        FOR UPDATE
      ), updated AS (
        UPDATE public.product_serials s
        SET status = 'RETURNED',
            version = s.version + 1,
            updated_at = NOW()
        FROM targets t
        WHERE s.id = t.id
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
      SELECT count(*) INTO v_affected FROM updated;
    ELSE
      WITH targets AS (
        SELECT s.id, s.branch_id
        FROM public.product_serials s
        WHERE s.tenant_id = p_tenant_id
          AND s.order_id = p_order_id
          AND s.product_id = v_line.product_id
          AND s.sale_id IS NULL
          AND s.status = 'SOLD'
          AND NOT EXISTS (
            SELECT 1 FROM public.product_serial_events e
            WHERE e.tenant_id = p_tenant_id
              AND e.serial_id = s.id
              AND e.event_type = 'VOIDED_NOT_RETURNED'
              AND e.reference_id = p_sale_id
          )
        ORDER BY s.sold_at DESC NULLS LAST, s.id DESC
        LIMIT v_line.quantity
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
      SELECT count(*) INTO v_affected FROM events;
    END IF;

    v_count := v_count + COALESCE(v_affected, 0);
  END LOOP;

  RETURN v_count;
END;
$$;
