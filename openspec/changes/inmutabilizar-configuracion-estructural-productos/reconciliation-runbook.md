# Intervencion separada: 33 unidades historicas sin lote

Estado: `PENDING`. Este runbook no fue ejecutado.
Dictamen de auditoria: `READY_FOR_AUTHORIZATION` solo despues del preflight final y con escritores detenidos.

## Evidencia read-only local

- Destino observado: `127.0.0.1:5432/manus_tienda_qa`, usuario `postgres`, `default_transaction_read_only=on` durante discovery.
- Producto: `eb1e6abe-58a6-4673-a8ad-f02e245c14f4`.
- Un tenant y una sucursal contienen cuatro movimientos.
- Kardex: `133.000`.
- Vinculos netos en `stock_movement_lots`: `100.000`.
- Saldos `inventory_lot_balances`: `100.000`.
- Causa exacta: movimiento `0109316d-c101-4c06-9abc-65471a582874`, `IN 33.000`, `ADJUSTMENT`, `stock_initial_load`, sin vinculo de lote.
- El `IN 100.000` de compra y el par `OUT 6.000` / `IN 6.000` de venta anulada tienen vinculos completos al lote comprado posteriormente.
- El producto exige lote y vencimiento. No se observo ubicacion en el alcance.
- Datos autorizados para esta intervencion: lote `LEGACY-001`, vencimiento `2027-01-31`, costo unitario historico `2791.00 COP`, cantidad `33.000`.

## Datos que negocio debe autorizar

Antes de ejecutar se deben aprobar y usar exactamente:

- `legacy_lot_code`: `LEGACY-001`. No usar el lote de la compra posterior.
- `legacy_expiration_date`: `2027-01-31`, real y vigente.
- `legacy_unit_cost`: `2791.00`, costo historico aprobado; no copiar el costo actual por suposicion.
- backup verificable y ventana sin servicios escritores.

## Ventana exclusiva y preflight inmediato

La intervencion requiere una ventana local sin escritores. No se deben forzar cierres con `pg_terminate_backend`.

1. Detener ordenadamente los servicios locales que puedan escribir inventario, incluyendo el proceso identificado como `backend-facturacion-electronica`.
2. Cerrar las sesiones DBeaver conectadas a `manus_tienda_qa`.
3. No iniciar API, importadores, workers ni pruebas con fixtures durante la intervencion.
4. Cargar `scripts/config/db.env`, exigir `127.0.0.1:5432/manus_tienda_qa` y usar `psql` explicito. No usar `api/.env` ni fallback remoto.
5. Ejecutar inmediatamente antes de `BEGIN`, en la misma conexion, solo estas verificaciones read-only:

```sql
SELECT current_database(), inet_server_addr(), inet_server_port(), current_user,
       current_setting('transaction_read_only'), current_setting('transaction_isolation');

SELECT application_name, state, backend_type, COUNT(*) AS sessions,
       COUNT(*) FILTER (WHERE backend_xid IS NOT NULL) AS sessions_in_transaction
FROM pg_stat_activity
WHERE datname = current_database()
  AND pid <> pg_backend_pid()
GROUP BY application_name, state, backend_type
ORDER BY application_name, state;
```

La identidad debe ser `manus_tienda_qa`, `127.0.0.1`, puerto `5432`, usuario `postgres`. Debe haber cero sesiones externas activas o en transaccion. Una sesion `idle` de un servicio escritor tambien bloquea la autorizacion: puede despertar despues del chequeo.

El operador debe volver a comprobar producto, movimiento original, lote `LEGACY-001`, Kardex `133.000`, vinculos `100.000`, balances `100.000` y el backup antes de continuar. Si algun valor cambio, detenerse.

## Riesgo de orden de locks

V108 y `StockMovementService` adquieren primero `inventory_lock_stock_scope(tenant, branch, product)`. El flujo de `stock-import`, en cambio, puede crear lotes antes de insertar movimientos y antes de que el trigger tome ese advisory lock. Esta inversion puede bloquear o producir espera circular si la carga masiva corre durante la reconciliacion.

No se modifica `stock-import` ni V108 en esta intervencion. La mitigacion obligatoria es la ventana exclusiva y la comprobacion inmediata de `pg_stat_activity`. El runbook no debe ejecutarse con importadores, API o workers activos.

## SQL exacto propuesto

El operador debe cargar las credenciales con el mecanismo oficial del repositorio y verificar nuevamente localhost. No se incluyen credenciales aqui.

