# Tasks: fortalecer productos e inventario

## Fase 0: diagnostico

- [x] Revisar estructura `api/`, `backend-reporteria/`, `web/`, `docs/`, `scripts/`, `README.md`, `AGENTS.md`.
- [x] Identificar modulos de productos, inventario, compras, ventas, caja, tenants y sucursales.
- [x] Identificar entidades, servicios, controladores, endpoints y validaciones actuales.
- [x] Identificar reglas actuales de entrada/salida de inventario.
- [x] Identificar reportes, tickets, PDFs y patrones de `backend-reporteria/`.
- [x] Identificar rutas, componentes, formularios, tablas, filtros y patrones visuales de `web/`.
- [x] Identificar tablas, funciones, triggers/vistas y scripts SQL relacionados.
- [x] Crear `docs/diagnostico-productos-inventario.md`.

## Fase 1: especificacion

- [x] Crear estructura OpenSpec base para `productos`, `inventario`, `precios`, `reporteria-inventario`.
- [x] Crear `proposal.md`.
- [x] Crear `design.md`.
- [x] Crear `tasks.md`.
- [x] Crear specs top-level en `openspec/specs/*/spec.md`.
- [x] Crear specs del cambio en `openspec/changes/fortalecer-productos-inventario/specs/*/spec.md`.
- [ ] Resolver preguntas abiertas de negocio antes de implementar.
- [ ] Validar propuesta con responsables de operacion, POS, compras y reporteria.

## Fase 2: modelo de datos

- [x] Crear `docs/modelo-datos-productos-inventario-fase-2.md`.
- [x] Definir nombres fisicos de tablas/columnas nuevas.
- [x] Definir estrategia para productos existentes sin lote.
- [x] Definir modelo de lote, vencimiento y ubicacion fisica.
- [x] Definir modelo de existencia por lote/sucursal.
- [x] Definir modelo de historial de precios.
- [x] Definir modelo de alertas operativas.
- [x] Definir indices por `tenant_id`, `branch_id`, `product_id`, lote y vencimiento.
- [x] Definir restricciones de integridad y checks.
- [x] Definir migracion de saldos actuales desde `stock_movements`.
- [x] Definir rollback y plan de respaldo.
- [x] Preparar scripts SQL solo cuando la especificacion sea aprobada.

## Fase 2.1: migraciones SQL preparatorias

- [x] Crear migracion principal `scripts/database/migrations/20260601_inventory_products_lots_phase_1.sql`.
- [x] Crear rollback `scripts/database/migrations/20260601_inventory_products_lots_phase_1_rollback.sql`.
- [x] Crear runbook `docs/runbook-migracion-productos-inventario-fase-2-1.md`.
- [x] Mantener productos existentes como no loteados por defecto.
- [x] No crear lote legacy masivo.
- [x] No crear seeds de productos ni reglas de alertas.
- [x] No modificar funciones SQL criticas de POS/pedidos.
- [x] Validar cambio OpenSpec con `openspec validate`.

## Fase 2.2: prueba local/dev de migracion

- [x] Identificar conexion local/dev sin exponer secretos.
- [x] Validar PostgreSQL con `SELECT version()`.
- [x] Validar tablas base requeridas.
- [x] Registrar conteos antes de migrar.
- [x] Ejecutar migracion principal en local/dev.
- [x] Validar columnas nuevas de `products`.
- [x] Validar defaults seguros en productos existentes.
- [x] Validar tablas nuevas.
- [x] Validar constraints e indices principales.
- [x] Validar funciones criticas existentes y no modificadas por la migracion.
- [x] Ejecutar `openspec validate`.
- [x] Ejecutar `git diff --check`.
- [x] Ejecutar rollback en local/dev.
- [x] Validar rollback y conteos base.
- [x] Reaplicar migracion para dejar local/dev migrado.
- [x] Crear `docs/evidencia-prueba-migracion-productos-inventario-fase-2-2.md`.

## Fase 3: backend api

- [ ] Agregar DTOs y validaciones para producto enriquecido.
- [ ] Agregar reglas de producto perecedero/no perecedero.
- [ ] Agregar reglas de lote obligatorio y vencimiento obligatorio.
- [ ] Agregar soporte de barcode si se aprueba.
- [ ] Agregar historial de precios con motivo obligatorio.
- [ ] Integrar lote/vencimiento/ubicacion en recepcion de compras.
- [x] Integrar lote/ubicacion en ajustes de inventario.
- [x] Agregar diagnostico/reconciliacion de saldos loteados.
- [x] Agregar selector FEFO preparatorio solo lectura.
- [x] Analizar integracion FEFO en ventas POS sin implementar.
- [x] Disenar `inventory_create_sale_v2` para FEFO POS sin implementar.
- [x] Crear migracion SQL de `inventory_create_sale_v2` sin activar backend.
- [x] Preparar flag interno `INVENTORY_SALE_V2_ENABLED` apagado por defecto.
- [x] Implementar cancelacion/reverso de ventas loteadas creadas con v2.
- [x] Agregar activacion controlada de v2 por tenant/sucursal piloto.
- [ ] Integrar FEFO en ventas POS.
- [ ] Integrar FEFO en entrega/facturacion de pedidos.
- [ ] Mantener compatibilidad para productos sin lote.
- [ ] Agregar auditoria de cambios sensibles.
- [ ] Agregar tests unitarios y de integracion para reglas criticas.

## Fase 3.1: backend api producto enriquecido

- [x] Extender `ProductEntity` con campos de producto enriquecido.
- [x] Extender tipos de request de `ProductController` sin cambiar rutas.
- [x] Agregar defaults compatibles para clientes actuales.
- [x] Validar reglas de perecedero, lote y vencimiento en `ProductService`.
- [x] Validar `operationalStatus`, `rotationClass`, `minStock` y `maxStock`.
- [x] Mantener normalizacion y unicidad de `sku`.
- [x] Extender `ProductRepository` para SELECT/INSERT/UPDATE parametrizados.
- [x] Mantener calculo actual de stock en listados.
- [x] Agregar tests unitarios de producto enriquecido.
- [x] Ejecutar build de `api/`.
- [x] No tocar frontend, reporteria, compras, ventas, pedidos, lotes, FEFO ni funciones SQL criticas.
- [x] Crear `docs/evidencia-backend-producto-enriquecido-fase-3-1.md`.

## Fase 3.2: backend api product barcodes

- [x] Crear `ProductBarcodeEntity`.
- [x] Crear `ProductBarcodeRepository`.
- [x] Crear `ProductBarcodeService`.
- [x] Crear `ProductBarcodeController`.
- [x] Registrar controller, service y repository en `InventoryModule`.
- [x] Agregar endpoints REST bajo `/api/products/:productId/barcodes`.
- [x] Validar `tenant_id` y pertenencia de `product_id`.
- [x] Validar barcode requerido, trim y no vacio.
- [x] Validar `barcodeType` permitido y default `UNIT`.
- [x] Bloquear barcode activo duplicado en el mismo tenant.
- [x] Permitir mismo barcode en otro tenant a nivel service.
- [x] Desmarcar otros primarios activos cuando se crea o marca primary.
- [x] Inactivar barcode sin borrado fisico.
- [x] Bloquear primary sobre barcode inactivo.
- [x] Mantener `products.sku` sin cambios.
- [x] Agregar tests unitarios de `ProductBarcodeService`.
- [x] Ejecutar build de `api/`.
- [x] No tocar frontend, reporteria, POS, compras, pedidos, lotes, FEFO, alertas, historial de precios ni funciones SQL criticas.
- [x] Crear `docs/evidencia-backend-product-barcodes-fase-3-2.md`.

## Fase 3.3: backend api inventory locations

- [x] Crear `InventoryLocationEntity`.
- [x] Crear `InventoryLocationRepository`.
- [x] Crear `InventoryLocationService`.
- [x] Crear `InventoryLocationController`.
- [x] Registrar controller, service y repository en `InventoryModule`.
- [x] Agregar endpoints REST bajo `/api/inventory/locations`.
- [x] Validar `tenant_id` y pertenencia de `branch_id`.
- [x] Validar acceso de sucursal para roles no globales.
- [x] Validar `code` requerido, trim, uppercase y no vacio.
- [x] Validar `name` requerido, trim y no vacio.
- [x] Validar `type` permitido y default `OTHER`.
- [x] Bloquear `code` duplicado en el mismo tenant y sucursal.
- [x] Permitir mismo `code` en otra sucursal del mismo tenant.
- [x] Bloquear cambio de `branch_id` en update.
- [x] Inactivar ubicacion sin borrado fisico.
- [x] Mantener ubicacion opcional; no tocar stock, lotes, FEFO, compras ni ventas.
- [x] Agregar tests unitarios de `InventoryLocationService`.
- [x] Ejecutar build de `api/`.
- [x] Ejecutar `openspec validate` y `git diff --check`.
- [x] Crear `docs/evidencia-backend-inventory-locations-fase-3-3.md`.

## Fase 3.4: backend api inventory lots

- [x] Crear `InventoryLotEntity`.
- [x] Crear `InventoryLotRepository`.
- [x] Crear `InventoryLotService`.
- [x] Crear `InventoryLotController`.
- [x] Registrar controller, service y repository en `InventoryModule`.
- [x] Agregar endpoints REST bajo `/api/inventory/lots`.
- [x] Validar `tenant_id`, `branch_id` y `product_id`.
- [x] Validar referencias opcionales `supplier_id`, `purchase_id` y `purchase_item_id`.
- [x] Validar acceso de sucursal para roles no globales.
- [x] Validar `lotCode` requerido, trim, uppercase y no vacio.
- [x] Validar `unitCost` default `0` y no negativo.
- [x] Validar `status` permitido y default `ACTIVE`.
- [x] Validar `isLegacy` default `false`.
- [x] Bloquear `lotCode` duplicado en el mismo tenant, sucursal y producto.
- [x] Permitir mismo `lotCode` en otra sucursal o producto.
- [x] Exigir `expirationDate` si el producto tiene `requiresExpiration=true`.
- [x] Rechazar `expirationDate` anterior a `2000-01-01`.
- [x] Rechazar lote `ACTIVE` vencido.
- [x] Bloquear cambio de `branch_id` y `product_id` en update.
- [x] Implementar `block` y `cancel` sin borrado fisico.
- [x] Rechazar cancelacion de lote `CONSUMED`.
- [x] Mantener lotes como catalogo basico; no tocar stock, saldos, movimientos, compras, ventas ni FEFO.
- [x] Agregar tests unitarios de `InventoryLotService`.
- [x] Ejecutar build de `api/`.
- [x] Ejecutar tests producto + barcodes + locations + lots.
- [x] Ejecutar `openspec validate` y `git diff --check`.
- [x] Crear `docs/evidencia-backend-inventory-lots-fase-3-4.md`.

## Fase 3.5: backend api lot balances y movement lots preparatorio

- [x] Crear `InventoryLotBalanceEntity`.
- [x] Crear `InventoryLotBalanceRepository`.
- [x] Crear `InventoryLotBalanceService`.
- [x] Crear controller solo lectura para `/api/inventory/lot-balances`.
- [x] Crear `StockMovementLotEntity`.
- [x] Crear `StockMovementLotRepository`.
- [x] Crear `StockMovementLotService`.
- [x] Crear controller solo lectura para `/api/inventory/stock-movement-lots`.
- [x] Registrar controllers, services y repositories en `InventoryModule`.
- [x] Validar `tenant_id`, `branch_id`, `product_id`, `lot_id` y `location_id`.
- [x] Validar saldos no negativos y `quantityReserved <= quantityOnHand`.
- [x] Preparar metodos internos para crear/incrementar/decrementar/reservar/liberar saldos.
- [x] Preparar metodo interno para registrar vinculos en `stock_movement_lots`.
- [x] No exponer endpoints publicos de escritura para saldos o movement lots.
- [x] No modificar `stock_movements`, calculo actual de stock, POS, compras, pedidos ni funciones SQL criticas.
- [x] Agregar tests unitarios de `InventoryLotBalanceService`.
- [x] Agregar tests unitarios de `StockMovementLotService`.
- [x] Ejecutar build de `api/`.
- [x] Ejecutar tests producto + barcodes + locations + lots + balances + movement lots.
- [x] Ejecutar `openspec validate` y `git diff --check`.
- [x] Crear `docs/evidencia-backend-lot-balances-movement-lots-fase-3-5.md`.

## Fase 3.6: recepcion de compras con lotes

- [x] Extender payload de recepcion de compras con `purchaseItemId`, `receivedQuantity`, `lotCode`, `expirationDate`, `locationId` y `unitCost` opcionales.
- [x] Mantener compatibilidad con payload actual basado en `product_id` y `quantity`.
- [x] Leer `requires_lot` y `requires_expiration` de productos dentro de la recepcion.
- [x] Mantener productos no loteados sin exigencia de lote ni vencimiento.
- [x] Rechazar datos de lote en productos sin control de lote para evitar ambiguedad.
- [x] Exigir `lotCode` para productos `requires_lot=true`.
- [x] Exigir `expirationDate` para productos `requires_expiration=true` cuando el lote existente no tenga vencimiento registrado.
- [x] Crear o reutilizar `inventory_lots` por tenant, sucursal, producto y `lotCode`.
- [x] Rechazar lotes existentes `BLOCKED` o `CANCELLED`.
- [x] Validar consistencia de `expirationDate` contra lote existente.
- [x] Incrementar `inventory_lot_balances` solo por cantidad recibida.
- [x] Crear `stock_movement_lots` enlazado al `stock_movement` IN creado.
- [x] Mantener `stock_movements` como ledger principal y evitar doble movimiento de stock.
- [x] Ejecutar todo dentro de la transaccion existente de `receivePurchase`.
- [x] No tocar ventas POS, pedidos, FEFO, funciones SQL criticas, pagos/caja, frontend ni reporteria.
- [x] Agregar tests unitarios de recepcion de compras con lotes.
- [x] Ejecutar build de `api/`.
- [x] Ejecutar tests especificos y suite acumulada.
- [x] Ejecutar `openspec validate` y `git diff --check`.
- [x] Crear `docs/evidencia-recepcion-compras-lotes-fase-3-6.md`.

## Fase 3.7: ajustes manuales de inventario con lotes

- [x] Extender payload de ajustes con `lotCode`, `expirationDate`, `locationId` y `unitCost` opcionales.
- [x] Mantener compatibilidad con ajustes actuales para productos sin lote.
- [x] Leer `requires_lot`, `requires_expiration` y `cost` de productos dentro del ajuste.
- [x] Rechazar datos de lote en productos sin control de lote para evitar ambiguedad.
- [x] Exigir `lotCode` para productos `requires_lot=true`.
- [x] Exigir `expirationDate` para ajuste `IN` cuando el producto tiene `requires_expiration=true`.
- [x] Crear o reutilizar `inventory_lots` en ajuste `IN` por tenant, sucursal, producto y `lotCode`.
- [x] Rechazar lotes `BLOCKED` o `CANCELLED` en ajuste `IN`.
- [x] Rechazar lotes `BLOCKED`, `CANCELLED` o `CONSUMED` en ajuste `OUT`.
- [x] Permitir ajuste `OUT` de lote vencido para correccion fisica.
- [x] Incrementar `inventory_lot_balances` en ajuste `IN` loteado.
- [x] Decrementar `inventory_lot_balances` en ajuste `OUT` loteado con validacion de disponibilidad.
- [x] Crear `stock_movement_lots` enlazado al `stock_movement` creado.
- [x] Mantener `stock_movements` como ledger principal y evitar doble movimiento de stock.
- [x] Ejecutar ajuste loteado dentro de transaccion local del servicio.
- [x] No tocar ventas POS, pedidos, FEFO, funciones SQL criticas, pagos/caja, frontend ni reporteria.
- [x] Agregar tests unitarios de ajustes con lotes.
- [x] Ejecutar build de `api/`.
- [x] Ejecutar tests especificos y suite acumulada.
- [x] Ejecutar `openspec validate` y `git diff --check`.
- [x] Crear `docs/evidencia-ajustes-inventario-lotes-fase-3-7.md`.

