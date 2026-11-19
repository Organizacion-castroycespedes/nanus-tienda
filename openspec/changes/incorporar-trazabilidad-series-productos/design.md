## Context

Evidencia (`develop` @ `2c07b94f`, 2026-11-14):

- `ProductService` define `PRODUCT_STRUCTURAL_FIELDS` y `assertStructuralConfigurationUnchanged`: `requiresLot` y otros campos no se pueden cambiar tras la creación.
- `PurchaseService.receivePurchase` hace todo en una transacción: compra `FOR UPDATE`, idempotencia, `lockReceiptProductScopes`, `OUT/IN` por línea, vínculo de lote. `PurchaseController.receive` mapea cada campo del item de forma explícita.
- `SaleService.createSale`: transacción con `createSaleWithFunction` (`inventory_create_sale_v2`, que descuenta stock y consume FEFO) seguida de consumo de capturas de peso con `saleItemId` pregenerado. `buildSaleIdempotencyHash` serializa toda la petición.
- Anulaciones: `SaleService.cancelSale` y `OperationalSalesService.applySaleVoid` (`returnInventory`); ambas son totales.
- Pedidos: el stock sale en `deliverOrder` (`OUT` + `consumeDeliveryLots`); `confirmOrder` no reserva; `cancelOrder` solo aplica a DRAFT.
- Concurrencia: `inventory_lock_stock_scope` (advisory lock por tenant/sucursal/producto, V108) se toma en cada `INSERT` de `stock_movements`.
- No existen traslados entre sucursales (`STOCK_REFERENCE_TYPES = PURCHASE, SALE, ADJUSTMENT`).

## Goals / Non-Goals

**Goals**
- Trazabilidad unidad por unidad: recepción → disponibilidad → venta o entrega → cliente → retorno e inspección.
- Cero cambios de comportamiento para productos sin serie.
- No permitir dobles ventas de una serie.

**Non-Goals:** ver "Fuera de alcance" en `proposal.md`.

## Decisions

### D1. Campo de producto
`products.requires_serial boolean NOT NULL DEFAULT false`, agregado a `PRODUCT_STRUCTURAL_FIELDS`. CHECK en la BD y validación en la entidad:
- `requires_serial ⇒ is_inventoryable`
- `requires_serial ⇒ sale_type = 'UNIT' AND measurement_unit = 'UND'`
- `requires_serial ⇒ NOT requires_lot`

Las cantidades de líneas con serie deben ser enteras.

### D2. Por qué no se permite lote + serie en el MVP
FEFO (`inventory_create_sale_v2`, `consumeDeliveryLots`) elige el lote sin saber qué unidad salió. Si la serie elegida es de otro lote, los saldos de lote divergen de la realidad. Corregirlo exige que la serie determine el lote, es decir, modificar la función de venta, cosa que la regla del propietario prohíbe. Odoo y SAP Business One también tratan lote y serie como opciones excluyentes por artículo; Dynamics 365 sí los combina. Se podrá habilitar en un change posterior.

### D3. Modelo de datos
`product_serials`:
- `id uuid PK`, `tenant_id`, `product_id`, `branch_id`, `location_id uuid NULL` (FK a `inventory_locations`), `serial_number varchar(100)`, `serial_number_normalized varchar(100)` (trim + mayúsculas)
- `status` (`AVAILABLE | SOLD | RETURNED | BLOCKED | WRITTEN_OFF`), `version int`
- Origen: `source_type` (`PURCHASE | ADJUSTMENT`), `purchase_id`, `purchase_item_id`, `in_stock_movement_id`, `received_at`
- Destino: `sale_id`, `sale_item_id`, `order_id`, `order_item_id`, `out_stock_movement_id`, `customer_id`, `sold_at`
- `created_by`, `created_at`, `updated_at`

Índices:
- `UNIQUE (tenant_id, product_id, serial_number_normalized)` **sin filtro de estado**: una unidad que vuelve cambia de estado, no se registra de nuevo.
- `(tenant_id, product_id, branch_id, status)` para disponibilidad.
- `(tenant_id, serial_number_normalized text_pattern_ops)` para búsqueda por prefijo.
- `(tenant_id, branch_id, location_id, status)` para conteos por ubicación.

