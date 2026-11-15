# Evidencia — incorporar-trazabilidad-series-productos

Rama: `feature/develop/incorporar-trazabilidad-series-productos` (base `develop` @ `88a1d87`), sin commit.
Discovery y decisiones: proyecto "manus tienda" → `claude/series-productos-discovery.md`, `claude/series-productos-decisiones.md`.

## Fase 1 — Base de datos (V117)
- `scripts/database/migrations/V117__product_serials.sql`:
  - `products.requires_serial` + `chk_products_serial_rules` (solo inventariable, `UNIT`/`UND`, sin lote ni vencimiento);
  - `product_serials` con estado actual, ubicación opcional y unicidad `(tenant_id, product_id, serial_number_normalized)`;
  - `product_serial_events`, historial de solo inserción protegido por trigger;
  - 9 funciones (`fnc_product_serials_register`, `_assign_sale`, `_assign_order_delivery`, `prc_product_serials_mark_returned`, `_inspect`, `_write_off`, `_move_location`, más la normalización y el trigger);
  - menú `INVENTORY_SERIALS` con permiso para SUPER_ADMIN, SUPER_USER y ADMIN.
  - No modifica `inventory_create_sale_v2`, `sales`, `sale_items`, `stock_movements` ni los lotes (lo verifica la prueba `test_sale_process_is_not_modified`).
- Rollback `scripts/database/rollbacks/V117__product_serials_rollback.sql`: falla si hay series o productos con serie.
- Pruebas: `scripts/database/tests/test_v117_product_serials_migration.py`, `v117_product_serials_scenarios.sql`, `fixtures/v117_minimal_schema.sql`.

### Validación (Cowork, 2026-11-14, PostgreSQL 16.15 desechable sobre el esquema mínimo)
- La migración aplica en una sola transacción. Una segunda aplicación se rechaza con `PRODUCT_SERIALS_V117_ALREADY_APPLIED`. El rollback queda bloqueado con datos, funciona sin datos y la migración se puede volver a aplicar después.
- 51 escenarios funcionales OK:
  - reglas del producto;
  - recepción: conteo = movimiento, duplicados en la carga y en la BD, formato, ubicación por línea y por serie, ubicación de otra sucursal rechazada;
  - venta: conteo, otra sucursal, producto sin serie, serie ya vendida, retorno temprano sin series;
  - anulación con y sin retorno, idempotente;
  - inspección y bloqueo;
  - mover ubicación;
  - baja por ajuste;
  - entrega de pedido;
  - historial inmutable;
  - conciliación series = kardex.
- Concurrencia real con dos sesiones vendiendo la misma serie: la segunda espera el bloqueo de fila y recibe `SERIAL_NOT_AVAILABLE`, y la serie queda solo en la primera venta.
- `python -m unittest scripts/database/tests/test_v117_product_serials_migration.py` con `MANUS_SQL_SCRATCH_PG`: 7/7 (incluida la corrida funcional y la verificación del runner).

## Fase 2 — Producto (`requiresSerial`)
- API:
  - `product.entity.ts` y `product.service.ts` (`validateSerialRules`; `requiresSerial` en `PRODUCT_STRUCTURAL_FIELDS`, inmutable tras la creación);
  - `product.repository.ts` (select e insert);
  - `product.controller.ts`.
- Web:
  - casilla "Requiere número de serie" en `ProductOperationalSection` (deshabilitada al editar, si no es inventariable o si no se vende por unidad; excluyente con lote, vencimiento y perecedero);
  - validación y payload en `ProductForm`;
  - tipos, DTO y `payload.ts` (campo inmutable).
- Pruebas: `product.service.spec.ts` 51/51 (5 nuevas, más `requiresSerial` en la prueba de campos estructurales). `tsc --noEmit` del API OK; `tsc` de la web sin errores en código de producción.