## Fase 3.8: reconciliacion de saldos loteados

- [x] Crear `InventoryLotReconciliationRepository` solo lectura.
- [x] Crear `InventoryLotReconciliationService` con validacion de filtros y severidades.
- [x] Crear `InventoryLotReconciliationController` solo lectura.
- [x] Registrar controller, service y repository en `InventoryModule`.
- [x] Agregar endpoint `GET /api/inventory/lot-reconciliation/summary`.
- [x] Agregar endpoint `GET /api/inventory/lot-reconciliation/discrepancies`.
- [x] Agregar endpoint `GET /api/inventory/lot-reconciliation/product/:productId`.
- [x] Agregar endpoint `GET /api/inventory/lot-reconciliation/lot/:lotId`.
- [x] Soportar filtros `branchId`, `productId`, `lotId`, `from`, `to`, `onlyDiscrepancies` y `discrepancyType`.
- [x] Detectar `LOT_REQUIRED_MOVEMENT_WITHOUT_LOT_LINK`.
- [x] Detectar `LOT_LINK_WITHOUT_MOVEMENT`.
- [x] Detectar `LOT_LINK_PRODUCT_MISMATCH`.
- [x] Detectar `LOT_LINK_TENANT_MISMATCH`.
- [x] Detectar `LOT_BALANCE_WITHOUT_LOT`.
- [x] Detectar `LOT_BALANCE_PRODUCT_BRANCH_MISMATCH`.
- [x] Detectar `LOT_BALANCE_NEGATIVE_OR_RESERVED_INVALID`.
- [x] Detectar `LOT_BALANCE_DIFFERS_FROM_MOVEMENT_LINKS`.
- [x] Detectar `EXPIRED_ACTIVE_LOT`.
- [x] Detectar `BLOCKED_OR_CANCELLED_LOT_WITH_AVAILABLE_BALANCE`.
- [x] Detectar `LOT_REQUIRED_PRODUCT_WITH_NON_LOTTED_STOCK`.
- [x] Clasificar severidades `CRITICAL`, `HIGH`, `WARNING` e `INFO`.
- [x] Retornar resumen con conteos revisados y conteos por severidad.
- [x] Mantener flujo estrictamente solo lectura, sin endpoint de correccion.
- [x] No tocar POS, ventas, pedidos, compras, ajustes, FEFO, funciones SQL criticas, frontend ni reporteria.
- [x] Agregar tests unitarios de `InventoryLotReconciliationService`.
- [x] Ejecutar build de `api/`.
- [x] Ejecutar test especifico de reconciliacion y suite acumulada.
- [x] Ejecutar `openspec validate` y `git diff --check`.
- [x] Crear `docs/evidencia-reconciliacion-lotes-fase-3-8.md`.

## Fase 3.9: selector FEFO preparatorio

- [x] Crear `InventoryFefoRepository` solo lectura.
- [x] Crear `InventoryFefoService` con `selectLotsForConsumption`.
- [x] Crear `InventoryFefoController` con endpoint preview solo lectura.
- [x] Registrar controller, service y repository en `InventoryModule`.
- [x] Agregar endpoint `GET /api/inventory/fefo/preview`.
- [x] Validar `quantity > 0`.
- [x] Validar que `productId` pertenezca al tenant.
- [x] Validar que `branchId` pertenezca al tenant.
- [x] Validar que FEFO solo aplique a productos `requires_lot=true`.
- [x] Validar `locationId` cuando venga y limitar seleccion a esa ubicacion.
- [x] Seleccionar lotes por `expiration_date ASC`, `received_at ASC`, `lot_code ASC`, `id ASC`.
- [x] Excluir lotes `BLOCKED`, `CANCELLED` y `CONSUMED`.
- [x] Excluir lotes vencidos y balances sin disponible.
- [x] Rechazar inconsistencia de lote sin `expirationDate` para productos `requires_expiration=true`.
- [x] Retornar `canFulfill`, `requestedQuantity`, `selectedQuantity`, `missingQuantity`, `selections` y `warnings`.
- [x] No reservar, no descontar, no crear `stock_movements` ni `stock_movement_lots`.
- [x] No tocar ventas POS, pedidos, compras, ajustes, funciones SQL criticas, frontend ni reporteria.
- [x] Agregar tests unitarios de `InventoryFefoService`.
- [x] Ejecutar build de `api/`.
- [x] Ejecutar test especifico FEFO y suite acumulada.
- [x] Ejecutar `openspec validate` y `git diff --check`.
- [x] Crear `docs/evidencia-fefo-service-preparatorio-fase-3-9.md`.

## Fase 3.10: analisis integracion FEFO en ventas POS

- [x] Analizar flujo actual de `SaleController`, `SaleService` y `SaleRepository`.
- [x] Identificar firma y comportamiento de `inventory_create_sale`.
- [x] Identificar validacion de stock agregado y creacion de `stock_movements OUT`.
- [x] Analizar transaccionalidad actual de venta, pagos y caja.
- [x] Analizar cancelacion/refund actual y reverso de stock.
- [x] Analizar `inventory_invoice_order` y relacion con pedidos/facturacion.
- [x] Analizar reportes y tickets POS actuales en `backend-reporteria`.
- [x] Evaluar opciones A, B, C y D para integrar FEFO.
- [x] Recomendar `inventory_create_sale_v2` o equivalente, manteniendo v1 intacta.
- [x] Documentar riesgos de doble descuento e inconsistencia entre `stock_movements`, `stock_movement_lots` e `inventory_lot_balances`.
- [x] Documentar impacto futuro en cancelacion, reportes, tickets, frontend/POS y pruebas.
- [x] Crear `docs/analisis-integracion-fefo-ventas-pos-fase-3-10.md`.
- [x] No modificar `SaleService`, `SaleRepository`, funciones SQL, POS, frontend, reporteria ni migraciones.

## Fase 3.11: diseno `inventory_create_sale_v2`

- [x] Analizar firma, parametros y retorno actuales de `inventory_create_sale`.
- [x] Documentar JSON actual de items y pagos legacy.
- [x] Documentar validacion de stock agregado, inserciones en `sales`, `sale_items`, `sale_item_taxes` y `stock_movements`.
- [x] Disenar firma compatible de `public.inventory_create_sale_v2`.
- [x] Disenar contrato de entrada/salida sin exigir lotes desde frontend.
- [x] Disenar algoritmo SQL FEFO para productos `requires_lot=true`.
- [x] Mantener comportamiento actual para productos `requires_lot=false`.
- [x] Disenar uso de `FOR UPDATE` sin `SKIP LOCKED` para concurrencia inicial.
- [x] Disenar atomicidad y rollback total ante errores de item loteado.
- [x] Disenar creacion de `stock_movement_lots` con `stock_movement_id` real.
- [x] Disenar decremento de `inventory_lot_balances.quantity_on_hand`.
- [x] Documentar compatibilidad con tickets, reportes y POS sin mostrar lote.
- [x] Disenar cancelacion futura usando `stock_movement_lots` del movimiento original.
- [x] Documentar matriz de pruebas futuras para venta, concurrencia, rollback, cancelacion y reconciliacion.
- [x] Crear `docs/diseno-inventory-create-sale-v2-fase-3-11.md`.
- [x] Crear draft SQL conceptual no ejecutable en `scripts/database/sale/drafts/202606XX_inventory_create_sale_v2_design.sql`.
- [x] No modificar `inventory_create_sale`, `inventory_invoice_order`, `SaleService`, `SaleRepository`, POS, frontend, reporteria ni migraciones ejecutables.

## Fase 3.12: migracion SQL `inventory_create_sale_v2`

- [x] Crear migracion ejecutable `scripts/database/migrations/20260602_inventory_create_sale_v2.sql`.
- [x] Crear rollback `scripts/database/migrations/20260602_inventory_create_sale_v2_rollback.sql`.
- [x] Mantener firma compatible con `inventory_create_sale` v1.
- [x] Crear solo `public.inventory_create_sale_v2`; no modificar `inventory_create_sale` v1.
- [x] No modificar `inventory_invoice_order`.
- [x] Mantener backend sin activar v2 desde `SaleRepository`.
- [x] Mantener flujo no loteado compatible y sin `stock_movement_lots`.
- [x] Agregar descuento FEFO atomico para productos `requires_lot=true`.
- [x] Crear `stock_movement_lots` enlazado al `stock_movement` OUT real.
- [x] Usar `FOR UPDATE` sin `SKIP LOCKED` para balances elegibles.
- [x] No crear tablas, triggers, indices, seeds ni cambios de datos.
- [x] Ejecutar migracion en local/dev y validar existencia de v2.
- [x] Ejecutar rollback en local/dev y validar que v1 queda intacta.
- [x] Reaplicar migracion en local/dev para dejar v2 disponible localmente.
- [x] No ejecutar ventas reales ni crear fixtures.
- [x] Crear `docs/evidencia-inventory-create-sale-v2-fase-3-12.md`.
- [x] Ejecutar `openspec validate` y `git diff --check`.

## Fase 3.13: flag backend para `inventory_create_sale_v2`

- [x] Identificar llamada actual a `inventory_create_sale` en `SaleRepository.createSaleWithFunction`.
- [x] Agregar helper privado `resolveCreateSaleFunctionName()`.
- [x] Usar flag interno `INVENTORY_SALE_V2_ENABLED`.
- [x] Mantener default `false`; sin env o valor distinto de `true` usa `inventory_create_sale`.
- [x] Usar `inventory_create_sale_v2` solo cuando `process.env.INVENTORY_SALE_V2_ENABLED === "true"`.
- [x] Restringir nombre SQL a union interna cerrada para evitar interpolacion insegura.
- [x] Mantener firma publica de `SaleRepository.createSaleWithFunction`.
- [x] Mantener payload y respuesta sin cambios.
- [x] Registrar en debug la funcion usada sin datos sensibles.
- [x] Agregar tests unitarios de seleccion v1/v2 por flag.
- [x] Ejecutar build de `api/`.
- [x] Ejecutar test especifico de `SaleRepository`.
- [x] No modificar SQL functions, migraciones, POS, `web/`, `backend-reporteria/`, compras, ajustes ni pedidos.
- [x] Crear `docs/evidencia-flag-inventory-create-sale-v2-fase-3-13.md`.
- [x] Ejecutar `openspec validate` y `git diff --check`.

## Fase 3.14: pruebas locales `inventory_create_sale_v2`

- [x] Confirmar ambiente local/dev sin exponer secretos.
- [x] Confirmar PostgreSQL 16 con `SELECT version()`.
- [x] Confirmar funciones `inventory_create_sale`, `inventory_create_sale_v2` e `inventory_invoice_order`.
- [x] Confirmar tablas base requeridas para venta POS y lotes.
- [x] Crear fixture local `scripts/database/dev/20260602_fixture_sale_v2_local.sql`.
- [x] Crear cleanup local `scripts/database/dev/20260602_fixture_sale_v2_local_cleanup.sql`.
- [x] Crear test SQL local `scripts/database/tests/20260602_inventory_create_sale_v2_local_test.sql`.
- [x] Ejecutar prueba local/dev de `inventory_create_sale_v2`.
- [x] Corregir ambiguedad de columnas en `inventory_create_sale_v2`.
- [x] Reaplicar funcion corregida en local/dev.
- [x] Completar escenarios A-H con resultado OK.
- [x] Validar reconciliacion sin discrepancias para escenarios exitosos.
- [x] Limpiar fixture local despues de la prueba exitosa.
- [x] Crear `docs/evidencia-pruebas-inventory-create-sale-v2-fase-3-14.md`.
- [x] Marcar Fase 3.14 como completada.

## Fase 3.15: cancelacion de venta loteada

- [x] Analizar cancelacion actual en `SaleService.cancelSale`.
- [x] Mantener cancelacion no loteada sin mutaciones de lote.
- [x] Usar `stock_movements` OUT originales de la venta como origen del reverso.
- [x] Leer `stock_movement_lots` asociados al movimiento OUT original.
- [x] Crear `stock_movements` IN de reverso con el flujo existente.
- [x] Incrementar `inventory_lot_balances` del lote y ubicacion originales.
- [x] Crear `stock_movement_lots` de reverso asociado al movimiento IN.
- [x] Permitir reverso hacia lote vencido o `BLOCKED`.
- [x] Rechazar reverso automatico hacia lote `CANCELLED`.
- [x] Rechazar cancelacion loteada legacy sin `stock_movement_lots`.
- [x] Mantener idempotencia de venta ya `CANCELLED` o `REFUNDED`.
- [x] Corregir bloqueo de venta en cancelacion con `FOR UPDATE OF s`.
- [x] Agregar tests unitarios de cancelacion no loteada, loteada, `BLOCKED`, `CANCELLED`, legacy sin links e idempotencia.
- [x] Crear prueba local/dev controlada `scripts/database/tests/20260602_sale_v2_cancellation_local_test.ts`.
- [x] Ejecutar prueba local/dev con fixture v2 y cleanup final.
- [x] Validar neto loteado cero en ventas canceladas exitosas.
- [x] Validar que fixture local queda limpio.
- [x] Ejecutar build de `api/`.
- [x] Ejecutar tests especificos de `SaleService` y `SaleRepository`.
- [x] Confirmar que `INVENTORY_SALE_V2_ENABLED` sigue apagado por defecto.
- [x] No tocar SQL functions, migraciones, POS, `web/`, `backend-reporteria/`, compras, ajustes ni pedidos.
- [x] Crear `docs/evidencia-cancelacion-venta-loteada-fase-3-15.md`.
- [x] Ejecutar `openspec validate` y `git diff --check`.

## Fase 3.16: activacion controlada sale v2 por tenant/sucursal

- [x] Analizar `SaleRepository.createSaleWithFunction` y datos disponibles `tenantId`/`branchId`.
- [x] Usar `tenants.config` como configuracion existente sin crear tabla ni migracion.
- [x] Mantener `inventory_create_sale` como default absoluto cuando `INVENTORY_SALE_V2_ENABLED !== "true"`.
- [x] Consultar config solo si `INVENTORY_SALE_V2_ENABLED === "true"`.
- [x] Soportar `config.inventory.saleV2Enabled`.
- [x] Soportar `config.inventory.saleV2Branches` como allowlist opcional de sucursales.
- [x] Usar v2 solo con doble condicion: env true + tenant habilitado + sucursal habilitada si hay lista.
- [x] Usar v1 ante config ausente, config invalida, branch no incluida o error de consulta.
- [x] Mantener union interna cerrada de nombres de funciones SQL.
- [x] Mantener payload, respuesta y contrato API sin cambios.
- [x] Agregar logging seguro sin datos sensibles.
- [x] Ampliar tests unitarios de `SaleRepository` para casos A-J.
- [x] Ejecutar build de `api/`.
- [x] Ejecutar tests de `SaleRepository`.
- [x] Confirmar que no se tocaron SQL functions, migraciones, POS, `web/`, `backend-reporteria/`, compras, ajustes ni pedidos.
- [x] Crear `docs/evidencia-activacion-sale-v2-tenant-branch-fase-3-16.md`.
- [x] Ejecutar `openspec validate` y `git diff --check`.

