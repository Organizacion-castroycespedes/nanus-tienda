-- Revierte una carga masiva de stock (reference_table = 'stock_initial_load')
-- generando movimientos inversos. Nunca borra filas.
--
-- Uso (psql):
--   Simulación (termina en ROLLBACK y muestra el plan):
--     psql "$DATABASE_URL" -v reference_id=<uuid> -f scripts/database/tools/revert_stock_initial_load.sql
--   Aplicar:
--     psql "$DATABASE_URL" -v reference_id=<uuid> -v apply=1 -f scripts/database/tools/revert_stock_initial_load.sql
--
-- El reference_id sale de la respuesta del commit (referenceId) o de:
--   SELECT DISTINCT reference_id, MIN(created_at)
--   FROM stock_movements WHERE reference_table = 'stock_initial_load'
--   GROUP BY reference_id ORDER BY 2 DESC;
--
-- Reglas:
--   * Falla si la carga no existe o ya fue revertida (reference_table = 'stock_initial_load_revert').
--   * Falla si algún stock de sucursal o saldo de lote quedaría negativo
--     (por ejemplo, porque ya se vendió lo que entró en la carga).

\set ON_ERROR_STOP on

BEGIN;

CREATE TEMP TABLE revert_stock_plan ON COMMIT DROP AS
WITH original AS (
  SELECT
    sm.id AS original_id,
    sm.tenant_id,
    sm.product_id,
    sm.branch_id,
    sm.quantity,
    CASE WHEN sm.type = 'IN' THEN 'OUT' ELSE 'IN' END AS reverse_type,
    CASE WHEN sm.type = 'IN' THEN -sm.quantity ELSE sm.quantity END AS reverse_delta,
    sm.created_at
  FROM stock_movements sm
  WHERE sm.reference_table = 'stock_initial_load'
    AND sm.reference_id = :'reference_id'::uuid
),
current_stock AS (
  SELECT
    sm.tenant_id,
    sm.product_id,
    sm.branch_id,
    COALESCE(SUM(sm.quantity) FILTER (WHERE sm.type = 'IN'), 0)
      - COALESCE(SUM(sm.quantity) FILTER (WHERE sm.type = 'OUT'), 0) AS stock
  FROM stock_movements sm
  JOIN (SELECT DISTINCT tenant_id, product_id, branch_id FROM original) keys
    ON keys.tenant_id = sm.tenant_id
   AND keys.product_id = sm.product_id
   AND keys.branch_id = sm.branch_id
  GROUP BY sm.tenant_id, sm.product_id, sm.branch_id
)
SELECT
  gen_random_uuid() AS new_id,
  :'reference_id'::uuid AS reference_id,
  o.*,
  cs.stock
    + SUM(o.reverse_delta) OVER (
        PARTITION BY o.tenant_id, o.product_id, o.branch_id
        ORDER BY o.created_at, o.original_id
        ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
      )
    - o.reverse_delta AS stock_before
FROM original o
JOIN current_stock cs
  ON cs.tenant_id = o.tenant_id
 AND cs.product_id = o.product_id
 AND cs.branch_id = o.branch_id;

DO $$
DECLARE
  v_count integer;
  v_tenant uuid;
  v_reference uuid;
BEGIN
  SELECT COUNT(*), MIN(tenant_id::text)::uuid INTO v_count, v_tenant FROM revert_stock_plan;
  IF v_count = 0 THEN
    RAISE EXCEPTION 'No hay movimientos de carga inicial con ese reference_id';
  END IF;

  SELECT sm.reference_id INTO v_reference
  FROM stock_movements sm
  WHERE sm.reference_table = 'stock_initial_load_revert'
    AND sm.reference_id = (SELECT reference_id FROM revert_stock_plan LIMIT 1)
  LIMIT 1;
  IF v_reference IS NOT NULL THEN
    RAISE EXCEPTION 'La carga % ya fue revertida', v_reference;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('stock-import:' || v_tenant::text));

  IF EXISTS (SELECT 1 FROM revert_stock_plan WHERE stock_before + reverse_delta < 0) THEN
    RAISE EXCEPTION 'La reversa dejaría stock negativo en al menos una sucursal';
  END IF;
END $$;

SELECT
  p.product_id,
  pr.sku,
  p.branch_id,
  p.reverse_type,
  p.quantity,
  p.stock_before,
  p.stock_before + p.reverse_delta AS stock_after
FROM revert_stock_plan p
JOIN products pr ON pr.id = p.product_id
ORDER BY pr.sku, p.created_at;

INSERT INTO stock_movements (
  id, tenant_id, product_id, type, quantity, reference_type, reference_id,
  branch_id, terminal_id, pos_session_code, user_id, reference_table,
  stock_before, stock_after, created_at
)
SELECT
  p.new_id, p.tenant_id, p.product_id, p.reverse_type, p.quantity, 'ADJUSTMENT',
  p.reference_id, p.branch_id, NULL, NULL, NULL, 'stock_initial_load_revert',
  p.stock_before, p.stock_before + p.reverse_delta, now()
FROM revert_stock_plan p;

WITH lot_changes AS (
  SELECT
    sml.tenant_id,
    sml.product_id,
    sml.lot_id,
    p.branch_id,
    SUM(p.reverse_delta) AS delta
  FROM stock_movement_lots sml
  JOIN revert_stock_plan p ON p.original_id = sml.stock_movement_id
  WHERE sml.lot_id IS NOT NULL
  GROUP BY sml.tenant_id, sml.product_id, sml.lot_id, p.branch_id
)
UPDATE inventory_lot_balances b
SET quantity_on_hand = b.quantity_on_hand + lc.delta,
    last_movement_at = now(),
    updated_at = now()
FROM lot_changes lc
WHERE b.tenant_id = lc.tenant_id
  AND b.branch_id = lc.branch_id
  AND b.product_id = lc.product_id
  AND b.lot_id = lc.lot_id
  AND b.location_id IS NULL;

INSERT INTO stock_movement_lots (
  tenant_id, stock_movement_id, product_id, lot_id, location_id, quantity, created_at
)
SELECT sml.tenant_id, p.new_id, sml.product_id, sml.lot_id, NULL, sml.quantity, now()
FROM stock_movement_lots sml
JOIN revert_stock_plan p ON p.original_id = sml.stock_movement_id;

\if :{?apply}
  COMMIT;
  \echo 'Reversa aplicada.'
\else
  ROLLBACK;
  \echo 'Simulación: no se guardó nada. Use -v apply=1 para aplicar.'
\endif