```sql
\set ON_ERROR_STOP on
\set legacy_lot_code 'LEGACY-001'
\set legacy_expiration_date '2027-01-31'
\set legacy_unit_cost '2791.00'

BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

SELECT set_config(
  'manus.reconcile.legacy_lot_code',
  :'legacy_lot_code',
  true
);
SELECT set_config(
  'manus.reconcile.legacy_expiration_date',
  :'legacy_expiration_date',
  true
);
SELECT set_config(
  'manus.reconcile.legacy_unit_cost',
  :'legacy_unit_cost',
  true
);

SELECT public.inventory_lock_stock_scope(
  'b159d683-4648-4bb2-9496-d3e3f84867e9'::uuid,
  '91d488bc-a45c-4734-a4f5-e23b98b521b7'::uuid,
  'eb1e6abe-58a6-4673-a8ad-f02e245c14f4'::uuid
);

DO $reconcile$
DECLARE
  c_tenant_id CONSTANT uuid := 'b159d683-4648-4bb2-9496-d3e3f84867e9';
  c_branch_id CONSTANT uuid := '91d488bc-a45c-4734-a4f5-e23b98b521b7';
  c_product_id CONSTANT uuid := 'eb1e6abe-58a6-4673-a8ad-f02e245c14f4';
  c_movement_id CONSTANT uuid := '0109316d-c101-4c06-9abc-65471a582874';
  c_reference_id CONSTANT uuid := '0ec96350-54c8-4d6f-a347-38877b629175';
  c_quantity CONSTANT numeric(14,3) := 33.000;
  v_lot_code text := upper(trim(current_setting('manus.reconcile.legacy_lot_code')));
  v_expiration_date date := current_setting('manus.reconcile.legacy_expiration_date')::date;
  v_unit_cost numeric(14,2) := current_setting('manus.reconcile.legacy_unit_cost')::numeric(14,2);
  v_lot_id uuid := gen_random_uuid();
  v_movement stock_movements%ROWTYPE;
  v_kardex numeric(14,3);
  v_linked numeric(14,3);
  v_balanced numeric(14,3);
  v_count bigint;
BEGIN
  IF current_database() <> 'manus_tienda_qa'
     OR inet_server_addr() <> '127.0.0.1'::inet
     OR inet_server_port() <> 5432
     OR current_user <> 'postgres' THEN
    RAISE EXCEPTION 'unauthorized database identity';
  END IF;

  IF v_lot_code IN ('', 'REEMPLAZAR_CON_CODIGO_REAL') THEN
    RAISE EXCEPTION 'legacy_lot_code must be verified';
  END IF;
  IF v_expiration_date <= CURRENT_DATE THEN
    RAISE EXCEPTION 'legacy_expiration_date must be real and current';
  END IF;
  IF v_unit_cost < 0 THEN
    RAISE EXCEPTION 'legacy_unit_cost cannot be negative';
  END IF;

  PERFORM 1
  FROM products
  WHERE id = c_product_id
    AND tenant_id = c_tenant_id
    AND requires_lot = true
    AND requires_expiration = true
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'product scope or lot policy changed';
  END IF;

  PERFORM 1
  FROM tenant_branches
  WHERE id = c_branch_id
    AND tenant_id = c_tenant_id
  FOR KEY SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'branch does not belong to tenant';
  END IF;

  SELECT *
  INTO STRICT v_movement
  FROM stock_movements
  WHERE id = c_movement_id
    AND tenant_id = c_tenant_id
    AND branch_id = c_branch_id
    AND product_id = c_product_id
  FOR UPDATE;

  IF v_movement.type <> 'IN'
     OR v_movement.quantity <> c_quantity
     OR v_movement.reference_type <> 'ADJUSTMENT'
     OR v_movement.reference_table <> 'stock_initial_load'
     OR v_movement.reference_id <> c_reference_id
     OR v_movement.stock_before <> 0.000
     OR v_movement.stock_after <> 33.000 THEN
    RAISE EXCEPTION 'historical movement no longer matches certified evidence';
  END IF;

  PERFORM 1
  FROM inventory_lots
  WHERE tenant_id = c_tenant_id
    AND branch_id = c_branch_id
    AND product_id = c_product_id
  FOR UPDATE;

  PERFORM 1
  FROM inventory_lot_balances
  WHERE tenant_id = c_tenant_id
    AND branch_id = c_branch_id
    AND product_id = c_product_id
  FOR UPDATE;

  PERFORM 1
  FROM stock_movement_lots
  WHERE tenant_id = c_tenant_id
    AND product_id = c_product_id
  FOR UPDATE;

  SELECT COUNT(*) INTO v_count
  FROM stock_movement_lots
  WHERE tenant_id = c_tenant_id
    AND stock_movement_id = c_movement_id;
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'initial movement already has lot links';
  END IF;

  SELECT COUNT(*) INTO v_count
  FROM stock_movements
  WHERE tenant_id = c_tenant_id
    AND branch_id = c_branch_id
    AND product_id = c_product_id;
  IF v_count <> 4 THEN
    RAISE EXCEPTION 'movement baseline changed';
  END IF;

  SELECT COUNT(*) INTO v_count
  FROM stock_movement_lots sml
  JOIN stock_movements sm
    ON sm.id = sml.stock_movement_id
   AND sm.tenant_id = sml.tenant_id
  WHERE sml.tenant_id = c_tenant_id
    AND sm.branch_id = c_branch_id
    AND sml.product_id = c_product_id;
  IF v_count <> 3 THEN
    RAISE EXCEPTION 'lot-link baseline changed';
  END IF;

  SELECT COUNT(*) INTO v_count
  FROM inventory_lots
  WHERE tenant_id = c_tenant_id
    AND branch_id = c_branch_id
    AND product_id = c_product_id;
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'lot baseline changed';
  END IF;

  SELECT COUNT(*) INTO v_count
  FROM inventory_lot_balances
  WHERE tenant_id = c_tenant_id
    AND branch_id = c_branch_id
    AND product_id = c_product_id;
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'lot-balance baseline changed';
  END IF;

  SELECT COUNT(*) INTO v_count
  FROM inventory_lots
  WHERE tenant_id = c_tenant_id
    AND branch_id = c_branch_id
    AND product_id = c_product_id
    AND upper(lot_code) = v_lot_code;
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'legacy lot code already exists';
  END IF;

  SELECT
    COALESCE(SUM(CASE WHEN type = 'IN' THEN quantity ELSE -quantity END), 0)::numeric(14,3)
  INTO v_kardex
  FROM stock_movements
  WHERE tenant_id = c_tenant_id
    AND branch_id = c_branch_id
    AND product_id = c_product_id;

  SELECT
    COALESCE(SUM(CASE WHEN sm.type = 'IN' THEN sml.quantity ELSE -sml.quantity END), 0)::numeric(14,3)
  INTO v_linked
  FROM stock_movement_lots sml
  JOIN stock_movements sm
    ON sm.id = sml.stock_movement_id
   AND sm.tenant_id = sml.tenant_id
  WHERE sml.tenant_id = c_tenant_id
    AND sm.branch_id = c_branch_id
    AND sml.product_id = c_product_id;

  SELECT COALESCE(SUM(quantity_on_hand), 0)::numeric(14,3)
  INTO v_balanced
  FROM inventory_lot_balances
  WHERE tenant_id = c_tenant_id
    AND branch_id = c_branch_id
    AND product_id = c_product_id;

  IF v_kardex <> 133.000
     OR v_kardex - v_linked <> c_quantity
     OR v_kardex - v_balanced <> c_quantity THEN
    RAISE EXCEPTION 'certified 33.000 gap changed: kardex %, linked %, balanced %',
      v_kardex, v_linked, v_balanced;
  END IF;

  INSERT INTO inventory_lots (
    id, tenant_id, branch_id, product_id, supplier_id, purchase_id,
    purchase_item_id, lot_code, expiration_date, received_at, unit_cost,
    status, is_legacy, created_at, updated_at
  ) VALUES (
    v_lot_id, c_tenant_id, c_branch_id, c_product_id, NULL, NULL,
    NULL, v_lot_code, v_expiration_date, v_movement.created_at, v_unit_cost,
    'ACTIVE', true, now(), now()
  );

  INSERT INTO stock_movement_lots (
    id, tenant_id, stock_movement_id, product_id, lot_id, location_id,
    quantity, created_at
  ) VALUES (
    gen_random_uuid(), c_tenant_id, c_movement_id, c_product_id, v_lot_id,
    NULL, c_quantity, now()
  );

  INSERT INTO inventory_lot_balances (
    id, tenant_id, branch_id, product_id, lot_id, location_id,
    quantity_on_hand, quantity_reserved, last_movement_at, created_at,
    updated_at
  ) VALUES (
    gen_random_uuid(), c_tenant_id, c_branch_id, c_product_id, v_lot_id,
    NULL, c_quantity, 0.000, v_movement.created_at, now(), now()
  );

  SELECT
    COALESCE(SUM(CASE WHEN sm.type = 'IN' THEN sml.quantity ELSE -sml.quantity END), 0)::numeric(14,3)
  INTO v_linked
  FROM stock_movement_lots sml
  JOIN stock_movements sm
    ON sm.id = sml.stock_movement_id
   AND sm.tenant_id = sml.tenant_id
  WHERE sml.tenant_id = c_tenant_id
    AND sm.branch_id = c_branch_id
    AND sml.product_id = c_product_id;

  SELECT COALESCE(SUM(quantity_on_hand), 0)::numeric(14,3)
  INTO v_balanced
  FROM inventory_lot_balances
  WHERE tenant_id = c_tenant_id
    AND branch_id = c_branch_id
    AND product_id = c_product_id;

  IF v_kardex <> 133.000 OR v_linked <> v_kardex OR v_balanced <> v_kardex THEN
    RAISE EXCEPTION 'postcondition failed: kardex %, linked %, balanced %',
      v_kardex, v_linked, v_balanced;
  END IF;
END
$reconcile$;

COMMIT;
```