## Fase 3.17: prueba API real local/dev de venta loteada v2

- [x] Confirmar ambiente local/dev, PostgreSQL 16 y funciones `inventory_create_sale`, `inventory_create_sale_v2` e `inventory_invoice_order`.
- [x] Crear fixture local/dev `scripts/database/dev/20260602_fixture_sale_v2_api_local.sql`.
- [x] Crear cleanup local/dev `scripts/database/dev/20260602_fixture_sale_v2_api_local_cleanup.sql`.
- [x] Configurar tenant piloto con `tenants.config.inventory.saleV2Enabled=true`.
- [x] Configurar allowlist `tenants.config.inventory.saleV2Branches` con sucursal piloto.
- [x] Levantar backend local con `INVENTORY_SALE_V2_ENABLED=true` sin persistir activacion global.
- [x] Crear prueba API real `scripts/http/20260602_sale_v2_api_local_test.ts`.
- [x] Validar venta no loteada por API sin `stock_movement_lots`.
- [x] Validar venta loteada por API con decremento de `inventory_lot_balances` y `stock_movement_lots OUT`.
- [x] Validar venta mixta por API con links solo para producto loteado.
- [x] Validar stock insuficiente loteado con rollback total.
- [x] Validar cancelacion loteada por API con `stock_movements IN`, `stock_movement_lots IN` y balance restaurado al lote original.
- [x] Validar cancelacion mixta por API.
- [x] Validar sucursal no habilitada cae a `inventory_create_sale` v1.
- [x] Validar reconciliacion read-only de sucursal piloto sin discrepancias criticas ni altas.
- [x] Ejecutar cleanup y confirmar `fixture_rows_remaining=0`.
- [x] Confirmar que no se tocaron PRD, QA remoto, `web/`, `backend-reporteria/`, POS UI, SQL functions ni migraciones.
- [x] Crear `docs/evidencia-api-venta-loteada-v2-fase-3-17.md`.
- [x] Ejecutar `openspec validate` y `git diff --check`.

## Fase 3.17.1: hotfix pre-QA reconciliacion y contexto de venta

- [x] Reproducir bug de `InventoryLotReconciliationController` con `branchId` UUID valido rechazado.
- [x] Identificar causa en regex local de UUID con grupos `8-4-4-12`.
- [x] Corregir validacion para UUID estandar `8-4-4-4-12`.
- [x] Aplicar mismo criterio a `branchId`, `productId`, `lotId` y route params.
- [x] Mantener rechazo de valores invalidos con `BadRequestException`.
- [x] Agregar tests de controller para UUID validos e invalidos.
- [x] Validar que filtros llegan correctamente al service.
- [x] Analizar `SaleService.normalizeSaleContext` y perdida de `roles`/`sessionId`.
- [x] Corregir preservacion de `roles`/`sessionId` como bug minimo y seguro.
- [x] Agregar tests de `SaleService.normalizeSaleContext`.
- [x] Ejecutar build de `api/`.
- [x] Ejecutar tests especificos de reconciliacion y `SaleService`.
- [x] Confirmar que no se tocaron SQL functions, migraciones, POS UI, `web/` ni `backend-reporteria/`.
- [x] Crear `docs/evidencia-hotfix-pre-qa-fase-3-17-1.md`.
- [x] Ejecutar `openspec validate` y `git diff --check`.

## Fase 3.18: runbook QA piloto ventas loteadas v2

- [x] Crear `docs/runbook-qa-piloto-ventas-loteadas-v2-fase-3-18.md`.
- [x] Documentar resumen ejecutivo, alcance QA y fallback v1.
- [x] Documentar precondiciones tecnicas de backup, PostgreSQL 16, migraciones y funciones.
- [x] Documentar precondiciones funcionales de tenant, sucursal, usuario, caja, productos, proveedor y metodo de pago.
- [x] Documentar activacion controlada con `tenants.config` y `INVENTORY_SALE_V2_ENABLED=true` solo en QA.
- [x] Documentar pruebas QA obligatorias A-M.
- [x] Documentar queries de lectura para config, productos, lotes, balances, movimientos, movement lots, reconciliacion y funciones.
- [x] Documentar criterios de exito y abortar.
- [x] Documentar plan rollback QA de menor a mayor impacto.
- [x] Documentar evidencia esperada, riesgos vivos y proximos pasos.
- [x] Confirmar que no se ejecuto QA, PRD, SQL, build, tests ni despliegues.
- [x] Confirmar que no se modifico codigo funcional, SQL, `web/`, `backend-reporteria/` ni POS UI.
- [x] Ejecutar `openspec validate` y `git diff --check`.

## Fase 3.19: ejecucion QA piloto ventas loteadas v2

- [x] Crear plantilla segura `docs/templates/qa-piloto-ventas-loteadas-v2.env.example` para recolectar datos QA sin secretos.
- [x] Crear checklist `docs/checklist-desbloqueo-qa-piloto-ventas-loteadas-v2.md`.
- [x] Documentar criterio de desbloqueo con confirmacion explicita `AUTORIZADO QA, NO PRD`.
- [ ] Confirmar host/base QA.
- [ ] Confirmar que el ambiente objetivo no es PRD.
- [ ] Confirmar usuario/conexion QA sin exponer secretos.
- [ ] Confirmar backup QA realizado.
- [ ] Confirmar PostgreSQL 16 en QA.
- [ ] Confirmar backend API QA y procedimiento de reinicio.
- [ ] Confirmar tenant, sucursal piloto, sucursal control y usuario QA.
- [ ] Confirmar rollback rapido antes de activar v2.
- [ ] Validar funciones `inventory_create_sale`, `inventory_create_sale_v2` e `inventory_invoice_order` en QA.
- [ ] Aplicar migraciones pendientes si QA no las tiene.
- [ ] Configurar `tenants.config.inventory.saleV2Enabled=true` solo en tenant piloto.
- [ ] Configurar `saleV2Branches` solo con sucursal piloto.
- [ ] Activar `INVENTORY_SALE_V2_ENABLED=true` solo en QA.
- [ ] Reiniciar API QA y validar healthcheck.
- [ ] Ejecutar pruebas QA A-M del runbook.
- [ ] Validar reconciliacion `critical=0` y `high=0`.
- [ ] Validar que v1 funciona en sucursal no habilitada.
- [ ] Ejecutar rollback QA si algun criterio de abortar se cumple.
- [x] Crear `docs/evidencia-qa-piloto-ventas-loteadas-v2-fase-3-19.md` con estado bloqueado por falta de datos QA.
- [ ] Ejecutar `openspec validate` y `git diff --check` despues de una ejecucion QA completa.

### Fase 3.19-local: ensayo local sobre copia PRD

- [x] Confirmar autorizacion `AUTORIZADO ENSAYO LOCAL SOBRE COPIA PRD, NO PRD REAL`.
- [x] Confirmar que `DB_HOST=localhost`, `DB_PORT=5432` y `DB_NAME=manus_tienda_prd`.
- [x] Registrar aclaracion de que `manus_tienda_prd` es copia local de PRD y no PRD real.
- [x] Crear backup local antes de tocar datos.
- [x] Confirmar PostgreSQL 16, funciones criticas y tablas loteadas en copia local.
- [x] Aplicar fixture local controlado para tenant/sucursal piloto.
- [x] Levantar backend local con `INVENTORY_SALE_V2_ENABLED=true` sin persistir activacion global.
- [x] Ejecutar pruebas API locales A-G sobre copia local.
- [x] Validar que sucursal control usa `inventory_create_sale` v1.
- [x] Validar reconciliacion local `critical=0` y `high=0`.
- [x] Ejecutar cleanup y confirmar `fixture_rows_remaining=0`.
- [x] Crear `docs/evidencia-ensayo-local-copia-prd-sale-v2-fase-3-19-local.md`.
- [x] Ejecutar `openspec validate` y `git diff --check` para el ensayo local.
- [x] Mantener Fase 3.19 QA real pendiente.

## Fase 3.20: consolidacion y plan de despliegue servidor

- [x] Crear `docs/consolidacion-productos-inventario-fase-3-20.md`.
- [x] Crear `docs/plan-despliegue-servidor-productos-inventario-fase-3-20.md`.
- [x] Aclarar que QA del proyecto corresponde al ambiente local sobre copia PRD y fue aprobada.
- [x] Aclarar que servidor/PRD real sigue pendiente y no fue tocado.
- [x] Documentar que v1 sigue default y v2 solo opera por env + tenant/sucursal.
- [x] Documentar riesgos vivos y pendientes de frontend, reporteria y despliegue servidor.
- [x] Confirmar que esta fase no ejecuta SQL, comandos remotos, despliegues ni cambios funcionales.
- [x] Ejecutar `openspec validate` y `git diff --check` para Fase 3.20.
- [x] Dejar despliegue servidor como fase futura pendiente.

## Fase 4: backend-reporteria

- [ ] Definir datasets para productos proximos a vencer.
- [ ] Definir datasets para productos vencidos.
- [ ] Definir datasets para baja rotacion.
- [ ] Definir datasets para inventario valorizado.
- [ ] Definir datasets para historial de precios.
- [ ] Crear funciones SQL de reporte.
- [ ] Crear adapters en `reports/sql-adapters`.
- [ ] Crear services/controllers de reporteria de inventario.
- [ ] Crear templates PDF si se aprueba PDF en esta fase.
- [ ] Mantener reportes existentes sin cambios contractuales.

## Fase 5: frontend web

- [x] Extender tipos de producto de forma compatible.
- [x] Extender `ProductForm` para configuracion operativa.
- [x] Agregar panel web para administrar multiples codigos de barras por producto.
- [x] Agregar pantalla web para administrar ubicaciones fisicas de inventario.
- [x] Agregar vista read-only de inventario por lote y saldos.
- [x] Extender recepcion de compras para lote/vencimiento/ubicacion.
- [x] Extender ajustes manuales para lote/vencimiento/ubicacion.
- [x] Mostrar badges de perecedero, loteado, vencimiento, estado operativo y rotacion en productos.
- [x] Agregar filtros por lote, vencimiento, sucursal, ubicacion y estado.
- [ ] Agregar vistas de historial de precios.
- [x] Agregar alertas en dashboard de inventario.
- [x] Agregar focus mode para acciones avanzadas de inventario.
- [x] Reusar `confirmation-message.tsx` para confirmaciones visuales sensibles.
- [ ] Agregar reportes de inventario bajo `reporteria`.
- [ ] Verificar POS desktop/mobile para no romper flujo de venta.

### Fase 4.1: frontend producto enriquecido

- [x] Analizar ruta `web/app/[tenant]/inventory/products/page.tsx`.
- [x] Analizar `ProductForm`, tipos y servicio API de productos.
- [x] Agregar campos frontend `isPerishable`, `requiresLot`, `requiresExpiration`, `operationalStatus`, `rotationClass`, `minStock`, `maxStock`.
- [x] Agregar seccion `Configuracion operativa` al formulario.
- [x] Implementar reglas UX de vencimiento/lote, perecedero y stock minimo/maximo.
- [x] Agregar badges discretos en listado de productos.
- [x] Mantener compatibilidad con productos antiguos y campos actuales.
- [x] Crear `docs/evidencia-frontend-producto-enriquecido-fase-4-1.md`.
- [x] Validar TypeScript con `npx tsc --noEmit --pretty false`.
- [x] Validar build en copia temporal completa de `web/`.
- [x] Documentar bloqueo de `next lint` interactivo y build directo con `.next` ocupado.
- [x] Confirmar que no se toco `api/`, `backend-reporteria/`, SQL, POS, compras, pedidos ni reportes.

### Fase 4.2: frontend product barcodes

- [x] Analizar ubicacion actual de crear/editar producto.
- [x] Definir `ProductBarcode` y `ProductBarcodeType` en tipos frontend.
- [x] Agregar cliente API para listar, crear, editar, inactivar y marcar principal.
- [x] Crear seccion `Codigos de barras` para producto existente.
- [x] Mostrar listado con tipo, principal, estado y acciones.
- [x] Agregar formulario con `barcode`, `barcodeType` e `isPrimary`.
- [x] Validar `barcode` requerido, trim y `barcodeType` valido.
- [x] Mostrar ayuda cuando `isPrimary=true`.
- [x] Usar confirmacion antes de inactivar.
- [x] Mantener SKU independiente de barcode.
- [x] Documentar que POS/escaner no cambia en esta fase.
- [x] Crear `docs/evidencia-frontend-product-barcodes-fase-4-2.md`.
- [x] Validar TypeScript con `npx tsc --noEmit --pretty false`.
- [x] Validar build en copia temporal completa de `web/`.
- [x] Documentar bloqueo de `next lint` interactivo.
- [x] Confirmar que no se toco `api/`, `backend-reporteria/`, SQL, POS, compras, pedidos ni reportes.

### Fase 4.3: frontend inventory locations

- [x] Analizar rutas bajo `web/app/[tenant]/inventory` y patrones de catalogo.
- [x] Crear tipos frontend `InventoryLocation` e `InventoryLocationType`.
- [x] Agregar cliente API para listar, obtener, crear, editar e inactivar ubicaciones.
- [x] Crear ruta `web/app/[tenant]/inventory/locations/page.tsx`.
- [x] Crear modal/formulario para nueva ubicacion y edicion.
- [x] Agregar filtros por sucursal, tipo, estado y busqueda por codigo/nombre.
- [x] Mostrar tabla con badges de tipo y estado.
- [x] Usar confirmacion antes de inactivar ubicacion.
- [x] Mantener ubicacion opcional; no tocar productos, compras, ventas ni POS.
- [x] Crear `docs/evidencia-frontend-inventory-locations-fase-4-3.md`.
- [x] Validar TypeScript con `npx tsc --noEmit --pretty false`.
- [x] Validar build en copia temporal completa de `web/`.
- [x] Documentar bloqueo de `next lint` interactivo.
- [x] Confirmar que no se toco `api/`, `backend-reporteria/`, SQL, POS, compras, pedidos ni reportes.

### Fase 4.4: frontend inventario por lote

