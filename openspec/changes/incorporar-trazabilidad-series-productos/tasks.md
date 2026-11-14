## 0. Gobernanza

- [x] 0.1 Aprobación del propietario del borrador (decisiones del 2026-11-14 en `claude/series-productos-decisiones.md`).
- [x] 0.2 `idempotencia-entrega-pedidos` mergeado en `develop` (PR #406, 88a1d87).
- [x] 0.3 Rama `feature/develop/incorporar-trazabilidad-series-productos` desde `develop`; mover el borrador a `openspec/changes/`; registrarlo en `scripts/governance/openspec-scope.json`.
- [x] 0.4 `openspec validate incorporar-trazabilidad-series-productos --strict`.
- [x] 0.5 Línea base: correr las suites API y web completas y guardar los resultados (regresión del POS).

## 1. Base de datos

- [x] 1.1 `V117__product_serials.sql`: `products.requires_serial` + CHECK (D1), `product_serials`, `product_serial_events`, índices (D3).
- [x] 1.2 Funciones `fnc_product_serials_register`, `fnc_product_serials_assign_sale`, `fnc_product_serials_assign_order_delivery`, `prc_product_serials_mark_returned`, `fnc_product_serials_inspect`, `fnc_product_serials_write_off` con errores de prefijo estable (D6).
- [x] 1.3 Seed del menú y permisos `INVENTORY_SERIALS`.
- [x] 1.4 Rollback y prueba SQL (`scripts/database/tests/test_v117_product_serials_migration.py` + escenarios): 51 escenarios y concurrencia de dos transacciones sobre la misma serie, OK en PostgreSQL 16.

## 2. Producto

- [x] 2.1 Specs: reglas D1, campo estructural inmutable, combinación con lote rechazada.
- [x] 2.2 `product.entity.ts`, `product.service.ts` (`PRODUCT_STRUCTURAL_FIELDS`), `product.repository.ts`, DTO y web (`ProductForm`, `ProductOperationalSection`, `payload.ts`, `types.ts`).

## 3. Módulo de series (lectura y prevalidación)

- [ ] 3.1 `inventory/serials`: repositorio, servicio (traducción de errores), controlador, permisos y alcance por sucursal.
- [ ] 3.2 `validate`, `parse` (CSV/XLSX con `exceljs`), disponibilidad, `lookup`, búsqueda, historial, conciliación.

## 4. Recepción de compras

- [ ] 4.1 Specs en `purchase.service.spec.ts`: series = cantidad recibida, parcial, duplicados, idempotencia con series, producto sin serie sin cambios.
- [ ] 4.2 `PurchaseController.receive` mapea `serialNumbers`; `receivePurchase` llama a `registerForReceipt` con el movimiento `IN`.
- [ ] 4.3 Web: diálogo "Registrar series" (escáner, pegado, archivo, manual, vista previa) en `PurchaseReceiveForm`.

## 5. POS y anulaciones (cambio mínimo en venta)

- [ ] 5.1 Specs en `sale.service.spec.ts`: asignación correcta; conteo distinto, otra sucursal o serie vendida → rechazo con rollback total; producto sin serie: mismas llamadas que hoy, más el retorno temprano; replay idempotente.
- [ ] 5.2 `ensureSaleInput` acepta `serialIds`; `createSale` llama a `assignForSale` tras `createSaleWithFunction`. **Verificar en el diff que `inventory_create_sale_v2` no cambia.**
- [ ] 5.3 `cancelSale` y `applySaleVoid` llaman a `markReturnedForSale` / `markVoidedNotReturned`; specs de ambos caminos y del worker.
- [ ] 5.4 Web: `PosCartItem.serialIds`, selector con búsqueda al agregar, cantidad bloqueada, persistencia y reemplazo ante 409.

## 6. Pedidos

- [ ] 6.1 Specs en `order.service.spec.ts`: entrega con series, parcial, rechazo, FEFO intacto para productos con lote.
- [ ] 6.2 `OrderController.deliver` mapea `serialIds`; `deliverOrder` llama a `assignForOrderDelivery` con el `OUT` de cada producto.
- [ ] 6.3 Web: selector de series en `OrderDeliverForm`.

## 7. Ajustes, importación e inspección

- [ ] 7.1 `stock-adjustment.service.ts`: entrada con series nuevas, salida con baja; web `StockAdjustmentForm`.
- [ ] 7.2 `stock-import`: rechazar productos con serie en la prevalidación.
- [ ] 7.3 Inspección y bloqueo: endpoints + `WRITTEN_OFF` con ajuste `OUT`; aviso de unidades devueltas pendientes en POS y entregas.
- [ ] 7.4 Página `/inventory/serials` (búsqueda, historial, inspección, conciliación) y entrada de menú.

## 7b. Ubicación por serie

- [ ] 7b.1 Specs: ubicación en la recepción (por línea y por serie), ubicación de otra sucursal o inactiva rechazada, mover sin movimiento de kardex, producto sin lote ni serie con el rechazo actual, inactivar una ubicación con series en existencia bloqueado.
- [ ] 7b.2 `fnc_product_serials_move_location`, `PATCH /inventory/serials/location`, `locationId` en disponibilidad y búsqueda, conteo en `GET /inventory/locations`.
- [ ] 7b.3 `validateReceiveLotPayload`: permitir `locationId` solo para productos con serie.
- [ ] 7b.4 Web: ubicación en el diálogo de recepción, "SERIE · Ubicación" en los selectores, acción "Mover ubicación", columna en `/inventory/locations`.

## 8. Validación

- [ ] 8.1 `cd api && npx tsx --test src/**/*.spec.ts && npm run build`; `cd web && npm test && npm run lint && npm run build`; comparar con la línea base 0.5.
- [ ] 8.2 QA manual con los escenarios de `specs/trazabilidad-series/spec.md`, más regresión completa de POS (venta, peso, FE, anulación), compras con lote y entregas FEFO.
- [ ] 8.3 Evidencia en `docs/evidencia-incorporar-trazabilidad-series-productos.md`.