## Resultado esperado

- `stock_movements`: sin cambios; sigue en cuatro filas y `133.000` netas.
- `inventory_lots`: un lote legacy adicional, separado del lote comprado.
- `stock_movement_lots`: un vinculo adicional de `33.000` al movimiento inicial.
- `inventory_lot_balances`: un balance adicional sin ubicacion por `33.000`.
- Kardex, vinculos y balances: `133.000` cada uno.
- Ninguna venta, pago, caja o documento electronico cambia.

Si cualquier precondicion falla, PostgreSQL aborta la transaccion. No se debe reintentar a ciegas.

## Procedimiento compensatorio posterior a `COMMIT`

Este procedimiento es separado del runbook principal. No forma parte de la ejecucion normal. Requiere nueva autorizacion expresa, backup vigente y el mismo preflight de ventana exclusiva.

Solo se puede ejecutar si el lote legacy no fue consumido, reservado, transferido ni referenciado por operaciones posteriores. Las guardas obligatorias son:

- el lote sigue siendo `ACTIVE`, `is_legacy = true`, sin referencias de compra;
- existe exactamente un balance para el lote, con `quantity_on_hand = 33.000`, `quantity_reserved = 0.000` y `location_id IS NULL`;
- existe exactamente un vinculo, pertenece al movimiento historico original, tiene `quantity = 33.000` y `location_id IS NULL`;
- no existe otro vinculo, movimiento, transferencia, reserva o balance para el lote;
- el Kardex sigue teniendo cuatro movimientos y `133.000` netos;
- ventas, pagos, caja y documentos electronicos no se modifican.

