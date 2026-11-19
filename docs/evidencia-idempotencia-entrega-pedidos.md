# Evidencia — idempotencia-entrega-pedidos

Rama: `feature/develop/idempotencia-entrega-pedidos` (base `develop` @ `2c07b94f`), sin commit.

## Cambios
- `scripts/database/migrations/V116__order_delivery_idempotency.sql` + rollback: tabla `order_delivery_idempotency` (mismo diseño que `purchase_receipt_idempotency`, V109).
- `api/src/modules/inventory/services/order.service.ts`:
  - `deliverOrder` recibe `idempotencyKey` (sexto parámetro, opcional en el servicio);
  - bloquea el pedido con `SELECT … FOR UPDATE` antes de leer los ítems;
  - reclama la clave antes de validar el estado, para que un reintento después de COMPLETED devuelva el resultado guardado;
  - completa la clave dentro de la misma transacción.
- `api/src/modules/inventory/controllers/order.controller.ts`: `POST /orders/:id/deliver` exige `Idempotency-Key` (400 si falta).
- `web/modules/inventory/components/OrderDeliverForm.tsx`: una clave por apertura del formulario, enviada en el encabezado.
- Sin cambios en `consumeDeliveryLots` (FEFO), POS, `inventory_create_sale_v2` ni la facturación del pedido.

## Validación automática (Cowork, 2026-11-14, VM Linux; tsx no corre por esbuild de Windows, se compiló con tsc y se ejecutó con node --test)
- `order.service.spec.ts`: 23/23. Las 19 existentes (incluidas las 5 de FEFO) y 4 nuevas: bloqueo del pedido antes de leer ítems, replay con la misma clave (una sola salida), 409 con otro contenido, clave inválida rechazada antes de abrir la transacción.
- `order.controller.spec.ts`: 4/4 (nueva: 400 sin encabezado y propagación de la clave).
- `test_v116_order_delivery_idempotency_migration.py`: 4/4.
- `tsc -p api/tsconfig.json --noEmit`: OK.
- `openspec validate idempotencia-entrega-pedidos --strict`: OK (propietario, Windows).

## Validación en Windows (propietario, 2026-11-14)
- `cd api && npx tsx --test src/**/*.spec.ts`: 1144 pruebas, 1136 pass, 0 fail, 8 omitidas (requieren base de datos de prueba).
- `cd api && npm run build`: OK.
- `cd web && npm run lint`: sin advertencias ni errores. `npm run build`: OK. (La web no tiene script `test`.)
- `git diff --stat`: 6 archivos modificados (395+/10−) y 5 nuevos, todos del change.

## Pendiente
- [x] V116 aplicada en la base local `manus_prd_local_test` (propietario, 2026-11-14) con `node "Claude outputs\aplicar-V116-local.cjs" --aplicar`: una transacción, tabla `order_delivery_idempotency` con 10 columnas e índice. SHA-256 del archivo: `222151863cc2356e2c7f8b9c6e39ad3d3f8de2daa77cda4fd86cafea27e493bb`. Sin registro en `migrations_history` (mismo método que V111 local; sin bash en Windows).
- [ ] Aplicar V116 en QA con el runner oficial `scripts/database/apply_single_migration.sh` (bash).
- [x] QA-0 (propietario, 2026-11-14 11:02): entrega del pedido `ebcf6ef0-…` (3 u) con la API y la web nuevas. Una sola salida en `stock_movements` (11:02:32.441) y una fila `COMPLETED` en `order_delivery_idempotency` (clave `f0e5c1a2-…`, completada a las 11:02:32.401, en la misma transacción).
- [x] QA manual:
  1. [x] PASS (propietario, 2026-11-14 11:07): doble clic en "Entregar" deja una sola salida (`count = 1` en `stock_movements` del pedido);
  2. [x] PASS (propietario, 2026-11-14 11:23): pedido `1f841ef3` (4 u, #12 THHN/THWN rojo CENTELSA) entregado a la vez desde dos sesiones (ADMIN y SUPER_USER). Una muestra "Entrega registrada" y la otra recibe 400 "order already completed". Kardex del pedido: `count = 1`, `sum = 4.000`;
  3. [x] PASS (propietario, 2026-11-14 11:37): esa entrega consumió el lote L3 de CEC01002005 por FEFO (sin vencimiento, desempate por recepción): compra +5, venta POS −1, entrega de pedido −4, en mano 0. Conciliación del producto 0/0 y lote sin discrepancias;
  4. [x] PASS (propietario, 2026-11-14 11:29): factura del pedido entregado, venta `4d9e926d-…` confirmada y pagada ($11.424, 4 u), FE aceptada SETP990900009.

## Observaciones (fuera de alcance)
- El rechazo concurrente muestra el texto del backend en inglés ("order already completed"). Opcional: traducirlo en `OrderDeliverForm.tsx`, como ya se hace con el stock insuficiente.
- "Pedido guardado, pero falló la impresión MOCK": aviso preexistente de periféricos en ambiente local, sin relación con este change.