`product_serial_events` (solo inserción): `id`, `tenant_id`, `serial_id`, `event_type` (`RECEIVED`, `SOLD`, `DELIVERED`, `RETURNED`, `VOIDED_NOT_RETURNED`, `INSPECTED_AVAILABLE`, `BLOCKED`, `UNBLOCKED`, `WRITTEN_OFF`, `LOCATION_CHANGED`), `from_status`, `to_status`, `branch_id`, `from_location_id`, `to_location_id`, `reference_type`, `reference_id`, `stock_movement_id`, `user_id`, `reason`, `created_at`.

### D4. Unicidad por tenant + producto
Distintos fabricantes pueden repetir números de serie; una unicidad global bloquearía recepciones válidas. Dentro del producto, una serie repetida sí es un error. La prevalidación devuelve una **advertencia que no bloquea** cuando la serie ya existe en otro producto del tenant, para detectar escaneos en el producto equivocado.

### D5. Aislamiento del proceso de venta (regla del propietario)
- La lógica vive en funciones almacenadas nuevas y en `inventory/serials` (`ProductSerialService`, `ProductSerialRepository`, `ProductSerialController`).
- **No se modifican** `inventory_create_sale_v2`, `consumeDeliveryLots`, la selección FEFO, los precios, los pagos ni la facturación.
- Llamados en código existente (lista cerrada):

| Archivo / método | Cambio |
|---|---|
| `sale.service.ts` `ensureSaleInput` | Aceptar `serialIds?: string[]` opcional por línea (forma: arreglo de uuid sin repetidos). |
| `sale.service.ts` `createSale` | Un llamado a `ProductSerialService.assignForSale(client, …)` después de `createSaleWithFunction`, en la misma transacción. |
| `sale.service.ts` `cancelSale` | Un llamado a `markReturnedForSale(client, …)` después de revertir el stock. |
| `operational-sales.service.ts` `applySaleVoid` | Un llamado a `markReturnedForSale` o `markVoidedNotReturned` según `returnInventory`. |
| `order.controller.ts` `deliver`, `order.service.ts` `deliverOrder` | Mapear `serialIds` y llamar a `assignForOrderDelivery(client, …)` con el movimiento `OUT` de cada producto. |
| `purchase.controller.ts` `receive`, `purchase.service.ts` `receivePurchase` | Mapear `serialNumbers` (y `serialLocations` opcional) y llamar a `registerForReceipt(client, …)` con el movimiento `IN` de cada línea. `validateReceiveLotPayload` hoy rechaza `locationId` en productos sin lote ("lot data is not allowed…"): se permite `locationId` **solo** para productos con serie, y se pasa a las series. Para los demás productos sin lote el rechazo sigue igual. |
| `stock-adjustment.service.ts` | Entrada: `registerForAdjustment`; salida: `writeOffForAdjustment`. |
| `product.service.ts`, `product.entity.ts`, `product.repository.ts` | Campo estructural y reglas D1. |
| `stock-import` | Rechazar productos con serie (fuera de alcance del MVP). |

- Cada función de series **retorna de inmediato** si la operación no tiene productos con serie ni `serialIds`. Para productos sin serie, el costo adicional es una consulta indexada (`sale_items ⋈ products WHERE requires_serial`).

### D6. Funciones almacenadas (convención V079)
- `fnc_product_serials_move_location(p_tenant, p_serial_ids uuid[], p_location_id uuid, p_user, p_reason)`: valida que la ubicación esté activa y sea de la misma sucursal que cada serie, que las series estén en `AVAILABLE`, `RETURNED` o `BLOCKED`, actualiza `location_id` y registra `LOCATION_CHANGED`. No crea movimientos de inventario.
- `fnc_product_serials_register(p_tenant, p_branch, p_product, p_source_type, p_source_id, p_source_item_id, p_stock_movement_id, p_serials jsonb /* [{serial, locationId?}] */, p_default_location_id, p_user)`: valida que cada ubicación sea activa y de la sucursal, normaliza, rechaza duplicados (en la carga y en la BD) e inserta las series `AVAILABLE` con el evento `RECEIVED`. Devuelve los ids.
- `fnc_product_serials_assign_sale(p_tenant, p_branch, p_sale_id, p_lines jsonb, p_user)`: verifica que **cada** `sale_item` de producto con serie tenga exactamente `quantity` series, que pertenezcan al producto y a la sucursal y que estén `AVAILABLE`; las pasa a `SOLD` y registra el evento `SOLD`.
- `fnc_product_serials_assign_order_delivery(p_tenant, p_branch, p_order_id, p_lines jsonb, p_user)`: lo mismo, por línea entregada, con el evento `DELIVERED` y `out_stock_movement_id`.
- `prc_product_serials_mark_returned(p_tenant, p_sale_id, p_return_inventory boolean, p_user, p_reason)`: con retorno: `SOLD → RETURNED` (evento `RETURNED`); sin retorno: queda `SOLD` con el evento `VOIDED_NOT_RETURNED`.
- `fnc_product_serials_inspect(p_tenant, p_serial_id, p_result, p_reason, p_user, p_stock_movement_id)`: `RETURNED|BLOCKED → AVAILABLE|BLOCKED|WRITTEN_OFF`, con motivo obligatorio.
- `fnc_product_serials_write_off(p_tenant, p_branch, p_product, p_serial_ids uuid[], p_stock_movement_id, p_user, p_reason)`: baja por ajuste de salida.

