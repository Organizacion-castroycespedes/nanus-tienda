## Why

Los clientes que venden aires acondicionados, electrodomésticos, computadores y herramientas necesitan saber **qué unidad física** entró, en qué sucursal está, cuándo se vendió y a qué cliente se entregó: para garantías, reclamos y control de pérdidas. Hoy MANUS solo controla cantidades (kardex) y lotes. No existe ningún modelo de series: `git grep` de `serial_number|requires_serial` en `develop` @ `2c07b94f` no encuentra nada, y la evaluación enterprise de `modernizar-inventario-lotes-ubicaciones/design.md` la registra como capacidad "Nueva".

Discovery completo: proyecto "manus tienda", `claude/series-productos-discovery.md`. Decisiones: `claude/series-productos-decisiones.md`.

## What Changes

- **Producto:** nuevo indicador estructural `requires_serial`. Solo se puede marcar al crear el producto, y solo en productos inventariables, de venta por unidad (`UNIT`/`UND`) y **sin lote** (`requires_lot = false`).
- **Registro de series:** tablas nuevas `product_serials` (estado actual) y `product_serial_events` (historial de solo inserción). La serie es única por tenant + producto.
- **Recepción de compras:** cada línea de un producto con serie exige tantas series como unidades se reciben, ingresadas con escáner, pegado masivo, archivo CSV/XLSX con prevalidación, o a mano.
- **POS:** al vender un producto con serie se eligen las series disponibles de la sucursal, con buscador. Pasan a `SOLD` en la misma transacción de la venta.
- **Pedidos:** las series se eligen al **entregar** (`deliverOrder`) y pasan a `SOLD`. No hay reservas.
- **Anulaciones:** al anular una venta con retorno de inventario, las series pasan a `RETURNED`. Un **flujo de inspección** las mueve a `AVAILABLE`, `BLOCKED` o `WRITTEN_OFF`.
- **Ubicación por serie:** cada serie puede tener una ubicación física (`inventory_locations`) de su sucursal. Se asigna al recibir y se cambia con la acción "Mover ubicación", que queda en el historial y no mueve el kardex. El selector de series muestra la ubicación.
- **Ajustes de inventario:** una entrada registra series nuevas; una salida indica qué series se dan de baja.
- **Consulta:** página de trazabilidad por serie con historial y conciliación series ↔ kardex.
- **Aislamiento del proceso de venta (regla del propietario):** toda la lógica vive en funciones almacenadas nuevas (`fnc_`/`prc_`) y en un módulo nuevo `inventory/serials`. `inventory_create_sale_v2`, `consumeDeliveryLots` y FEFO **no se modifican**. Los servicios de venta y entrega solo reciben un llamado a esas funciones, que no hace nada cuando la operación no tiene productos con serie.

## Capabilities

### New Capabilities

- `trazabilidad-series`: registro, unicidad, estados, historial, asignación en venta y entrega, retorno e inspección, ajustes, consulta y conciliación de series.

### Modified Capabilities

- `productos`: se agrega el requisito "Producto con serie obligatoria".
- `inventario`: se agrega el requisito "Movimientos de productos con serie".

## Fuera de alcance (fases posteriores)

- Serie en ticket y factura electrónica.
- Productos con lote y serie a la vez.
- Activar la serie en productos existentes (regularización).
- Reservas de series en pedidos.
- Traslados entre sucursales.
- Garantías.
- Columna de serie en la importación de stock o de productos.

## Dependencias

- `idempotencia-entrega-pedidos` mergeado antes de la fase de pedidos.

## Impact

- BD: `V117__product_serials.sql` + rollback (columna en `products`, dos tablas, índices, funciones `fnc_`/`prc_`).
- API: módulo nuevo `api/src/modules/inventory/serials/`; llamados mínimos en `product.service.ts`, `purchase.service.ts` + `purchase.controller.ts`, `sale.service.ts` (`ensureSaleInput`, `createSale`, `cancelSale`), `operational-sales.service.ts` (`applySaleVoid`), `order.service.ts` + `order.controller.ts` (`deliverOrder`), `stock-adjustment.service.ts`, `stock-import`.
- Web: `ProductForm`, `PurchaseReceiveForm`, `PosScreen` + `store/posCart.ts`, `OrderDeliverForm`, `StockAdjustmentForm`, página nueva `/inventory/serials`, captura de series con `barcode/*`.
- RBAC: reutiliza `INVENTORY_PURCHASES`, `POS`, `ORDERS` e `INVENTORY`; clave de menú nueva `INVENTORY_SERIALS` (seed).