La compensacion debe ejecutarse en una transaccion nueva, con `SET LOCAL lock_timeout`, `SET LOCAL statement_timeout` y el mismo advisory lock V108:

```sql
SELECT public.inventory_lock_stock_scope(
  'b159d683-4648-4bb2-9496-d3e3f84867e9'::uuid,
  '91d488bc-a45c-4734-a4f5-e23b98b521b7'::uuid,
  'eb1e6abe-58a6-4673-a8ad-f02e245c14f4'::uuid
);
```

Despues de bloquear producto, movimiento, lotes, balances y vinculos, debe localizar el lote por el ambito completo y `upper(lot_code) = 'LEGACY-001'`. Si alguna guarda falla, debe hacer `ROLLBACK`. Solo con todas las guardas satisfechas puede eliminar, en este orden, el balance legacy, el vinculo historico y el lote legacy; luego debe verificar que no cambio ningun `stock_movement` ni snapshot y hacer `COMMIT`.

La compensacion no puede borrar por `lot_id` recibido externamente ni por un criterio global. Su objetivo es revertir solo las tres filas creadas por esta intervencion y dejar nuevamente visible la diferencia historica de `33.000`.

La legibilidad de `D:\Backups\MANUS_POS\QA\manus_tienda_qa_20261018_%timestamp%.backup` mediante `pg_restore --list` confirma que el archivo es legible. No confirma una restauracion completa ni sustituye el backup vigente requerido para la ventana.