- [x] Analizar rutas de inventario, productos y ubicaciones existentes.
- [x] Crear tipos frontend `InventoryLot`, `InventoryLotBalance` y `LotStatus`.
- [x] Agregar cliente API para lotes, saldos y reconciliacion.
- [x] Crear ruta `web/app/[tenant]/inventory/lots/page.tsx`.
- [x] Crear vista read-only con filtros por sucursal, producto, estado, vencimiento, ubicacion y disponibilidad.
- [x] Mostrar tabla de lotes/saldos con producto, lote, sucursal, ubicacion, vencimiento, estado y cantidades.
- [x] Agregar badges de vigente, proximo a vencer, vencido, bloqueado, cancelado, sin stock, disponible y legacy.
- [x] Agregar cards de resumen de lotes activos, vencidos, proximos, disponible y discrepancias criticas/altas.
- [x] Agregar modal de detalle rapido de lote/balance.
- [x] Consumir reconciliacion read-only para resumen y alertas visuales.
- [x] Documentar FEFO preview como pendiente Fase 4.4.1.
- [x] Mantener vista sin edicion de lotes o saldos.
- [x] Crear `docs/evidencia-frontend-inventario-por-lote-fase-4-4.md`.
- [x] Validar TypeScript con `npx tsc --noEmit --pretty false`.
- [x] Validar build en copia temporal completa de `web/`.
- [x] Documentar bloqueo de `next lint` interactivo.
- [x] Confirmar que no se toco `api/`, `backend-reporteria/`, SQL, POS, compras, pedidos ni reportes.

### Fase 4.5: frontend recepcion de compras con lotes

- [x] Analizar flujo actual de compras y `PurchaseReceiveForm`.
- [x] Extender tipos frontend de recepcion con `lotCode`, `expirationDate`, `locationId` y `unitCost`.
- [x] Cargar configuracion operativa de productos para detectar `requiresLot`, `requiresExpiration` e `isPerishable`.
- [x] Cargar ubicaciones activas por sucursal de la compra.
- [x] Mostrar badges de perecedero, requiere lote y requiere vencimiento por item.
- [x] Mostrar captura de lote, vencimiento, ubicacion y costo solo para productos loteados.
- [x] Validar lote obligatorio, vencimiento obligatorio, vencimiento no pasado, costo no negativo y ubicacion valida.
- [x] Enviar datos de lote solo para productos `requiresLot=true`.
- [x] Mantener recepcion no loteada sin campos de lote.
- [x] Crear `docs/evidencia-frontend-recepcion-compras-lotes-fase-4-5.md`.
- [x] Validar TypeScript con `npx tsc --noEmit --pretty false`.
- [x] Validar build en copia temporal completa de `web/`.
- [x] Documentar bloqueo de `next lint` interactivo.
- [x] Confirmar que no se toco `api/`, `backend-reporteria/`, SQL, POS, pedidos ni reportes.

### Fase 4.6: frontend ajustes de inventario con lotes

- [x] Analizar `StockAdjustmentForm`, ruta de productos y servicio de ajustes.
- [x] Extender tipos frontend de ajuste con `lotCode`, `lotId`, `expirationDate`, `locationId` y `unitCost`.
- [x] Usar flags de producto `requiresLot`, `requiresExpiration` e `isPerishable`.
- [x] Cargar ubicaciones activas por sucursal para ajustes loteados.
- [x] Para ajuste `IN`, capturar lote, vencimiento, ubicacion y costo unitario.
- [x] Para ajuste `OUT`, cargar saldos disponibles y seleccionar lote/balance existente.
- [x] Validar cantidad, motivo, lote obligatorio, vencimiento obligatorio, costo no negativo y disponible suficiente.
- [x] Enviar datos de lote solo para productos `requiresLot=true`.
- [x] Mantener ajuste no loteado sin campos de lote.
- [x] Crear `docs/evidencia-frontend-ajustes-inventario-lotes-fase-4-6.md`.
- [x] Validar TypeScript con `npx tsc --noEmit --pretty false`.
- [x] Validar build en copia temporal completa de `web/`.
- [x] Documentar bloqueo de `next lint` interactivo.
- [x] Confirmar que no se toco `api/`, `backend-reporteria/`, SQL, POS, compras, pedidos ni reportes.

### Fase 4.7: frontend dashboard alertas de inventario

- [x] Analizar dashboard principal `web/modules/inventory/components/InventoryDashboard.tsx`.
- [x] Analizar vista read-only `web/app/[tenant]/inventory/lots/page.tsx`.
- [x] Consumir lotes, saldos y reconciliacion desde servicios frontend existentes.
- [x] Agregar seccion `Alertas de inventario` al dashboard principal.
- [x] Mostrar cards de lotes vencidos, proximos a vencer, bloqueados/cancelados con saldo, discrepancias criticas, discrepancias altas y stock loteado disponible.
- [x] Agregar estado visual de reconciliacion sin acciones correctivas.
- [x] Agregar accesos a inventario por lote, ubicaciones fisicas, productos y discrepancias.
- [x] Mejorar vista de lotes con ayuda contextual read-only.
- [x] Mantener compatibilidad sin tocar ventas, POS, compras, ajustes ni reportes.
- [x] Crear `docs/evidencia-frontend-dashboard-alertas-inventario-fase-4-7.md`.
- [x] Validar TypeScript con `npx tsc --noEmit --pretty false`.
- [x] Validar build en copia temporal completa de `web/`.
- [x] Documentar bloqueo de `next lint` interactivo.
- [x] Confirmar que no se toco `api/`, `backend-reporteria/`, SQL, POS, compras, pedidos ni reportes.

### Fase 4.8: frontend focus mode inventario

- [x] Analizar patron de foco existente en compras.
- [x] Revisar y extender `web/components/design-system/confirmation-message.tsx` sin romper usos existentes.
- [x] Crear `FocusActionLayout` reutilizable para acciones activas.
- [x] Aplicar focus mode en productos para crear, editar, codigos de barras y ajuste de stock.
- [x] Aplicar focus mode en ubicaciones para crear y editar.
- [x] Usar `confirmation-message.tsx` para cancelar acciones activas.
- [x] Usar `confirmation-message.tsx` para eliminar producto, inactivar ubicacion, inactivar barcode y marcar barcode principal.
- [x] Mantener inventario por lote read-only con detalle ligero en modal.
- [x] Confirmar que compras ya usa patron de accion enfocada para recepcion.
- [x] No usar `alert()` ni `window.confirm()`.
- [x] Crear `docs/evidencia-frontend-focus-mode-inventario-fase-4-8.md`.
- [x] Validar TypeScript con `npx tsc --noEmit --pretty false`.
- [x] Validar build en copia temporal completa de `web/`.
- [x] Documentar bloqueo de `next lint` interactivo.
- [x] Confirmar que no se toco `api/`, `backend-reporteria/`, SQL, POS, reportes ni contratos API.

### Fase 4.R: auditoria funcional y cierre producto-compras-ventas

- [x] Auditar flujo producto enriquecido entre `ProductForm`, `/inventory/products`, `/products` y `products`.
- [x] Corregir `/api/inventory/products` para devolver `isPerishable`, `requiresLot`, `requiresExpiration`, `operationalStatus`, `rotationClass`, `minStock` y `maxStock`.
- [x] Agregar prueba unitaria para mapping enriquecido de `InventoryService`.
- [x] Auditar recepcion de compras con lotes entre UI, detalle de compra y backend.
- [x] Corregir detalle de compra para devolver `productSku`, `isPerishable`, `requiresLot` y `requiresExpiration` por item.
- [x] Agregar prueba unitaria para mapping de flags operativos en detalle de compra.
- [x] Auditar pruebas existentes de ajustes loteados IN/OUT.
- [x] Auditar pruebas existentes de venta v1/v2, cancelacion loteada y seleccion por flag.
- [x] Ejecutar pruebas unitarias backend de producto, inventario, compras, ajustes, ventas y repositorio de ventas.
- [x] Ejecutar `cd api && npm run build`.
- [x] Ejecutar `cd web && npx tsc --noEmit --pretty false`.
- [x] Crear `docs/evidencia-auditoria-funcional-productos-compras-ventas-fase-4R.md`.
- [x] Ejecutar prueba UI/API/DB real de crear producto enriquecido y confirmar persistencia en DB.
- [x] Ejecutar prueba UI/API/DB real de editar producto enriquecido y confirmar persistencia en DB.
- [x] Ejecutar prueba UI/API/DB real de recepcion no loteada y loteada.
- [x] Ejecutar prueba UI/API/DB real de ajuste loteado `IN` y `OUT`.
- [x] Ejecutar prueba UI/API/DB real de venta FEFO v2, cancelacion loteada y reconciliacion.
- [x] Resolver bloqueo local de `web/.next/trace` para `cd web && npm run build` directo.
- [x] Marcar Fase 4.R como completada solo cuando pasen los flujos end-to-end anteriores.

### Fase 4.R2: unificacion flujo venta con inventory_create_sale_v2

- [x] Revisar `SaleRepository` y ubicar selector `inventory_create_sale` vs `inventory_create_sale_v2`.
- [x] Remover dependencia operativa de `INVENTORY_SALE_V2_ENABLED` para el camino normal.
- [x] Remover dependencia operativa de `tenants.config.inventory.saleV2Enabled` y `saleV2Branches`.
- [x] Usar `inventory_create_sale_v2` como funcion principal de `POST /api/sales`.
- [x] Mantener `inventory_create_sale` v1 intacta como respaldo tecnico/manual.
- [x] Confirmar que no cambia payload ni respuesta esperada de venta.
- [x] Confirmar que `SaleService` mantiene contexto, caja, pagos y cancelacion loteada.
- [x] Ajustar tests de `SaleRepository` para v2 como camino normal sin flag.
- [x] Ejecutar tests de `SaleRepository` y `SaleService`.
- [x] Ejecutar `cd api && npm run build`.
- [x] Ejecutar prueba API local sobre copia PRD con `INVENTORY_SALE_V2_ENABLED=false`.
- [x] Validar venta no loteada.
- [x] Validar venta loteada con FEFO y `stock_movement_lots`.
- [x] Validar venta mixta.
- [x] Validar rollback por stock loteado insuficiente.
- [x] Validar cancelacion loteada y mixta.
- [x] Validar reconciliacion `critical=0 high=0`.
- [x] Ejecutar cleanup de fixture local con `fixture_rows_remaining=0`.
- [x] Crear `docs/evidencia-unificacion-flujo-venta-v2-fase-4R2.md`.
- [x] Ejecutar `openspec validate fortalecer-productos-inventario --type change --strict --json`.
- [x] Ejecutar `git diff --check`.
- [x] Confirmar que no se toco PRD real, POS UI, `web/`, `backend-reporteria/`, compras, ajustes, pedidos ni SQL critico.

### Fase 4.R3: validacion UI/API/DB producto-compras-ajustes

- [x] Crear backup local de `manus_tienda_prd` antes de tocar datos de prueba.
- [x] Aplicar fixture local seguro para producto loteado, producto no loteado, compra, ubicacion y usuario QA.
- [x] Validar desde UI crear producto enriquecido y persistir `is_perishable`, `requires_lot`, `requires_expiration`, `operational_status`, `rotation_class`, `min_stock` y `max_stock`.
- [x] Validar desde UI editar producto enriquecido y confirmar cambios en DB, `GET /api/products/:id` y `GET /api/inventory/products`.
- [x] Validar listado web con badges correctos para producto enriquecido.
- [x] Validar recepcion loteada desde UI con bloqueo de `lotCode` y `expirationDate` faltantes.
- [x] Validar recepcion loteada valida creando `inventory_lots`, incrementando `inventory_lot_balances` y creando `stock_movement_lots`.
- [x] Validar recepcion no loteada desde UI sin enviar campos loteados.
- [x] Validar ajuste loteado `IN` desde UI creando/reutilizando lote y subiendo balance.
- [x] Validar ajuste loteado `OUT` desde UI seleccionando balance disponible y bajando balance.
- [x] Corregir bug minimo de fecha ISO en ajuste loteado `OUT` para enviar `expirationDate` como `YYYY-MM-DD`.
- [x] Validar ajuste no loteado desde UI sin campos loteados y sin `stock_movement_lots`.
- [x] Validar vista `/inventory/lots` mostrando lote, saldo, ubicacion y disponibilidad.
- [x] Validar reconciliacion del producto/lote fixture con `critical=0 high=0`.
- [x] Ejecutar cleanup de fixture local con `fixture_rows_remaining=0`.
- [x] Crear `docs/evidencia-ui-api-db-productos-compras-ajustes-fase-4R3.md`.
- [x] Ejecutar `cd web && npm run build`.
- [x] Ejecutar `cd web && npx tsc --noEmit --pretty false`.
- [x] Documentar bloqueo interactivo de `cd web && npm run lint`.
- [x] Confirmar que no se toco PRD real, servidor remoto, POS UI, `backend-reporteria/`, migraciones ni funciones SQL de venta.

### Fase 5.R: validacion integral operativa producto-compra-inventario-venta

- [x] Confirmar QA local sobre copia PRD: `localhost:5432/manus_tienda_prd`.
- [x] Crear backup local antes de tocar datos de prueba.
- [x] Confirmar PostgreSQL 16.12.
- [x] Confirmar funciones `inventory_create_sale`, `inventory_create_sale_v2` e `inventory_invoice_order`.
- [x] Confirmar tablas `products`, `purchases`, `purchase_items`, `stock_movements`, `inventory_lots`, `inventory_lot_balances`, `stock_movement_lots`, `sales` y `sale_items`.
- [x] Crear script de prueba integral `scripts/database/tests/20260528_phase5_operational_integral_test.ts`.
- [x] Crear cleanup local seguro `scripts/database/dev/20260528_fixture_phase5_operational_cleanup.sql`.
- [x] Validar producto enriquecido: crear, editar, consultar `GET /api/products/:id` y `GET /api/inventory/products`.
- [x] Validar compra y recepcion loteada con `stock_movements IN`, `inventory_lots`, `inventory_lot_balances` y `stock_movement_lots`.
- [x] Validar compra y recepcion no loteada sin `stock_movement_lots` ni balances loteados.
- [x] Validar ajuste manual loteado `IN` y `OUT` con balances y links loteados.
- [x] Validar ajuste manual no loteado sin links loteados.
- [x] Validar venta FEFO con dos lotes y consumo por vencimiento mas cercano.
- [x] Validar venta mixta con links solo para producto loteado.
- [x] Validar stock loteado insuficiente con rollback total.
- [x] Validar cancelacion loteada y mixta devolviendo al lote original sin duplicar reversos.
- [x] Validar reconciliacion del fixture con `critical=0`, `high=0` y `discrepancies=0`.
- [x] Ejecutar cleanup y confirmar `fixture_rows_remaining=0`.
- [x] Corregir solo bugs de fixture/cleanup local: tablas opcionales y orden FK `purchase_items_product_id_fkey`.
- [x] Crear `docs/evidencia-validacion-integral-operativa-fase-5.md`.
- [x] Confirmar que no se toco PRD real, servidor remoto, `backend-reporteria/`, POS UI, migraciones, `inventory_create_sale` v1 ni `inventory_invoice_order`.

### Fase 5.1: UX operativo pagos rapidos, foco de acciones y mensajes consistentes