## Fase 3 — Módulo de series (lectura y prevalidación)
- `api/src/modules/inventory/serials/`:
  - `product-serial.repository.ts`, `product-serial.service.ts`, `product-serial.controller.ts`;
  - `product-serial.normalize.ts` (misma regla de formato que V117);
  - `product-serial.errors.ts` (traduce `SERIAL_*` a 400/404/409 con mensaje en español, para las fases 4–7).
  - Registrado en `inventory.module.ts` (también exporta `ProductSerialService`).
- Endpoints (solo lectura): `POST inventory/serials/validate`, `POST inventory/serials/parse`, `GET inventory/serials/available`, `GET inventory/serials/lookup`, `GET inventory/serials`, `GET inventory/serials/:id/history`. Las consultas se filtran por tenant y por las sucursales permitidas al usuario (SUPER_ADMIN/SUPER_USER: todas).
- Validación (Cowork, 2026-11-14):
  - `product-serial.service.spec.ts` 13/13: prevalidación, archivos CSV/XLSX, límites, sucursales, traducción de errores, permisos por endpoint;
  - `tsc --noEmit` del API OK;
  - las 8 consultas del repositorio ejecutadas contra PostgreSQL 16 con V117 y datos de los escenarios, con resultados esperados.

## Fase 4 — Recepción de compras con series
- API:
  - `PurchaseController.receive` acepta `serialNumbers` (o `serial_numbers`) por línea;
  - `PurchaseService.receivePurchase`, para productos con `requires_serial`, llama a `ProductSerialService.registerForReceipt` dentro de la misma transacción, con el movimiento `IN` de la línea y la ubicación de la línea como predeterminada (`fnc_product_serials_register`);
  - sin series → `SERIAL_REQUIRED`; series en un producto sin serie → `SERIAL_NOT_REQUIRED`; lote, vencimiento o costo de lote en un producto con serie → rechazo; cualquier error revierte toda la recepción;
  - `validateReceiveLotPayload` admite `locationId` solo para productos con serie (7b.3); el resto de productos sin lote mantiene el rechazo actual.
- Web:
  - `PurchaseReceiveForm`: etiqueta "Requiere serie", fila con contador "N de M series", botón "Capturar series" y ubicación de la línea; no deja revisar ni confirmar si el conteo no coincide con la cantidad o la cantidad no es entera; el payload envía `serialNumbers` y `locationId`;
  - `SerialCaptureDialog`: escáner o teclado (Enter), pegado de varias líneas, archivo `.csv/.txt/.xlsx` vía `POST inventory/serials/parse`, lista con quitar, y "Validar y guardar" con `POST inventory/serials/validate`; si la serie existe en otro producto muestra el aviso y pide "Guardar de todas formas" (no bloquea);
  - mientras el diálogo está abierto se pausa la captura de códigos de barras del formulario;
  - la ubicación es por línea; la ubicación distinta por serie (el API ya la admite) queda para la fase 7b.4.
- Validación (Cowork, 2026-11-14):
  - `purchase.service.spec.ts` + `product-serial.service.spec.ts`: 74/74;
  - `serial-capture.spec.ts` + `purchase-receive-lines.spec.ts`: 19/19;
  - `tsc --noEmit` web: sin errores fuera de los specs (los errores en specs ya existían);
  - gobernanza: manifiesto válido; se reasignó la propiedad actual de los archivos de compras (de `modernizar-captura-barcode-orders-purchases` y `soportar-productos-no-inventariables`; la entrada de este último quedó vacía y se retiró de `current_ownership`, su asociación histórica en `changes[]` se conserva).

