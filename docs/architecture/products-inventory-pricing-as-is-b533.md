# Productos, inventario, precios, impuestos y promociones AS-IS — B5.3.3

## Alcance

Esta ficha describe el código observado en `83266f361e0ef5c53219e19dbc8756f71b4fc7e6`.
No sustituye B4.1, B5.3.1 ni B5.3.2. Las rutas de POS, compras, pedidos y
ventas operativas se comparan, pero no se presentan como un único motor.

## Productos y catálogo

`ProductController` expone `POST /products`, `GET /products`,
`GET /products/:id`, historial y cambio de precio, actualización y eliminación.
El servicio trabaja por `tenantId`; la consulta de catálogo incorpora códigos
de barras activos y puede consultar stock por sucursal.

El modelo observado incluye precio base, `priceWithTax`, `priceWithoutTax`,
unidad, impuesto puente, asignaciones multiimpuesto, perfil fiscal, SKU,
barcodes y clasificación. La migración de productos añade estados
`ACTIVE`, `INACTIVE`, `BLOCKED` y `DISCONTINUED`, además de control de
perishable, lote, vencimiento, rotación y mínimos/máximos.

El cambio de precio tiene ruta dedicada y registra historial. El servicio
bloquea campos protegidos cuando se intenta modificar el precio por una ruta
distinta. La creación y actualización resuelven impuestos y pueden recalcular
precios derivados; las pruebas del servicio comprueban commit y rollback.

## Inventario y lotes

El modelo versionado separa:

- `stock_movements`: hecho de movimiento.
- `stock_movement_lots`: distribución del movimiento por lote y ubicación.
- `inventory_lots`: lote, proveedor, compra, vencimiento, costo y estado.
- `inventory_lot_balances`: saldo por tenant, sucursal, producto, lote y
  ubicación.
- `inventory_locations`: ubicación activa dentro de una sucursal.

El saldo disponible se deriva como `quantity_on_hand - quantity_reserved`.
El servicio rechaza cantidades negativas, reservas superiores al disponible y
decrementos superiores al disponible. Esto demuestra controles en el servicio;
no certifica que todas las rutas históricas usen exactamente la misma capa.

Se observan operaciones de recepción de compra, venta, ajustes y pedidos con
servicios de movimientos. B4.1 documenta la venta POS y B5.3.1 documenta
compras y pedidos. Este documento no extiende la atomicidad de una ruta a otra.

## FEFO

`InventoryFefoService` exige producto con control de lote, valida tenant,
sucursal, ubicación y acceso de sucursal, excluye saldos sin disponibilidad,
lotes `BLOCKED`, `CANCELLED`, `CONSUMED` y lotes vencidos. Ordena por fecha de
vencimiento ascendente, fecha de recepción, código e identificador, y puede
seleccionar cantidades parciales de varios lotes.

Si el producto exige vencimiento y un saldo elegible carece de fecha, rechaza
la inconsistencia. El controlador expone `GET /inventory/fefo/preview`.
Las pruebas `inventory-fefo.service.spec.ts` verifican selección múltiple,
exclusión de vencidos y estados no elegibles. La prueba de preview no equivale
por sí sola a certificación de consumo en cada flujo comercial.

## Pricing e impuestos

`PricingController` expone `POST /pricing/preview-line` y
`POST /pricing/fiscal-preview`. `PricingService` acepta canales `POS` y
`ORDER`, valida tenant, sucursal, producto y cantidad, obtiene un snapshot de
producto por fecha y consulta funciones SQL de impuestos del producto.

La lógica observada:

- redondea moneda a dos decimales;
- distingue precio visible con impuesto y precio sin impuesto;
- conserva base, tasa, importe, orden e inclusión de cada impuesto;
- soporta impuesto porcentual, importe fijo, ad valorem y cálculo por grado
  alcohólico/volumen cuando el perfil fiscal tiene los datos requeridos;
- rechaza perfiles incompletos para impuestos especiales;
- genera una previsualización de línea, no una prueba de aceptación fiscal.

La migración `V078__sale_item_taxes_multi_tax_snapshot.sql` agrega columnas
fiscales a `sale_item_taxes`, crea `order_item_taxes` y modifica la función
`inventory_create_sale_v2`. Esto demuestra snapshots fiscales versionados en
flujos concretos, no equivalencia fiscal automática de todos los documentos.

## Promociones

`PromotionsController` expone administración bajo `pricing/promotions`:
consulta, detalle, creación, actualización y desactivación. Las promociones
son `PRODUCT_DISCOUNT` y admiten `PERCENTAGE`, `FIXED_AMOUNT` y
`SPECIAL_PRICE`. Validan rango temporal, prioridad, valor y pertenencia de
productos y sucursales al tenant.

`PricingRepository.findApplicablePromotions` filtra tenant, producto, vigencia,
activo y sucursal. Sin sucursales asociadas la promoción aplica al tenant; con
sucursales, requiere coincidencia. Ordena por prioridad ascendente, fecha de
creación descendente e identificador.

`PricingService` calcula candidatos, limita descuentos al precio base y elige
un candidato. El campo `isStackable` existe en modelo y administración, pero
la selección observada aplica una promoción elegida; no se documenta
acumulación múltiple como comportamiento confirmado.

## Relaciones entre dominios

| Dominio | Fuente de precio/impuesto | Efecto de inventario | Snapshot |
|---|---|---|---|
| POS | pricing para canal `POS` y datos del producto | venta, movimiento y lotes según B4.1 | venta y líneas |
| Pedido | pricing para canal `ORDER`; snapshot de ítem en migraciones | entrega o facturación según B5.3.1 | `order_items`/impuestos |
| Compra | costos y recepción del flujo de compras | recepción y lotes | compra, ítems y costo |
| Venta operativa | lectura y recuperación de ventas existentes | no se trata como creación POS | documento existente |

Las diferencias de cálculo o persistencia entre estas rutas requieren pruebas
de integración. No se afirma que frontend y backend calculen siempre el mismo
resultado ni que una promoción se aplique en todos los canales.

## Fuentes principales

- `api/src/modules/inventory/controllers/product.controller.ts`
- `api/src/modules/inventory/services/product.service.ts`
- `api/src/modules/inventory/services/inventory-fefo.service.ts`
- `api/src/modules/inventory/services/inventory-lot-balance.service.ts`
- `api/src/modules/inventory/services/stock-movement.service.ts`
- `api/src/modules/inventory/services/stock-adjustment.service.ts`
- `api/src/modules/inventory/services/sale.service.ts`
- `api/src/modules/inventory/services/purchase.service.ts`
- `api/src/modules/inventory/controllers/inventory.controller.ts`
- `api/src/modules/inventory/controllers/inventory-lot.controller.ts`
- `api/src/modules/inventory/controllers/inventory-fefo.controller.ts`
- `api/src/modules/pricing/pricing.service.ts`
- `api/src/modules/pricing/pricing.repository.ts`
- `api/src/modules/pricing/promotions.service.ts`
- `api/src/modules/pricing/promotions.repository.ts`
- `scripts/database/migrations/20260601_inventory_products_lots_phase_1.sql`
- `scripts/database/migrations/20260605_pricing_promotions_phase_1.sql`
- `scripts/database/migrations/V078__sale_item_taxes_multi_tax_snapshot.sql`
- `scripts/database/migrations/V086__sale_creation_idempotency.sql`