- [x] Revisar `web/components/design-system/confirm-dialog.tsx`.
- [x] Extender `ConfirmDialog` con `hideCancel` para mensajes de exito/error sin crear modal duplicado.
- [x] Crear helper frontend `web/modules/shared/payments/payment-allocation.helper.ts`.
- [x] Implementar deteccion robusta de metodo EFECTIVO/CASH sin UUID hardcodeado.
- [x] POS `Cobrar venta` inicia con efectivo por defecto por el total.
- [x] POS rebalancea efectivo al agregar, editar o quitar otros medios de pago.
- [x] POS bloquea sobrepago no efectivo, montos invalidos y metodos duplicados.
- [x] POS mejora modal de cobro con scroll interno para pantallas pequenas.
- [x] Orders entrega pedido muestra errores API con `confirm-dialog.tsx`.
- [x] Orders entrega/facturacion muestran confirmacion de exito con `confirm-dialog.tsx`.
- [x] Orders aplica focus mode real y oculta filtros/listado durante acciones.
- [x] Orders facturar/crear venta usa efectivo por defecto y rebalanceo automatico.
- [x] Orders facturar/crear venta muestra errores API con `confirm-dialog.tsx`.
- [x] Purchases crear compra autocompleta costo desde `product.cost`.
- [x] Purchases muestra aviso discreto cuando producto no tiene costo registrado.
- [x] Purchases crear/recibir compra muestra errores criticos con `confirm-dialog.tsx`.
- [x] Ejecutar `cd web && npx.cmd tsc --noEmit --pretty false`.
- [x] Ejecutar `cd web && npm.cmd run build`.
- [x] Documentar bloqueo interactivo de `cd web && npm.cmd run lint`.
- [x] Crear `docs/evidencia-ux-operativo-pagos-focus-confirmaciones-fase-5-1.md`.
- [x] Confirmar que no se toco `api/`, `backend-reporteria/`, SQL, migraciones, POS backend ni funciones SQL.

### Fase 5.1.1: Orders precio automatico del producto al crear pedido

- [x] Revisar flujo de crear pedido en `/[tenant]/orders`.
- [x] Confirmar que el catalogo frontend de productos expone `product.price`.
- [x] Usar `product.price` como precio por defecto del item al seleccionar producto.
- [x] Confirmar que no se usa `product.cost` para pedidos.
- [x] Mantener precio editable manualmente por el usuario.
- [x] Actualizar precio cuando el usuario cambia de producto.
- [x] Mantener recalculo de subtotal y total.
- [x] Mostrar aviso discreto cuando producto no tiene precio valido.
- [x] Usar `confirm-dialog.tsx` para errores criticos de crear/editar pedido.
- [x] Ejecutar `cd web && npx.cmd tsc --noEmit --pretty false`.
- [x] Ejecutar `cd web && npm.cmd run build`.
- [x] Documentar bloqueo interactivo de `cd web && npm.cmd run lint`.
- [x] Crear `docs/evidencia-orders-precio-producto-fase-5-1-1.md`.
- [x] Confirmar que no se toco `api/`, `backend-reporteria/`, SQL, migraciones, POS ni compras.

### Fase 5.1.R: validacion UX operativa POS, Orders y Purchases

- [x] Validar POS `Cobrar venta` con `EFECTIVO` por defecto.
- [x] Validar POS rebalanceando efectivo al agregar `NEQUI`.
- [x] Validar POS con efectivo en `0` cuando otro medio cubre total.
- [x] Validar POS bloqueando sobrepago de medio no efectivo.
- [x] Validar modal POS con foco visual y contenido accesible.
- [x] Validar Orders `Crear pedido` autocompletando precio desde `product.price`.
- [x] Validar Orders respetando edicion manual de precio al cambiar cantidad.
- [x] Validar Orders actualizando precio al cambiar producto.
- [x] Validar Orders focus mode para `Entregar pedido`.
- [x] Validar Orders entrega con confirmacion visual y dialog de exito.
- [x] Validar Orders focus mode para `Facturar pedido`.
- [x] Validar Orders facturacion con `EFECTIVO` por defecto.
- [x] Validar Orders facturacion rebalanceando efectivo al agregar `NEQUI`.
- [x] Validar Orders facturacion bloqueando sobrepago.
- [x] Validar Orders `Crear venta` con confirmacion visual y dialog de exito.
- [x] Validar Purchases `Crear compra` autocompletando costo desde `product.cost`.
- [x] Validar Purchases respetando edicion manual de costo al cambiar cantidad.
- [x] Validar Purchases actualizando costo al cambiar producto.
- [x] Confirmar que errores criticos operativos usan `confirm-dialog.tsx`.
- [x] Crear `docs/evidencia-validacion-ux-operativa-fase-5-1R.md`.
- [x] Confirmar que no se toco `api/`, `backend-reporteria/`, SQL, migraciones ni funciones SQL.

### Fase 5.1.R2: hardening UX tecnico previo a pricing

- [x] Corregir keys duplicadas en `/inventory/lots` deduplicando opciones y filas por `id`.
- [x] Corregir key duplicada en alertas de reconciliacion del dashboard de inventario.
- [x] Crear fixture local/dev de producto sin `price` y producto sin `cost`.
- [x] Validar Orders con producto sin `price`: campo editable, aviso discreto, subtotal/total sin `NaN`.
- [x] Validar Purchases con producto sin `cost`: campo editable, aviso discreto, subtotal/total sin `NaN`.
- [x] Ejecutar cleanup de fixture local con `fixture_rows_remaining=0`.
- [x] Resolver prompt interactivo de `npm run lint` con configuracion minima de Next ESLint.
- [x] Ejecutar `cd web && npm.cmd run lint` sin prompt interactivo y sin errores.
- [x] Ejecutar `cd web && npx.cmd tsc --noEmit --pretty false`.
- [x] Ejecutar `cd web && npm.cmd run build`.
- [x] Crear `docs/evidencia-hardening-ux-tecnico-fase-5-1R2.md`.
- [x] Confirmar que no se toco `backend-reporteria/`, SQL estructural, migraciones productivas, POS, ventas ni funciones SQL.

## Fase 6.0: diseno fiscal de pricing, promociones y base para facturacion electronica

- [x] Crear `docs/diseno-fiscal-pricing-promociones-facturacion-electronica-fase-6-0.md` sin cambios funcionales y validar con `openspec validate` y `git diff --check`.

## Fase 6.1: backend cambio de precio con historial

- [x] Implementar `POST /api/products/:id/change-price` con motivo obligatorio, precio no negativo y usuario autenticado.
- [x] Implementar `GET /api/products/:id/price-history` filtrado por tenant.
- [x] Usar `product_price_history` existente para registrar `previous_price`, `new_price`, `reason`, `changed_by`, `valid_from`, `status = APPLIED` y `created_at`.
- [x] Actualizar solo `products.price` sin recalcular `sale_items`, `order_items`, POS, Orders ni `inventory_create_sale_v2`.
- [x] Agregar pruebas unitarias de cambio de precio, validaciones, historial, tenant y no recalculo historico.
- [x] Ejecutar build de `api/`.
- [x] Crear `docs/evidencia-backend-cambio-precio-fase-6-1.md`.
- [x] Ejecutar `openspec validate` y `git diff --check`.

## Fase 6.2: frontend cambio de precio con historial

- [x] Extender servicio frontend de productos con `getProductPriceHistory` y `changeProductPrice`.
- [x] Crear modal de cambio de precio con precio actual, nuevo precio, diferencia, motivo obligatorio y validaciones UX.
- [x] Crear panel de historial de precios con fecha, precio anterior/nuevo, motivo, usuario, estado y vacio amigable.
- [x] Integrar boton `Cambiar precio` en productos sin tocar POS, Orders ni compras.
- [x] Refrescar producto/listado e historial despues de guardar.
- [x] Mostrar exito y errores con `ConfirmDialog` o patron consistente.
- [x] Mantener `ProductForm` compatible y documentar ayuda para usar cambio trazable.
- [x] Ejecutar `cd web && npx.cmd tsc --noEmit --pretty false`.
- [x] Ejecutar `cd web && npm.cmd run build`.
- [x] Ejecutar `cd web && npm.cmd run lint`.
- [x] Crear `docs/evidencia-frontend-cambio-precio-fase-6-2.md`.
- [x] Ejecutar `openspec validate` y `git diff --check`.

## Fase 6.3: validacion punta a punta cambio de precio UI/API/DB

- [x] Levantar API local contra copia QA local `localhost:5432/manus_tienda_prd`.
- [x] Levantar web local y validar flujo real desde UI de productos.
- [x] Cambiar precio desde UI con motivo obligatorio y confirmar exito visual.
- [x] Validar que listado, `ProductForm` e historial reflejan el nuevo precio.
- [x] Validar `products.price` y `product_price_history` en PostgreSQL.
- [x] Validar errores de motivo corto, precio negativo y producto inexistente.
- [x] Confirmar que `sale_items` y `order_items` historicos no cambian.
- [x] Confirmar compatibilidad de `GET /api/products/:id` y `GET /api/inventory/products`.
- [x] Crear `docs/evidencia-validacion-cambio-precio-fase-6-3.md`.
- [x] Ejecutar `openspec validate` y `git diff --check`.

## Fase 6.4: PricingService base sin promociones

- [x] Crear modulo `api/src/modules/pricing` con `PricingService`.
- [x] Implementar `calculateLinePrice` con lectura por `tenantId + productId`.
- [x] Validar producto activo, `quantity > 0` y `channel` permitido.
- [x] Usar `products.price` como precio visible vigente.
- [x] Calcular impuesto con regla actual de precio incluido.
- [x] Mantener promociones en `0/null`.
- [x] Implementar endpoint preview `POST /api/pricing/preview-line`.
- [x] Confirmar que no persiste ni modifica productos, ventas ni pedidos.
- [x] Agregar tests de PricingService y preview controller.
- [x] Ejecutar `cd api && npx.cmd tsx --test src/modules/pricing/*.spec.ts`.
- [x] Ejecutar `cd api && npm.cmd run build`.
- [x] Crear `docs/evidencia-pricing-service-base-fase-6-4.md`.
- [x] Ejecutar `openspec validate` y `git diff --check`.
- [x] Hardening: extraer `calculateLineWithoutPromotions` como calculo base sin consultar promociones.
- [x] Hardening: reutilizar el calculo base desde `calculateLinePrice` antes de aplicar promociones.
- [x] Hardening: mantener compatible `POST /api/pricing/preview-line` con promociones existentes.
- [x] Hardening: agregar pruebas especificas del calculo base sin promociones.
- [x] Hardening: documentar que `products.price` es fuente vigente y que `price_with_tax`/`price_without_tax` pueden quedar desfasados tras `change-price`.

## Fase 6.5: backend CRUD promociones simples

- [x] Crear migracion `scripts/database/migrations/20260605_pricing_promotions_phase_1.sql`.
- [x] Crear rollback `scripts/database/migrations/20260605_pricing_promotions_phase_1_rollback.sql`.
- [x] Crear runbook `docs/runbook-migracion-promociones-fase-6-5.md`.
- [x] Crear CRUD backend bajo `/api/pricing/promotions`.
- [x] Validar productos y sucursales por tenant.
- [x] Validar descuentos `PERCENTAGE`, `FIXED_AMOUNT` y `SPECIAL_PRICE`.
- [x] Validar vigencia, prioridad y productos obligatorios.
- [x] Implementar desactivacion logica sin borrado fisico.
- [x] Agregar tests de servicio y controller de promociones.
- [x] Ejecutar `cd api && npx.cmd tsx --test src/modules/pricing/promotions*.spec.ts`.
- [x] Ejecutar `cd api && npm.cmd run build`.
- [x] Crear `docs/evidencia-backend-promociones-crud-fase-6-5.md`.
- [x] Confirmar que POS, Orders, `SaleService`, `OrderService` e `inventory_create_sale_v2` no se modificaron.
- [x] Ejecutar `openspec validate` y `git diff --check`.

## Fase 6.5.1: prueba local migracion y API promociones

- [x] Crear backup local previo fuera del repo.
- [x] Ejecutar migracion `scripts/database/migrations/20260605_pricing_promotions_phase_1.sql` contra copia QA local `localhost:5432/manus_tienda_prd`.
- [x] Validar tablas `promotions`, `promotion_products` y `promotion_branches`.
- [x] Validar constraints e indices de promociones, productos y sucursales.
- [x] Ejecutar rollback local y confirmar que productos, ventas y pedidos siguen intactos.
- [x] Reaplicar migracion y dejar DB local migrada.
- [x] Levantar API local y probar CRUD real de promociones.
- [x] Crear promociones `PERCENTAGE`, `FIXED_AMOUNT`, `SPECIAL_PRICE`, con sucursal y sin sucursal.
- [x] Listar, filtrar por `productId`, actualizar y desactivar promocion sin borrado fisico.
- [x] Validar errores esperados: porcentaje mayor a 100, vigencia invalida, sin productos y producto inexistente.
- [x] Confirmar que `GET /api/products/:id` y `GET /api/inventory/products` siguen funcionando.
- [x] Confirmar que `POST /api/pricing/preview-line` sigue sin aplicar promociones.
- [x] Confirmar que POS, Orders, `SaleService`, `OrderService` e `inventory_create_sale_v2` no se modificaron.
- [x] Ejecutar cleanup de fixtures y validar `fixture_rows_remaining=0`.
- [x] Crear `docs/evidencia-api-local-promociones-fase-6-5-1.md`.
- [x] Ejecutar `openspec validate` y `git diff --check`.

## Fase 6.5.1-H: hardening CRUD promociones

- [x] Reforzar cobertura de `PromotionsService` para `discountType` invalido, descuentos negativos/no finitos, `PERCENTAGE > 100`, fechas invalidas y `priority` negativo.
- [x] Reforzar cobertura de pertenencia por tenant para productos y sucursales objetivo.
- [x] Reforzar cobertura de listado por `isActive`, query `isActive` invalida y request sin tenant autenticado.
- [x] Confirmar desactivacion logica de promocion existente sin borrado fisico.
- [x] Confirmar que `POST /api/pricing/preview-line` mantiene compatibilidad con campos de promocion aplicada.
- [x] Ejecutar `cd api && npx.cmd tsx --test src/modules/pricing/*.spec.ts`.
- [x] Ejecutar `cd api && npm.cmd run build`.
- [x] Actualizar `docs/evidencia-backend-promociones-crud-fase-6-5.md`.
- [x] Confirmar que no se tocaron migraciones, POS, Orders, frontend, facturacion electronica, DIAN, suppliers ni PRD real.

## Fase 6.5.2: permiso dedicado para promociones

- [x] Agregar `MENU_KEYS.INVENTORY_PROMOTIONS`.
- [x] Proteger CRUD de promociones con `INVENTORY_PROMOTIONS` y retirar `INVENTORY_PRODUCTS` del controller.
- [x] Crear migracion idempotente para `INVENTORY_PROMOTIONS` oculto bajo Inventario.
- [x] Actualizar seeds fresh DB de menu y permisos.
- [x] Asignar permisos por defecto a `SUPER_ADMIN`, `SUPER_USER` y `ADMIN`; no asignar a `USER`.
- [x] Agregar test de metadata RBAC de `PromotionsController`.
- [x] Ejecutar pruebas y build autorizados.
- [x] Crear `docs/evidencia-permiso-promociones-fase-6-5-2.md`.
- [x] Confirmar que no se toco frontend, facturacion electronica, DIAN, suppliers, POS, Orders ni `PricingService`.

## Fase 6.6: PricingService preview con promociones