Errores con prefijo estable (`SERIAL_NOT_AVAILABLE`, `SERIAL_COUNT_MISMATCH`, `SERIAL_DUPLICATE`, `SERIAL_WRONG_BRANCH`, `SERIAL_REQUIRED`), traducidos a 409/400 en `ProductSerialService` y a mensajes en español en la web.

### D6b. Ubicación por serie
Las ubicaciones hoy solo existen a través del lote (`inventory_lot_balances.location_id`), y la recepción rechaza `locationId` en productos sin lote. Como el producto con serie no lleva lote, la ubicación vive en la serie. Reglas:
- La ubicación es opcional.
- Debe estar activa y pertenecer a la sucursal de la serie.
- Cambiarla no crea movimientos de inventario (misma sucursal).
- Una venta o baja conserva la última ubicación como dato histórico.
- Inactivar una ubicación que tiene series en existencia se bloquea con un mensaje claro.

### D7. Concurrencia
Las transiciones usan `UPDATE … WHERE id = ANY($ids) AND status = 'AVAILABLE' AND branch_id = $b AND product_id = $p RETURNING id`. Si el número de filas no coincide, se lanza `SERIAL_NOT_AVAILABLE` y se hace `ROLLBACK` de toda la operación (venta, pagos, FE encolada). Con READ COMMITTED, la transacción concurrente espera el bloqueo de fila y vuelve a evaluar `status`. Además, el advisory lock de V108 ya serializa por producto y sucursal.

### D8. Retorno e inspección
`RETURNED` cuenta como existencia (el kardex ya sumó la unidad al anular), pero no se puede vender. La inspección decide el destino:
- `AVAILABLE`: vendible de nuevo.
- `BLOCKED`: sigue en existencia, no vendible; puede volver a `AVAILABLE` o ir a `WRITTEN_OFF`.
- `WRITTEN_OFF`: crea en la misma transacción un ajuste `OUT` de 1 unidad (`referenceType ADJUSTMENT`) y enlaza `out_stock_movement_id`.

La web muestra el aviso "Hay N unidades devueltas pendientes de inspección" cuando el stock es mayor que las series disponibles.

### D9. Invariante y conciliación
Para cada (producto con serie, sucursal): `#series en {AVAILABLE, RETURNED, BLOCKED}` = existencia del kardex. Un reporte de solo lectura (patrón `inventory-lot-reconciliation`) lista las diferencias.

### D10. Contratos HTTP (nuevos o extendidos)
- `POST /purchases/:id/receive`: `items[].serialNumbers?: string[]` (incluido en el hash de idempotencia porque viaja en los items mapeados).
- `POST /sales`: `items[].serialIds?: string[]`. `POST /orders/:id/deliver`: `items[].serialIds?: string[]`.
- `POST /inventory/stock-adjustments`: `serialNumbers` (entrada) o `serialIds` (salida).
- Lectura y prevalidación (fase 3, controlador `inventory/serials`; el de productos vive en `/products`):
  - `POST /inventory/serials/validate` `{productId, branchId, serialNumbers[]}` → `{total, valid, invalidFormat, duplicatesInPayload, alreadyRegistered, existsInOtherProduct, ok}` (solo lectura, máximo 2000).
  - `POST /inventory/serials/parse` (multipart `file`: .csv/.txt una serie por línea, o .xlsx con columna "Serie" o la primera columna; máximo 2 MB y 2000 series) → `{serialNumbers}`.
  - `GET /inventory/serials/available?productId&branchId&status=AVAILABLE&search&limit&offset`.
  - `GET /inventory/serials/lookup?serial&branchId&productId` (búsqueda exacta para escaneo).
  - `GET /inventory/serials?search&productId&branchId&status&limit&offset` y `GET /inventory/serials/:id/history`.