## Fase 5 — POS y anulaciones (cambio mínimo en venta)
- Regla del propietario respetada: `inventory_create_sale_v2`, `consumeDeliveryLots`, FEFO y las migraciones no cambian. El payload que recibe la función de venta es el mismo (las líneas no llevan `serialIds`).
- API:
  - `SaleLineRequest` (UNIT) acepta `serialIds` opcional; `ensureSaleInput` exige UUIDs (máximo 2000) y rechaza `serialIds` en líneas de peso.
  - `prepareSaleItemsForPricing` arma la lista de líneas con serie solo si el producto tiene `requiresSerial` o la línea trae series; para el resto no hay llamadas nuevas.
  - `createSale`: justo después de `createSaleWithFunction`, en la misma transacción, `ProductSerialService.assignForSale` → `fnc_product_serials_assign_sale` (conteo = cantidad, serie AVAILABLE de la misma sucursal y producto, bloqueo por fila). Cualquier error revierte la venta completa; el error informa el `productId` de la línea.
  - `cancelSale` (devuelve inventario): `markReturnedForSale` con devolución → series `RETURNED`.
  - `applySaleVoid` (anulación local, con nota crédito y reintento del worker): `returnInventory` ≠ false → `RETURNED`; `returnInventory` = false → evento `VOIDED_NOT_RETURNED` (la serie sigue SOLD).
  - Pruebas: `sale.service.spec.ts` 45/45 (7 nuevas), `operational-sales.service.spec.ts` + `product-serial.service.spec.ts` 38/38 y 15/15 (4 nuevas).
- Web (POS):
  - Al agregar un producto con serie (búsqueda, catálogo o escáner) se abre `PosSerialPickerDialog`: lista de series disponibles con ubicación ("SERIE · UBICACIÓN"), búsqueda y escaneo con Enter (si hay más de 200, busca la serie exacta en el servidor); la cantidad es la cantidad de series elegidas, limitada al stock.
  - En el carrito, la línea muestra "N de M series", las series y "Cambiar series"; los botones de cantidad abren el selector.
  - Antes de cobrar se valida que cada producto con serie tenga sus series; el payload agrega `serialIds` solo en esas líneas.
  - Rechazo `SERIAL_*` del API: es definitivo (la venta se revirtió). El carrito vuelve a borrador, se limpian las series del producto y se reabre el selector con el mensaje; el siguiente cobro usa una nueva Idempotency-Key.
  - Las series quedan en el carrito persistido (localStorage).
  - Pruebas: `pos-serials.spec.ts`, `sale-recovery.spec.ts`, `posCart.spec.ts`: 25/25; `tsc --noEmit` web sin errores nuevos.

## Fase 6 — Entrega de pedidos con series
- Sin cambios en `consumeDeliveryLots`, FEFO, el bloqueo por producto ni la idempotencia de la entrega (V116). Las series entran al hash de la Idempotency-Key solo cuando la línea las trae.
- API:
  - `OrderController.deliver` acepta `serial_ids` (o `serialIds`) por línea y solo lo pasa cuando viene.
  - `deliverOrder` valida los UUID antes de abrir la transacción; `loadDeliveryLotPolicies` también lee `requires_serial`. Por cada línea con serie guarda `{productId, quantity, stockMovementId, serialIds}` con el OUT creado, y al final llama a `ProductSerialService.assignForOrderDelivery` → `fnc_product_serials_assign_order_delivery` (serie AVAILABLE de la sucursal del pedido, conteo = cantidad, evento DELIVERED). Un error revierte toda la entrega e informa el `productId`.
  - Productos sin serie: sin llamadas nuevas.
  - Las ventas que se facturan desde un pedido no reasignan series (quedan ligadas al pedido); como esas ventas no devuelven inventario al anularse, las series siguen SOLD, coherente con el kardex.
  - Pruebas: `order.service.spec.ts` 27/27 (4 nuevas), `order.controller.spec.ts` + `product-serial.service.spec.ts` 21/21 (2 nuevas).
- Web (`OrderDeliverForm`):
  - Para productos con serie, "Entregar ahora" es el botón "Seleccionar series" (mismo selector del POS, con ubicación); la cantidad es el número de series, hasta el pendiente de la línea. El lector de códigos abre el selector de la primera línea con pendiente.
  - Series repetidas entre líneas del mismo producto: marcadas "En otra línea".
  - Rechazo `SERIAL_*`: se limpian las series del producto y, tras el aviso, se reabre el selector con el mensaje.
  - `tsc --noEmit` y ESLint de los archivos tocados sin errores.