- [x] Consultar promociones aplicables por `tenantId`, `branchId`, `productId` y fecha.
- [x] Aplicar solo promociones activas, vigentes y asociadas al producto.
- [x] Respetar alcance por sucursal: sin sucursal aplica a todo el tenant, con sucursal aplica solo a esa sucursal.
- [x] Calcular descuentos `PERCENTAGE`, `FIXED_AMOUNT` y `SPECIAL_PRICE`.
- [x] Evitar `finalUnitPrice < 0` y limitar descuentos a `baseUnitPrice`.
- [x] No aplicar `SPECIAL_PRICE` cuando no beneficia al cliente.
- [x] Seleccionar promocion no acumulable por menor prioridad, mayor descuento, mayor recencia e `id` estable.
- [x] Recalcular `taxBase`, `taxAmount`, `lineSubtotal` y `lineTotal` sobre `finalUnitPrice`.
- [x] Mantener comportamiento anterior cuando no hay promociones aplicables.
- [x] Mantener `preview-line` sin persistencia y sin modificar ventas, pedidos ni productos.
- [x] Agregar tests de promociones aplicadas, no aplicables, prioridad, empates, impuestos y no persistencia.
- [x] Ejecutar `cd api && npx.cmd tsx --test src/modules/pricing/*.spec.ts`.
- [x] Ejecutar `cd api && npm.cmd run build`.
- [x] Crear `docs/evidencia-pricing-service-promociones-preview-fase-6-6.md`.
- [x] Confirmar que no se toco POS, Orders, `SaleService`, `OrderService`, `inventory_create_sale_v2`, frontend, reporteria ni SQL.
- [x] Ejecutar `openspec validate` y `git diff --check`.

## Fase 6.6.1: validacion API local PricingService promociones preview

- [x] Crear backup local previo fuera del repo.
- [x] Confirmar ambiente QA local `localhost:5432/manus_tienda_prd` y no PRD real.
- [x] Levantar API local en puerto disponible.
- [x] Crear fixture seguro con producto, IVA, sucursal y promociones de prueba.
- [x] Validar `preview-line` sin promocion aplicable.
- [x] Validar promocion `PERCENTAGE` activa.
- [x] Validar promocion `FIXED_AMOUNT` activa.
- [x] Validar promocion `SPECIAL_PRICE` activa.
- [x] Validar que promocion vencida no aplica.
- [x] Validar que promocion inactiva no aplica.
- [x] Validar que promocion de otra sucursal no aplica.
- [x] Validar prioridad: gana menor `priority`.
- [x] Validar empate de prioridad: gana mayor descuento.
- [x] Validar que descuento no deja precio final negativo.
- [x] Validar `quantity > 1` y recalculo de impuestos.
- [x] Confirmar no persistencia en `sale_items`, `order_items` ni productos base.
- [x] Ejecutar cleanup de fixture y validar `fixture_rows_remaining=0`.
- [x] Crear `docs/evidencia-api-local-pricing-promociones-preview-fase-6-6-1.md`.
- [x] Ejecutar `openspec validate` y `git diff --check`.

## Fase 6.7.1: migracion snapshot pricing Orders

- [x] Crear migracion idempotente para columnas snapshot de pricing en `order_items`.
- [x] Crear rollback idempotente de columnas snapshot de pricing en `order_items`.
- [x] Mantener `price` y `subtotal` actuales por compatibilidad.
- [x] No recalcular ni poblar snapshot inventado para pedidos historicos.
- [x] Actualizar entidad tipada `OrderItemEntity` con campos snapshot nullable.
- [x] No crear indices prematuros para `applied_promotion_id` ni `tax_id`.
- [x] Documentar que `price` seguira representando `finalUnitPrice` en Fase 6.7.2.
- [x] Documentar que `subtotal` seguira representando `lineTotal` en Fase 6.7.2.
- [x] Crear `docs/evidencia-orders-pricing-snapshot-fase-6-7-1.md`.
- [x] Ejecutar `openspec validate`, `git diff --check` y build de `api/`.
- [x] Confirmar que no se toco `OrderService`, `SaleService`, frontend, POS, facturacion electronica, DIAN, GetAcquirer, suppliers fiscales, PRD real, remoto ni commits.

## Fase 6.7.2: OrderService usa PricingService en pedidos DRAFT

- [x] Importar `PricingModule` en `InventoryModule` sin circularidad.
- [x] Inyectar `PricingService` en `OrderService`.
- [x] Calcular lineas con `PricingService.calculateLinePrice` al crear pedidos.
- [x] Resolver `branchId` antes de calcular y rechazar creacion sin sucursal.
- [x] Ignorar `price`, `subtotal` y `total` enviados por frontend en creacion.
- [x] Calcular `orders.total` como suma de `lineTotal`.
- [x] Persistir `order_items.price = finalUnitPrice` y `order_items.subtotal = lineTotal`.
- [x] Persistir snapshot de precio, descuento, promocion, impuesto y fecha de calculo en `order_items`.
- [x] Recalcular lineas al actualizar pedidos `DRAFT` cuando llegan `items`.
- [x] Mantener actualizacion sin recalculo cuando no llegan `items`.
- [x] Documentar riesgo de cambio de `branchId`/`customerId` sin `items`.
- [x] Agregar pruebas unitarias de `OrderService` sin base real.
- [x] Crear `docs/evidencia-orders-pricing-service-fase-6-7-2.md`.
- [x] Ejecutar tests autorizados, build, `openspec validate` y `git diff --check`.
- [x] Confirmar que no se tocaron `SaleService`, `invoiceOrder`, POS, frontend, facturacion electronica, DIAN, GetAcquirer, suppliers fiscales, PRD real, remoto ni commits.

## Fase 6.7.3: validacion API local Orders + PricingService

- [x] Confirmar ambiente QA local `::1/128:5432/manus_tienda_prd` y no PRD real.
- [x] Confirmar migracion snapshot 6.7.1 aplicada en `order_items`.
- [x] Levantar API local en puerto `4024`.
- [x] Crear fixture local controlado con tenant, sucursal, usuario, cliente, productos, IVA y promocion.
- [x] Hacer login local sin documentar token completo.
- [x] Crear pedido sin promocion enviando `price`, `subtotal` y `total` basura.
- [x] Verificar que backend calcula `orders.total`, `order_items.price`, `order_items.subtotal` y snapshot con `PricingService`.
- [x] Crear pedido con promocion activa enviando `price`, `subtotal` y `total` basura.
- [x] Verificar `applied_promotion_id`, `applied_promotion_name`, `discount_total`, `tax_base`, `tax_amount`, `line_total` y `pricing_snapshot`.
- [x] Probar `updateOrder` DRAFT con `items` y verificar recalculo.
- [x] Ejecutar cleanup y validar `fixtureRowsRemaining=0`.
- [x] Crear `docs/evidencia-api-local-orders-pricing-fase-6-7-3.md`.
- [x] Confirmar que no se tocaron logica funcional, `OrderService`, `SaleService`, `invoiceOrder`, POS, frontend, facturacion electronica, DIAN, GetAcquirer, suppliers fiscales, PRD real, remoto ni commits.

## Fase 6.7.4.1: migracion snapshot pricing sale_items

- [x] Crear migracion idempotente para columnas snapshot de pricing en `sale_items`.
- [x] Crear rollback idempotente de columnas snapshot de pricing en `sale_items`.
- [x] Mantener `price`, `price_without_tax`, `tax_total` y `subtotal` actuales por compatibilidad.
- [x] No recalcular ni poblar snapshot inventado para ventas historicas.
- [x] Actualizar entidad tipada `SaleItemEntity` con campos snapshot nullable.
- [x] No crear indices prematuros para `applied_promotion_id` ni `pricing_snapshot`.
- [x] Documentar que `sale_items.price` seguira representando `finalUnitPrice` en fases futuras.
- [x] Documentar que `sale_items.subtotal` seguira representando `lineTotal` en fases futuras.
- [x] Documentar que `sale_item_taxes` conservara `tax_id`, `tax_name`, `tax_rate` y `tax_amount`.
- [x] Crear `docs/evidencia-sale-items-pricing-snapshot-fase-6-7-4-1.md`.
- [x] Ejecutar `openspec validate`, `git diff --check` y build de `api/`.
- [x] Confirmar que no se toco `inventory_invoice_order`, `SaleService`, `OrderService`, POS, frontend, facturacion electronica, DIAN, GetAcquirer, suppliers fiscales, PRD real, remoto ni commits.

## Fase 6.7.4.2: inventory_invoice_order usa snapshot de order_items

- [x] Crear migracion `V049__invoice_order_uses_order_item_snapshot_phase_6_7_4_2.sql`.
- [x] Crear rollback `V049__invoice_order_uses_order_item_snapshot_phase_6_7_4_2_rollback.sql`.
- [x] Actualizar `inventory_invoice_order` para usar snapshot suficiente de `order_items`.
- [x] No recalcular precio, promocion ni impuesto desde `products`/`taxes` cuando hay snapshot suficiente.
- [x] Crear `sale_item_taxes` desde `order_items.tax_id`, `tax_rate` y `tax_amount` prorrateado.
- [x] Mantener fallback legacy para pedidos sin snapshot suficiente.
- [x] Prorratear `line_total`, `tax_base`, `tax_amount` y `discount_total` en facturacion parcial.
- [x] Actualizar fresh DB function `scripts/database/sale/012_sale_financial_sync_and_pos_function.sql`.
- [x] Crear `docs/evidencia-invoice-order-uses-order-snapshot-fase-6-7-4-2.md`.
- [x] Ejecutar `openspec validate`, `git diff --check` y build de `api/`.
- [x] Confirmar que no se toco POS, frontend, facturacion electronica, DIAN, GetAcquirer, suppliers fiscales, PRD real, remoto, `SaleService`, `OrderService` ni commits.

## Fase 6.7.4.3: validacion API local invoice order snapshot

- [x] Confirmar ambiente QA local `::1/128:5432/manus_tienda_prd` y no PRD real.
- [x] Aplicar V048 y V049 solo en DB local/copia QA al no estar presentes.
- [x] Confirmar columnas snapshot en `sale_items`.
- [x] Confirmar que `inventory_invoice_order` contiene `ORDER_ITEM_SNAPSHOT`.
- [x] Levantar API local en puerto `4024`.
- [x] Crear fixture local controlado con prefijo UUID `67430000-*`.
- [x] Abrir sesion POS local para el fixture.
- [x] Crear pedido con producto IVA incluido y promocion, enviando `price`, `subtotal` y `total` basura.
- [x] Confirmar pedido y entregar parcialmente cantidad `1` de cantidad pedida `2`.
- [x] Mutar despues del pedido `products.price`, `taxes.rate` y `promotions.is_active`.
- [x] Facturar el pedido por API con `POST /api/orders/:id/invoice`.
- [x] Verificar que `sale_items` usa `order_items.final_unit_price`, `line_total`, `discount_total` y promocion prorrateados/copiados desde snapshot.
- [x] Verificar que `sale_item_taxes.tax_rate` y `tax_amount` vienen del snapshot y no de `taxes.rate` actual.
- [x] Ejecutar cleanup y validar `fixtureRowsRemaining=0`.
- [x] Crear `docs/evidencia-api-local-invoice-order-snapshot-fase-6-7-4-3.md`.
- [x] Confirmar que no se toco logica funcional, archivos SQL, `SaleService`, `OrderService`, POS, frontend, facturacion electronica, DIAN, GetAcquirer, suppliers fiscales, PRD real, remoto ni commits; V048/V049 se aplicaron solo en DB local/copia QA aprobada.

## Fase 6.7.4.QA: validacion complementaria invoice order snapshot

- [x] Confirmar DB local/copia QA `::1/128:5432/manus_tienda_prd`.
- [x] Confirmar efectos de V048/V049 por columnas snapshot en `sale_items` y marcadores en `inventory_invoice_order`.
- [x] Confirmar API local en puerto `4024`.
- [x] Crear fixture local controlado con prefijo UUID `67440000-*`.
- [x] Validar fallback legacy sin snapshot suficiente en `order_items`.
- [x] Verificar `sale_items.pricing_source = LEGACY_ORDER_ITEM_NO_PRICING_SNAPSHOT`.
- [x] Verificar descuento/promocion en cero/null para fallback legacy.
- [x] Validar producto sin `tax_id` con snapshot suficiente.
- [x] Verificar que linea sin impuesto no crea `sale_item_taxes` y usa `ORDER_ITEM_SNAPSHOT`.
- [x] Validar redondeo parcial con 3 facturas parciales de cantidad `1`.
- [x] Documentar diferencia acumulada de centavos como riesgo sin corregir logica.
- [x] Ejecutar cleanup y validar `fixtureRowsRemaining=0`.
- [x] Detener API local despues de la prueba.
- [x] Crear `docs/evidencia-api-local-invoice-order-snapshot-qa-fase-6-7-4.md`.
- [x] Ejecutar `openspec validate` y `git diff --check`.
- [x] Confirmar que no se toco logica funcional, SQL permanente, migraciones, `SaleService`, `OrderService`, POS, frontend, facturacion electronica, DIAN, GetAcquirer, suppliers, PRD real, remoto ni commits.

## Fase 6.7.4.5: absorcion de redondeo en ultima factura parcial

- [x] Crear migracion `V050__invoice_order_partial_rounding_absorption_phase_6_7_4_5.sql`.
- [x] Crear rollback `V050__invoice_order_partial_rounding_absorption_phase_6_7_4_5_rollback.sql`.
- [x] Eliminar `chk_sale_items_subtotal_matches` en la migracion para permitir absorcion de centavos.
- [x] Crear indice parcial `idx_sale_items_tenant_order_item`.
- [x] Actualizar `inventory_invoice_order` para absorber redondeo solo en la ultima factura parcial con `ORDER_ITEM_SNAPSHOT`.
- [x] Mantener prorrateo normal en facturas parciales intermedias.
- [x] Mantener fallback legacy sin absorcion.
- [x] Actualizar fresh DB function `scripts/database/sale/012_sale_financial_sync_and_pos_function.sql`.
- [x] Crear `docs/evidencia-invoice-order-partial-rounding-fase-6-7-4-5.md`.
- [x] Ejecutar `openspec validate`, `git diff --check` y build de `api/`.
- [x] Confirmar que no se toco API TypeScript, `SaleService`, `OrderService`, POS, frontend, facturacion electronica, DIAN, GetAcquirer, suppliers, PRD real, remoto ni commits.

## Fase 6.7.4.5.QA: validacion API local absorcion de redondeo

- [x] Confirmar DB local/copia QA `::1/128:5432/manus_tienda_prd`.
- [x] Aplicar V050 solo en DB local/copia QA.
- [x] Confirmar que `inventory_invoice_order` contiene `v_use_rounding_absorption`.
- [x] Confirmar que `chk_sale_items_subtotal_matches` no existe en DB local.
- [x] Crear fixture local controlado con prefijo UUID `67500000-*`.
- [x] Validar por DB directa 3 parciales `33.33`, `33.33`, `33.34`.
- [x] Verificar suma `line_total = 100.00` y `tax_amount = 15.97`.
- [x] Verificar `pricing_source = ORDER_ITEM_SNAPSHOT` en todas las lineas DB.
- [x] Ejecutar cleanup y validar `fixtureRowsRemaining = 0`.
- [x] Detener API local y confirmar sin listener en `4035`.
- [x] Documentar bloqueo API: `SaleItemEntity` mantiene validacion legacy `subtotal = price * quantity`.
- [x] Crear `docs/evidencia-api-local-invoice-order-partial-rounding-fase-6-7-4-5.md`.
- [x] Ejecutar `openspec validate` y `git diff --check`.
- [x] Confirmar que no se toco logica funcional, SQL, API TypeScript, `SaleService`, `OrderService`, POS, frontend, facturacion electronica, DIAN, suppliers, PRD real, remoto ni commits.

