-- corregir-lotes-entrega-pedidos · D3 · Corrección histórica de entregas de pedidos sin lote
-- ESTADO: BORRADOR para revisión del propietario. NO forma parte del deploy ni de las migraciones.
-- Ejecutar primero en QA. Termina en ROLLBACK: cambia a COMMIT solo después de revisar el resultado.
--
-- Qué hace, para UN producto y UNA sucursal:
--   1. Lista las salidas de "Entregar pedido" (reference_table = 'orders') sin vínculo de lote.
--   2. Para cada una, en orden cronológico, descuenta lotes vigentes por FEFO (misma regla que el POS)
--      y crea el vínculo en stock_movement_lots. No toca stock_movements (el kardex ya es correcto).
--   3. Muestra la verificación: suma de lotes = kardex y ninguna salida de pedido sin lote.
-- Requisito previo: conteo físico de los lotes del producto. Si el conteo indica otro lote, no usar FEFO:
-- ajustar la asignación a mano.
-- Idempotente: solo procesa salidas que aún no tienen vínculo.

BEGIN;

-- Parámetros (reemplazar):
--   tenant  : 00000000-0000-0000-0000-000000000001
--   producto: 27293fcf-27bc-4ea8-be00-94404d33c5e7  (CEC01002003, ejercicio controlado)
--   sucursal: ab41d3da-6686-4de3-9191-875a5a7da5a5  (Sucursal Principal)

-- 1. Diagnóstico previo
SELECT sm.id, sm.created_at, sm.quantity, sm.reference_id AS pedido
FROM stock_movements sm
WHERE sm.tenant_id = '00000000-0000-0000-0000-000000000001'
  AND sm.product_id = '27293fcf-27bc-4ea8-be00-94404d33c5e7'
  AND sm.branch_id = 'ab41d3da-6686-4de3-9191-875a5a7da5a5'
  AND sm.type = 'OUT'
  AND sm.reference_table = 'orders'
  AND NOT EXISTS (
    SELECT 1 FROM stock_movement_lots sml
    WHERE sml.stock_movement_id = sm.id AND sml.tenant_id = sm.tenant_id
  )
ORDER BY sm.created_at;

-- 2. Corrección
DO $$
DECLARE
  v_tenant  uuid := '00000000-0000-0000-0000-000000000001';
  v_product uuid := '27293fcf-27bc-4ea8-be00-94404d33c5e7';
  v_branch  uuid := 'ab41d3da-6686-4de3-9191-875a5a7da5a5';
  v_movement record;
  v_balance record;
  v_remaining numeric;
  v_from_lot numeric;
BEGIN
  PERFORM public.inventory_lock_stock_scope(v_tenant, v_branch, v_product);

  FOR v_movement IN
    SELECT sm.id, sm.quantity
    FROM stock_movements sm
    WHERE sm.tenant_id = v_tenant
      AND sm.product_id = v_product
      AND sm.branch_id = v_branch
      AND sm.type = 'OUT'
      AND sm.reference_table = 'orders'
      AND NOT EXISTS (
        SELECT 1 FROM stock_movement_lots sml
        WHERE sml.stock_movement_id = sm.id AND sml.tenant_id = sm.tenant_id
      )
    ORDER BY sm.created_at
  LOOP
    v_remaining := v_movement.quantity;

    FOR v_balance IN
      SELECT balance.id AS balance_id, balance.lot_id, balance.location_id, balance.quantity_available
      FROM inventory_lot_balances balance
      INNER JOIN inventory_lots lot
        ON lot.id = balance.lot_id
       AND lot.tenant_id = balance.tenant_id
       AND lot.branch_id = balance.branch_id
       AND lot.product_id = balance.product_id
      WHERE balance.tenant_id = v_tenant
        AND balance.branch_id = v_branch
        AND balance.product_id = v_product
        AND balance.quantity_available > 0
        AND lot.status = 'ACTIVE'
        AND (lot.expiration_date IS NULL OR lot.expiration_date >= CURRENT_DATE)
      ORDER BY lot.expiration_date ASC NULLS LAST, lot.received_at ASC, lot.lot_code ASC, lot.id ASC
      FOR UPDATE OF balance
    LOOP
      EXIT WHEN v_remaining <= 0;
      v_from_lot := LEAST(v_remaining, v_balance.quantity_available);

      UPDATE inventory_lot_balances
      SET quantity_on_hand = quantity_on_hand - v_from_lot,
          last_movement_at = NOW(),
          updated_at = NOW()
      WHERE id = v_balance.balance_id
        AND tenant_id = v_tenant
        AND quantity_available >= v_from_lot;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'saldo insuficiente en el lote % al corregir el movimiento %', v_balance.lot_id, v_movement.id;
      END IF;

      INSERT INTO stock_movement_lots (id, tenant_id, stock_movement_id, product_id, lot_id, location_id, quantity, created_at)
      VALUES (gen_random_uuid(), v_tenant, v_movement.id, v_product, v_balance.lot_id, v_balance.location_id, v_from_lot, NOW());

      v_remaining := v_remaining - v_from_lot;
    END LOOP;

    IF v_remaining > 0 THEN
      RAISE EXCEPTION 'los lotes vigentes no alcanzan para el movimiento % (faltan %)', v_movement.id, v_remaining;
    END IF;
  END LOOP;
END $$;

-- 3. Verificación: lotes = kardex y sin salidas de pedido sin lote
SELECT
  (SELECT COALESCE(SUM(quantity) FILTER (WHERE type = 'IN'), 0) - COALESCE(SUM(quantity) FILTER (WHERE type = 'OUT'), 0)
     FROM stock_movements
    WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
      AND product_id = '27293fcf-27bc-4ea8-be00-94404d33c5e7'
      AND branch_id = 'ab41d3da-6686-4de3-9191-875a5a7da5a5') AS kardex,
  (SELECT COALESCE(SUM(quantity_on_hand), 0)
     FROM inventory_lot_balances
    WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
      AND product_id = '27293fcf-27bc-4ea8-be00-94404d33c5e7'
      AND branch_id = 'ab41d3da-6686-4de3-9191-875a5a7da5a5') AS suma_lotes;

SELECT l.lot_code, b.quantity_on_hand, b.quantity_available
FROM inventory_lot_balances b
JOIN inventory_lots l ON l.id = b.lot_id AND l.tenant_id = b.tenant_id
WHERE b.tenant_id = '00000000-0000-0000-0000-000000000001'
  AND b.product_id = '27293fcf-27bc-4ea8-be00-94404d33c5e7'
ORDER BY l.received_at;

ROLLBACK;  -- cambiar a COMMIT solo después de revisar