- `POST /inventory/serials/:id/inspection` `{result, reason}`; `PATCH /inventory/serials/:id/block|unblock` `{reason}`.
- `GET /inventory/serials/reconciliation?branchId`.
- `PATCH /inventory/serials/location` `{serialIds[], locationId, reason?}` (mover una o varias series).
- La disponibilidad y la búsqueda devuelven `locationId`, `locationCode` y `locationName`, y aceptan el filtro `locationId`. `GET /inventory/locations` agrega el conteo de series por ubicación (solo lectura).

RBAC:
- Recepción: `INVENTORY_PURCHASES WRITE`. Venta: `POS WRITE`. Entrega: `ORDERS WRITE`.
- Disponibilidad y búsqueda: `POS READ` o `ORDERS READ` o `INVENTORY READ`.
- Inspección, bloqueo y conciliación: `INVENTORY_SERIALS WRITE/READ` (seed nuevo, roles `SUPER_ADMIN`, `SUPER_USER`, `ADMIN`).
- Toda consulta se filtra por `tenant_id` y por las sucursales permitidas al actor.

### D11. Web
- `ProductForm` / `ProductOperationalSection`: casilla "Requiere número de serie" (deshabilitada al editar; mutuamente excluyente con "Requiere lote").
- `PurchaseReceiveForm`: diálogo "Registrar series" por línea:
  - contador N de M;
  - modo escáner (el wedge HID escribe en el campo de serie, Enter avanza, el deduper evita lecturas dobles);
  - pegado de varias líneas;
  - archivo CSV/XLSX;
  - vista previa de errores mediante `validate`.
  El botón Recibir se habilita solo con todas las series válidas.
- POS (`PosScreen`, `store/posCart.ts`): `PosCartItem.serialIds?: string[]` y `serialLabels`. Al agregar un producto con serie se abre el selector (`SearchableSelect`, búsqueda en el servidor); la cantidad es igual al número de series y el stepper queda bloqueado. El carrito persiste las series y, ante un 409, pide reemplazar la serie.
- `OrderDeliverForm`: selector de series por línea con producto con serie.
- `StockAdjustmentForm`: captura de series (entrada) o selección (salida).
- Ubicación:
  - en el diálogo de recepción, una ubicación por línea con cambio opcional por serie (reutiliza `SearchableSelect` y el servicio `inventory-location.service.ts`);
  - en los selectores de POS y entrega se muestra "SERIE · Ubicación";
  - acción "Mover ubicación" (una o varias series);
  - columna "Unidades con serie" en `/inventory/locations`.
- `/inventory/serials`: búsqueda (con filtro por ubicación), estado, historial, inspección y bloqueo, mover ubicación, conciliación.

## Risks / Trade-offs

- **Llamado en `createSale`:** si la función de series falla por un defecto, la venta se revierte. Mitigación: retorno temprano sin productos con serie, pruebas de regresión del POS completas, QA dedicado.
- **Rendimiento:** una consulta adicional por venta; se mide en QA.
- **Carrito persistido:** series vendidas por otra caja mientras tanto; se resuelve con un 409 y un reemplazo guiado.
- **Facturación de pedidos:** anular la venta de un pedido no devuelve stock (comportamiento actual), así que las series quedan `SOLD`, coherentes con el kardex.
- **Posible error existente en `assertCanSkipLottedReversal`** (ventas de pedido con producto con lote): no aplica a series porque lote + serie queda prohibido.

## Migration Plan

1. `V117__product_serials.sql`: columna y CHECK en `products`, tablas, índices, funciones; seed del menú `INVENTORY_SERIALS` y sus permisos.
2. Rollback: DROP de las funciones, tablas y columna (solo si no hay series registradas).
3. Sin datos históricos: solo productos nuevos.

## Open Questions

Resueltas con valores por defecto (2026-11-14, el propietario puede cambiarlas):
- **Formato de la serie:** 1–100 caracteres; tras normalizar (trim + mayúsculas) solo `[A-Z0-9\-_/.]`. Se valida en la función de BD y en el servicio.
- **Inspección de devoluciones y bloqueo:** `INVENTORY_SERIALS WRITE` para `SUPER_ADMIN`, `SUPER_USER` y `ADMIN` (seed de V117). Sin rol adicional.