## Fase 6.7.4.6: compatibilidad SaleItemEntity con subtotal absorbido por snapshot

- [x] Actualizar `SaleItemEntity` para permitir subtotal absorbido solo con `pricingSource = ORDER_ITEM_SNAPSHOT`.
- [x] Mantener validacion legacy para `pricingSource` nulo o `LEGACY_ORDER_ITEM_NO_PRICING_SNAPSHOT`.
- [x] Comparar montos monetarios redondeados a 2 decimales para evitar ruido de floating point.
- [x] Validar que `lineTotal`, si viene informado en snapshot, coincida con `subtotal` redondeado.
- [x] Actualizar solo lectura/mapeo de `SaleService.getSaleById` para `line_total` y `pricing_source`.
- [x] Crear prueba `api/src/modules/inventory/entities/sale-item.entity.spec.ts`.
- [x] Actualizar `docs/evidencia-api-local-invoice-order-partial-rounding-fase-6-7-4-5.md`.
- [x] Ejecutar tests autorizados, build, `openspec validate` y `git diff --check`.
- [x] Confirmar que no se toco SQL, `inventory_invoice_order`, migraciones, logica de facturacion/escritura de `SaleService`, `OrderService`, POS, frontend, facturacion electronica, DIAN, GetAcquirer, suppliers, PRD real, remoto ni commits.

## Fase 6.7.4.6.QA: validacion API local completa de absorcion

- [x] Confirmar DB local/copia QA `::1/128:5432/manus_tienda_prd`.
- [x] Confirmar V050 aplicada localmente y `inventory_invoice_order` con `v_use_rounding_absorption`.
- [x] Levantar API local en puerto `4024`.
- [x] Crear fixture local controlado con prefijo UUID `67600000-*`.
- [x] Ejecutar 3 entregas parciales de cantidad `1` por API.
- [x] Ejecutar 3 facturas parciales por API usando `type = CREDIT` para aislar redondeo de pagos/caja.
- [x] Confirmar por API `lineTotal` `33.33`, `33.33`, `33.34`.
- [x] Confirmar por API `sale_item_taxes.taxAmount` `5.32`, `5.32`, `5.33`.
- [x] Confirmar por API `pricingSource = ORDER_ITEM_SNAPSHOT` en todas las lineas.
- [x] Confirmar que respuesta de `invoice` y `GET /api/sales/:id` no fallan por `SaleItemEntity`.
- [x] Confirmar por DB `line_total = 100.00`, `tax_amount = 15.97` y `billed_quantity = 3.00`.
- [x] Ejecutar cleanup y validar `fixtureRowsRemaining = 0`.
- [x] Detener API local y confirmar sin listener en `4024`.
- [x] Actualizar `docs/evidencia-api-local-invoice-order-partial-rounding-fase-6-7-4-5.md`.
- [x] Ejecutar `openspec validate` y `git diff --check`.
- [x] Confirmar que no se toco logica funcional, SQL, `SaleItemEntity`, `SaleService`, `OrderService`, POS, frontend, facturacion electronica, DIAN, GetAcquirer, suppliers, PRD real, remoto, credenciales ni commits.

## Fase 6.8.1: diseno tecnico POS usa PricingService

- [x] Analizar flujo POS directo `POST /api/sales` -> `SaleController` -> `SaleService.createSale` -> `SaleRepository.createSaleWithFunction` -> `inventory_create_sale_v2`.
- [x] Documentar que POS backend hoy confia en `items[].price` enviado por frontend para el calculo final.
- [x] Documentar calculo actual de `sales.total`, `sale_items.price`, `price_without_tax`, `tax_total`, `subtotal` y `sale_item_taxes`.
- [x] Documentar estrategia de inventario, stock agregado, `products.requires_lot`, `inventory_lot_balances`, `stock_movement_lots` y FEFO dentro de SQL.
- [x] Confirmar campos snapshot de V048 disponibles en `sale_items`.
- [x] Documentar diseno propuesto: `SaleService` calcula lineas con `PricingService`, ignora `items[].price`, envia payload enriquecido y mantiene stock/FEFO en `inventory_create_sale_v2`.
- [x] Documentar contrato interno `SaleService` -> `PricingService` para POS.
- [x] Documentar contrato JSON enriquecido hacia `inventory_create_sale_v2` con `pricing_source = POS_PRICING_SERVICE`.
- [x] Documentar estrategia de `sale_item_taxes`, pagos/caja, `SaleItemEntity`, riesgos, criterios de aceptacion y validaciones futuras.
- [x] Crear `docs/diseno-pos-pricing-service-fase-6-8-1.md`.
- [x] Confirmar que no se toco logica funcional, SQL, `inventory_create_sale_v2`, `SaleService`, `SaleRepository`, `SaleItemEntity`, frontend POS, Orders, facturacion electronica, DIAN, GetAcquirer, suppliers, PRD real, remoto ni commits.

## Fase 6.8.2: SaleService prepara payload POS con PricingService

- [x] Inyectar `PricingService` en `SaleService`.
- [x] Calcular cada item POS directo con `PricingService.calculateLinePrice`.
- [x] Usar `tenantId`, `branchId`, `customerId`, `productId`, `quantity`, `channel = POS` y una fecha unica de venta.
- [x] Ignorar `items[].price` enviado por frontend para el calculo final.
- [x] Construir `backendTotal` como suma de `lineTotal`.
- [x] Construir items enriquecidos con snapshot POS y `pricingSource = POS_PRICING_SERVICE`.
- [x] Extender `SaleRepository.createSaleWithFunction` para serializar payload enriquecido en snake_case.
- [x] Mantener compatibilidad con payload legacy.
- [x] Rechazar ventas `CASH` cuando pagos enviados no coinciden con `backendTotal`.
- [x] No autoajustar pagos ni modificar `PaymentsService` o cash session.
- [x] Agregar tests de `SaleService.createSale` y `SaleRepository.createSaleWithFunction`.
- [x] Crear `docs/evidencia-pos-pricing-payload-fase-6-8-2.md`.
- [x] Confirmar que no se toco SQL, `inventory_create_sale_v2`, migraciones, frontend POS, Orders, facturacion electronica, DIAN, GetAcquirer, suppliers, PRD real, remoto ni commits.

## Fase 6.8.3: inventory_create_sale_v2 persiste snapshot POS

- [x] Crear migracion `scripts/database/migrations/V051__inventory_create_sale_v2_pos_pricing_snapshot_phase_6_8_3.sql`.
- [x] Crear rollback `scripts/database/rollbacks/V051__inventory_create_sale_v2_pos_pricing_snapshot_phase_6_8_3_rollback.sql`.
- [x] Ampliar lectura JSONB de `items` con campos enriquecidos de PricingService.
- [x] Persistir snapshot POS en `sale_items` cuando `pricing_source = POS_PRICING_SERVICE`.
- [x] Usar `final_unit_price` como `sale_items.price` y `line_total` como `sale_items.subtotal`.
- [x] Sumar `sales.total` con `line_total` para snapshot POS.
- [x] Crear `sale_item_taxes` desde `tax_id`, `tax_rate` y `tax_amount` del payload POS.
- [x] No recalcular precio ni impuesto desde `products`/`taxes` en rama `POS_PRICING_SERVICE`.
- [x] Mantener comportamiento legacy actual cuando no hay `pricing_source = POS_PRICING_SERVICE`.
- [x] Mantener stock, FEFO, lotes, pagos, caja y Orders sin cambios funcionales.
- [x] Actualizar fresh DB function en `scripts/database/sale/012_sale_financial_sync_and_pos_function.sql`.
- [x] Crear `docs/evidencia-pos-sql-persists-pricing-snapshot-fase-6-8-3.md`.
- [x] Ejecutar `openspec validate`, `git diff --check` y build de `api/`.
- [x] Confirmar que no se toco API TypeScript, `SaleService`, `SaleRepository`, frontend POS, Orders, facturacion electronica, DIAN, GetAcquirer, suppliers, PRD real, remoto ni commits.

## Fase 6.8.4: QA API local POS pricing

- [x] Confirmar DB local/copia QA `::1/128:5432/manus_tienda_prd`.
- [x] Confirmar V048 por columnas snapshot en `sale_items`.
- [x] Confirmar V050 por ausencia de `chk_sale_items_subtotal_matches`.
- [x] Aplicar V051 solo en DB local/QA al no estar presente.
- [x] Levantar API local en puerto `4024`.
- [x] Crear fixture local controlado con tenant, sucursal, usuario, terminal, sesion POS, customer, unidad, IVA, promociones, productos, stock y lotes.
- [x] Validar venta POS con promocion + IVA enviando `price` basura.
- [x] Confirmar `sale_items.price = finalUnitPrice`, `subtotal = lineTotal` y `pricing_source = POS_PRICING_SERVICE`.
- [x] Confirmar `discount_total`, promocion aplicada y `pricing_snapshot` persistidos.
- [x] Confirmar `sale_item_taxes.tax_rate` y `tax_amount` desde snapshot POS.
- [x] Mutar `products.price`, `taxes.rate` y `promotions.is_active` despues de la venta.
- [x] Confirmar que la venta creada conserva snapshot y no cambia.
- [x] Validar CASH mismatch por API y confirmar que no crea ventas ni movimientos huerfanos.
- [x] Validar venta POS de producto loteado con FEFO y snapshot POS.
- [x] Confirmar que `stock_movement_lots` consume primero el lote con vencimiento mas cercano.
- [x] Validar legacy directo sin `pricing_source`.
- [x] Ejecutar cleanup completo del fixture y confirmar `fixtureRowsRemaining = 0`.
- [x] Apagar API local y confirmar puerto `4024` sin listener.
- [x] Crear `docs/evidencia-api-local-pos-pricing-fase-6-8-4.md`.
- [x] Ejecutar `openspec validate` y `git diff --check`.
- [x] Confirmar que no se toco logica funcional, SQL, TypeScript, frontend, Orders, facturacion electronica, DIAN, GetAcquirer, suppliers, PRD real, remoto ni commits.

## Fase 6.8.5: hardening carga JWT_SECRET / dotenv en bootstrap auth

- [x] Revisar carga de variables de entorno en `api/`.
- [x] Revisar `main.ts`, `app.module.ts`, `AuthModule`, `AuthService`, `JwtAuthGuard`, `MenuService` y `MenuController`.
- [x] Identificar lecturas directas de `process.env.JWT_SECRET` y fallback `"changeme"`.
- [x] Cargar `.env` antes de inicializar modulos auth/JWT.
- [x] Centralizar resolucion de `JWT_SECRET`, `JWT_EXPIRES_IN` y `REFRESH_TOKEN_EXPIRES_DAYS`.
- [x] Evitar fallback inseguro fuera de `NODE_ENV=local` o `NODE_ENV=test` explicito.
- [x] Agregar prueba especifica de hardening auth env.
- [x] Crear `docs/evidencia-auth-env-loading-hardening-fase-6-8-5.md`.
- [x] Ejecutar build de `api/`, prueba auth env, `openspec validate` y `git diff --check`.
- [x] Confirmar que no se toco pricing, POS, Orders, `inventory_create_sale_v2`, SQL, frontend, facturacion electronica, DIAN, suppliers, PRD real, remoto ni commits.

## Fase 6.9: frontend POS consume pricing y refleja promociones

- [x] Analizar vista POS actual en `web/modules/pos/components/PosScreen.tsx`.
- [x] Identificar agregado y cambio de cantidad del carrito POS.
- [x] Identificar `createSale` en `web/modules/pos/services/pos.service.ts`.
- [x] Consumir `POST /api/pricing/preview-line` desde servicio frontend POS.
- [x] Consultar preview-line al agregar producto, cambiar cantidad o rehidratar carrito con pricing pendiente.
- [x] Mostrar `finalUnitPrice`, descuento, nombre de promocion y `lineTotal` en carrito.
- [x] Mantener `POST /api/sales` compatible y enviar `price` como precio unitario final visible.
- [x] Mantener backend como fuente de verdad para precio, promociones, impuestos y persistencia.
- [x] Manejar error de preview con toast y mensaje por item sin bloquear toda la pantalla.
- [x] Crear `docs/evidencia-frontend-pos-pricing-fase-6-9.md`.
- [x] Ejecutar lint/build frontend, `openspec validate` y `git diff --check`.
- [x] Confirmar que no se toco backend, SQL, pagos/caja, stock/FEFO, Orders, facturacion electronica, DIAN/GetAcquirer, suppliers, PRD real, remoto ni commits.

## Fase 6.9.1: frontend administracion de promociones

- [x] Crear ruta `web/app/[tenant]/inventory/promotions/page.tsx`.
- [x] Crear servicio frontend `web/modules/pricing/services/promotions.service.ts`.
- [x] Consumir `GET /api/pricing/promotions`.
- [x] Consumir `GET /api/pricing/promotions/:id` para editar con datos frescos.
- [x] Consumir `POST /api/pricing/promotions`.
- [x] Consumir `PATCH /api/pricing/promotions/:id`.
- [x] Consumir `PATCH /api/pricing/promotions/:id/deactivate`.
- [x] Crear listado de promociones con estado, vigencia, prioridad, productos y sucursales.
- [x] Crear formulario modal para crear y editar promociones.
- [x] Permitir inactivar promocion.
- [x] Permitir filtrar por estado activo/inactivo/todas.
- [x] Permitir seleccionar productos aplicables con `productIds`.
- [x] Permitir seleccionar sucursales opcionales con `branchIds` usando selector existente.
- [x] Validar reglas UX de descuento, fechas, prioridad y producto obligatorio.
- [x] Mostrar que menor `priority` gana.
- [x] Indicar que `branchIds` vacio aplica a todas las sucursales permitidas.
- [x] Agregar permiso frontend `MENU_KEYS.INVENTORY_PROMOTIONS` y regla de ruta.
- [x] Agregar acceso rapido desde dashboard de Inventario.
- [x] Crear `docs/evidencia-frontend-promotions-admin-fase-6-9-1.md`.
- [x] Ejecutar lint/build frontend, `openspec validate` y `git diff --check`.
- [x] Confirmar que no se toco backend, SQL, PricingService, POS venta, Orders, facturacion electronica, DIAN/GetAcquirer, suppliers, PRD real, remoto ni commits.

## Fase 6.9.2: QA local frontend administracion de promociones

- [x] Confirmar DB local/copia QA, API local y web local sin exponer credenciales.
- [x] Validar que `/default/inventory/promotions` responde `200` y no cae en 404.
- [x] Validar permiso local con usuario `SUPER_ADMIN` y endpoints de promociones.
- [x] Validar listado y filtros `activas`, `inactivas` y `todas` por API local.
- [x] Crear promocion `PERCENTAGE` local y confirmar listado.
- [x] Crear promocion `FIXED_AMOUNT` local y documentar validacion inconsistente de `discountValue = 0`.
- [x] Crear promocion `SPECIAL_PRICE` local y validar rechazo de valor negativo.
- [x] Editar promocion y confirmar persistencia.
- [x] Inactivar promocion y confirmar filtro inactivo.
- [x] Validar `POST /api/pricing/preview-line` con promocion activa y reflejo de precio final, descuento, nombre de promocion y total linea.
- [x] Ejecutar cleanup logico de fixtures por inactivacion y confirmar `activeRemaining = 0`.
- [x] Documentar bloqueo de QA visual por in-app browser y bugs encontrados.
- [x] Crear `docs/evidencia-frontend-promotions-admin-qa-fase-6-9-2.md`.
- [x] Ejecutar lint/build frontend, `openspec validate` y `git diff --check`.
- [x] Confirmar que no se toco logica funcional, backend, SQL, frontend funcional, POS venta, Orders, facturacion electronica, DIAN/GetAcquirer, suppliers, PRD real, remoto ni commits.