## Fase 7 — Ajustes, carga de stock, inspección y página de Series
- Carga masiva de stock (`stock-import`): un producto con serie se rechaza si la fila cambia el stock ("ajusta su stock desde Ajustes de inventario indicando las series"); si deja el mismo stock la fila se omite. La plantilla precargada ya no incluye productos con serie.
- Ajustes de inventario (`StockAdjustmentService`): producto con serie → entrada con series nuevas y ubicación (`fnc_product_serials_register`, origen ADJUSTMENT) o salida eligiendo series disponibles que quedan WRITTEN_OFF (`fnc_product_serials_write_off`) con el OUT del ajuste; rechaza datos de lote; un producto sin serie rechaza series. Web `StockAdjustmentForm`: "Capturar series" (mismo diálogo de compras) o "Seleccionar series" (selector del POS) y ubicación.
- Endpoints nuevos (INVENTORY_SERIALS WRITE; SUPER_ADMIN, SUPER_USER y ADMIN):
  - `POST /inventory/serials/:id/inspect` `{result, reason}`: RETURNED → AVAILABLE/BLOCKED/WRITTEN_OFF, BLOCKED → AVAILABLE/WRITTEN_OFF, AVAILABLE → BLOCKED. WRITTEN_OFF crea el OUT de 1 unidad (ajuste) con bloqueo de stock por producto, en la misma transacción.
  - `PATCH /inventory/serials/location` `{serialIds, locationId|null, reason}`: cambio de ubicación sin kardex; valida sucursal del usuario.
- Página `/inventory/serials` (el menú "Series" ya existía): búsqueda por serie/producto/SKU, filtros de estado y sucursal, aviso "N series devueltas pendientes de inspección", historial de eventos, inspeccionar/bloquear y mover ubicación (una o varias).
- Pruebas: `stock-adjustment.service.spec.ts`, `product-serial.service.spec.ts`, `stock-import.resolver.spec.ts` y `stock-import.service.spec.ts`: 66/66; web `serial-labels.spec.ts` 2/2; `tsc --noEmit` API y web sin errores.
- Corrección tras la QA: el listado `/inventory/products` (de donde sale el producto del formulario de ajuste) no traía `requiresSerial`, así que el formulario no mostraba la sección de series y el API respondía "Debes indicar las series del producto". `InventoryRepository`/`InventoryService` ahora lo incluyen (`inventory.service.spec.ts` 6/6).
- Pendientes de la fase 7 cerrados antes del PR:
  - Selector de series (POS y entregas): aviso "Hay N unidades devueltas de este producto pendientes de inspección" (consulta `available?status=RETURNED`).
  - `GET /inventory/serials/location-counts` (series AVAILABLE, RETURNED y BLOCKED por ubicación, limitado a las sucursales del usuario) y columna "Series" en /inventory/locations.
  - Recepción de compras: en el diálogo de captura cada serie puede tener una ubicación distinta a la de la línea; el payload envía `{serialNumber, locationId}` solo para esas series.
  - Inactivar una ubicación con series en existencia: el API responde 409 `LOCATION_HAS_SERIALS` y la web deshabilita "Inactivar" con el mensaje para moverlas antes (`inventory-location.service.spec.ts` 13/13).
  - Pruebas: `product-serial.service.spec.ts` 22/22; `tsc --noEmit` y ESLint web sin errores.

## Validación en Windows (propietario, 2026-11-14)
- `openspec.cmd validate incorporar-trazabilidad-series-productos --strict`: válido.
- API `npx tsx --test src/**/*.spec.ts`: 1149 pruebas, 1141 pass, 0 fail, 8 omitidas (5 más que la línea base de 1136: las nuevas de producto). `npm run build` OK.
- Web `npm run lint` sin advertencias; `npm run build` OK.
- V117 aplicada en la base local real `manus_prd_local_test` con `node "Claude outputs\aplicar-V117-local.cjs" --aplicar`: SHA-256 `89e6d21052a051a5c3c057c158f3353672dec286d23184f66777fd60935b9410`; 9 funciones, columna `requires_serial` y menú "Series" en 3 tenants. Esto confirma las FK y columnas contra el esquema real. Sin registro en `migrations_history` (método local, igual que V116).