## Fase 6.9.3: fixes promociones admin detectados en QA

- [x] Corregir `web/app/[tenant]/inventory/promotions/page.tsx` para no enviar slug `default` como `tenantId` en productos/sucursales.
- [x] Alinear validacion UX de promociones con reglas de backend.
- [x] Corregir `PromotionsService` para rechazar `FIXED_AMOUNT <= 0`, `PERCENTAGE <= 0` y `PERCENTAGE > 100`.
- [x] Mantener `SPECIAL_PRICE >= 0`.
- [x] Permitir deactivar promociones legacy invalidas con `FIXED_AMOUNT = 0`.
- [x] Agregar/ajustar tests de `PromotionsService`.
- [x] Cambiar menu `INVENTORY_PROMOTIONS` a `visible = TRUE` en migracion/seed idempotentes.
- [x] Agregar migracion idempotente `20260608_promotions_menu_visible_phase_6_9_3.sql`.
- [x] Validar localmente que productos/sucursales cargan sin `tenantId=default`.
- [x] Validar localmente que API rechaza `FIXED_AMOUNT = 0`.
- [x] Validar localmente que `/auth/menu` incluye `INVENTORY_PROMOTIONS` para rol con permiso.
- [x] Crear promocion por API, verla en listado, inactivarla y confirmar cleanup.
- [x] Crear `docs/evidencia-promotions-admin-fixes-fase-6-9-3.md`.
- [x] Ejecutar tests pricing, build API, lint/build web, `openspec validate` y `git diff --check`.
- [x] Confirmar que no se toco PricingService, POS venta, Orders, `inventory_create_sale_v2`, facturacion electronica, DIAN/GetAcquirer, suppliers, PRD real, remoto ni commits.

## Fase 6.9.4: permisos y menu de clasificacion de productos

- [x] Discover current Products menu key and permission model.
- [x] Discover menu_items and role_menu_permissions structure.
- [x] Decide whether categories/subcategories reuse Products permission or use product-equivalent aliases.
- [x] Create idempotent SQL script for menu entries.
- [x] Assign classification menu to the same roles that can access Products.
- [x] Protect category/subcategory backend endpoints with product-equivalent guards.
- [x] Protect category/subcategory frontend routes with product-equivalent access.
- [x] Add QA for role with Products access.
- [x] Add QA for role without Products access.
- [x] Validate SQL idempotency x2.
- [x] Validate no duplicate menu_items.
- [x] Validate no duplicate role_menu_permissions.

## Fase 6.9.5: DB y backend categorias/subcategorias tenant-safe

- [x] Discover real inventory/product migrations, SQL naming, idempotency, product backend patterns, tenant resolution and guards.
- [x] Crear migracion idempotente `V062__product_classification_backend_phase_6_9_5.sql`.
- [x] Crear tablas `product_categories` y `product_subcategories`.
- [x] Agregar columnas de clasificacion e imagen a `products`.
- [x] Agregar constraints tenant-safe, checks e indices requeridos.
- [x] Ejecutar migracion SQL local/dev dos veces para validar idempotencia.
- [x] Crear entidades `ProductCategoryEntity` y `ProductSubcategoryEntity`.
- [x] Crear repositories de categorias y subcategorias con filtro por `tenant_id`.
- [x] Crear services de categorias y subcategorias con validacion de slug, tenant y activacion/inactivacion.
- [x] Crear controllers REST de categorias y subcategorias bajo `/api/inventory/product-categories` y `/api/inventory/product-subcategories`.
- [x] Proteger endpoints con `JwtAuthGuard`, `RolesGuard`, `PermissionsGuard` y permiso equivalente `INVENTORY_PRODUCTS`.
- [x] Extender producto con `category_id`, `subcategory_id` y metadata de imagen sin upload real.
- [x] Validar categoria/subcategoria tenant-safe al crear y actualizar producto.
- [x] Agregar tests backend de categorias.
- [x] Agregar tests backend de subcategorias.
- [x] Agregar tests backend de producto con clasificacion.
- [x] Agregar tests de permisos para endpoints de clasificacion.
- [x] Ejecutar tests backend relevantes.
- [x] Ejecutar build de `api/`.
- [x] Ejecutar `openspec validate` y `git diff --check`.
- [x] Crear `docs/evidencia-product-classification-backend-fase-6-9-5.md`.
- [x] Confirmar que no se implemento UI, upload real, storage local, filtros POS, impuestos, descuentos, inventario ni cobro/pagos.

## Fase 6.9.6: UI categorias/subcategorias sin modales

- [x] Confirmar `git status --short` limpio y HEAD `7fb773d fix(api): wire product classification into inventory module`.
- [x] Discover rutas frontend de inventario/productos.
- [x] Discover convencion de modulos frontend en `web/modules/inventory`.
- [x] Discover patrones CRUD sin modales en unidades, impuestos y ubicaciones.
- [x] Discover componentes `web/components/design-system`.
- [x] Discover patron de API client/fetch y manejo de errores.
- [x] Discover permisos y rutas para categorias/subcategorias.
- [x] Crear cliente frontend de categorias/subcategorias.
- [x] Crear helpers frontend de clasificacion y tests.
- [x] Crear formulario inline de categorias.
- [x] Crear formulario inline de subcategorias.
- [x] Crear ruta `/[tenant]/inventory/product-categories`.
- [x] Crear ruta `/[tenant]/inventory/product-subcategories`.
- [x] Implementar listado/loading/empty/error para categorias.
- [x] Implementar listado/loading/empty/error para subcategorias.
- [x] Implementar crear/editar/activar/desactivar categorias sin modales.
- [x] Implementar crear/editar/activar/desactivar subcategorias sin modales.
- [x] Implementar filtro por categoria en subcategorias.
- [x] Implementar placeholder/preview de imagen sin upload real.
- [x] Mantener permisos frontend equivalentes a Productos.
- [x] Ejecutar tests frontend relevantes.
- [x] Ejecutar lint/build frontend.
- [x] Ejecutar `openspec validate` y `git diff --check`.
- [x] Crear `docs/evidencia-product-classification-ui-fase-6-9-6.md`.
- [x] Ejecutar QA manual local en `/00000000-0000-0000-0000-000000000001/inventory/product-categories` y `/00000000-0000-0000-0000-000000000001/inventory/product-subcategories`: PASS.
- [x] Confirmar en QA manual local paginas cargadas, CRUD categorias/subcategorias, UX sin modales, foco a la accion y permisos equivalentes a Productos.
- [x] Confirmar que no se implemento upload real, storage local, adaptacion CRUD productos, filtros POS, imagen efectiva POS, impuestos, descuentos, inventario ni cobro/pagos.

## Fase 6.9.7: adaptar CRUD de productos a categoria/subcategoria

- [x] Confirmar `git status --short` limpio y HEAD `5a0724d feat(web): add product classification management UI`.
- [x] Discover ruta CRUD de productos, formulario, focus layout, catalogos auxiliares, payload y tipos.
- [x] Confirmar que create/update backend de productos acepta `categoryId` y `subcategoryId`.
- [x] Detectar y corregir bug minimo: `/api/inventory/products` no devolvia `categoryId` ni `subcategoryId`.
- [x] Extender tipos frontend de producto y payload create/update con clasificacion.
- [x] Reutilizar `product-classification.service.ts` en el formulario y listado de productos.
- [x] Agregar helpers/tests de subcategoria dependiente, limpieza y payload.
- [x] Agregar seccion compacta `Clasificacion` al formulario de producto.
- [x] Permitir crear/editar producto sin categoria.
- [x] Permitir crear/editar producto con categoria.
- [x] Permitir crear/editar producto con categoria y subcategoria valida.
- [x] Limpiar subcategoria al cambiar o quitar categoria.
- [x] Bloquear subcategoria sin categoria desde validacion frontend.
- [x] Mostrar estados de carga/error de categorias y subcategorias sin bloquear guardado sin clasificacion.
- [x] Mostrar categoria/subcategoria compacta en listado de productos.
- [x] Mantener permisos existentes de Productos sin crear permisos nuevos.
- [x] Crear `docs/evidencia-product-crud-classification-fase-6-9-7.md`.
- [x] Ejecutar tests frontend/backend relevantes.
- [x] Ejecutar lint/build frontend.
- [x] Ejecutar build API por ajuste minimo backend.
- [x] Ejecutar `openspec validate` y `git diff --check`.
- [x] Ejecutar QA manual local en `/00000000-0000-0000-0000-000000000001/inventory/products`: PASS.
- [x] Confirmar QA manual local de crear producto sin categoria, con categoria, con categoria + subcategoria, editar/asignar clasificacion, limpiar subcategoria invalida al cambiar/quitar categoria y listado compacto.
- [x] Confirmar QA manual local que producto existente sin categoria sigue funcionando y no se afectaron precio, impuestos, unidad, estado operativo, inventario/stock ni cobro.
- [x] Confirmar que no se implemento upload real, storage local, filtros POS, imagen efectiva POS, impuestos, descuentos, inventario/stock ni cobro/pagos.

## Fase 6.9.8: upload local de imagenes para productos/categorias/subcategorias

- [x] Confirmar `git status --short` limpio y HEAD `7de1ee9 feat(web): add product classification fields to product CRUD`.
- [x] Discover que no existia modulo upload/archivos, storage local, static serving ni env vars de uploads.
- [x] Discover que `@nestjs/platform-express` permite `multipart/form-data` con `FileInterceptor`.
- [x] Discover que productos/categorias/subcategorias ya tenian metadata `image_*` y `default_image_*`.
- [x] Crear `LocalImageStorageService` con storage keys seguras y sin rutas absolutas.
- [x] Agregar variables `LOCAL_UPLOADS_DIR`, `MAX_PRODUCT_IMAGE_SIZE_MB` y `MAX_CATEGORY_IMAGE_SIZE_MB`.
- [x] Ignorar `storage/` y `api/storage/` en `.gitignore`.
- [x] Crear `ProductImageService` para upload, reemplazo, lectura y delete tenant-safe.
- [x] Crear endpoints `POST/DELETE/GET /api/inventory/products/:productId/image`.
- [x] Crear endpoints `POST/DELETE/GET /api/inventory/product-categories/:categoryId/image`.
- [x] Crear endpoints `POST/DELETE/GET /api/inventory/product-subcategories/:subcategoryId/image`.
- [x] Proteger endpoints con `JwtAuthGuard`, `RolesGuard`, `PermissionsGuard` y `INVENTORY_PRODUCTS`.
- [x] Validar MIME, extension, tamano, magic bytes y path traversal.
- [x] Actualizar metadata DB al subir/eliminar imagen de producto.
- [x] Actualizar metadata DB al subir/eliminar imagen de categoria.
- [x] Actualizar metadata DB al subir/eliminar imagen de subcategoria.
- [x] Extender `ProductResponse` e inventory listing con metadata de imagen.
- [x] Corregir cliente HTTP para no forzar `Content-Type: application/json` con `FormData`.
- [x] Crear API client frontend para upload/delete de imagenes.
- [x] Crear panel UI reutilizable de imagen sin modales.
- [x] Integrar panel en `ProductForm`.
- [x] Integrar panel en `ProductCategoryForm`.
- [x] Integrar panel en `ProductSubcategoryForm`.
- [x] Mostrar preview autenticado via blob API sin exponer ruta fisica.
- [x] Agregar tests backend de storage local, validacion, reemplazo/delete y cross-tenant.
- [x] Agregar tests frontend de helpers de imagen.
- [x] Ejecutar tests backend relevantes.
- [x] Ejecutar tests frontend relevantes.
- [x] Ejecutar build API.
- [x] Ejecutar lint/build frontend.
- [x] Crear `docs/evidencia-product-images-local-upload-fase-6-9-8.md`.
- [x] Ejecutar QA manual local de upload/reemplazo/delete/archivo invalido en productos, categorias y subcategorias: PASS.
- [x] Confirmar QA manual local en `/00000000-0000-0000-0000-000000000001/inventory/product-categories`, `/00000000-0000-0000-0000-000000000001/inventory/product-subcategories` y `/00000000-0000-0000-0000-000000000001/inventory/products`.
- [x] Confirmar QA manual local de preview autenticado, rechazo de archivos invalidos con mensaje legible, sin ruta fisica expuesta y registros sin imagen funcionando.
- [x] Confirmar que no se implemento filtros POS, imagen efectiva POS, impuestos, descuentos, inventario/stock, cobro/pagos ni migraciones nuevas.

## Fase 6.10: release readiness pricing, promociones, POS y Orders

- [x] Crear `docs/release-readiness-pricing-promociones-pos-orders-fase-6-10.md`.
- [x] Consolidar resumen ejecutivo, fases completadas, cambios backend/frontend/SQL, POS, Orders, promociones, validaciones, evidencias, riesgos, migraciones, checklists y rollback.
- [x] Documentar explicitamente que la consulta DIAN de clientes y proveedores no se implementa en esta fase y queda separada como epica FE-3.
- [x] Confirmar que no se toco codigo funcional, SQL, frontend, backend, PRD real, remoto ni commits.
- [x] Ejecutar `openspec.cmd validate fortalecer-productos-inventario --type change --strict --json` y `git diff --check`.

## Fase 6: integracion compras/ventas

- [ ] Validar entrada de compra con lotes obligatorios.
- [ ] Validar liquidacion parcial sin crear lotes de cantidad no recibida.
- [ ] Validar venta POS descuenta lote correcto por FEFO.
- [ ] Validar cancelacion de venta revierte lote correcto.
- [ ] Validar entrega de pedido descuenta lote correcto.
- [ ] Validar facturacion de pedido no duplica descuento.
- [ ] Validar pagos/caja sin mezclar responsabilidades de inventario.
- [ ] Validar reportes/tickets existentes con productos loteados y no loteados.

## Fase 7: pruebas y validacion

- [ ] Pruebas unitarias de producto enriquecido.
- [ ] Pruebas unitarias de historial de precios.
- [ ] Pruebas de recepcion de compras con lote/vencimiento.
- [ ] Pruebas de FEFO en ventas POS.
- [ ] Pruebas de cancelacion y reverso de lotes.
- [ ] Pruebas de pedidos con entrega/facturacion.
- [ ] Pruebas de reporteria de inventario.
- [ ] Pruebas de permisos y multi-tenant.
- [ ] Pruebas de performance de consultas de stock.
- [ ] Pruebas manuales web POS, compras, productos, reporteria.

## Fase 8: documentacion y cierre

- [ ] Actualizar docs de producto.
- [ ] Actualizar docs de inventario.
- [ ] Actualizar docs de compras.
- [ ] Actualizar docs de POS/ventas.
- [ ] Actualizar docs de reporteria.
- [ ] Actualizar runbook de migracion.
- [ ] Documentar riesgos residuales.
- [ ] Archivar cambio OpenSpec cuando implementacion y validacion terminen.