## Pendiente
- [ ] QA de los pendientes de la fase 7: aviso de devueltas en el selector (POS y entrega), columna "Series" en Ubicaciones, intentar inactivar una ubicación con series (bloqueado) y una compra con 2 series en ubicaciones distintas.
- [x] QA de la fase 7 (propietario, 2026-11-14, local): inspección de la 3H61260000017 a disponible (aparece en el selector del POS), bloqueo/desbloqueo, baja, mover ubicación; ajuste de entrada de 2 unidades con las series 3H61260000023 y 3H61260000024 en 002 - Licores (stock 0 → 2) y ajuste de salida de la 023 (stock 2 → 1, serie de baja); carga masiva con el inverter en cantidad 5: fila rechazada con el mensaje de series y "Confirmar carga" bloqueado.
- Ajuste tras la QA: la fila rechazada de la carga masiva mostraba "Antes 0"; ahora muestra el stock real y la diferencia pedida (`stock-import` 27/27).
- [x] QA de la fase 6 (propietario, 2026-11-14, local): pedido cbe7d30e entregado por un ADMIN en otro navegador con la serie 3H61260000021 (evento DELIVERED, SOLD con order_id). En el POS (otra sesión) la cuenta 2 tenía la 021 en el carrito: al cobrar fue rechazada, el selector se reabrió con la 022 y la venta aee0b605 (SETP990900015) se cobró. Regresión de lotes: lote LT122112 de CEC01002003 con salida por entrega de pedido (-2) y venta POS 238537db (-1, SETP990900016) desde la misma ubicación 002, sin discrepancias.
- Validación en Windows de la fase 6 (commit e98484ce): OpenSpec strict válido; API 1185 pruebas, 1177 pass, 0 fail, 8 omitidas, build OK; web 30/30, lint y `next build` OK.
- [x] QA de la fase 5 (propietario, 2026-11-14, local, FE en habilitación): ventas e01f29ee (012), 4ddeb2de (020 + 301), 32a426ba (017), 8a44074f (018) y 27380bf0 (019, venta mixta con licor y producto normal), todas con FE aceptada. Misma serie en dos cuentas: la cuenta 1 cobró y la cuenta 2 fue rechazada ("ya no están disponibles"), el selector se reabrió y la venta se cobró con otra serie. Anulación de 32a426ba con nota crédito NCC1500004 y devolución: 017 quedó RETURNED con su evento. Kardex = series: stock 1 (la 017 devuelta, pendiente de inspección).
- Ajuste tras la QA: el selector marca "En Cuenta N" y no deja elegir las series que ya están en otra cuenta del mismo POS (`collectSerialsInOtherAccounts`); entre cajas distintas sigue protegiendo el API al cobrar.
- Pendiente de QA: cancelar venta (`cancelSale`) y anular sin devolución (evento VOIDED_NOT_RETURNED).
- [x] QA de la fase 4 (propietario, 2026-11-14, local): compra 04DB607A con 4 unidades de "Inverter 12.000 BTU, 110V" recibida con 4 series y ubicación 002 - Licores; compra 6CC170C6 rechazó en el diálogo las series ya registradas (3H61260000017, 3H61260000018) y luego quedó RECEIVED (2 de 2). Pendiente opcional: recepción parcial y aviso de serie existente en otro producto.
- Validación en Windows de la fase 4 (commit 5bee8a69): OpenSpec strict válido; API 1168 pruebas, 1160 pass, 0 fail, 8 omitidas, `npm run build` OK; web 19/19, lint sin advertencias, `next build` OK.
- [ ] QA del formulario: crear un producto con serie (UNIT, sin lote); la casilla se deshabilita al editar; no se combina con lote ni vencimiento.
- Nota: el menú "Series" ya aparece en local, pero la página `/inventory/serials` llega en la fase 7; mientras tanto abre la página de "no encontrado".
